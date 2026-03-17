import { Routes, Route, Navigate } from "react-router-dom";
import UserRoutes from "./routes/UserRoutes";
import AdminRoutes from "./routes/AdminRoutes";
import { adminPath } from "./routes/EncryptRoute";
function App() {
  return (
    <>
      <Routes>
       <Route path="/" element={<Navigate to={`/admin${adminPath("login")}`} replace />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="/*" element={<UserRoutes />} />
      </Routes>
    </>
  );
}

export default App;
