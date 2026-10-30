import ManagerSidebar from "../components/ManagerSidebar";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import formatDisplayValue from "./worker/formatDisplayValue";
import "../styles/managerDashboard.css";

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatDate = (value) => {
  if (!value) return "Date not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const statusLabels = {
  pending: "Pending",
  ready: "Ready",
  in_progress: "In progress",
  completed: "Completed",
};

const STAFF_PHOTOS_KEY = "managerStaffProfilePhotos";

const loadStaffProfilePhotos = () => {
  try {
    return JSON.parse(localStorage.getItem(STAFF_PHOTOS_KEY) || "{}");
  } catch {
    return {};
  }
};

function ManagerDashboard() {
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffPhotos, setStaffPhotos] = useState(loadStaffProfilePhotos);
  const [lowStock, setLowStock] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState({ tasks: true, staff: true, lowStock: true });
  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");

  useEffect(() => {
    const load = (key, path, setter) => {
      api.get(path)
        .then((response) => {
          setter(asList(response.data));
          setErrors((current) => ({ ...current, [key]: "" }));
        })
        .catch((error) => {
          setErrors((current) => ({
            ...current,
            [key]: error.response?.data?.detail || "This information could not be loaded.",
          }));
        })
        .finally(() => {
          setLoading((current) => ({ ...current, [key]: false }));
        });
    };

    load("tasks", "manager/tasks/", setTasks);
    load("staff", "manager/staff/", setStaff);
    load("lowStock", "manager/low-stock/", setLowStock);
  }, []);

  useEffect(() => {
    const syncStaffPhotos = (event) => {
      if (event.key === STAFF_PHOTOS_KEY) setStaffPhotos(loadStaffProfilePhotos());
    };
    window.addEventListener("storage", syncStaffPhotos);
    return () => window.removeEventListener("storage", syncStaffPhotos);
  }, []);

  const taskCounts = useMemo(() => ({
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    ready: tasks.filter((task) => task.status === "ready").length,
    completed: tasks.filter((task) => task.status === "completed").length,
  }), [tasks]);

  const activeTasks = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "ready"
  );

  const taskStages = useMemo(() => {
    const stages = new Map();
    tasks.forEach((task) => {
      const step = task.workflow_step_name;
      if (!step) return;
      const entry = stages.get(step) || { name: step, total: 0, inProgress: 0, ready: 0 };
      entry.total += 1;
      if (task.status === "in_progress") entry.inProgress += 1;
      if (task.status === "ready") entry.ready += 1;
      stages.set(step, entry);
    });
    return [...stages.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const staffWithWorkload = useMemo(() => staff.map((person) => ({
    ...person,
    inProgressCount: tasks.filter(
      (task) => task.assigned_to === person.id && task.status === "in_progress"
    ).length,
  })), [staff, tasks]);

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
    <div className="manager-dashboard">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Dashboard</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content">
          <section className="manager-dashboard__metrics" aria-label="Production task summary">
            <MetricCard label="Tasks in progress" value={loading.tasks ? "—" : taskCounts.inProgress} tone="blue" icon="◷" error={errors.tasks} />
            <MetricCard label="Ready tasks" value={loading.tasks ? "—" : taskCounts.ready} tone="amber" icon="◉" error={errors.tasks} />
            <MetricCard label="Completed tasks" value={loading.tasks ? "—" : taskCounts.completed} tone="green" icon="✓" error={errors.tasks} />
            <MetricCard label="Low-stock items" value={loading.lowStock ? "—" : lowStock.length} tone="red" icon="!" error={errors.lowStock} />
          </section>

          <div className="manager-dashboard__sections">
            <section className="manager-dashboard__panel manager-dashboard__panel--work">
              <div className="manager-dashboard__panel-heading">
                <div>
                  <h2>Current production work</h2>
                  <p>Tasks currently in progress or ready to start.</p>
                </div>
                <Link to="/manager/tasks" className="manager-dashboard__text-link">Open task monitor <span aria-hidden="true">→</span></Link>
              </div>
              {errors.tasks ? (
                <PanelState>{errors.tasks}</PanelState>
              ) : loading.tasks ? (
                <PanelState>Loading production tasks…</PanelState>
              ) : activeTasks.length === 0 ? (
                <PanelState>No ready or in-progress tasks were returned.</PanelState>
              ) : (
                <div className="manager-dashboard__work-list">
                  {activeTasks.slice(0, 6).map((task) => (
                    <article className="manager-dashboard__work-item" key={task.id}>
                      <span className={`manager-dashboard__step-icon manager-dashboard__step-icon--${task.status}`} aria-hidden="true">
                        {task.status === "ready" ? "◉" : "◷"}
                      </span>
                      <div className="manager-dashboard__work-main">
                        <div className="manager-dashboard__work-title">
                          <strong>{formatDisplayValue(task.workflow_step_name, "Workflow task")}</strong>
                          <span className={`manager-dashboard__status manager-dashboard__status--${task.status}`}>
                            {statusLabels[task.status] || formatDisplayValue(task.status)}
                          </span>
                        </div>
                        <p>
                          <span className="manager-dashboard__order-id">ORD-{String(task.order_id).padStart(4, "0")}</span>
                          <span>{formatDisplayValue(task.customer_name, "Customer")}</span>
                          {task.product_name && <span>{task.quantity ? `${task.quantity} × ` : ""}{formatDisplayValue(task.product_name)}</span>}
                        </p>
                        <div className="manager-dashboard__work-meta">
                          <span>{formatDisplayValue(task.workflow_role_name, "Role not set")}</span>
                          <span>{task.assigned_to_name ? formatDisplayValue(task.assigned_to_name) : "Unassigned"}</span>
                          <span>Due {formatDate(task.order_delivery_date)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {!errors.tasks && activeTasks.length > 6 && (
                <p className="manager-dashboard__list-footnote">Showing 6 of {activeTasks.length} tasks.</p>
              )}
            </section>

            <section className="manager-dashboard__panel manager-dashboard__panel--team">
              <div className="manager-dashboard__panel-heading">
                <div>
                  <h2>Staff status</h2>
                  <p>Accounts and assigned in-progress tasks.</p>
                </div>
                <Link to="/manager/staff" className="manager-dashboard__icon-link" aria-label="Manage staff">→</Link>
              </div>
              {errors.staff ? (
                <PanelState>{errors.staff}</PanelState>
              ) : loading.staff ? (
                <PanelState>Loading staff…</PanelState>
              ) : staffWithWorkload.length === 0 ? (
                <PanelState>No staff accounts were returned.</PanelState>
              ) : (
                <div className="manager-dashboard__staff-list">
                  {staffWithWorkload.slice(0, 8).map((person) => (
                    <article className="manager-dashboard__staff-item" key={person.id}>
                      <span className="manager-dashboard__avatar manager-dashboard__avatar--light" aria-hidden="true">
                        {staffPhotos[person.id]
                          ? <img src={staffPhotos[person.id]} alt="" />
                          : formatDisplayValue(person.username, "?").charAt(0).toLocaleUpperCase()}
                      </span>
                      <div className="manager-dashboard__staff-main">
                        <strong>{formatDisplayValue(person.username, "Unnamed user")}</strong>
                        <span>{formatDisplayValue(person.role_name, "Role not set")}</span>
                      </div>
                      <div className="manager-dashboard__staff-workload">
                        <strong>{person.inProgressCount}</strong>
                        <span>{person.inProgressCount === 1 ? "task" : "tasks"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="manager-dashboard__panel manager-dashboard__panel--stock">
              <div className="manager-dashboard__panel-heading">
                <div>
                  <h2>Low stock alert</h2>
                  <p>Items returned by the existing low-stock endpoint.</p>
                </div>
                <Link to="/manager/materials" className="manager-dashboard__text-link">Manage materials <span aria-hidden="true">→</span></Link>
              </div>
              {errors.lowStock ? (
                <PanelState>{errors.lowStock}</PanelState>
              ) : loading.lowStock ? (
                <PanelState>Loading stock alerts…</PanelState>
              ) : lowStock.length === 0 ? (
                <PanelState>No low-stock items were returned.</PanelState>
              ) : (
                <div className="manager-dashboard__stock-list">
                  {lowStock.slice(0, 5).map((item) => (
                    <article className="manager-dashboard__stock-item" key={item.id}>
                      <span className="manager-dashboard__stock-indicator" aria-hidden="true">!</span>
                      <div>
                        <strong>{formatDisplayValue(item.material_name, "Material")}</strong>
                        <span>{formatDisplayValue(item.name, "Variant")}</span>
                      </div>
                      <span className="manager-dashboard__stock-quantity">
                        {item.stock ?? "—"} {formatDisplayValue(item.unit, "")}
                      </span>
                    </article>
                  ))}
                </div>
              )}
              {!errors.lowStock && lowStock.length > 5 && (
                <p className="manager-dashboard__list-footnote">Showing 5 of {lowStock.length} items.</p>
              )}
            </section>

            <section className="manager-dashboard__panel manager-dashboard__panel--stages">
              <div className="manager-dashboard__panel-heading">
                <div>
                  <h2>Tasks by workflow step</h2>
                  <p>Counts calculated from the manager task response.</p>
                </div>
              </div>
              {errors.tasks ? (
                <PanelState>{errors.tasks}</PanelState>
              ) : loading.tasks ? (
                <PanelState>Loading task stages…</PanelState>
              ) : taskStages.length === 0 ? (
                <PanelState>No workflow task data was returned.</PanelState>
              ) : (
                <div className="manager-dashboard__stage-list">
                  {taskStages.map((stage) => (
                    <div className="manager-dashboard__stage-item" key={stage.name}>
                      <div>
                        <strong>{formatDisplayValue(stage.name)}</strong>
                        <span>{stage.inProgress} in progress · {stage.ready} ready</span>
                      </div>
                      <strong>{stage.total}</strong>
                      <span className="manager-dashboard__stage-bar" aria-hidden="true">
                        <span style={{ width: `${(stage.total / tasks.length) * 100}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone, icon, error }) {
  return (
    <article className="manager-dashboard__metric">
      <span className={`manager-dashboard__metric-icon manager-dashboard__metric-icon--${tone}`} aria-hidden="true">{icon}</span>
      <div>
        <span className="manager-dashboard__metric-label">{label}</span>
        <strong>{error ? "—" : value}</strong>
        {error && <small>Unavailable</small>}
      </div>
    </article>
  );
}

function PanelState({ children }) {
  return <p className="manager-dashboard__panel-state" role="status">{children}</p>;
}

export default ManagerDashboard;
