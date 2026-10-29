import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/api";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerWorkflows.css";

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const emptyStep = { name: "", role: "", sequence_order: "" };

function WorkflowStepsManager() {
  const { workflowId } = useParams();
  const [steps, setSteps] = useState([]);
  const [roles, setRoles] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [form, setForm] = useState(emptyStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");

  const loadSteps = useCallback(async () => {
    try {
      // The workflow-step list endpoint currently returns every workflow's
      // steps, even when a `workflow` query parameter is supplied. The
      // workflow detail serializer already includes only this workflow's
      // related steps, so use that response to keep this page scoped correctly.
      const response = await api.get(`manager/workflows/${workflowId}/`);
      setWorkflow(response.data);
      setSteps(asList(response.data?.steps).sort((left, right) => Number(left.sequence_order) - Number(right.sequence_order)));
      setLoadError("");
    } catch (error) {
      setWorkflow(null);
      setSteps([]);
      setLoadError(error.response?.data?.detail || "Workflow and its steps could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    loadSteps();
    api.get("roles/").then((response) => setRoles(asList(response.data))).catch(() => setRoles([]));
  }, [loadSteps]);

  const rolesById = useMemo(() => new Map(roles.map((role) => [String(role.id), role.name])), [roles]);

  const openCreateForm = () => {
    setEditingStep(null);
    setForm({ ...emptyStep, sequence_order: String(steps.length ? Number(steps[steps.length - 1].sequence_order) + 1 : 1) });
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (step) => {
    setEditingStep(step);
    setForm({ name: step.name || "", role: step.role ?? "", sequence_order: step.sequence_order ?? "" });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingStep(null);
    setForm(emptyStep);
    setFormError("");
  };

  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const saveStep = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError("Step name is required.");
      return;
    }
    if (form.sequence_order === "" || Number(form.sequence_order) < 0) {
      setFormError("Enter a valid sequence order.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name,
      role: form.role ? Number(form.role) : null,
      sequence_order: Number(form.sequence_order),
      workflow: Number(workflowId),
    };
    try {
      if (editingStep) await api.put(`manager/workflow-steps/${editingStep.id}/`, payload);
      else await api.post("manager/workflow-steps/", payload);
      closeForm();
      await loadSteps();
    } catch (error) {
      const data = error.response?.data;
      setFormError(data?.detail || Object.values(data || {}).flat().join(" ") || "Workflow step could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteStep = async (step) => {
    if (!window.confirm(`Delete step “${step.name}”? Existing tasks using this workflow step will also be deleted by the backend.`)) return;
    try {
      await api.delete(`manager/workflow-steps/${step.id}/`);
      await loadSteps();
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Workflow step could not be deleted.");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");
  const currentDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  const workflowName = formatDisplayValue(workflow?.name, `Workflow #${workflowId}`);

  return (
    <div className="manager-dashboard manager-workflows-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar"><div className="manager-dashboard__breadcrumb"><p className="manager-dashboard__eyebrow">MANAGER AREA</p><span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span><Link className="manager-dashboard__crumb manager-workflows-page__crumb-link" to="/manager/workflows">Workflows</Link><span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span><p className="manager-dashboard__crumb">Steps</p></div><span className="manager-dashboard__date">{currentDate}</span></header>
        <div className="manager-dashboard__content manager-workflows-page__content">
          <div className="manager-workflows-page__back-link"><Link to="/manager/workflows">← All workflows</Link></div>
          <section className="manager-dashboard__page-heading manager-workflows-page__heading"><div><h1>{workflowName}</h1><p>{workflow?.description ? formatDisplayValue(workflow.description) : "Workflow steps in their configured sequence."}</p></div><button type="button" className="manager-workflows-page__primary-button" onClick={openCreateForm}><span aria-hidden="true">＋</span> Add Step</button></section>
          {loadError && <div className="manager-workflows-page__alert" role="alert">{loadError}</div>}
          <section className="manager-workflows-page__steps-panel" aria-label={`${workflowName} steps`}>
            <header><div><h2>Workflow sequence</h2><p>{steps.length} {steps.length === 1 ? "step" : "steps"} · Ordered by sequence</p></div></header>
            {loading ? <div className="manager-workflows-page__empty">Loading steps…</div> : steps.length ? <ol className="manager-workflows-page__step-list">{steps.map((step) => <li className="manager-workflows-page__step-row" key={step.id}><span className="manager-workflows-page__sequence manager-workflows-page__sequence--large">{step.sequence_order}</span><span className="manager-workflows-page__step-copy"><strong>{formatDisplayValue(step.name)}</strong><small>{formatDisplayValue(rolesById.get(String(step.role)), "Role not assigned")}</small></span><span className="manager-workflows-page__role-chip">{formatDisplayValue(rolesById.get(String(step.role)), "Role not assigned")}</span><div className="manager-workflows-page__step-actions"><button type="button" className="manager-workflows-page__text-button" onClick={() => openEditForm(step)}>Edit</button><button type="button" className="manager-workflows-page__text-button is-danger" onClick={() => deleteStep(step)}>Delete</button></div></li>)}</ol> : <div className="manager-workflows-page__empty"><strong>No steps in this workflow.</strong><span>Add steps to define its existing sequence.</span></div>}
          </section>
        </div>
      </main>

      {formOpen && <WorkflowStepModal step={editingStep} roles={roles} form={form} saving={saving} error={formError} onChange={handleChange} onClose={closeForm} onSubmit={saveStep} />}
    </div>
  );
}

function WorkflowStepModal({ step, roles, form, saving, error, onChange, onClose, onSubmit }) {
  const editing = Boolean(step);
  return <div className="manager-workflows-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="manager-workflows-page__modal" role="dialog" aria-modal="true" aria-labelledby="workflow-step-modal-title"><header className="manager-workflows-page__modal-header"><div><h2 id="workflow-step-modal-title">{editing ? "Edit Workflow Step" : "Add Workflow Step"}</h2><p>Configure the step name, role, and sequence position.</p></div><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header><form onSubmit={onSubmit}><div className="manager-workflows-page__form-grid"><label className="manager-workflows-page__field"><span>Step name <b>*</b></span><input name="name" value={form.name} onChange={onChange} required /></label><label className="manager-workflows-page__field"><span>Role</span><select name="role" value={form.role} onChange={onChange}><option value="">No role assigned</option>{roles.map((role) => <option key={role.id} value={role.id}>{formatDisplayValue(role.name)}</option>)}</select></label><label className="manager-workflows-page__field"><span>Sequence order <b>*</b></span><input type="number" min="0" step="1" name="sequence_order" value={form.sequence_order} onChange={onChange} required /></label></div>{error && <p className="manager-workflows-page__form-error" role="alert">{error}</p>}<footer className="manager-workflows-page__modal-actions"><button type="button" className="manager-workflows-page__secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="manager-workflows-page__primary-button" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add Step"}</button></footer></form></section></div>;
}

export default WorkflowStepsManager;
