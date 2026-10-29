import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import { createProduct } from "../../api/products";
import { addProductProperty } from "../../api/productProperties";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerProducts.css";

const emptyProductForm = {
  name: "",
  description: "",
  wholesale_price: "",
  retail_price: "",
  default_workflow: "",
  is_active: true,
};

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

function ProductsManager() {
  const [products, setProducts] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [propertyDraft, setPropertyDraft] = useState({ name: "", field_type: "text", options: "" });
  const [newProperties, setNewProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");

  const loadProducts = useCallback(() => api.get("manager/products/")
    .then((response) => {
      setProducts(asList(response.data));
      setLoadError("");
    })
    .catch((error) => {
      setLoadError(error.response?.data?.detail || "Products could not be loaded.");
    })
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    loadProducts();
    api.get("manager/workflows/")
      .then((response) => setWorkflows(asList(response.data)))
      .catch(() => setWorkflows([]));
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesActive = activeFilter === "all" ||
        (activeFilter === "active" ? product.is_active === true : product.is_active === false);
      const searchFields = [
        product.name,
        product.description,
        product.default_workflow_name,
        ...(Array.isArray(product.properties) ? product.properties.map((property) => property.name) : []),
        ...(Array.isArray(product.default_materials)
          ? product.default_materials.flatMap((material) => [material.material_name, material.variant_name])
          : []),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return matchesActive && (!query || searchFields.includes(query));
    });
  }, [products, search, activeFilter]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingProduct(null);
    setForm(emptyProductForm);
    setPropertyDraft({ name: "", field_type: "text", options: "" });
    setNewProperties([]);
    setFormError("");
  };

  const openCreateForm = () => {
    setSelectedProduct(null);
    setEditingProduct(null);
    setForm(emptyProductForm);
    setPropertyDraft({ name: "", field_type: "text", options: "" });
    setNewProperties([]);
    setFormError("");
    setFormOpen(true);
  };

  const startEdit = (product) => {
    setSelectedProduct(null);
    setEditingProduct(product.id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      wholesale_price: product.wholesale_price ?? "",
      retail_price: product.retail_price ?? "",
      default_workflow: product.default_workflow ?? "",
      is_active: product.is_active !== false,
    });
    setNewProperties([]);
    setFormError("");
    setFormOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const addPropertyDraft = () => {
    const name = propertyDraft.name.trim();
    if (!name) return;
    setNewProperties((current) => [...current, {
      name,
      field_type: propertyDraft.field_type,
      options: propertyDraft.field_type === "dropdown"
        ? propertyDraft.options.split(",").map((option) => option.trim()).filter(Boolean)
        : null,
    }]);
    setPropertyDraft({ name: "", field_type: "text", options: "" });
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    let createdProduct = null;
    try {
      const payload = {
        ...form,
        default_workflow: form.default_workflow ? Number(form.default_workflow) : null,
      };
      if (editingProduct !== null) {
        await api.put(`manager/products/${editingProduct}/`, payload);
      } else {
        createdProduct = await createProduct(payload);
        for (const property of newProperties) {
          await addProductProperty({ product: createdProduct.id, ...property });
        }
      }
      closeForm();
      await loadProducts();
    } catch (error) {
      if (createdProduct) await loadProducts();
      const responseData = error.response?.data;
      setFormError(
        typeof responseData === "string"
          ? responseData
          : responseData?.detail || "Product could not be saved. Check the entered information and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name || "this product"}?`)) return;
    try {
      await api.delete(`manager/products/${product.id}/`);
      if (selectedProduct?.id === product.id) setSelectedProduct(null);
      await loadProducts();
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Product could not be deleted.");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const role = formatDisplayValue(localStorage.getItem("role"), "Manager");
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="manager-dashboard manager-products-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Products</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content manager-products-page__content">
          <section className="manager-dashboard__page-heading manager-products-page__heading">
            <div>
              <h1>Products</h1>
              <p>{products.length} {products.length === 1 ? "product" : "products"} in the catalog</p>
            </div>
            <button type="button" className="manager-products-page__primary-button" onClick={openCreateForm}>
              <span aria-hidden="true">＋</span> Add Product
            </button>
          </section>

          {loadError && <div className="manager-products-page__alert" role="alert">{loadError}</div>}

          <div className="manager-products-page__toolbar">
            <label className="manager-products-page__search">
              <span aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" aria-label="Search products" />
            </label>
            <div className="manager-products-page__filters" role="group" aria-label="Filter products by activity">
              {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={activeFilter === value ? "is-active" : ""}
                  aria-pressed={activeFilter === value}
                  onClick={() => setActiveFilter(value)}
                >{label}</button>
              ))}
            </div>
            <span className="manager-products-page__result-count">{filteredProducts.length} {filteredProducts.length === 1 ? "result" : "results"}</span>
          </div>

          {loading ? (
            <div className="manager-products-page__empty">Loading products…</div>
          ) : filteredProducts.length === 0 ? (
            <div className="manager-products-page__empty">
              <span aria-hidden="true">⌕</span>
              <strong>{products.length ? "No products match these filters." : "No products have been added yet."}</strong>
              <span>{products.length ? "Try another search or activity filter." : "Add a product to start building the catalog."}</span>
            </div>
          ) : (
            <section className="manager-products-page__grid" aria-label="Products">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onDetails={() => setSelectedProduct(product)}
                  onEdit={() => startEdit(product)}
                  onDelete={() => deleteProduct(product)}
                />
              ))}
            </section>
          )}
        </div>
      </main>

      {formOpen && (
        <ProductModal
          form={form}
          editing={editingProduct !== null}
          workflows={workflows}
          propertyDraft={propertyDraft}
          newProperties={newProperties}
          saving={saving}
          error={formError}
          onChange={handleFormChange}
          onPropertyDraftChange={(event) => setPropertyDraft((current) => ({ ...current, [event.target.name]: event.target.value }))}
          onAddProperty={addPropertyDraft}
          onRemoveProperty={(index) => setNewProperties((current) => current.filter((_, propertyIndex) => propertyIndex !== index))}
          onClose={closeForm}
          onSubmit={saveProduct}
        />
      )}

      {selectedProduct && (
        <ProductDetails
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => startEdit(selectedProduct)}
          onDelete={() => deleteProduct(selectedProduct)}
        />
      )}
    </div>
  );
}

