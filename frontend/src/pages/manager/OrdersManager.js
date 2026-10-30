import ManagerSidebar from "../../components/ManagerSidebar";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import PlaceOrderForm from "../../components/PlaceOrderForm";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerOrders.css";

const statusLabels = {
  pending: "Pending",
  ready: "Ready",
  in_progress: "In Progress",
  completed: "Completed",
};

const asList = (data) => (Array.isArray(data) ? data : []);

const getCurrentTask = (item) => {
  const tasks = Array.isArray(item?.tasks) ? item.tasks : [];
  return tasks.find((task) => task.status === "in_progress") ||
    tasks.find((task) => task.status === "ready") ||
    null;
};

const getOrderNumber = (order) => `ORD-${String(order.order_id).padStart(4, "0")}`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

export default function OrdersManager() {
  const role = localStorage.getItem("role") || "Manager";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showPlaceOrder, setShowPlaceOrder] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get("worker/workorders/");
      setOrders(asList(response.data));
      setLoadError("");
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const newestFirstOrders = useMemo(
    () => [...orders].sort((left, right) => Number(right.order_id) - Number(left.order_id)),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return newestFirstOrders;
    return newestFirstOrders.filter((order) => {
      const items = Array.isArray(order.products) ? order.products : [];
      const searchable = [
        getOrderNumber(order),
        order.customer,
        order.company,
        order.phone,
        ...items.flatMap((item) => [
          item.product,
          ...(Array.isArray(item.tasks) ? item.tasks.flatMap((task) => [task.step, task.role, task.status, task.worker]) : []),
        ]),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [newestFirstOrders, search]);

  const closeAfterSuccess = async () => {
    setShowPlaceOrder(false);
    await loadOrders();
  };

  const deleteOrder = async (order) => {
    const orderNumber = getOrderNumber(order);
    if (!window.confirm(`Delete ${orderNumber}? This action cannot be undone.`)) return;

    setDeletingOrderId(order.order_id);
    setDeleteError(null);
    try {
      await api.delete(`orders/${order.order_id}/`);
      setOrders((current) => current.filter((entry) => entry.order_id !== order.order_id));
    } catch (error) {
      setDeleteError({
        orderId: order.order_id,
        message: error.response?.data?.detail || `Could not delete ${orderNumber}. Please try again.`,
      });
    } finally {
      setDeletingOrderId(null);
    }
  };

  return (
    <div className="manager-dashboard manager-orders-page">
      <ManagerSidebar role={role} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Orders</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content manager-orders-page__content">
          <section className="manager-dashboard__page-heading manager-orders-page__heading">
            <div><h1>Orders</h1><p>Orders and item-level workflow information returned by the existing API.</p></div>
            <button type="button" className="manager-orders-page__primary-button" onClick={() => setShowPlaceOrder(true)}>
              <span aria-hidden="true">＋</span> Place Order
            </button>
          </section>

          <section className="manager-orders-page__panel" aria-labelledby="manager-orders-list-heading">
            <div className="manager-orders-page__toolbar">
              <div><h2 id="manager-orders-list-heading">Order list</h2><p>{loading ? "Loading orders…" : `${filteredOrders.length} ${filteredOrders.length === 1 ? "order" : "orders"}`}</p></div>
              <label className="manager-orders-page__search">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, customers, products or tasks" aria-label="Search orders" />
              </label>
            </div>

            {loadError ? (
              <div className="manager-orders-page__state manager-orders-page__state--error" role="alert">
                <strong>Orders could not be loaded</strong><span>{loadError}</span>
                <button type="button" className="manager-orders-page__secondary-button" onClick={loadOrders}>Try again</button>
              </div>
            ) : loading ? (
              <div className="manager-orders-page__state" role="status">Loading orders…</div>
            ) : filteredOrders.length === 0 ? (
              <div className="manager-orders-page__state">
                <strong>{orders.length ? "No orders match your search." : "No orders were returned."}</strong>
                {orders.length > 0 && <span>Try another order, customer, product, or task search.</span>}
              </div>
            ) : (
              <div className="manager-orders-page__table-scroll">
                <table className="manager-orders-page__table">
                  <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>CURRENT WORK</th><th>DUE DATE</th><th>TOTAL</th><th>ACTIONS</th></tr></thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const items = Array.isArray(order.products) ? order.products : [];
                      return (
                        <tr key={order.order_id}>
                          <td><strong className="manager-orders-page__order-id">{getOrderNumber(order)}</strong></td>
                          <td><strong>{formatDisplayValue(order.company || order.customer, "Customer")}</strong>{order.company && order.customer && <small>{formatDisplayValue(order.customer)}</small>}</td>
                          <td>{items.length ? items.map((item) => <span className="manager-orders-page__item-line" key={item.id}>{item.quantity} × {formatDisplayValue(item.product, "Product")}</span>) : <span className="manager-orders-page__muted">No items returned</span>}</td>
                          <td>
                            {items.length ? items.map((item) => {
                              const task = getCurrentTask(item);
                              const isComplete = Array.isArray(item.tasks) && item.tasks.length > 0 && item.tasks.every((entry) => entry.status === "completed");
                              return (
                                <span className="manager-orders-page__task-line" key={item.id}>
                                  <strong>{formatDisplayValue(item.product, "Product")}</strong>
                                  {task ? <><span>{formatDisplayValue(task.step, "Workflow task")} · {formatDisplayValue(task.role, "Role not set")}</span><span className={`manager-orders-page__status manager-orders-page__status--${task.status || "unknown"}`}>{statusLabels[task.status] || formatDisplayValue(task.status, "Status unavailable")}</span><small>{formatDisplayValue(task.worker, "Unassigned")}</small></> : <span>{isComplete || order.completed ? "Production complete" : "No current task returned"}</span>}
                                </span>
                              );
                            }) : <span className="manager-orders-page__muted">No item details returned</span>}
                          </td>
                          <td>{formatDate(order.delivery_date)}</td>
                          <td className="manager-orders-page__total">{order.grand_total == null ? "—" : `₹ ${Number(order.grand_total).toLocaleString("en-IN")}`}</td>
                          <td className="manager-orders-page__action-cell">
                            <button
                              type="button"
                              className="manager-orders-page__delete-button"
                              onClick={() => deleteOrder(order)}
                              disabled={deletingOrderId === order.order_id}
                              aria-label={`Delete ${getOrderNumber(order)}`}
                            >
                              {deletingOrderId === order.order_id ? "Deleting…" : "Delete"}
                            </button>
                            {deleteError?.orderId === order.order_id && <small className="manager-orders-page__delete-error" role="alert">{deleteError.message}</small>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {showPlaceOrder && (
        <div className="manager-orders-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlaceOrder(false); }}>
          <section className="manager-orders-page__dialog" role="dialog" aria-modal="true" aria-labelledby="manager-place-order-heading">
            <header className="manager-orders-page__dialog-header">
              <div><p className="manager-dashboard__eyebrow">MANAGER AREA <span>›</span> ORDERS</p><h2 id="manager-place-order-heading">Place Order</h2></div>
              <button type="button" className="manager-orders-page__close-button" onClick={() => setShowPlaceOrder(false)} aria-label="Close Place Order form">×</button>
            </header>
            <div className="manager-orders-page__form-container"><PlaceOrderForm onSuccess={closeAfterSuccess} showHeading={false} /></div>
          </section>
        </div>
      )}
    </div>
  );
}
