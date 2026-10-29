import ManagerSidebar from "../../components/ManagerSidebar";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/api";
import formatDisplayValue from "../worker/formatDisplayValue";
import "../../styles/managerDashboard.css";
import "../../styles/managerCustomers.css";

const emptyForm = {
  name: "",
  company_name: "",
  phone: "",
  email: "",
  address: "",
  customer_type: "retail",
  is_frequent: false,
  delivery_method: "direct",
  order_get_method: "direct",
};

const asCustomers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const customerSaveError = (data) => {
  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;

  const fieldLabels = { name: "Name", phone: "Phone", email: "Email", customer_type: "Customer type" };
  return Object.entries(data || {})
    .map(([field, messages]) => {
      const message = Array.isArray(messages) ? messages.join(" ") : typeof messages === "string" ? messages : "";
      if (!message) return "";
      return field === "non_field_errors" ? message : `${fieldLabels[field] || formatDisplayValue(field)}: ${message}`;
    })
    .filter(Boolean)
    .join(" ");
};

function CustomersManager() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [customerContextLoading, setCustomerContextLoading] = useState(true);
  const [customerContextError, setCustomerContextError] = useState("");

  const loadCustomers = useCallback(() => api.get("customers/")
    .then((response) => {
      const nextCustomers = asCustomers(response.data);
      setCustomers(nextCustomers);
      setSelectedCustomer((current) => current
        ? nextCustomers.find((customer) => customer.id === current.id) || null
        : null);
      setLoadError("");
      return nextCustomers;
    })
    .catch((error) => {
      setLoadError(error.response?.data?.detail || "Customers could not be loaded.");
    })
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get("worker/workorders/"),
      api.get("worker/history/"),
    ]).then(([ordersResult, historyResult]) => {
      if (!active) return;
      const errors = [];
      if (ordersResult.status === "fulfilled") {
        setOrders(asCustomers(ordersResult.value.data));
      } else {
        errors.push("Customer order details are unavailable.");
      }
      if (historyResult.status === "fulfilled") {
        setHistoryItems(asCustomers(historyResult.value.data));
      } else {
        errors.push("Saved payment totals are unavailable.");
      }
      setCustomerContextError(errors.join(" "));
      setCustomerContextLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return customers.filter((customer) => {
      const matchesType = customerTypeFilter === "all" || customer.customer_type === customerTypeFilter;
      const searchableText = [
        customer.name,
        customer.company_name,
        customer.phone,
        customer.email,
        customer.address,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return matchesType && (!query || searchableText.includes(query));
    });
  }, [customers, search, customerTypeFilter]);

  const customerMetrics = useMemo(() => {
    const ordersByCustomer = new Map();
    const customerByOrderId = new Map();
    orders.forEach((order) => {
      const customerId = Number(order.customer_id);
      if (!Number.isFinite(customerId)) return;
      const currentOrders = ordersByCustomer.get(customerId) || [];
      currentOrders.push(order);
      ordersByCustomer.set(customerId, currentOrders);
      customerByOrderId.set(Number(order.order_id), customerId);
    });

    const paidTotals = new Map();
    historyItems.forEach((item) => {
      if (!item.payment_received_at) return;
      const customerId = customerByOrderId.get(Number(item.order_id));
      if (customerId === undefined) return;
      const total = paidTotals.get(customerId) || { amount: 0, hasPaidItems: false, incomplete: false };
      total.hasPaidItems = true;
      const unitPrice = Number(item.unit_price_at_order);
      const quantity = Number(item.quantity);
      if (Number.isFinite(unitPrice) && Number.isFinite(quantity)) {
        total.amount += unitPrice * quantity;
      } else {
        total.incomplete = true;
      }
      paidTotals.set(customerId, total);
    });

    return { ordersByCustomer, paidTotals };
  }, [orders, historyItems]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const openCreateForm = () => {
    setSelectedCustomer(null);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const startEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      ...emptyForm,
      name: customer.name || "",
      company_name: customer.company_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      customer_type: customer.customer_type || "retail",
      is_frequent: Boolean(customer.is_frequent),
      delivery_method: customer.delivery_method || "direct",
      order_get_method: customer.order_get_method || "direct",
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      // Phone is optional and unique in the existing model. Send an actual
      // null for an omitted phone instead of reusing the unique empty string.
      const payload = { ...form, phone: form.phone.trim() || null };
      if (editingId) {
        await api.put(`customers/${editingId}/`, payload);
      } else {
        await api.post("customers/", payload);
      }
      closeForm();
      await loadCustomers();
    } catch (error) {
      setFormError(customerSaveError(error.response?.data) || "Customer could not be saved. Check the entered information and try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm("Delete this customer?")) return;
    try {
      await api.delete(`customers/${id}/`);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      await loadCustomers();
    } catch (error) {
      setLoadError(error.response?.data?.detail || "Customer could not be deleted.");
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
    <div className="manager-dashboard manager-customers-page">
      <ManagerSidebar role={role} onLogout={logout} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Customers</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>

        <div className="manager-dashboard__content manager-customers-page__content">
          {selectedCustomer ? (
            <CustomerDetails
              customer={selectedCustomer}
              orders={customerMetrics.ordersByCustomer.get(Number(selectedCustomer.id)) || []}
              paidTotal={customerMetrics.paidTotals.get(Number(selectedCustomer.id))}
              loading={customerContextLoading}
              contextError={customerContextError}
              onBack={() => setSelectedCustomer(null)}
              onEdit={() => startEdit(selectedCustomer)}
              onDelete={() => deleteCustomer(selectedCustomer.id)}
            />
          ) : (
          <>
          <section className="manager-dashboard__page-heading manager-customers-page__heading">
            <div>
              <h1>Customers</h1>
              <p>{customers.length} registered {customers.length === 1 ? "customer" : "customers"}</p>
            </div>
            <button type="button" className="manager-customers-page__primary-button" onClick={openCreateForm}>
              <span aria-hidden="true">＋</span> Add Customer
            </button>
          </section>

          {loadError && <div className="manager-customers-page__alert" role="alert">{loadError}</div>}

          <section className="manager-customers-page__directory" aria-label="Customer directory">
            <div className="manager-customers-page__toolbar">
              <label className="manager-customers-page__search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customers…"
                  aria-label="Search customers"
                />
              </label>
              <label className="manager-customers-page__type-filter">
                <span className="manager-customers-page__visually-hidden">Filter by customer type</span>
                <select value={customerTypeFilter} onChange={(event) => setCustomerTypeFilter(event.target.value)}>
                  <option value="all">All types</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                </select>
              </label>
              <span className="manager-customers-page__result-count">
                {filteredCustomers.length} {filteredCustomers.length === 1 ? "result" : "results"}
              </span>
            </div>
            {customerContextError && <p className="manager-customers-page__context-note" role="status">{customerContextError}</p>}

            <div className="manager-customers-page__table-wrap">
              <table className="manager-customers-page__table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Type</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Total spent</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td data-label="Customer">
                        <button type="button" className="manager-customers-page__customer-name" onClick={() => setSelectedCustomer(customer)}>
                          {formatDisplayValue(customer.company_name || customer.name, "Unnamed customer")}
                        </button>
                        {customer.company_name && customer.name && (
                          <span className="manager-customers-page__contact-name">{formatDisplayValue(customer.name)}</span>
                        )}
                        {customer.is_frequent && <span className="manager-customers-page__frequent-badge">Frequent</span>}
                      </td>
                      <td data-label="Type">
                        <span className={`manager-customers-page__type manager-customers-page__type--${customer.customer_type || "retail"}`}>
                          {formatDisplayValue(customer.customer_type || "retail")}
                        </span>
                      </td>
                      <td data-label="Contact">
                        <span className="manager-customers-page__contact-value">{customer.phone || "—"}</span>
                        <span className="manager-customers-page__contact-email">{customer.email || "—"}</span>
                      </td>
                      <td data-label="Orders" className="manager-customers-page__numeric-cell">
                        {customerContextLoading ? "—" : customerContextError.includes("order details") ? "—" : (customerMetrics.ordersByCustomer.get(Number(customer.id)) || []).length}
                      </td>
                      <td data-label="Total spent" className="manager-customers-page__numeric-cell">
                        {(() => {
                          const total = customerMetrics.paidTotals.get(Number(customer.id));
                          return !total?.hasPaidItems || total.incomplete
                            ? "—"
                            : formatCurrency(total.amount);
                        })()}
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan="5">
                        <div className="manager-customers-page__empty">
                          <span aria-hidden="true">⌕</span>
                          <strong>{customers.length ? "No customers match these filters." : "No customers have been added yet."}</strong>
                          <span>{customers.length ? "Try a different search or customer type." : "Add a customer to start building the directory."}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr><td colSpan="5"><div className="manager-customers-page__empty">Loading customers…</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          </>
          )}
        </div>
      </main>

      {formOpen && (
        <CustomerModal
          form={form}
          editing={editingId !== null}
          saving={saving}
          error={formError}
          onChange={handleChange}
          onClose={closeForm}
          onSubmit={saveCustomer}
        />
      )}

    </div>
  );
}

function CustomerModal({ form, editing, saving, error, onChange, onClose, onSubmit }) {
  return (
    <div className="manager-customers-page__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manager-customers-page__modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
        <header className="manager-customers-page__modal-header">
          <div>
            <h2 id="customer-modal-title">{editing ? "Edit Customer" : "Add Customer"}</h2>
            <p>Customer profile and order preferences</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="manager-customers-page__form-grid">
            <label className="manager-customers-page__field">
              <span>Full name</span>
              <input name="name" value={form.name} onChange={onChange} autoComplete="name" />
            </label>
            <label className="manager-customers-page__field">
              <span>Company / organization</span>
              <input name="company_name" value={form.company_name} onChange={onChange} autoComplete="organization" />
            </label>
            <label className="manager-customers-page__field">
              <span>Email</span>
              <input type="email" name="email" value={form.email} onChange={onChange} autoComplete="email" />
            </label>
            <label className="manager-customers-page__field">
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={onChange} autoComplete="tel" />
            </label>
            <label className="manager-customers-page__field manager-customers-page__field--wide">
              <span>Address</span>
              <textarea name="address" value={form.address} onChange={onChange} rows="2" autoComplete="street-address" />
            </label>
            <label className="manager-customers-page__field">
              <span>Customer type</span>
              <select name="customer_type" value={form.customer_type} onChange={onChange}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </label>
            <label className="manager-customers-page__field">
              <span>Usual delivery method</span>
              <select name="delivery_method" value={form.delivery_method} onChange={onChange}>
                <option value="bus">Bus</option>
                <option value="courier">Courier</option>
                <option value="direct">Direct</option>
                <option value="minnal">Minnal</option>
                <option value="others">Others</option>
              </select>
            </label>
            <label className="manager-customers-page__field">
              <span>Usual order/get method</span>
              <select name="order_get_method" value={form.order_get_method} onChange={onChange}>
                <option value="direct">Direct</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="person">Person</option>
              </select>
            </label>
            <label className="manager-customers-page__checkbox">
              <input type="checkbox" name="is_frequent" checked={form.is_frequent} onChange={onChange} />
              <span>Mark as frequent customer</span>
            </label>
          </div>
          {error && <p className="manager-customers-page__form-error" role="alert">{error}</p>}
          <footer className="manager-customers-page__modal-actions">
            <button type="button" className="manager-customers-page__secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="manager-customers-page__primary-button" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add Customer"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getOrderDisplayStatus(order) {
  if (order.completed === true) return { label: "Complete", complete: true };
  const task = order.my_task || (Array.isArray(order.products)
    ? order.products.flatMap((item) => Array.isArray(item.tasks) ? item.tasks : [])
      .find((candidate) => candidate.status === "in_progress" || candidate.status === "ready")
    : null);
  return task?.step
    ? { label: formatDisplayValue(task.step), complete: false }
    : { label: "—", complete: false };
}

function CustomerDetails({ customer, orders, paidTotal, loading, contextError, onBack, onEdit, onDelete }) {
  return (
    <section className="manager-customers-page__profile" aria-labelledby="customer-details-title">
      <div className="manager-customers-page__profile-toolbar">
        <button type="button" className="manager-customers-page__back" onClick={onBack}>‹ <span>Customers</span></button>
        <div className="manager-customers-page__profile-actions">
          <button type="button" className="manager-customers-page__danger-button" onClick={onDelete}>Delete</button>
          <button type="button" className="manager-customers-page__primary-button" onClick={onEdit}>Edit</button>
        </div>
      </div>

      <section className="manager-customers-page__profile-card">
        <span className={`manager-customers-page__type manager-customers-page__type--${customer.customer_type || "retail"}`}>
          {formatDisplayValue(customer.customer_type || "retail")}
        </span>
        <h1 id="customer-details-title">{formatDisplayValue(customer.company_name || customer.name, "Unnamed customer")}</h1>
        {customer.company_name && customer.name && <p className="manager-customers-page__profile-contact-name">{formatDisplayValue(customer.name)}</p>}
        <div className="manager-customers-page__profile-contact">
          <div><span>Email</span><strong>{customer.email || "—"}</strong></div>
          <div><span>Phone</span><strong>{customer.phone || "—"}</strong></div>
          <div className="is-wide"><span>Address</span><strong>{customer.address || "—"}</strong></div>
        </div>
      </section>

      <section className="manager-customers-page__order-history" aria-labelledby="customer-orders-title">
        <div className="manager-customers-page__section-title">
          <h2 id="customer-orders-title">Order History</h2>
          <span>{loading ? "—" : orders.length} {orders.length === 1 ? "order" : "orders"}</span>
        </div>
        {contextError && <p className="manager-customers-page__context-note" role="status">{contextError}</p>}
        <div className="manager-customers-page__table-wrap">
          <table className="manager-customers-page__table manager-customers-page__order-table">
            <thead>
              <tr><th scope="col">Order ID</th><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Due date</th></tr>
            </thead>
            <tbody>
              {!loading && orders.map((order) => {
                const status = getOrderDisplayStatus(order);
                const products = Array.isArray(order.products) ? order.products : [];
                return (
                  <tr key={order.order_id}>
                    <td data-label="Order ID" className="manager-customers-page__order-id">ORD-{String(order.order_id).padStart(4, "0")}</td>
                    <td data-label="Product" className="manager-customers-page__order-products">
                      {products.length
                        ? products.map((item) => `${item.quantity ?? "—"} × ${formatDisplayValue(item.product, "Product")}`).join(", ")
                        : "—"}
                    </td>
                    <td data-label="Status"><span className={`manager-customers-page__order-status${status.complete ? " is-complete" : ""}`}>{status.label}</span></td>
                    <td data-label="Amount">{formatCurrency(order.grand_total)}</td>
                    <td data-label="Due date">{order.delivery_date || "—"}</td>
                  </tr>
                );
              })}
              {!loading && orders.length === 0 && (
                <tr><td colSpan="5"><div className="manager-customers-page__empty">No orders are available for this customer.</div></td></tr>
              )}
              {loading && <tr><td colSpan="5"><div className="manager-customers-page__empty">Loading order history…</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manager-customers-page__summary" aria-label="Customer order summary">
        <div><strong>{loading ? "—" : orders.length}</strong><span>Total orders</span></div>
        <div>
          <strong>{paidTotal?.hasPaidItems && !paidTotal.incomplete ? formatCurrency(paidTotal.amount) : "—"}</strong>
          <span>Total spent</span>
          {paidTotal?.incomplete && <small>Some paid item prices are unavailable.</small>}
        </div>
      </section>

      <section className="manager-customers-page__preferences" aria-label="Customer preferences">
        <div><span>Frequent customer</span><strong>{customer.is_frequent ? "Yes" : "No"}</strong></div>
        <div><span>Usual delivery</span><strong>{formatDisplayValue(customer.delivery_method || "direct")}</strong></div>
        <div><span>Order received by</span><strong>{formatDisplayValue(customer.order_get_method || "direct")}</strong></div>
      </section>
    </section>
  );
}

export default CustomersManager;
