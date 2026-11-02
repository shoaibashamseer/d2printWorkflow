
import { useEffect, useState } from "react";
import api from "../api/api";
import "../styles/placeOrder.css";
import SmartSearchInput from "../components/SmartSearchInput";

export default function PlaceOrderForm({ onSuccess, showHeading = true }) {
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [materialVariants, setMaterialVariants] = useState([]);

    const [customerId, setCustomerId] = useState("");
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");

    const [deliveryDate, setDeliveryDate] = useState("");
    const [deliveryMethod, setDeliveryMethod] = useState("bus");
    const [orderGetMethod, setOrderGetMethod] = useState("direct");

    const [items, setItems] = useState([
        {
            productId: "",
            workflowId: "",
            quantity: 1,
            features: [],
            materials: [],
        },
    ]);

    const [orderError, setOrderError] = useState("");
    const [loading, setLoading] = useState(false);

    // Load products, customers and materials
    useEffect(() => {
        const loadData = async () => {
            try {
                const [productsRes, customersRes, materialsRes] =
                    await Promise.all([
                        api.get("manager/products/"),
                        api.get("customers/"),
                        api.get("manager/raw-material-variants/"),
                    ]);

                const getArray = (data) => {
                    if (Array.isArray(data)) return data;
                    if (Array.isArray(data?.results)) return data.results;
                    return [];
                };

                setProducts(getArray(productsRes.data));
                setCustomers(getArray(customersRes.data));
                setMaterialVariants(getArray(materialsRes.data));

                console.log("CUSTOMERS LOADED:", customersRes.data);
            } catch (error) {
                console.error(
                    "Loading error:",
                    error.response?.data || error
                );

                setOrderError(
                    "Unable to load customers, products or materials. Please refresh."
                );
            }
        };

        loadData();
    }, []);

    // Find selected customer using its actual database ID
    const getSelectedCustomer = () =>
        customers.find(
            customer => String(customer.id) === String(customerId)
        );

    const selectedCustomer = getSelectedCustomer();

    // Get product price based on customer type
    const getProductPrice = (product) => {
        if (!selectedCustomer || !product) return 0;

        return selectedCustomer.customer_type === "wholesale"
            ? Number(product.wholesale_price || 0)
            : Number(product.retail_price || 0);
    };

    const updateItem = (index, field, value) => {
        setItems(previous =>
            previous.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        );
    };

    const addItem = () => {
        setItems(previous => [
            ...previous,
            {
                productId: "",
                workflowId: "",
                quantity: 1,
                features: [],
                materials: [],
            },
        ]);
    };

    const addMaterial = (index, variantId) => {
        if (!variantId) return;

        setItems(previous =>
            previous.map((item, i) => {
                if (i !== index) return item;

                const exists = item.materials.some(
                    material =>
                        String(material.variantId) === String(variantId)
                );

                if (exists) return item;

                return {
                    ...item,
                    materials: [
                        ...item.materials,
                        { variantId, quantity: 1 },
                    ],
                };
            })
        );
    };

    // Create and submit order
    const submitOrder = async () => {
        if (loading) return;

        setOrderError("");

        if (!customerId && !newCustomerName.trim()) {
            setOrderError("Please select or enter a customer.");
            return;
        }

        if (
            customerId &&
            !customers.some(
                customer => String(customer.id) === String(customerId)
            )
        ) {
            setOrderError(
                "The selected customer could not be found. Please select again."
            );
            return;
        }

        if (
            items.some(
                item =>
                    !item.productId ||
                    Number(item.quantity) <= 0
            )
        ) {
            setOrderError(
                "Please select a product and enter a valid quantity for every item."
            );
            return;
        }

        // Verify default workflow before creating an order
        const missingWorkflowItems = items.flatMap((item, index) => {
            const product = products.find(
                entry => String(entry.id) === String(item.productId)
            );

            if (!product) return [];

            return product.default_workflow ? [] : [index + 1];
        });

        if (missingWorkflowItems.length) {
            setOrderError(
                `Set a default workflow for ${
                    missingWorkflowItems.length === 1 ? "item" : "items"
                } ${missingWorkflowItems.join(", ")} in Products before placing this order.`
            );
            return;
        }

        setLoading(true);

        try {
            let finalCustomerId = customerId;

            // Create a new customer when entered
            if (!customerId && newCustomerName.trim()) {
                const customerResponse = await api.post("customers/", {
                    name: newCustomerName.trim(),
                    phone: newCustomerPhone.trim(),
                });

                finalCustomerId = customerResponse.data.id;

                if (!finalCustomerId) {
                    throw new Error(
                        "Customer was created but the server did not return an ID."
                    );
                }

                setCustomers(previous => [
                    ...previous,
                    customerResponse.data,
                ]);
            }

            // Validate the actual customer database ID
            if (
                !finalCustomerId ||
                !Number.isInteger(Number(finalCustomerId)) ||
                Number(finalCustomerId) <= 0
            ) {
                throw new Error("Please select a valid customer.");
            }

            const payload = {
                customer: Number(finalCustomerId),

                delivery_date: deliveryDate
                    ? deliveryDate.split("T")[0]
                    : "",

                delivery_method: deliveryMethod,
                order_get_method: orderGetMethod,

                items: items.map(item => ({
                    product: Number(item.productId),
                    workflow: Number(item.workflowId),
                    quantity: Number(item.quantity),
                    features: item.features,

                    materials: item.materials.map(material => ({
                        variant: Number(material.variantId),
                        quantity_used: Number(material.quantity),
                    })),
                })),
            };

            console.log("ORDER PAYLOAD:", payload);

            await api.post("orders/", payload);

            alert("Order Created Successfully");

            // Reset form
            setCustomerId("");
            setNewCustomerName("");
            setNewCustomerPhone("");
            setDeliveryDate("");
            setDeliveryMethod("bus");
            setOrderGetMethod("direct");

            setItems([
                {
                    productId: "",
                    workflowId: "",
                    quantity: 1,
                    features: [],
                    materials: [],
                },
            ]);

            await onSuccess?.();

        } catch (error) {
            console.error(
                "ORDER ERROR:",
                error.response?.data || error
            );

            const data = error.response?.data;

            if (data && typeof data === "object") {
                setOrderError(
                    Object.entries(data)
                        .map(([field, message]) => {
                            const detail = Array.isArray(message)
                                ? message.join(", ")
                                : typeof message === "object"
                                    ? JSON.stringify(message)
                                    : message;

                            return `${field}: ${detail}`;
                        })
                        .join(" | ")
                );
            } else {
                setOrderError(
                    error.message || "Unable to create order."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // Calculate grand total
    const calculateGrandTotal = () => {
        return items.reduce((total, item) => {
            const product = products.find(
                entry => String(entry.id) === String(item.productId)
            );

            return (
                total +
                getProductPrice(product) * Number(item.quantity || 0)
            );
        }, 0);
    };

    return (
        <div className="manager-place-order-page manager-place-order-form manager-place-order-page__content">

            {showHeading && (
                <section className="manager-dashboard__page-heading manager-place-order-page__heading">
                    <div>
                        <h1>Place Order</h1>
                        <p>
                            Create an order with one or more products and
                            the required delivery details.
                        </p>
                    </div>
                </section>
            )}

            {/* CUSTOMER SECTION */}
            <section
                className="manager-place-order-page__section"
                aria-labelledby="place-order-customer-heading"
            >
                <header className="manager-place-order-page__section-header">
                    <span className="manager-place-order-page__section-number">
                        01
                    </span>
                    <div>
                        <h2 id="place-order-customer-heading">Customer</h2>
                        <p>Select an existing customer or enter a new customer.</p>
                    </div>
                </header>

                <div className="manager-place-order-page__section-body">

                    <label className="manager-place-order-page__field">
                        <span>Customer <b>*</b></span>

                        <SmartSearchInput
                            items={customers}
                            value={customerId}
                            placeholder="Search by name, company or phone"
                            onSelect={(customer) => {
                                if (!customer) {
                                    setCustomerId("");
                                    return;
                                }

                                setCustomerId(String(customer.id));
                                setNewCustomerName("");
                                setNewCustomerPhone("");
                            }}
                            onCreate={(name) => {
                                setCustomerId("");
                                setNewCustomerName(name);
                            }}
                        />
                    </label>

                    {!customerId && newCustomerName && (
                        <label className="manager-place-order-page__field">
                            <span>Customer phone</span>
                            <input
                                className="form-input"
                                placeholder="Customer phone number"
                                value={newCustomerPhone}
                                onChange={event =>
                                    setNewCustomerPhone(event.target.value)
                                }
                            />
                        </label>
                    )}

                    {selectedCustomer && (
                        <div className="manager-place-order-page__customer-summary">
                            <span className="manager-place-order-page__customer-mark">
                                {(
                                    selectedCustomer.name ||
                                    selectedCustomer.company_name ||
                                    "C"
                                ).charAt(0).toUpperCase()}
                            </span>

                            <div>
                                <strong>
                                    {selectedCustomer.name ||
                                        selectedCustomer.company_name}
                                </strong>

                                {selectedCustomer.name &&
                                    selectedCustomer.company_name && (
                                        <small>
                                            {selectedCustomer.company_name}
                                        </small>
                                    )}

                                {selectedCustomer.phone && (
                                    <small>{selectedCustomer.phone}</small>
                                )}
                            </div>

                            <span className="manager-place-order-page__customer-type">
                                {String(selectedCustomer.customer_type || "retail").toLowerCase() === "wholesale"
                                    ? "Wholesale"
                                    : "Retail"} pricing
                            </span>
                        </div>
                    )}

                    {!customerId && newCustomerName && (
                        <div className="manager-place-order-page__customer-summary">
                            <span className="manager-place-order-page__customer-mark">
                                {newCustomerName.charAt(0).toUpperCase()}
                            </span>
                            <div>
                                <strong>{newCustomerName}</strong>
                                <small>New customer</small>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* PRODUCTS SECTION */}
            <section
                className="manager-place-order-page__section"
                aria-labelledby="place-order-items-heading"
            >
                <header className="manager-place-order-page__section-header manager-place-order-page__section-header--items">
                    <span className="manager-place-order-page__section-number">
                        02
                    </span>
                    <div>
                        <h2 id="place-order-items-heading">Products &amp; Items</h2>
                        <p>
                            Add products and materials. Each product’s default
                            workflow is assigned automatically.
                        </p>
                    </div>

                    <span className="manager-place-order-page__item-count">
                        {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                </header>

                <div className="manager-place-order-page__items">
                    {items.map((item, index) => {
                        const product = products.find(
                            entry => String(entry.id) === String(item.productId)
                        );

                        const pricePerUnit = getProductPrice(product);
                        const total = pricePerUnit * (item.quantity || 0);

                        return (
                            <article
                                key={index}
                                className="manager-place-order-page__item-card"
                            >
                                <header className="manager-place-order-page__item-header">
                                    <span className="manager-place-order-page__item-index">
                                        Item {String(index + 1).padStart(2, "0")}
                                    </span>

                                    {product && (
                                        <span className="manager-place-order-page__line-total">
                                            Line total{" "}
                                            <strong>
                                                ₹{Number(total).toLocaleString("en-IN")}
                                            </strong>
                                        </span>
                                    )}
                                </header>

                                <div className="manager-place-order-page__item-fields">
                                    <label className="manager-place-order-page__field manager-place-order-page__field--wide">
                                        <span>Product <b>*</b></span>

                                        <SmartSearchInput
                                            items={products}
                                            value={item.productId}
                                            placeholder="Search or create product"
                                            onSelect={(selectedProduct) => {
                                                if (!selectedProduct) {
                                                    updateItem(index, "productId", "");
                                                    updateItem(index, "workflowId", "");
                                                    return;
                                                }

                                                const updated = [...items];

                                                updated[index] = {
                                                    ...updated[index],
                                                    productId: selectedProduct.id,
                                                    workflowId:
                                                        selectedProduct.default_workflow || "",
                                                    materials:
                                                        selectedProduct.default_materials?.map(
                                                            material => ({
                                                                variantId: material.variant,
                                                                quantity: material.default_quantity,
                                                            })
                                                        ) || [],
                                                };

                                                setItems(updated);
                                            }}
                                            onCreate={async (name) => {
                                                try {
                                                    const res = await api.post(
                                                        "manager/products/",
                                                        { name }
                                                    );

                                                    setProducts(previous => [
                                                        ...previous,
                                                        res.data,
                                                    ]);

                                                    const updated = [...items];

                                                    updated[index] = {
                                                        ...updated[index],
                                                        productId: res.data.id,
                                                        workflowId:
                                                            res.data.default_workflow || "",
                                                    };

                                                    setItems(updated);

                                                } catch (error) {
                                                    console.error(
                                                        "Product creation error:",
                                                        error.response?.data || error
                                                    );

                                                    setOrderError(
                                                        "Unable to create product."
                                                    );
                                                }
                                            }}
                                        />
                                    </label>

                                    <label className="manager-place-order-page__field">
                                        <span>Quantity <b>*</b></span>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="1"
                                            placeholder="Quantity"
                                            value={item.quantity}
                                            onChange={event =>
                                                updateItem(
                                                    index,
                                                    "quantity",
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </label>
                                </div>

                                {product && (
                                    <div className="manager-place-order-page__price-info">
                                        <span>
                                            <small>
                                                {selectedCustomer?.customer_type === "wholesale"
                                                    ? "Wholesale price"
                                                    : "Retail price"}
                                            </small>
                                            <strong>
                                                ₹{Number(pricePerUnit).toLocaleString("en-IN")}
                                            </strong>
                                        </span>

                                        <span className="manager-place-order-page__pricing-note">
                                            Price based on customer type
                                        </span>
                                    </div>
                                )}

                                {/* MATERIALS */}
                                <div className="manager-place-order-page__materials">
                                    <div className="manager-place-order-page__subsection-heading">
                                        <div>
                                            <h3>Materials</h3>
                                            <p>Optional material variants for this item.</p>
                                        </div>
                                    </div>

                                    <label className="manager-place-order-page__field">
                                        <span>Add material</span>

                                        <SmartSearchInput
                                            items={materialVariants}
                                            value=""
                                            displayField="name"
                                            placeholder="Search material variants"
                                            onSelect={variant =>
                                                variant && addMaterial(index, variant.id)
                                            }
                                            onCreate={async (name) => {
                                                try {
                                                    const res = await api.post(
                                                        "manager/raw-material-variants/",
                                                        { name }
                                                    );

                                                    setMaterialVariants(previous => [
                                                        ...previous,
                                                        res.data,
                                                    ]);

                                                    addMaterial(index, res.data.id);

                                                } catch (error) {
                                                    console.error(
                                                        "Material creation error:",
                                                        error.response?.data || error
                                                    );

                                                    setOrderError(
                                                        "Unable to create material."
                                                    );
                                                }
                                            }}
                                        />
                                    </label>

                                    {item.materials.length > 0 && (
                                        <div className="manager-place-order-page__selected-materials">
                                            {item.materials.map(
                                                (material, materialIndex) => {
                                                    const variant = materialVariants.find(
                                                        entry =>
                                                            String(entry.id) ===
                                                            String(material.variantId)
                                                    );

                                                    return (
                                                        <div
                                                            className="manager-place-order-page__material-row"
                                                            key={materialIndex}
                                                        >
                                                            <div className="manager-place-order-page__material-name">
                                                                <strong>
                                                                    {variant?.material_name || "Material"}
                                                                </strong>
                                                                <small>
                                                                    {variant?.name || "Variant"}
                                                                </small>
                                                            </div>

                                                            <label className="manager-place-order-page__material-quantity">
                                                                <span>Quantity</span>
                                                                <input
                                                                    className="form-input"
                                                                    type="number"
                                                                    min="1"
                                                                    step="1"
                                                                    value={material.quantity}
                                                                    onChange={event => {
                                                                        setItems(previous =>
                                                                            previous.map((currentItem, i) => {
                                                                                if (i !== index) return currentItem;

                                                                                return {
                                                                                    ...currentItem,
                                                                                    materials: currentItem.materials.map(
                                                                                        (currentMaterial, j) =>
                                                                                            j === materialIndex
                                                                                                ? {
                                                                                                    ...currentMaterial,
                                                                                                    quantity: event.target.value,
                                                                                                }
                                                                                                : currentMaterial
                                                                                    ),
                                                                                };
                                                                            })
                                                                        );
                                                                    }}
                                                                />
                                                            </label>

                                                            <button
                                                                type="button"
                                                                className="manager-place-order-page__remove-button"
                                                                onClick={() => {
                                                                    setItems(previous =>
                                                                        previous.map((currentItem, i) =>
                                                                            i === index
                                                                                ? {
                                                                                    ...currentItem,
                                                                                    materials: currentItem.materials.filter(
                                                                                        (_, j) => j !== materialIndex
                                                                                    ),
                                                                                }
                                                                                : currentItem
                                                                        )
                                                                    );
                                                                }}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="manager-place-order-page__add-item-row">
                    <button
                        type="button"
                        className="manager-place-order-page__secondary-button"
                        onClick={addItem}
                    >
                        <span aria-hidden="true">＋</span> Add another item
                    </button>
                </div>
            </section>

            {/* DELIVERY SECTION */}
            <section
                className="manager-place-order-page__section"
                aria-labelledby="place-order-delivery-heading"
            >
                <header className="manager-place-order-page__section-header">
                    <span className="manager-place-order-page__section-number">
                        03
                    </span>
                    <div>
                        <h2 id="place-order-delivery-heading">Delivery</h2>
                        <p>Set the due date and how the order will be handled.</p>
                    </div>
                </header>

                <div className="manager-place-order-page__section-body manager-place-order-page__delivery-fields">
                    <label className="manager-place-order-page__field">
                        <span>Delivery date</span>
                        <input
                            className="form-input"
                            type="datetime-local"
                            value={deliveryDate}
                            onChange={event =>
                                setDeliveryDate(event.target.value)
                            }
                        />
                    </label>

                    <label className="manager-place-order-page__field">
                        <span>Delivery method</span>
                        <select
                            className="form-input"
                            value={deliveryMethod}
                            onChange={event =>
                                setDeliveryMethod(event.target.value)
                            }
                        >
                            <option value="bus">Bus</option>
                            <option value="courier">Courier</option>
                            <option value="direct">Direct</option>
                            <option value="others">Others</option>
                        </select>
                    </label>

                    <label className="manager-place-order-page__field">
                        <span>Order / get method</span>
                        <select
                            className="form-input"
                            value={orderGetMethod}
                            onChange={event =>
                                setOrderGetMethod(event.target.value)
                            }
                        >
                            <option value="direct">Direct</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="email">Email</option>
                            <option value="call">Call</option>
                            <option value="person">Person</option>
                        </select>
                    </label>
                </div>
            </section>

            {/* ERROR */}
            {orderError && (
                <p
                    className="manager-place-order-page__error"
                    role="alert"
                >
                    {orderError}
                </p>
            )}

            {/* FOOTER */}
            <footer className="manager-place-order-page__footer">
                <div className="manager-place-order-page__grand-total">
                    <span>Grand total</span>
                    <strong>
                        ₹{calculateGrandTotal().toLocaleString("en-IN")}
                    </strong>
                </div>

                <button
                    type="button"
                    className="manager-place-order-page__submit-button"
                    onClick={submitOrder}
                    disabled={loading}
                >
                    <span aria-hidden="true">✓</span>
                    {loading ? "Creating Order..." : "Place Order"}
                </button>
            </footer>
        </div>
    );
}
