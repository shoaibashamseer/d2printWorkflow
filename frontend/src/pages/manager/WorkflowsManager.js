import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerWorkflows.css";

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

function WorkflowsManager() {
  const [workflows, setWorkflows] = useState([]);
  const [products, setProducts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [productsAvailable, setProductsAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get("manager/workflows/"),
      api.get("manager/products/"),
      api.get("roles/"),
    ]);
    const [workflowResult, productResult, roleResult] = results;
    if (workflowResult.status === "fulfilled") {
      setWorkflows(asList(workflowResult.value.data));
      setLoadError("");
    } else {
      setLoadError(workflowResult.reason.response?.data?.detail || "Workflows could not be loaded.");
    }
    if (productResult.status === "fulfilled") {
      setProducts(asList(productResult.value.data));
      setProductsAvailable(true);
    } else {
      setProducts([]);
      setProductsAvailable(false);
    }
    if (roleResult.status === "fulfilled") setRoles(asList(roleResult.value.data));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const rolesById = useMemo(() => new Map(roles.map((role) => [String(role.id), role.name])), [roles]);
  const filteredWorkflows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return workflows.filter((workflow) => {
      const text = [workflow.name, workflow.description, ...(workflow.steps || []).flatMap((step) => [step.name, rolesById.get(String(step.role))])]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return !query || text.includes(query);
    });
  }, [workflows, search, rolesById]);

  const productsForWorkflow = (workflowId) => products.filter((product) => String(product.default_workflow) === String(workflowId));

  const closeModal = () => {
    setModalOpen(false);
    setEditingWorkflow(null);
    setForm({ name: "", description: "" });
    setFormError("");
  };

  const openCreateModal = () => {
    setEditingWorkflow(null);
    setForm({ name: "", description: "" });
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (workflow) => {
    setEditingWorkflow(workflow);
    setForm({ name: workflow.name || "", description: workflow.description || "" });
    setFormError("");
    setModalOpen(true);
  };

  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const saveWorkflow = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError("Workflow name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingWorkflow) await api.put(`manager/workflows/${editingWorkflow.id}/`, form);
      else await api.post("manager/workflows/", form);
      closeModal();
      await loadData();
    } catch (error) {
      setFormError(error.response?.data?.detail || "Workflow could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkflow = async (workflow) => {
    const confirmed = window.confirm(
      `Delete workflow “${workflow.name}”? Existing backend behavior also deletes its workflow steps and OrderItems/tasks that reference this workflow. Products using it as their default workflow will have that reference cleared.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`manager/workflows/${workflow.id}/`);
      await loadData();
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Workflow could not be deleted.");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");
  const currentDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());

  return (
    <div className="manager-dashboard manager-workflows-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar"><div className="manager-dashboard__breadcrumb"><p className="manager-dashboard__eyebrow">MANAGER AREA</p><span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span><p className="manager-dashboard__crumb">Workflows</p></div><span className="manager-dashboard__date">{currentDate}</span></header>
        <div className="manager-dashboard__content manager-workflows-page__content">
          <section className="manager-dashboard__page-heading manager-workflows-page__heading"><div><h1>Workflows</h1><p>{workflows.length} {workflows.length === 1 ? "workflow" : "workflows"} configured</p></div><button type="button" className="manager-workflows-page__primary-button" onClick={openCreateModal}><span aria-hidden="true">＋</span> New Workflow</button></section>

          {loadError && <div className="manager-workflows-page__alert" role="alert">{loadError}</div>}
          <div className="manager-workflows-page__toolbar"><label className="manager-workflows-page__search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workflows or steps…" aria-label="Search workflows" /></label><span className="manager-workflows-page__result-count">{filteredWorkflows.length} {filteredWorkflows.length === 1 ? "result" : "results"}</span></div>

          {loading ? <div className="manager-workflows-page__empty">Loading workflows…</div> : filteredWorkflows.length ? (
            <section className="manager-workflows-page__grid" aria-label="Workflow templates">{filteredWorkflows.map((workflow) => {
              const orderedSteps = [...(Array.isArray(workflow.steps) ? workflow.steps : [])].sort((left, right) => Number(left.sequence_order) - Number(right.sequence_order));
              const linkedProducts = productsForWorkflow(workflow.id);
              return <article className="manager-workflows-page__card" key={workflow.id}>
                <header className="manager-workflows-page__card-header"><div><span className="manager-workflows-page__card-eyebrow">WORKFLOW TEMPLATE</span><h2>{formatDisplayValue(workflow.name, "Unnamed workflow")}</h2></div><span className="manager-workflows-page__step-count">{orderedSteps.length} {orderedSteps.length === 1 ? "step" : "steps"}</span></header>
                {workflow.description && <p className="manager-workflows-page__description">{formatDisplayValue(workflow.description)}</p>}
                <div className="manager-workflows-page__steps-preview" aria-label="Workflow steps">{orderedSteps.length ? orderedSteps.slice(0, 5).map((step, index) => <div className="manager-workflows-page__step-preview" key={step.id}><span className="manager-workflows-page__sequence">{step.sequence_order}</span><span className="manager-workflows-page__step-copy"><strong>{formatDisplayValue(step.name)}</strong><small>{formatDisplayValue(rolesById.get(String(step.role)), "Role not assigned")}</small></span>{index < Math.min(orderedSteps.length, 5) - 1 && <span className="manager-workflows-page__connector" aria-hidden="true" />}</div>) : <p className="manager-workflows-page__no-steps">No workflow steps yet.</p>}{orderedSteps.length > 5 && <span className="manager-workflows-page__more-steps">+{orderedSteps.length - 5} more</span>}</div>
                <footer className="manager-workflows-page__card-footer"><span>{productsAvailable ? `${linkedProducts.length} ${linkedProducts.length === 1 ? "product" : "products"} use this as default` : ""}</span><div><button type="button" className="manager-workflows-page__text-button" onClick={() => openEditModal(workflow)}>Edit</button><button type="button" className="manager-workflows-page__text-button is-danger" onClick={() => deleteWorkflow(workflow)}>Delete</button><Link to={`/manager/workflows/${workflow.id}/steps`} className="manager-workflows-page__manage-link">Manage Steps <span aria-hidden="true">→</span></Link></div></footer>
              </article>;
            })}</section>
          ) : <div className="manager-workflows-page__empty"><strong>{workflows.length ? "No workflows match your search." : "No workflows have been created yet."}</strong><span>{workflows.length ? "Try a different workflow or step name." : "Create a workflow, then add its ordered steps."}</span></div>}
        </div>
      </main>

      {modalOpen && <WorkflowModal workflow={editingWorkflow} form={form} saving={saving} error={formError} onChange={handleChange} onClose={closeModal} onSubmit={saveWorkflow} />}
    </div>
  );
}

function WorkflowModal({ workflow, form, saving, error, onChange, onClose, onSubmit }) {
  const editing = Boolean(workflow);
  return <div className="manager-workflows-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="manager-workflows-page__modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title"><header className="manager-workflows-page__modal-header"><div><h2 id="workflow-modal-title">{editing ? "Edit Workflow" : "New Workflow"}</h2><p>Set the workflow name and description.</p></div><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header><form onSubmit={onSubmit}><div className="manager-workflows-page__form-grid"><label className="manager-workflows-page__field"><span>Workflow name <b>*</b></span><input name="name" value={form.name} onChange={onChange} required /></label><label className="manager-workflows-page__field"><span>Description</span><textarea name="description" value={form.description} onChange={onChange} rows="3" /></label></div>{error && <p className="manager-workflows-page__form-error" role="alert">{error}</p>}<footer className="manager-workflows-page__modal-actions"><button type="button" className="manager-workflows-page__secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="manager-workflows-page__primary-button" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create Workflow"}</button></footer></form></section></div>;
}

export default WorkflowsManager;
