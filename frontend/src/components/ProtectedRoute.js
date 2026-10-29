import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ role, allow = [], allowAnyWorkerRole = false, children }) {
  const token = localStorage.getItem("token");
  const normalizedRole = role?.trim().toLowerCase();
  const userType = localStorage.getItem("user_type")?.trim().toLowerCase();
  const isManager = normalizedRole === "manager" || userType === "manager";
  const isBoss = normalizedRole === "boss" || userType === "boss";
  const isWorkerRole = !isManager && !isBoss && (userType === "worker" || !userType);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!normalizedRole) {
    return <Navigate to="/login" replace />;
  }

  const allowedByRole = allow.some((allowedRole) => allowedRole.toLowerCase() === normalizedRole);
  if (allowedByRole || (allowAnyWorkerRole && isWorkerRole)) return children;

  if (isManager) return <Navigate to="/manager" replace />;
  if (isBoss) return <Navigate to="/boss" replace />;
  if (isWorkerRole) return <Navigate to="/worker" replace />;

  return <Navigate to="/login" replace />;
}
