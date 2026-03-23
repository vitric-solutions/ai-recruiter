// src/routes/UserRoutes.tsx
import { Route, Routes } from "react-router-dom";
import PageNotFound from "../common/PageNotFound";
import ToastProvider from "../common/ToastProvider";
import UserLogin from "../pages/user/UserLogin";
import SystemCompatibilityCheck from "../pages/user/Systemcompatibilitycheck";
import IdentityVerification from "../pages/user/Identityverification";
import SelfieVerification from "../pages/user/Selfieverification";
import InterviewInstructions from "../pages/user/Interviewinstructions";
import MCQAssessment from "../pages/user/MCQAssessment";
import AssessmentCompleted from "../pages/user/AssessmentCompleted";
import SessionEnded from "../pages/user/SessionEnded";
import VideoInterview from "../pages/user/VideoInterview";
import { ENCRYPTED_USER_ROUTES as R } from "./EncryptRoute";

function App() {
  return (
    <>
      <ToastProvider />
      <Routes>
        {/* Public Routes */}
        <Route path={R.login}       element={<UserLogin />} />
        <Route path={R.loginWithId} element={<UserLogin />} />

        {/* User Flow Routes */}
        {/* Uncomment ProtectedRoute once user auth is ready */}
        {/* <Route element={<ProtectedRoute redirectTo={R.login} />}> */}
          <Route path={R.systemCheck}    element={<SystemCompatibilityCheck />} />
          <Route path={R.identity}       element={<IdentityVerification />} />
          <Route path={R.selfie}         element={<SelfieVerification />} />
          <Route path={R.instructions}   element={<InterviewInstructions />} />
          <Route path={R.mcq}            element={<MCQAssessment />} />
          <Route path={R.videoInterview} element={<VideoInterview />} />
          <Route path={R.complete}       element={<AssessmentCompleted />} />
          <Route path={R.sessionEnd}     element={<SessionEnded />} />
        {/* </Route> */}

        {/* 404 Route */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}

export default App;