import { useEffect, useRef, useState } from "react";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import WorkOrderCard from "./WorkOrderCard";
import WorkOrderDetails from "./WorkOrderDetails";
import PlaceOrderForm from "../../components/PlaceOrderForm";
import formatDisplayValue from "./formatDisplayValue";
import "../../styles/worker.css";

const EMPTY_LIST = [];

const getItemTasks = (order) => {
  if (!Array.isArray(order?.products)) return [];

  return order.products.flatMap((item) =>
    Array.isArray(item.tasks)
      ? item.tasks.map((task) => ({ item, task }))
      : []
  );
};

const hasAssignedCurrentTask = (order) => {
  const itemTasks = getItemTasks(order);
  if (
    itemTasks.some(
      ({ task }) => task.assigned_to_me === true && task.status === "in_progress"
    )
  ) {
    return true;
  }

  const currentTask = order?.my_task;
  return (
    currentTask?.assigned_to_me === true &&
    currentTask?.status === "in_progress"
  );
};

export default function WorkerDashboard() {
  const [orders, setOrders] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [billingItems, setBillingItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lifecycleLoading, setLifecycleLoading] = useState(true);
  const [lifecycleLoadError, setLifecycleLoadError] = useState("");
  const [lifecycleNotice, setLifecycleNotice] = useState("");
  const [activeTab, setActiveTab] = useState("queue");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showPlaceOrder, setShowPlaceOrder] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ordersRequestId = useRef(0);
  const lifecycleRequestId = useRef(0);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const loadOrders = async () => {
    const requestId = ++ordersRequestId.current;
    try {
      const res = await api.get("worker/workorders/");
      if (requestId !== ordersRequestId.current) return;
      setOrders(Array.isArray(res.data) ? res.data : []);
      setLoadError("");
    } catch (err) {
      if (requestId !== ordersRequestId.current) return;
      console.log(err);
      setLoadError(
        err.response?.data?.detail ||
          "Could not load orders. Check the API connection and sign in again if needed."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadLifecycleData = async () => {
    const requestId = ++lifecycleRequestId.current;
    const results = await Promise.allSettled([
      api.get("worker/delivery-items/"),
      api.get("worker/billing-items/"),
      api.get("worker/history/"),
    ]);
    if (requestId !== lifecycleRequestId.current) {
      return { stale: true, deliveryLoaded: false, deliveryItems: [] };
    }
    const setters = [setDeliveryItems, setBillingItems, setHistoryItems];
    let firstError = "";
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        setters[index](Array.isArray(result.value.data) ? result.value.data : []);
      } else if (!firstError) {
        firstError = result.reason.response?.data?.detail || "Delivery, billing, or history could not be loaded.";
      }
    });
    setLifecycleLoadError(firstError);
    setLifecycleLoading(false);
    const deliveryResult = results[0];
    return {
      stale: false,
      deliveryLoaded: deliveryResult.status === "fulfilled" && Array.isArray(deliveryResult.value.data),
      deliveryItems: deliveryResult.status === "fulfilled" && Array.isArray(deliveryResult.value.data)
        ? deliveryResult.value.data
        : [],
    };
  };

  const refreshAfterTaskChange = async (change) => {
    const [, lifecycleResult] = await Promise.all([loadOrders(), loadLifecycleData()]);
    if (
      change?.action === "complete" &&
      change.orderItemId != null &&
      lifecycleResult?.deliveryLoaded &&
      lifecycleResult.deliveryItems.some(
        (item) => Number(item.order_item_id) === Number(change.orderItemId)
      )
    ) {
      setActiveTab("delivery");
      setExpandedOrder(change.orderItemId);
      setMobileNavOpen(false);
    }
  };

  const handleLifecycleChange = async (message) => {
    setLifecycleNotice(message);
    await loadLifecycleData();
  };

  const handlePlaceOrderSuccess = async () => {
    setShowPlaceOrder(false);
    await loadOrders();
  };

  useEffect(() => {
    loadOrders();
    loadLifecycleData();
    const interval = setInterval(() => {
      loadOrders();
      loadLifecycleData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const queueOrders = orders.filter(hasAssignedCurrentTask);
  const historicalOrderItemIds = new Set(
    historyItems
      .map((item) => item.order_item_id)
      .filter((id) => id !== null && id !== undefined)
      .map(String)
  );
  const allOrders = orders.flatMap((order) => {
    const products = Array.isArray(order.products) ? order.products : null;
    if (!products || products.length === 0) return [order];

    const currentProducts = products.filter((item) =>
      item.id === null || item.id === undefined || !historicalOrderItemIds.has(String(item.id))
    );
    if (currentProducts.length === products.length) return [order];
    if (currentProducts.length === 0) return [];
    return [{ ...order, products: currentProducts }];
  });
  const overdueOrders = orders.filter(
    (order) => order.priority === "overdue"
  );

  const tabContent = {
    queue: {
      title: "My Queue",
      description: "Work currently assigned to you.",
      orders: queueOrders,
      mode: "queue",
      empty: "No tasks are currently assigned to you.",
    },
    orders: {
      title: "All Orders",
      description: "Orders and task information returned by the work-order API.",
      orders: allOrders,
      mode: "all",
      empty: "No orders are available.",
    },
    delivery: {
      title: "Delivery",
      description: "Production-complete items awaiting delivery confirmation.",
      items: deliveryItems,
      mode: "delivery",
      empty: "No order items are ready for delivery.",
    },
    billing: {
      title: "Billing",
      description: "Delivered items awaiting billing or payment confirmation.",
      items: billingItems,
      mode: "billing",
      empty: "No delivered items need billing or payment action.",
    },
    history: {
      title: "History",
      description: "Items with billing completed, including payment history.",
      items: historyItems,
      mode: "history",
      empty: "No items have completed billing yet.",
    },
    overdue: {
      title: "Overdue",
      description: "Orders marked overdue by the existing work-order response.",
      orders: overdueOrders,
      mode: "overdue",
      empty: "No overdue orders are available.",
    },
  };

  const tabs = [
    { id: "queue", label: "My Queue", count: queueOrders.length },
    { id: "orders", label: "All Orders", count: allOrders.length },
    { id: "delivery", label: "Delivery", count: deliveryItems.length },
    { id: "billing", label: "Billing", count: billingItems.length },
    { id: "history", label: "History", count: historyItems.length },
    { id: "overdue", label: "Overdue", count: overdueOrders.length },
  ];

  const currentView = tabContent[activeTab];
  const isMasterDetailView = activeTab === "queue" || activeTab === "orders";
  const isLifecycleView = ["delivery", "billing", "history"].includes(activeTab);
  const currentOrders = currentView.orders || EMPTY_LIST;
  const currentItems = currentView.items || EMPTY_LIST;
  const currentRecordCount = isLifecycleView ? currentItems.length : currentOrders.length;
  const viewLoading = isLifecycleView ? lifecycleLoading : loading;
  const viewError = isLifecycleView ? lifecycleLoadError : loadError;
  const activeQueueTaskCount = queueOrders.reduce((total, order) => {
    const assignedItemTasks = getItemTasks(order).filter(
      ({ task }) =>
        task.assigned_to_me === true && task.status === "in_progress"
    ).length;
    return total + (assignedItemTasks || Number(
      order.my_task?.assigned_to_me === true &&
      order.my_task?.status === "in_progress"
    ));
  }, 0);
  const selectedOrder =
    currentOrders.find((order) => order.order_id === selectedOrderId) ||
    currentOrders[0] ||
    null;
  const role = formatDisplayValue(localStorage.getItem("role"), "Worker");

  useEffect(() => {
    if (!isMasterDetailView) return;

    setSelectedOrderId((currentId) =>
      currentOrders.some((order) => order.order_id === currentId)
        ? currentId
        : currentOrders[0]?.order_id ?? null
    );
  }, [currentOrders, isMasterDetailView]);

  return (
    <main className="worker-page">
      <div className="worker-layout">
        <aside className="worker-sidebar" aria-label="Worker navigation">
          <div className="worker-sidebar__top">
            <div className="worker-sidebar__brand">
              <div className="worker-brand__mark" aria-hidden="true">
                <span />
              </div>
              <div>
                <strong>D2 Print</strong>
                <span>WORKFLOW SYSTEM</span>
              </div>
            </div>
            <button
              type="button"
              className="worker-sidebar__mobile-toggle"
              aria-expanded={mobileNavOpen}
              aria-controls="worker-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span aria-hidden="true">☰</span> {currentView.title}
            </button>
          </div>

          <div id="worker-navigation" className={`worker-sidebar__navigation${mobileNavOpen ? " is-open" : ""}`}>
            <p className="worker-sidebar__heading">WORKER AREA</p>
            <nav
              className="worker-sidebar__nav"
              role="tablist"
              aria-label="Work views"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`worker-sidebar__tab${activeTab === tab.id ? " is-active" : ""}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setExpandedOrder(null);
                    setShowPlaceOrder(false);
                    setMobileNavOpen(false);
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="worker-sidebar__count">{tab.count}</span>
                </button>
              ))}
            </nav>
          </div>
          <button
            type="button"
            className={`worker-sidebar__place-order${showPlaceOrder ? " is-active" : ""}`}
            aria-expanded={showPlaceOrder}
            onClick={() => setShowPlaceOrder((visible) => !visible)}
          >
            <span aria-hidden="true">＋</span> Place order
          </button>
          <div className="worker-sidebar__identity">
            <span className="worker-sidebar__avatar" aria-hidden="true">
              {role.charAt(0)}
            </span>
            <span>
              <strong>{role}</strong>
              <small>Signed in</small>
            </span>
            <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              ↗
            </button>
          </div>
        </aside>

        <section className="worker-workspace">
          <section className="worker-content">
          {showPlaceOrder ? (
            <section className="worker-place-order-panel">
              <div className="worker-place-order-panel__heading">
                <div>
                  <p className="worker-breadcrumb">WORKSPACE <span>›</span> PLACE ORDER</p>
                  <h2>Place Order</h2>
                </div>
                <button
                  type="button"
                  className="worker-place-order-panel__close"
                  onClick={() => setShowPlaceOrder(false)}
                >
                  Close
                </button>
              </div>
              <div className="worker-place-order-panel__form">
                <PlaceOrderForm onSuccess={handlePlaceOrderSuccess} showHeading={false} />
              </div>
            </section>
          ) : (
          <>
          <div className="worker-section-heading">
            <div>
              <p className="worker-breadcrumb">WORKSPACE <span>›</span> {currentView.title.toUpperCase()}</p>
              <h2>{currentView.title}</h2>
              <p>{currentView.description}</p>
            </div>
            <div className="worker-section-heading__tools">
              <span className="worker-section-count">
                {activeTab === "queue"
                  ? `${activeQueueTaskCount} ACTIVE ${activeQueueTaskCount === 1 ? "TASK" : "TASKS"}`
                  : `${currentRecordCount} ${isLifecycleView ? (currentRecordCount === 1 ? "ITEM" : "ITEMS") : (currentRecordCount === 1 ? "ORDER" : "ORDERS")}`}
              </span>
            </div>
          </div>

          {lifecycleNotice && isLifecycleView && <div className="worker-lifecycle-notice" role="status">{lifecycleNotice}</div>}

          {viewError ? (
            <div className="worker-state worker-state--error" role="alert">
              <strong>{isLifecycleView ? "Delivery and billing data could not be loaded" : "Orders could not be loaded"}</strong>
              <span>{viewError}</span>
              <button type="button" className="worker-task-action" onClick={isLifecycleView ? loadLifecycleData : loadOrders}>
                Try again
              </button>
            </div>
          ) : viewLoading ? (
            <div className="worker-state worker-state--loading" role="status">
              <span className="worker-spinner" aria-hidden="true" />
              {isLifecycleView ? "Loading delivery and billing items…" : "Loading work orders…"}
            </div>
          ) : currentRecordCount === 0 ? (
            <div className="worker-state">
              <strong>{currentView.empty}</strong>
            </div>
          ) : isMasterDetailView ? (
            <div className="worker-master-detail">
              <section className="worker-order-picker" aria-label={`${currentView.title} orders`}>
                <div className="worker-order-picker__heading">
                  <h3>Orders</h3>
                  <span>{currentOrders.length}</span>
                </div>
                <div className="worker-order-picker__list">
                  {currentOrders.map((order) => (
                    <WorkOrderCard
                      key={order.order_id}
                      order={order}
                      mode={currentView.mode}
                      masterDetail
                      selected={selectedOrder?.order_id === order.order_id}
                      onToggle={() => setSelectedOrderId(order.order_id)}
                    />
                  ))}
                </div>
              </section>

              <section className="worker-selected-order" aria-label="Selected order details">
                {selectedOrder ? (
                  <WorkOrderDetails
                    order={selectedOrder}
                    mode={currentView.mode}
                    onTaskChange={refreshAfterTaskChange}
                  />
                ) : (
                  <div className="worker-state">
                    <strong>{currentView.empty}</strong>
                  </div>
                )}
              </section>
            </div>
          ) : isLifecycleView ? (
            <div className="worker-orders worker-lifecycle-list">
              {currentItems.map((item) => (
                <WorkOrderCard
                  key={item.order_item_id}
                  lifecycleItem={item}
                  mode={currentView.mode}
                  expanded={expandedOrder === item.order_item_id}
                  onToggle={() => setExpandedOrder((current) => current === item.order_item_id ? null : item.order_item_id)}
                  onLifecycleChange={handleLifecycleChange}
                />
              ))}
            </div>
          ) : (
            <div className="worker-orders">
              {currentOrders.map((order) => (
                <WorkOrderCard
                  key={order.order_id}
                  order={order}
                  mode={currentView.mode}
                  expanded={expandedOrder === order.order_id}
                  onToggle={() =>
                    setExpandedOrder((current) =>
                      current === order.order_id ? null : order.order_id
                    )
                  }
                  onTaskChange={refreshAfterTaskChange}
                />
              ))}
            </div>
          )}
          </>
          )}
          </section>
        </section>
      </div>
    </main>
  );
}
