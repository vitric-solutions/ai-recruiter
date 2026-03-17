// src/routes/AdminRoutes.tsx
import { Route, Routes } from "react-router-dom";
import Dashboard from "../pages/admin/AdminDashboard";
import Candidate from "../pages/admin/AdminCandidate";
import Reports from "../pages/admin/ReportsInsights";
import AIVideoInterview from "../pages/admin/AIVideoInterview";
import TestsAssessments from "../pages/admin/Tests-Assessments";
import LoginPage from "../pages/admin/AdminLogin";
import ProtectedRoute from "../routes/ProtectedRoute";
import PageNotFound from "../common/PageNotFound";
import ToastProvider from "../common/ToastProvider";
import { ENCRYPTED_ADMIN_ROUTES as R } from "./EncryptRoute";

function AdminRoutes() {
  return (
    <>
      <ToastProvider />
      <Routes>
        {/* Public Routes */}
        <Route path={R.login} element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute redirectTo={`/admin${R.login}`} />}>
          <Route path={R.dashboard}  element={<Dashboard />} />
          <Route path={R.candidates} element={<Candidate />} />
          <Route path={R.tests}      element={<TestsAssessments />} />
          <Route path={R.video}      element={<AIVideoInterview />} />
          <Route path={R.reports}    element={<Reports />} />
        </Route>

        {/* 404 Route (Always Last) */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}

export default AdminRoutes;