function ProductCard({ product, onDetails, onEdit, onDelete }) {
  const properties = Array.isArray(product.properties) ? product.properties : [];
  return (
    <article className="manager-products-page__card">
      <button type="button" className="manager-products-page__card-main" onClick={onDetails}>
        <span className="manager-products-page__card-eyebrow">
          {product.default_workflow_name
            ? formatDisplayValue(product.default_workflow_name)
            : "No default workflow"}
        </span>
        <span className="manager-products-page__card-title-row">
          <strong>{formatDisplayValue(product.name, "Unnamed product")}</strong>
          <span aria-hidden="true">›</span>
        </span>
        <span className="manager-products-page__description">
          {product.description ? formatDisplayValue(product.description) : "No description provided."}
        </span>
      </button>

      <div className="manager-products-page__card-prices">
        <div><span>Retail</span><strong>{formatPrice(product.retail_price)}</strong></div>
        <div><span>Wholesale</span><strong>{formatPrice(product.wholesale_price)}</strong></div>
      </div>

      <div className="manager-products-page__card-footer">
        <span className={`manager-products-page__active-badge${product.is_active === false ? " is-inactive" : ""}`}>
          {product.is_active === false ? "Inactive" : "Active"}
        </span>
        <span className="manager-products-page__property-count">{properties.length} {properties.length === 1 ? "property" : "properties"}</span>
        <div className="manager-products-page__card-actions">
          <button type="button" onClick={onEdit}>Edit</button>
          <button type="button" className="is-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </article>
  );
}

