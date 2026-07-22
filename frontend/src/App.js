import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";

import ManagerDashboard from "./pages/ManagerDashboard";
import AddProduct from "./pages/AddProduct";
import AddProductProperty from "./pages/AddProductProperty";
import AddWorkflow from "./pages/AddWorkflow";
import PlaceOrder from "./pages/PlaceOrder";

import WorkerDashboard from "./pages/worker/WorkerDashboard";

import BossDashboard from "./pages/BossDashboard";

import TasksMonitor from "./pages/manager/TasksMonitor";
import ProductsManager from "./pages/manager/ProductsManager";
import WorkflowsManager from "./pages/manager/WorkflowsManager";
import WorkflowStepsManager from "./pages/manager/WorkflowStepsManager";
import StaffManager from "./pages/manager/StaffManager";
import CustomersManager from "./pages/manager/CustomersManager";
import ReportsDashboard from "./pages/manager/ReportsDashboard";
import RawMaterialsManager from "./pages/manager/RawMaterialsManager";

import BossFinance from "./pages/boss/BossFinance";
import WorkEstimator from "./pages/boss/WorkEstimator";
import WorkAnalyser from "./pages/boss/WorkAnalyser";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {

    const token = localStorage.getItem("token");

    const role = localStorage.getItem("role");

    const userType = localStorage.getItem("user_type");

    const mustChange =
        localStorage.getItem("must_change_password") === "true";
    
    const ALL_ROLES = [
        "manager",
        "boss",
        "designer",
        "printer",
        "helper",
        "worker",
        "accountant",
        "setup",
        "packing",
        "billing"
    ];

    return (

        <BrowserRouter>

            <Routes>

                {/* LOGIN */}

                <Route
                    path="/login"
                    element={
                        token
                            ? <Navigate to="/" replace />
                            : <Login />
                    }
                />

                {/* CHANGE PASSWORD */}

                <Route
                    path="/change-password"
                    element={
                        token && mustChange
                            ? <ChangePassword />
                            : <Navigate to="/" replace />
                    }
                />

                {/* ROOT */}

                <Route
                    path="/"
                    element={
                        !token ? (
                            <Navigate to="/login" replace />
                        ) : mustChange ? (
                            <Navigate to="/change-password" replace />
                        ) : role === "manager" ? (
                            <Navigate to="/manager" replace />
                        ) : role === "boss" ? (
                            <Navigate to="/boss" replace />
                        ) : (
                            <Navigate to="/worker" replace />
                        )
                    }
                />

                {/* ===========================
                    MANAGER
                =========================== */}

                <Route
                    path="/manager"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <ManagerDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/products"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <ProductsManager />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/products/new"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <AddProduct />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/products/properties"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <AddProductProperty />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/workflows"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <WorkflowsManager />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/workflows/new"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <AddWorkflow />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/workflows/:workflowId/steps"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <WorkflowStepsManager />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/tasks"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <TasksMonitor />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/staff"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <StaffManager />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/customers"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <CustomersManager />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/materials"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <RawMaterialsManager />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/manager/reports"
                    element={
                        <ProtectedRoute role={role} allow={["manager"]}>
                            <ReportsDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/orders/new"
                    element={
                        <ProtectedRoute role={role} allow={ALL_ROLES}>
                            <PlaceOrder />
                        </ProtectedRoute>
                    }
                />

                {/* ===========================
                    BOSS
                =========================== */}

                <Route
                    path="/boss"
                    element={
                        <ProtectedRoute role={role} allow={["boss"]}>
                            <BossDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/boss/finance"
                    element={
                        <ProtectedRoute role={role} allow={["boss"]}>
                            <BossFinance />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/boss/work-estimator"
                    element={
                        <ProtectedRoute role={role} allow={["boss"]}>
                            <WorkEstimator />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/boss/work-analyser"
                    element={
                        <ProtectedRoute role={role} allow={["boss"]}>
                            <WorkAnalyser />
                        </ProtectedRoute>
                    }
                />

                {/* ===========================
                    WORKER
                =========================== */}

                <Route
                    path="/worker"
                    element={
                        <ProtectedRoute
                            role={role}
                            allow={[
                                "designer",
                                "printer",
                                "helper",
                                "worker",
                                "accountant",
                                "setup",
                                "packing",
                                "billing"
                            ]}
                        >
                            <WorkerDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* UNKNOWN ROUTES */}

                <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                />

            </Routes>

        </BrowserRouter>

    );
}

export default App;