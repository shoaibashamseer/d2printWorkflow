import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ role, allow, children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(role)) {
    if (role === "manager") return <Navigate to="/manager" replace />;
    if (role === "bosss") return <Navigate to="/boss" replace />;
    return <Navigate to="/worker" replace />;
  }

  return children;
}