function ProductModal({ form, editing, workflows, propertyDraft, newProperties, saving, error, onChange, onPropertyDraftChange, onAddProperty, onRemoveProperty, onClose, onSubmit }) {
  return (
    <div className="manager-products-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-products-page__modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header className="manager-products-page__modal-header">
          <div>
            <h2 id="product-modal-title">{editing ? "Edit Product" : "Add Product"}</h2>
            <p>Product details, pricing, and workflow setup</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="manager-products-page__form-grid">
            <label className="manager-products-page__field manager-products-page__field--wide">
              <span>Product name <b>*</b></span>
              <input name="name" value={form.name} onChange={onChange} required />
            </label>
            <label className="manager-products-page__field manager-products-page__field--wide">
              <span>Description</span>
              <textarea name="description" value={form.description} onChange={onChange} rows="2" />
            </label>
            <label className="manager-products-page__field">
              <span>Retail price (₹)</span>
              <input type="number" step="0.01" name="retail_price" value={form.retail_price} onChange={onChange} />
            </label>
            <label className="manager-products-page__field">
              <span>Wholesale price (₹)</span>
              <input type="number" step="0.01" name="wholesale_price" value={form.wholesale_price} onChange={onChange} />
            </label>
            <label className="manager-products-page__field">
              <span>Default workflow</span>
              <select name="default_workflow" value={form.default_workflow} onChange={onChange}>
                <option value="">No default workflow</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>{formatDisplayValue(workflow.name)}</option>
                ))}
              </select>
            </label>
            <label className="manager-products-page__checkbox">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} />
              <span>Active product</span>
            </label>
          </div>

          {!editing && (
            <div className="manager-products-page__properties-editor">
              <div className="manager-products-page__subheading">
                <div><h3>Product properties</h3><p>Optional product-specific fields</p></div>
              </div>
              <div className="manager-products-page__property-draft">
                <input name="name" value={propertyDraft.name} onChange={onPropertyDraftChange} placeholder="Property name" aria-label="Property name" />
                <select name="field_type" value={propertyDraft.field_type} onChange={onPropertyDraftChange} aria-label="Property type">
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="dropdown">Dropdown</option>
                </select>
                {propertyDraft.field_type === "dropdown" && (
                  <input name="options" value={propertyDraft.options} onChange={onPropertyDraftChange} placeholder="Options, comma separated" aria-label="Dropdown options" />
                )}
                <button type="button" className="manager-products-page__secondary-button" onClick={onAddProperty}>Add property</button>
              </div>
              {newProperties.length > 0 && (
                <ul className="manager-products-page__pending-properties">
                  {newProperties.map((property, index) => (
                    <li key={`${property.name}-${index}`}>
                      <span><strong>{formatDisplayValue(property.name)}</strong><small>{formatDisplayValue(property.field_type)}</small></span>
                      <button type="button" onClick={() => onRemoveProperty(index)} aria-label={`Remove ${property.name}`}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="manager-products-page__form-error" role="alert">{error}</p>}
          <footer className="manager-products-page__modal-actions">
            <button type="button" className="manager-products-page__secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="manager-products-page__primary-button" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add Product"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ProductDetails({ product, onClose, onEdit, onDelete }) {
  const properties = Array.isArray(product.properties) ? product.properties : [];
  const materials = Array.isArray(product.default_materials) ? product.default_materials : [];
  return (
    <div className="manager-products-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-products-page__modal manager-products-page__details-modal" role="dialog" aria-modal="true" aria-labelledby="product-details-title">
        <header className="manager-products-page__modal-header">
          <div>
            <p className="manager-products-page__dialog-eyebrow">PRODUCT DETAILS</p>
            <h2 id="product-details-title">{formatDisplayValue(product.name, "Unnamed product")}</h2>
            <p>{formatDisplayValue(product.description, "No description provided.")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>

        <div className="manager-products-page__details-content">
          <div className="manager-products-page__price-summary">
            <div><span>Retail price</span><strong>{formatPrice(product.retail_price)}</strong></div>
            <div><span>Wholesale price</span><strong>{formatPrice(product.wholesale_price)}</strong></div>
          </div>
          <dl className="manager-products-page__details-grid">
            <div><dt>Status</dt><dd>{product.is_active === false ? "Inactive" : "Active"}</dd></div>
            <div><dt>Default workflow</dt><dd>{formatDisplayValue(product.default_workflow_name, "Not set")}</dd></div>
          </dl>
          <section className="manager-products-page__detail-section">
            <h3>Properties <span>{properties.length}</span></h3>
            {properties.length === 0 ? <p>No product properties returned.</p> : (
              <ul>{properties.map((property) => (
                <li key={property.id}>
                  <span>{formatDisplayValue(property.name)}</span>
                  <span>{formatDisplayValue(property.field_type)}{Array.isArray(property.options) && property.options.length ? ` · ${property.options.map((option) => formatDisplayValue(option)).join(", ")}` : ""}</span>
                </li>
              ))}</ul>
            )}
          </section>
          <section className="manager-products-page__detail-section">
            <h3>Default materials <span>{materials.length}</span></h3>
            {materials.length === 0 ? <p>No default materials returned.</p> : (
              <ul>{materials.map((material) => (
                <li key={material.id}>
                  <span>{formatDisplayValue(material.material_name, "Material")} · {formatDisplayValue(material.variant_name, "Variant")}</span>
                  <span>{material.default_quantity ?? "—"}</span>
                </li>
              ))}</ul>
            )}
          </section>
        </div>

        <footer className="manager-products-page__modal-actions">
          <button type="button" className="manager-products-page__danger-button" onClick={onDelete}>Delete</button>
          <button type="button" className="manager-products-page__secondary-button" onClick={onClose}>Close</button>
          <button type="button" className="manager-products-page__primary-button" onClick={onEdit}>Edit Product</button>
        </footer>
      </section>
    </div>
  );
}

export default ProductsManager;
