import WorkOrderDetails from "./WorkOrderDetails";
import formatDisplayValue from "./formatDisplayValue";

const priorityLabels = {
  overdue: "Overdue",
  today: "Due today",
  future: "Upcoming",
};

const getCurrentTask = (order) => {
  const tasks = Array.isArray(order?.products)
    ? order.products.flatMap((item) =>
        Array.isArray(item.tasks) ? item.tasks : []
      )
    : [];

  return (
    tasks.find((task) => task.status === "in_progress") ||
    tasks.find((task) => task.status === "ready") ||
    order?.my_task ||
    null
  );
};

const statusLabels = {
  pending: "Pending",
  ready: "Ready",
  in_progress: "In progress",
  completed: "Completed",
};

export default function WorkOrderCard({
  order,
  mode,
  expanded,
  onToggle,
  onTaskChange,
  masterDetail = false,
  selected = false,
  lifecycleItem,
  onLifecycleChange,
}) {
  const products = Array.isArray(order?.products) ? order.products : [];
  const currentTask = getCurrentTask(order);
  const showDetails = mode === "queue" || expanded;

  if (lifecycleItem) {
    const billingComplete = Boolean(lifecycleItem.billing_completed_at);
    const paymentReceived = Boolean(lifecycleItem.payment_received_at);
    return (
      <article className="worker-lifecycle-card">
        <button
          type="button"
          className="worker-lifecycle-card__summary"
          aria-expanded={Boolean(expanded)}
          onClick={onToggle}
        >
          <span className="worker-lifecycle-card__topline">
            <strong className="worker-mono">ORDER #{lifecycleItem.order_id}</strong>
            {mode !== "delivery" && <span className={`worker-lifecycle-card__badge${billingComplete ? " is-complete" : " is-pending"}`}>{billingComplete ? "Billing complete" : "Billing pending"}</span>}
          </span>
          <span className="worker-lifecycle-card__customer">{lifecycleItem.customer_name || "Customer unavailable at order time"}</span>
          <span className="worker-lifecycle-card__item">{lifecycleItem.quantity ?? "—"} × {lifecycleItem.product_name || "Product unavailable at order time"}</span>
          <span className="worker-lifecycle-card__bottomline">
            <span>{lifecycleItem.delivery_method ? formatDisplayValue(lifecycleItem.delivery_method) : "Delivery method unavailable"}</span>
            <span>{lifecycleItem.delivery_date || "—"}</span>
            {mode !== "delivery" && <span className={`worker-lifecycle-card__badge${paymentReceived ? " is-complete" : " is-pending"}`}>{paymentReceived ? "Payment received" : "Payment pending"}</span>}
            <span className={`workorder-card__chevron${expanded ? " is-open" : ""}`} aria-hidden="true">⌄</span>
          </span>
        </button>
        {expanded && (
          <div className="worker-lifecycle-card__details">
            <WorkOrderDetails lifecycleItem={lifecycleItem} mode={mode} onLifecycleChange={onLifecycleChange} />
          </div>
        )}
      </article>
    );
  }

  if (masterDetail) {
    return (
      <button
        type="button"
        className={`workorder-select${selected ? " is-selected" : ""}`}
        aria-pressed={selected}
        onClick={onToggle}
      >
        <span className="workorder-select__topline">
          <strong className="worker-mono">Order #{order.order_id}</strong>
          <span className={`workorder-priority workorder-priority--${order.priority || "future"}`}>
            {priorityLabels[order.priority] || "Scheduled"}
          </span>
        </span>
        {order.company && (
          <span className="workorder-select__company-name">{formatDisplayValue(order.company)}</span>
        )}
        <span className={`workorder-select__customer${order.company ? " is-secondary" : ""}`}>
          {formatDisplayValue(order.customer, "Customer")}
        </span>
        <span className="workorder-select__products">
          {products.length === 0
            ? "No item details returned"
              : products.map((item) => `${item.quantity} × ${formatDisplayValue(item.product, "Product")}`).join(" · ")}
        </span>
        <span className="workorder-select__bottomline">
          <span>{currentTask ? formatDisplayValue(currentTask.step) : "No current task"}</span>
          <span>{order.delivery_date || "—"}</span>
        </span>
      </button>
    );
  }

  const currentTaskStatus = currentTask?.status
    ? statusLabels[currentTask.status] || formatDisplayValue(currentTask.status)
    : "Status unavailable";

  return (
    <article className="workorder-card">
      <button
        type="button"
        className="workorder-card__summary"
        aria-expanded={showDetails}
        onClick={mode === "queue" ? undefined : onToggle}
      >
        <span className="workorder-card__main">
          <span className="workorder-card__title-row">
            <strong>{formatDisplayValue(order.company || order.customer, "Customer")}</strong>
            <span className={`workorder-priority workorder-priority--${order.priority || "future"}`}>
              {priorityLabels[order.priority] || "Scheduled"}
            </span>
          </span>
          {order.company && (
            <span className="workorder-card__customer">{formatDisplayValue(order.customer, "Customer")}</span>
          )}
          <span className="workorder-card__products">
            {products.length === 0
              ? "No item details returned"
              : products.map((item) => `${item.quantity} × ${formatDisplayValue(item.product, "Product")}`).join(" · ")}
          </span>
        </span>

        <span className="workorder-card__meta">
          <span className="workorder-card__delivery">
            <span className="workorder-card__meta-label">Delivery date</span>
            <strong>{order.delivery_date || "—"}</strong>
          </span>
          <span className="workorder-card__total">
            <span className="workorder-card__meta-label">Order total</span>
            <strong>₹ {order.grand_total ?? "—"}</strong>
          </span>
          {mode !== "queue" && (
            <span className={`workorder-card__chevron${expanded ? " is-open" : ""}`} aria-hidden="true">
              ⌄
            </span>
          )}
        </span>
      </button>

      {currentTask &&
        (mode !== "queue" ||
          (currentTask.assigned_to_me === true &&
            currentTask.status === "in_progress")) && (
          <div className="workorder-current-task">
            <span className="workorder-current-task__label">Current task</span>
            <strong>{formatDisplayValue(currentTask.step)}</strong>
            <span className="workorder-current-task__worker">
              {formatDisplayValue(currentTask.worker, "Unassigned")}
            </span>
            <span className={`task-status task-status--${currentTask.status || "unknown"}`}>
              {currentTaskStatus}
            </span>
          </div>
        )}

      {showDetails && (
        <div className="workorder-card__details">
          <WorkOrderDetails
            order={order}
            mode={mode}
            onTaskChange={onTaskChange}
          />
        </div>
      )}
    </article>
  );
}
