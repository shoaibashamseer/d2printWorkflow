import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import formatDisplayValue from "../pages/worker/formatDisplayValue";

const primaryNavigation = [
  { label: "Dashboard", path: "/manager", icon: "▦", exact: true },
  { label: "Orders", path: "/manager/orders", icon: "▣" },
  { label: "Customers", path: "/manager/customers", icon: "♙" },
  { label: "Products", path: "/manager/products", icon: "▤" },
  { label: "Materials", path: "/manager/materials", icon: "◈" },
  { label: "Staff", path: "/manager/staff", search: "", icon: "♧" },
  { label: "Roles", path: "/manager/staff", search: "?tab=roles", icon: "⚙" },
  { label: "Workflows", path: "/manager/workflows", icon: "⟳" },
  { label: "Delivery", disabled: true, icon: "⇢" },
  { label: "Billing", disabled: true, icon: "¤" },
];

const additionalNavigation = [
  { label: "Tasks", path: "/manager/tasks", icon: "✓" },
  { label: "Reports", path: "/manager/reports", icon: "▥" },
];

function NavigationLink({ item, location, onNavigate }) {
  if (item.disabled) {
    return (
      <span
        className="manager-dashboard__nav-link is-disabled"
        aria-disabled="true"
        title="No manager page is available for this section."
      >
        <span className="manager-dashboard__nav-icon" aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
      </span>
    );
  }

  const pathMatches = item.exact
    ? location.pathname === item.path
    : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  const searchMatches = item.search === undefined || location.search === item.search;
  const active = pathMatches && searchMatches;
  const destination = item.search === undefined
    ? item.path
    : { pathname: item.path, search: item.search };

  return (
    <Link
      to={destination}
      className={`manager-dashboard__nav-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="manager-dashboard__nav-icon" aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export default function ManagerSidebar({ role, onLogout }) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayRole = formatDisplayValue(role || localStorage.getItem("role"), "Manager");
  const handleLogout = onLogout || (() => {
    localStorage.clear();
    window.location.href = "/";
  });

  return (
    <aside className="manager-dashboard__sidebar" aria-label="Manager navigation">
      <div className="manager-dashboard__sidebar-top">
        <Link to="/manager" className="manager-dashboard__brand">
          <span className="manager-dashboard__brand-mark" aria-hidden="true">D2</span>
          <span><strong>D2 Print</strong><small>WORKFLOW SYSTEM</small></span>
        </Link>
        <button
          type="button"
          className="manager-dashboard__mobile-nav-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="manager-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span> Menu
        </button>
      </div>
      <div id="manager-navigation" className={`manager-dashboard__navigation${mobileNavOpen ? " is-open" : ""}`}>
        <p className="manager-dashboard__nav-label">MANAGEMENT</p>
        <nav className="manager-dashboard__nav" aria-label="Management pages">
          {primaryNavigation.map((item) => (
            <NavigationLink key={item.label} item={item} location={location} onNavigate={() => setMobileNavOpen(false)} />
          ))}
        </nav>
        <p className="manager-dashboard__nav-label manager-dashboard__nav-label--secondary">OPERATIONS</p>
        <nav className="manager-dashboard__nav manager-dashboard__nav--secondary" aria-label="Additional manager pages">
          {additionalNavigation.map((item) => (
            <NavigationLink key={item.path} item={item} location={location} onNavigate={() => setMobileNavOpen(false)} />
          ))}
        </nav>
      </div>
      <div className="manager-dashboard__identity">
        <span className="manager-dashboard__avatar" aria-hidden="true">{displayRole.charAt(0).toUpperCase()}</span>
        <span className="manager-dashboard__identity-text"><strong>{displayRole}</strong><small>Signed in</small></span>
        <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out">↗</button>
      </div>
    </aside>
  );
}
