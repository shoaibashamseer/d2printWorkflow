import SmartSearchInput from "./SmartSearchInput";

export default function CustomerSection({
    customers,
    customer,
    customerType,
    deliveryDate,
    phone,
    setCustomer,
    setPhone,
    setCustomerType,
    setDeliveryDate,
    createCustomer,
}) {
    return (
        <div className="form-card">

            <h3>Customer</h3>

            <SmartSearchInput
                items={customers}
                value={customer}
                displayField="name"
                placeholder="Search Customer..."
                onSelect={setCustomer}
                onCreate={createCustomer}
            />

            {!customer && (
                <input
                    className="form-input"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e)=>setPhone(e.target.value)}
                />
            )}

            <select
                className="form-input"
                value={customerType}
                onChange={(e)=>setCustomerType(e.target.value)}
            >
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
            </select>

            <input
                className="form-input"
                type="datetime-local"
                value={deliveryDate}
                onChange={(e)=>setDeliveryDate(e.target.value)}
            />

        </div>
    );
}