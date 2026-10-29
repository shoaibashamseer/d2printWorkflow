import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useState } from "react";
import api from "../../api/api";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerTasks.css";

const columns = [
  { title: "Ready", status: "ready", icon: "◉" },
  { title: "In Progress", status: "in_progress", icon: "◷" },
  { title: "Completed", status: "completed", icon: "✓" },
];

const statusLabels = {
  ready: "Ready",
  in_progress: "In Progress",
  completed: "Completed",
};

const getRoleClass = (role) => {
  if (!role) return "role-default";
  const normalizedRole = role.toLowerCase();
  if (normalizedRole.includes("design")) return "role-design";
  if (normalizedRole.includes("print")) return "role-print";
  if (normalizedRole.includes("sublimation")) return "role-sublimation";
  if (normalizedRole.includes("helper")) return "role-helper";
  if (normalizedRole.includes("bill")) return "role-billing";
  return "role-default";
};

const getDeadlineInfo = (dateStr) => {
  if (!dateStr) return null;

  const today = new Date();
  const delivery = new Date(dateStr);
  const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return { label: "Today", class: "manager-task-deadline--today" };
  if (diffDays === 1) return { label: "Tomorrow", class: "manager-task-deadline--soon" };
  if (diffDays <= 3) return { label: `${diffDays} days`, class: "manager-task-deadline--warn" };
  return { label: `${diffDays} days`, class: "manager-task-deadline--normal" };
};

const getOrderLabel = (task) => {
  const orderId = task.order_id ?? task.order;
  return orderId === null || orderId === undefined || orderId === ""
    ? "Order ID unavailable"
    : `Order #${orderId}`;
};

const asTasks = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

function TasksMonitor() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");

  const loadTasks = useCallback(() => api.get("manager/tasks/")
    .then((response) => {
      setTasks(asTasks(response.data));
      setLoadError("");
    })
    .catch((error) => {
      setLoadError(error.response?.data?.detail || "Tasks could not be loaded.");
    })
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const getTasks = (status) => tasks.filter((task) => task.status === status);

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const source = result.source.droppableId;
    const destination = result.destination.droppableId;
    if (source === destination) return;

    try {
      if (destination === "in_progress") {
        await api.post(`tasks/${taskId}/start/`);
      }

      if (destination === "completed") {
        await api.post(`tasks/${taskId}/complete/`);
      }

      loadTasks();
    } catch (error) {
      console.log("Drag action error:", error);
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="manager-dashboard manager-tasks-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main manager-tasks-page__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Tasks</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content manager-tasks-page__content">
          <section className="manager-dashboard__page-heading manager-tasks-page__heading">
            <div>
              <h1>Tasks</h1>
              <p>Monitor production tasks by their current workflow status.</p>
            </div>
          </section>

          {loadError && (
            <div className="manager-tasks-page__error" role="alert">{loadError}</div>
          )}

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="manager-tasks-board">
              {columns.map((column) => (
                <TaskColumn
                  key={column.status}
                  title={column.title}
                  status={column.status}
                  icon={column.icon}
                  tasks={getTasks(column.status)}
                  loading={loading}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      </main>
    </div>
  );
}

function TaskColumn({ title, status, icon, tasks, loading }) {
  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <section
          className={`manager-task-lane manager-task-lane--${status}${snapshot.isDraggingOver ? " is-dragging-over" : ""}`}
          ref={provided.innerRef}
          {...provided.droppableProps}
          aria-label={`${title} tasks`}
        >
          <header className="manager-task-lane__heading">
            <div>
              <span className={`manager-task-lane__icon manager-task-lane__icon--${status}`} aria-hidden="true">{icon}</span>
              <h2>{title}</h2>
            </div>
            <span className="manager-task-lane__count">{tasks.length}</span>
          </header>

          <div className="manager-task-lane__cards">
            {!loading && tasks.length === 0 && (
              <p className="manager-task-lane__empty">No {title.toLowerCase()} tasks.</p>
            )}

            {tasks.map((task, index) => {
              const deadline = getDeadlineInfo(task.order_delivery_date || task.delivery_date);
              return (
                <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                  {(draggableProvided, draggableSnapshot) => (
                    <article
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      {...draggableProvided.dragHandleProps}
                      className={`manager-task-card ${getRoleClass(task.workflow_role_name)}${draggableSnapshot.isDragging ? " is-dragging" : ""}`}
                      style={{
                        ...draggableProvided.draggableProps.style,
                        transition: "box-shadow 120ms ease, border-color 120ms ease",
                      }}
                    >
                      <div className="manager-task-card__topline">
                        <strong className="manager-task-card__step">
                          {formatDisplayValue(task.workflow_step_name, "Workflow task")}
                        </strong>
                        <span className={`manager-task-card__status manager-task-card__status--${status}`}>
                          {statusLabels[status]}
                        </span>
                      </div>

                      <div className="manager-task-card__order">
                        <span>{getOrderLabel(task)}</span>
                        {task.order_item_id !== null && task.order_item_id !== undefined && (
                          <span>Item #{task.order_item_id}</span>
                        )}
                      </div>

                      <div className="manager-task-card__product">
                        {task.product_name
                          ? `${task.quantity ? `${task.quantity} × ` : ""}${formatDisplayValue(task.product_name)}`
                          : "Product details unavailable"}
                      </div>

                      {task.customer_name && (
                        <div className="manager-task-card__customer">
                          {formatDisplayValue(task.customer_name)}
                          {task.customer_company && ` · ${formatDisplayValue(task.customer_company)}`}
                        </div>
                      )}

                      <div className="manager-task-card__details">
                        <span><small>Role</small>{formatDisplayValue(task.workflow_role_name, "Role not set")}</span>
                        <span><small>Worker</small>{task.assigned_to_name ? formatDisplayValue(task.assigned_to_name) : "Unassigned"}</span>
                      </div>

                      <div className="manager-task-card__footer">
                        {deadline ? (
                          <span className={`manager-task-deadline ${deadline.class}`}>Due {deadline.label}</span>
                        ) : (
                          <span className="manager-task-deadline manager-task-deadline--normal">No due date</span>
                        )}
                        <span className="manager-task-card__drag-hint" aria-hidden="true">⠿</span>
                      </div>
                    </article>
                  )}
                </Draggable>
              );
            })}

            {provided.placeholder}
          </div>
        </section>
      )}
    </Droppable>
  );
}

export default TasksMonitor;
