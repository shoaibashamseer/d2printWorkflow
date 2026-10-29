import ManagerSidebar from "../components/ManagerSidebar";
import PlaceOrderForm from "../components/PlaceOrderForm";
import "../styles/managerDashboard.css";

export default function PlaceOrder() {
  const role = localStorage.getItem("role") || "Manager";
  const currentDate = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="manager-dashboard manager-place-order-page">
      <ManagerSidebar role={role} />

      <main className="manager-dashboard__main">
        <header className="manager-dashboard__topbar">
          <div className="manager-dashboard__breadcrumb">
            <p className="manager-dashboard__eyebrow">MANAGER AREA</p>
            <span className="manager-dashboard__breadcrumb-separator" aria-hidden="true">›</span>
            <p className="manager-dashboard__crumb">Place Order</p>
          </div>
          <span className="manager-dashboard__date">{currentDate}</span>
        </header>
        <div className="manager-dashboard__content">
          <PlaceOrderForm />
        </div>
      </main>
    </div>
  );
}
