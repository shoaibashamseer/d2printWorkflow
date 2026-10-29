import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerReports.css";

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatDuration = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const source = String(value).trim();
  const iso = source.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    const minutes = Math.round((Number(iso[1] || 0) * 1440) + (Number(iso[2] || 0) * 60) + Number(iso[3] || 0) + (Number(iso[4] || 0) / 60));
    return formatMinutes(minutes);
  }
  const python = source.match(/^(?:(\d+)\s+day(?:s)?,\s*)?(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/i);
  if (python) {
    const minutes = Math.round((Number(python[1] || 0) * 1440) + (Number(python[2] || 0) * 60) + Number(python[3] || 0) + (Number(python[4] || 0) / 60));
    return formatMinutes(minutes);
  }
  return source;
};

const formatMinutes = (minutes) => {
  if (!Number.isFinite(minutes)) return "—";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  return `${remainingMinutes}m`;
};

const statusClass = (status) => String(status || "unknown").toLocaleLowerCase().replace(/[^a-z0-9_-]/g, "");

function ReportsDashboard() {
  const [report, setReport] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadReport = useCallback(async () => {
    try {
      const response = await api.get("manager/reports/tasks/");
      setReport(response.data);
      setLoadError("");
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
    api.get("manager/staff/").then((response) => setWorkers(asList(response.data))).catch(() => setWorkers([]));
  }, [loadReport]);

  const workerNames = useMemo(() => new Map(workers.map((worker) => [String(worker.id), worker.username])), [workers]);
  const statusSummary = Array.isArray(report?.status_summary) ? report.status_summary : [];
  const stepRows = Array.isArray(report?.by_step) ? report.by_step : [];
  const workerRows = Array.isArray(report?.by_worker) ? report.by_worker : [];
  const totalTasks = statusSummary.reduce((total, item) => total + (Number(item.count) || 0), 0);
  const summaryCards = statusSummary.length ? [
    { label: "Total tasks", value: totalTasks, kind: "total" },
    ...statusSummary.map((item) => ({ label: formatDisplayValue(item.status), value: Number(item.count) || 0, kind: statusClass(item.status) })),
  ] : [];
  const maxStatusCount = Math.max(1, ...statusSummary.map((item) => Number(item.count) || 0));
  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");
  const currentDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());

  return (
    <div className="manager-dashboard manager-reports-page">
      <ManagerSidebar role={role} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar"><div className="manager-dashboard__breadcrumb"><p className="manager-dashboard__eyebrow">MANAGER AREA</p><span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span><p className="manager-dashboard__crumb">Reports</p></div><span className="manager-dashboard__date">{currentDate}</span></header>
        <div className="manager-dashboard__content manager-reports-page__content">
          <section className="manager-dashboard__page-heading manager-reports-page__heading"><div><h1>Reports</h1><p>Task status and completion timing from recorded task data.</p></div></section>
          {loadError && <div className="manager-reports-page__alert" role="alert">{loadError}</div>}
          {loading ? <div className="manager-reports-page__empty">Loading reports…</div> : report && <>
            {summaryCards.length > 0 && <section className="manager-reports-page__summary" aria-label="Task summary">{summaryCards.map((item) => <article className="manager-reports-page__summary-card" key={item.kind}><span className={`manager-reports-page__summary-icon manager-reports-page__summary-icon--${item.kind}`} aria-hidden="true">{item.kind === "total" ? "▦" : "•"}</span><div><span>{item.label}</span><strong>{item.value.toLocaleString("en-IN")}</strong></div></article>)}</section>}

            <section className="manager-reports-page__panel" aria-labelledby="task-status-heading">
              <header className="manager-reports-page__panel-heading"><div><h2 id="task-status-heading">Task Status Summary</h2><p>Task counts returned by the reporting endpoint</p></div></header>
              {statusSummary.length ? <div className="manager-reports-page__status-list">{statusSummary.map((item) => <div className="manager-reports-page__status-row" key={item.status}><div className="manager-reports-page__status-title"><span className={`manager-reports-page__status-badge manager-reports-page__status-badge--${statusClass(item.status)}`}>{formatDisplayValue(item.status)}</span><strong>{Number(item.count) || 0}</strong></div><div className="manager-reports-page__bar"><span className={`manager-reports-page__bar-fill manager-reports-page__bar-fill--${statusClass(item.status)}`} style={{ width: `${((Number(item.count) || 0) / maxStatusCount) * 100}%` }} /></div></div>)}</div> : <div className="manager-reports-page__panel-empty">No task status counts were returned.</div>}
            </section>

            <div className="manager-reports-page__tables">
              <section className="manager-reports-page__panel" aria-labelledby="step-time-heading">
                <header className="manager-reports-page__panel-heading"><div><h2 id="step-time-heading">Average Time per Workflow Step</h2><p>Completed tasks with recorded start and completion times</p></div></header>
                <div className="manager-reports-page__table-wrap"><table className="manager-reports-page__table"><thead><tr><th scope="col">Workflow step</th><th scope="col">Average time</th><th scope="col">Tasks</th></tr></thead><tbody>{stepRows.length ? stepRows.map((item, index) => <tr key={`${item.workflow_step__name || "step"}-${index}`}><td>{formatDisplayValue(item.workflow_step__name, "Step unavailable")}</td><td><span className="manager-reports-page__duration">{formatDuration(item.avg_time)}</span></td><td>{item.count ?? "—"}</td></tr>) : <tr><td colSpan="3"><div className="manager-reports-page__table-empty">No workflow-step timing data was returned.</div></td></tr>}</tbody></table></div>
              </section>

              <section className="manager-reports-page__panel" aria-labelledby="worker-time-heading">
                <header className="manager-reports-page__panel-heading"><div><h2 id="worker-time-heading">Average Time per Worker</h2><p>Completed tasks grouped by assigned user</p></div></header>
                <div className="manager-reports-page__table-wrap"><table className="manager-reports-page__table"><thead><tr><th scope="col">Worker</th><th scope="col">Average time</th><th scope="col">Tasks</th></tr></thead><tbody>{workerRows.length ? workerRows.map((item, index) => {
                  const workerId = item.assigned_to__id;
                  const workerName = workerId === null || workerId === undefined ? "Unassigned" : workerNames.get(String(workerId)) || `Worker #${workerId}`;
                  return <tr key={`${workerId ?? "unassigned"}-${index}`}><td><strong>{formatDisplayValue(workerName)}</strong></td><td><span className="manager-reports-page__duration">{formatDuration(item.avg_time)}</span></td><td>{item.count ?? "—"}</td></tr>;
                }) : <tr><td colSpan="3"><div className="manager-reports-page__table-empty">No worker timing data was returned.</div></td></tr>}</tbody></table></div>
              </section>
            </div>
          </>}
        </div>
      </main>
    </div>
  );
}

export default ReportsDashboard;
