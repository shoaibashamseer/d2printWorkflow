import { useEffect, useState } from "react";
import api from "../api/api";
import "../styles/placeOrder.css";
import SmartSearchInput from "../components/SmartSearchInput";

export default function PlaceOrderForm({ onSuccess, showHeading = true }) {
  const [products, setProducts] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [materialVariants, setMaterialVariants] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("bus");
  const [orderGetMethod, setOrderGetMethod] = useState("direct");
  const [items, setItems] = useState([{ productId: "", workflowId: "", quantity: 1, features: [], materials: [] }]);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    api.get("manager/products/").then((res) => setProducts(res.data));
    api.get("manager/workflows/").then((res) => setWorkflows(res.data));
    api.get("customers/").then((res) => setCustomers(res.data));
    api.get("manager/raw-material-variants/").then((res) => setMaterialVariants(res.data));
  }, []);

  const getSelectedCustomer = () => customers.find((customer) => customer.id === parseInt(customerId));

  const getProductPrice = (product) => {
    const customer = getSelectedCustomer();
    if (!customer || !product) return 0;
    return customer.customer_type === "wholesale" ? product.wholesale_price : product.retail_price;
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { productId: "", workflowId: "", quantity: 1, features: [], materials: [] }]);
  };

  const addMaterial = (index, variantId) => {
    if (!variantId) return;
    const updated = [...items];
    if (updated[index].materials.find((material) => material.variantId == variantId)) return;
    updated[index].materials.push({ variantId, quantity: 1 });
    setItems(updated);
  };

  const submitOrder = async () => {
    setOrderError("");

    // The order API builds workflow tasks from each product's saved default
    // workflow. A workflow selected in this form is not used by that API.
    // Validate before creating a customer or posting the order, because the
    // backend can persist the order before rejecting an item with no default.
    const missingWorkflowItems = items.flatMap((item, index) => {
      const product = products.find((entry) => String(entry.id) === String(item.productId));
      if (!product) return [];
      return product.default_workflow ? [] : [index + 1];
    });
    if (missingWorkflowItems.length) {
      setOrderError(
        `Set a default workflow for ${missingWorkflowItems.length === 1 ? "item" : "items"} ${missingWorkflowItems.join(", ")} in Products before placing this order.`
      );
      return;
    }

    try {
      let finalCustomerId = customerId;
      if (!customerId && newCustomerName.trim()) {
        const res = await api.post("customers/", { name: newCustomerName, phone: newCustomerPhone });
        finalCustomerId = res.data.id;
      }

      const payload = {
        customer: Number(finalCustomerId),
        delivery_date: deliveryDate ? deliveryDate.split("T")[0] : "",
        delivery_method: deliveryMethod,
        order_get_method: orderGetMethod,
        items: items.map((item) => ({
          product: Number(item.productId),
          workflow: Number(item.workflowId),
          quantity: Number(item.quantity),
          features: item.features,
          materials: item.materials.map((material) => ({
            variant: Number(material.variantId),
            quantity_used: Number(material.quantity),
          })),
        })),
      };

      await api.post("orders/", payload);
      alert("Order Created Successfully");
      await onSuccess?.();
    } catch (err) {
      console.log("ORDER ERROR:", err.response?.data);
      alert(JSON.stringify(err.response?.data));
    }
  };

  const calculateGrandTotal = () => {
    let total = 0;
    items.forEach((item) => {
      const product = products.find((entry) => entry.id == item.productId);
      const price = getProductPrice(product);
      total += price * (item.quantity || 0);
    });
    return total;
  };
  const selectedCustomer = getSelectedCustomer();

  return (
        <div className="manager-place-order-page manager-place-order-form manager-place-order-page__content">
          {showHeading && <section className="manager-dashboard__page-heading manager-place-order-page__heading"><div><h1>Place Order</h1><p>Create an order with one or more products and the required delivery details.</p></div></section>}

          <section className="manager-place-order-page__section" aria-labelledby="place-order-customer-heading">
            <header className="manager-place-order-page__section-header"><span className="manager-place-order-page__section-number">01</span><div><h2 id="place-order-customer-heading">Customer</h2><p>Select an existing customer or enter a new customer.</p></div></header>
            <div className="manager-place-order-page__section-body">
              <label className="manager-place-order-page__field"><span>Customer <b>*</b></span><SmartSearchInput items={customers} value={customerId} placeholder="Search or create customer" onSelect={(customer) => { setCustomerId(customer.id); setNewCustomerName(""); setNewCustomerPhone(""); }} onCreate={(name) => { setCustomerId(""); setNewCustomerName(name); }} /></label>
              {!customerId && newCustomerName && <label className="manager-place-order-page__field"><span>Customer phone</span><input className="form-input" placeholder="Customer phone number" value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value)} /></label>}
              {selectedCustomer && <div className="manager-place-order-page__customer-summary"><span className="manager-place-order-page__customer-mark" aria-hidden="true">{(selectedCustomer.company_name || selectedCustomer.name || "C").charAt(0).toUpperCase()}</span><div><strong>{selectedCustomer.company_name || selectedCustomer.name}</strong>{selectedCustomer.company_name && selectedCustomer.name && <small>{selectedCustomer.name}</small>}</div><span className="manager-place-order-page__customer-type">{String(selectedCustomer.customer_type || "retail").toLocaleLowerCase() === "wholesale" ? "Wholesale" : "Retail"} pricing</span></div>}
              {!customerId && newCustomerName && <div className="manager-place-order-page__customer-summary"><span className="manager-place-order-page__customer-mark" aria-hidden="true">{newCustomerName.charAt(0).toUpperCase()}</span><div><strong>{newCustomerName}</strong><small>New customer</small></div></div>}
            </div>
          </section>

          <section className="manager-place-order-page__section" aria-labelledby="place-order-items-heading">
            <header className="manager-place-order-page__section-header manager-place-order-page__section-header--items"><span className="manager-place-order-page__section-number">02</span><div><h2 id="place-order-items-heading">Products &amp; Items</h2><p>Add products, quantities, workflows, and materials.</p></div><span className="manager-place-order-page__item-count">{items.length} {items.length === 1 ? "item" : "items"}</span></header>
            <div className="manager-place-order-page__items">
              {items.map((item, index) => {
                const product = products.find((entry) => entry.id == item.productId);
                const pricePerUnit = getProductPrice(product);
                const total = pricePerUnit * (item.quantity || 0);
                return <article key={index} className="manager-place-order-page__item-card">
                  <header className="manager-place-order-page__item-header"><span className="manager-place-order-page__item-index">Item {String(index + 1).padStart(2, "0")}</span>{product && <span className="manager-place-order-page__line-total">Line total <strong>₹{Number(total).toLocaleString("en-IN")}</strong></span>}</header>
                  <div className="manager-place-order-page__item-fields">
                    <label className="manager-place-order-page__field manager-place-order-page__field--wide"><span>Product <b>*</b></span><SmartSearchInput items={products} value={item.productId} placeholder="Search or create product" onSelect={(selectedProduct) => {
                      const updated = [...items];
                      updated[index].productId = selectedProduct.id;
                      if (selectedProduct.default_workflow) updated[index].workflowId = selectedProduct.default_workflow;
                      if (selectedProduct.default_materials?.length) updated[index].materials = selectedProduct.default_materials.map((material) => ({ variantId: material.variant, quantity: material.default_quantity }));
                      setItems(updated);
                    }} onCreate={async (name) => {
                      const res = await api.post("manager/products/", { name });
                      setProducts([...products, res.data]);
                      const updated = [...items];
                      updated[index].productId = res.data.id;
                      if (res.data.default_workflow) updated[index].workflowId = res.data.default_workflow;
                      setItems(updated);
                    }} /></label>
                    <label className="manager-place-order-page__field"><span>Workflow <b>*</b></span><select className="form-input" value={item.workflowId} onChange={(event) => updateItem(index, "workflowId", event.target.value)}><option value="">Select workflow</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select></label>
                    <label className="manager-place-order-page__field"><span>Quantity <b>*</b></span><input className="form-input" type="number" placeholder="Quantity" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} /></label>
                  </div>
                  {product && <div className="manager-place-order-page__price-info"><span><small>{selectedCustomer?.customer_type === "wholesale" ? "Wholesale price" : "Retail price"}</small><strong>₹{Number(pricePerUnit).toLocaleString("en-IN")}</strong></span><span className="manager-place-order-page__pricing-note">Price based on customer type</span></div>}

                  <div className="manager-place-order-page__materials"><div className="manager-place-order-page__subsection-heading"><div><h3>Materials</h3><p>Optional material variants for this item.</p></div></div><label className="manager-place-order-page__field"><span>Add material</span><SmartSearchInput items={materialVariants} value="" displayField="name" placeholder="Search material variants" onSelect={(variant) => addMaterial(index, variant.id)} onCreate={async (name) => {
                    try {
                      const res = await api.post("manager/raw-material-variants/", { name });
                      setMaterialVariants((previous) => [...previous, res.data]);
                      addMaterial(index, res.data.id);
                    } catch (err) {
                      alert("Unable to create material.");
                      console.log(err.response?.data);
                    }
                  }} /></label>
                    {item.materials.length > 0 && <div className="manager-place-order-page__selected-materials">{item.materials.map((material, materialIndex) => {
                      const variant = materialVariants.find((entry) => entry.id == material.variantId);
                      return <div className="manager-place-order-page__material-row" key={materialIndex}><div className="manager-place-order-page__material-name"><strong>{variant?.material_name || "Material"}</strong><small>{variant?.name || "Variant"}</small></div><label className="manager-place-order-page__material-quantity"><span>Quantity</span><input className="form-input" type="number" min="1" step="1" value={material.quantity} onChange={(event) => {
                        const updated = [...items];
                        updated[index].materials[materialIndex].quantity = event.target.value;
                        setItems(updated);
                      }} /></label><button type="button" className="manager-place-order-page__remove-button" onClick={() => {
                        const updated = [...items];
                        updated[index].materials = updated[index].materials.filter((_, materialPosition) => materialPosition !== materialIndex);
                        setItems(updated);
                      }}>Remove</button></div>;
                    })}</div>}
                  </div>
                </article>;
              })}
            </div>
            <div className="manager-place-order-page__add-item-row"><button type="button" className="manager-place-order-page__secondary-button" onClick={addItem}><span aria-hidden="true">＋</span> Add another item</button></div>
          </section>

          <section className="manager-place-order-page__section" aria-labelledby="place-order-delivery-heading">
            <header className="manager-place-order-page__section-header"><span className="manager-place-order-page__section-number">03</span><div><h2 id="place-order-delivery-heading">Delivery</h2><p>Set the due date and how the order will be handled.</p></div></header>
            <div className="manager-place-order-page__section-body manager-place-order-page__delivery-fields">
              <label className="manager-place-order-page__field"><span>Delivery date</span><input className="form-input" type="datetime-local" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
              <label className="manager-place-order-page__field"><span>Delivery method</span><select className="form-input" value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value)}><option value="bus">Bus</option><option value="courier">Courier</option><option value="direct">Direct</option><option value="others">Others</option></select></label>
              <label className="manager-place-order-page__field"><span>Order / get method</span><select className="form-input" value={orderGetMethod} onChange={(event) => setOrderGetMethod(event.target.value)}><option value="direct">Direct</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="call">Call</option><option value="person">Person</option></select></label>
            </div>
          </section>

          {orderError && <p className="manager-place-order-page__error" role="alert">{orderError}</p>}
          <footer className="manager-place-order-page__footer"><div className="manager-place-order-page__grand-total"><span>Grand total</span><strong>₹{calculateGrandTotal().toLocaleString("en-IN")}</strong></div><button type="button" className="manager-place-order-page__submit-button" onClick={submitOrder}><span aria-hidden="true">✓</span> Place Order</button></footer>
        </div>

  );
}
