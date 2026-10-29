import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerMaterials.css";

const emptyVariant = { material: "", name: "", stock: "", unit: "pcs", base_cost: "" };

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatPrice = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `₹ ${number.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : `₹ ${value}`;
};

export default function RawMaterialsManager() {
  const [materials, setMaterials] = useState([]);
  const [variants, setVariants] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const [newMaterial, setNewMaterial] = useState("");
  const [lowStockLimit, setLowStockLimit] = useState("");
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [savingStockId, setSavingStockId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [materialResponse, variantResponse] = await Promise.all([
        api.get("manager/raw-materials/"),
        api.get("manager/raw-material-variants/"),
      ]);
      setMaterials(asList(materialResponse.data));
      setVariants(asList(variantResponse.data));
      setLoadError("");
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Materials could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!deleteError) return undefined;
    const timer = setTimeout(() => setDeleteError(""), 3000);
    return () => clearTimeout(timer);
  }, [deleteError]);

  const materialById = useMemo(() => new Map(materials.map((material) => [String(material.id), material])), [materials]);
  const lowStockVariants = useMemo(() => variants.filter((variant) => variant.low_stock === true), [variants]);
  const filteredVariants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return variants.filter((variant) => {
      const material = materialById.get(String(variant.material));
      return !query || [variant.material_name, material?.name, variant.name, variant.unit]
        .filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
    });
  }, [variants, materialById, search]);
  const materialsWithoutVariants = useMemo(() => {
    const materialsWithVariants = new Set(variants.map((variant) => String(variant.material)));
    const query = search.trim().toLocaleLowerCase();
    return materials.filter((material) =>
      !materialsWithVariants.has(String(material.id)) &&
      (!query || String(material.name || "").toLocaleLowerCase().includes(query))
    );
  }, [materials, variants, search]);
  const inventoryResultCount = filteredVariants.length + materialsWithoutVariants.length;

  const openMaterialForm = () => {
    setNewMaterial("");
    setLowStockLimit("");
    setFormError("");
    setModal("material");
  };

  const openVariantForm = () => {
    setVariantForm({ ...emptyVariant, material: materials[0]?.id ? String(materials[0].id) : "" });
    setFormError("");
    setModal("variant");
  };

  const closeModal = () => {
    setModal("");
    setFormError("");
  };

  const addMaterial = async (event) => {
    event.preventDefault();
    if (!newMaterial.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      await api.post("manager/raw-materials/", {
        name: newMaterial,
        low_stock_limit: lowStockLimit,
      });
      closeModal();
      await loadData();
    } catch (error) {
      setFormError(error.response?.data?.detail || "Material could not be added.");
    } finally {
      setSaving(false);
    }
  };

  const addVariant = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post("manager/raw-material-variants/", variantForm);
      closeModal();
      await loadData();
    } catch (error) {
      setFormError(error.response?.data?.detail || "Material variant could not be added.");
    } finally {
      setSaving(false);
    }
  };

  const saveStock = async (variant) => {
    setSavingStockId(variant.id);
    setLoadError("");
    try {
      await api.put(`manager/raw-material-variants/${variant.id}/`, variant);
      await loadData();
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Stock could not be saved.");
    } finally {
      setSavingStockId(null);
    }
  };

  const deleteVariant = async (variant) => {
    if (!window.confirm(`Delete ${variant.name || "this variant"}?`)) return;
    try {
      await api.delete(`manager/raw-material-variants/${variant.id}/`);
      setDeleteError("");
      await loadData();
    } catch (error) {
      setDeleteError(error.response?.data?.error || "Cannot delete this material variant.");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date());

  return (
    <div className="manager-dashboard manager-materials-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Materials</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content manager-materials-page__content">
          <section className="manager-dashboard__page-heading manager-materials-page__heading">
            <div><h1>Materials</h1><p>{materials.length} {materials.length === 1 ? "material" : "materials"} · {lowStockVariants.length} low stock</p></div>
            <div className="manager-materials-page__heading-actions">
              <button type="button" className="manager-materials-page__secondary-button" onClick={openVariantForm} disabled={materials.length === 0}>Add Variant</button>
              <button type="button" className="manager-materials-page__primary-button" onClick={openMaterialForm}><span aria-hidden="true">＋</span> Add Material</button>
            </div>
          </section>

          {lowStockVariants.length > 0 && (
            <section className="manager-materials-page__low-stock-alert" aria-label="Low stock alert">
              <span className="manager-materials-page__alert-icon" aria-hidden="true">!</span>
              <div><strong>Low Stock Alert</strong><p>{lowStockVariants.map((variant) => formatDisplayValue(variant.material_name || variant.name)).join(", ")} · reorder required</p></div>
              <span className="manager-materials-page__alert-count">{lowStockVariants.length}</span>
            </section>
          )}

          {loadError && <div className="manager-materials-page__alert" role="alert">{loadError}</div>}
          {deleteError && <div className="manager-materials-page__alert manager-materials-page__alert--error" role="alert">{deleteError}</div>}

          <section className="manager-materials-page__inventory" aria-label="Material inventory">
            <div className="manager-materials-page__toolbar">
              <label className="manager-materials-page__search">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search materials or variants…" aria-label="Search materials and variants" />
              </label>
              <span className="manager-materials-page__result-count">{inventoryResultCount} {inventoryResultCount === 1 ? "item" : "items"}</span>
            </div>
            <div className="manager-materials-page__table-wrap">
              <table className="manager-materials-page__table">
                <thead><tr>
                  <th scope="col">Material</th><th scope="col">Variant</th><th scope="col">Stock</th><th scope="col">Min. stock</th><th scope="col">Status</th><th scope="col">Unit price</th><th scope="col">Actions</th>
                </tr></thead>
                <tbody>
                  {!loading && filteredVariants.map((variant) => {
                    const material = materialById.get(String(variant.material));
                    return (
                      <tr key={variant.id} className={variant.low_stock === true ? "is-low-stock" : ""}>
                        <td data-label="Material"><strong>{formatDisplayValue(variant.material_name || material?.name, "Material")}</strong></td>
                        <td data-label="Variant">{formatDisplayValue(variant.name)}</td>
                        <td data-label="Stock">
                          <div className="manager-materials-page__stock-edit">
                            <input aria-label={`Stock for ${variant.name}`} type="number" value={variant.stock ?? ""} onChange={(event) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, stock: event.target.value } : item))} />
                            <span>{formatDisplayValue(variant.unit, "")}</span>
                            <button type="button" className="manager-materials-page__save-button" onClick={() => saveStock(variant)} disabled={savingStockId === variant.id}>{savingStockId === variant.id ? "Saving…" : "Save"}</button>
                          </div>
                        </td>
                        <td data-label="Min. stock">{material?.low_stock_limit ?? "—"}{variant.unit ? ` ${formatDisplayValue(variant.unit, "")}` : ""}</td>
                        <td data-label="Status"><span className={`manager-materials-page__status${variant.low_stock === true ? " is-low" : ""}`}><i aria-hidden="true" />{variant.low_stock === true ? "Low stock" : "OK"}</span></td>
                        <td data-label="Unit price">{formatPrice(variant.base_cost)}{variant.unit ? <small> / {formatDisplayValue(variant.unit, "")}</small> : null}</td>
                        <td data-label="Actions"><button type="button" className="manager-materials-page__delete-button" onClick={() => deleteVariant(variant)}>Delete</button></td>
                      </tr>
                    );
                  })}
                  {!loading && materialsWithoutVariants.map((material) => (
                    <tr key={`material-${material.id}`}>
                      <td data-label="Material"><strong>{formatDisplayValue(material.name, "Material")}</strong></td>
                      <td data-label="Variant">—</td>
                      <td data-label="Stock">—</td>
                      <td data-label="Min. stock">{material.low_stock_limit ?? "—"}</td>
                      <td data-label="Status">—</td>
                      <td data-label="Unit price">—</td>
                      <td data-label="Actions">—</td>
                    </tr>
                  ))}
                  {!loading && inventoryResultCount === 0 && <tr><td colSpan="7"><div className="manager-materials-page__empty"><strong>{variants.length || materials.length ? "No materials match your search." : "No materials have been added yet."}</strong><span>{variants.length || materials.length ? "Try another material or variant name." : "Add a material to begin tracking inventory."}</span></div></td></tr>}
                  {loading && <tr><td colSpan="7"><div className="manager-materials-page__empty">Loading materials…</div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {modal && (
        <MaterialModal
          kind={modal}
          materials={materials}
          materialName={newMaterial}
          lowStockLimit={lowStockLimit}
          variantForm={variantForm}
          saving={saving}
          error={formError}
          onMaterialNameChange={setNewMaterial}
          onLowStockLimitChange={setLowStockLimit}
          onVariantChange={(event) => setVariantForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
          onClose={closeModal}
          onSubmit={modal === "material" ? addMaterial : addVariant}
        />
      )}
    </div>
  );
}

function MaterialModal({ kind, materials, materialName, lowStockLimit, variantForm, saving, error, onMaterialNameChange, onLowStockLimitChange, onVariantChange, onClose, onSubmit }) {
  const isMaterial = kind === "material";
  return (
    <div className="manager-materials-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-materials-page__modal" role="dialog" aria-modal="true" aria-labelledby="material-modal-title">
        <header className="manager-materials-page__modal-header">
          <div><h2 id="material-modal-title">{isMaterial ? "Add Material" : "Add Material Variant"}</h2><p>{isMaterial ? "Create a material and its stock threshold." : "Add a stock variant to an existing material."}</p></div>
          <button type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="manager-materials-page__form-grid">
            {isMaterial ? <>
              <label className="manager-materials-page__field manager-materials-page__field--wide"><span>Material name <b>*</b></span><input value={materialName} onChange={(event) => onMaterialNameChange(event.target.value)} required /></label>
              <label className="manager-materials-page__field"><span>Low stock alert limit</span><input type="number" value={lowStockLimit} onChange={(event) => onLowStockLimitChange(event.target.value)} /></label>
            </> : <>
              <label className="manager-materials-page__field manager-materials-page__field--wide"><span>Material <b>*</b></span><select name="material" value={variantForm.material} onChange={onVariantChange} required><option value="">Select material</option>{materials.map((material) => <option key={material.id} value={material.id}>{formatDisplayValue(material.name)}</option>)}</select></label>
              <label className="manager-materials-page__field manager-materials-page__field--wide"><span>Variant name <b>*</b></span><input name="name" value={variantForm.name} onChange={onVariantChange} required /></label>
              <label className="manager-materials-page__field"><span>Initial stock</span><input type="number" step="any" name="stock" value={variantForm.stock} onChange={onVariantChange} /></label>
              <label className="manager-materials-page__field"><span>Unit</span><input name="unit" value={variantForm.unit} onChange={onVariantChange} /></label>
              <label className="manager-materials-page__field"><span>Price per unit (₹)</span><input type="number" step="0.01" name="base_cost" value={variantForm.base_cost} onChange={onVariantChange} /></label>
            </>}
          </div>
          {error && <p className="manager-materials-page__form-error" role="alert">{error}</p>}
          <footer className="manager-materials-page__modal-actions"><button type="button" className="manager-materials-page__secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="manager-materials-page__primary-button" disabled={saving}>{saving ? "Saving…" : isMaterial ? "Add Material" : "Add Variant"}</button></footer>
        </form>
      </section>
    </div>
  );
}
