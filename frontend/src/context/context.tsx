import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { socket } from "../utils/socket";
import { adminPath } from "../routes/EncryptRoute";

/* ================= TYPES ================= */

type User = {
  _id: string;
  email: string;
  role: "admin" | "super_admin" | "user";
  phone: string;
  name: string;
  userName: string;
  location: string;
};

type InterviewInfo = {
  // Core fields coming from backend AI_Interview document
  interviewId: string;                    // _id
  position: string;
  type: string;
  jobPosition: string;
  description?: string;
  jobDescription?: string;                // path or short preview
  difficulty: "Easy" | "Medium" | "Hard" | string; // string fallback
  duration: string;
  passingScore?: number;
  numberOfQuestions: number;
  examType: "AI" | "MCQ" | "Coding" | "Hybrid" | string;
  status: "draft" | "scheduled" | "completed" | "cancelled";

  // Candidate-specific runtime info (very useful during interview)
  candidateId?: string;
  username?: string;
  candidateName?: string;
  questions?: string;
  questionList?: string;

  candidateStatus?: 
    | "scheduled"
    | "pending"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "expired";
  scheduledStartDate?: string;            // ISO string
  scheduledEndDate?: string;
  interviewLink?: string;

  // Client-side / live interview state
  currentQuestionIndex?: number;          // 0-based
  timeLeftSeconds?: number;               // countdown
  score?: number;                         // current or final
  isCompleted?: boolean;

  // Optional – depending on your flow
  questionsPreview?: string[];            // titles only, no full content
  skills?: string[];
} | null;

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  logout: () => void;

  interviewInfo: InterviewInfo;
  setInterviewInfo: React.Dispatch<React.SetStateAction<InterviewInfo>>;
  userData: any; // ← keep any if still experimental, otherwise type it
  setUserData: React.Dispatch<React.SetStateAction<any>>;
};

/* ================= CONTEXT ================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState<User | null>(null);
  const [interviewInfo, setInterviewInfo] = useState<InterviewInfo>(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  /* ================= LOAD FROM STORAGE ================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedInterview = localStorage.getItem("interviewInfo");
    const token =
      sessionStorage.getItem("accessToken") ||
      localStorage.getItem("accessToken");

    if (storedUser && token) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch (err) {
        console.error("Failed to parse stored user:", err);
        localStorage.removeItem("user");
      }
    }

    if (storedInterview) {
      try {
        const parsed = JSON.parse(storedInterview);
        setInterviewInfo(parsed);
      } catch (err) {
        console.error("Failed to parse stored interviewInfo:", err);
        localStorage.removeItem("interviewInfo");
      }
    }

    setLoading(false);
  }, []);

  /* ================= PERSIST INTERVIEW INFO ================= */

  useEffect(() => {
    if (interviewInfo) {
      localStorage.setItem("interviewInfo", JSON.stringify(interviewInfo));
    } else {
      localStorage.removeItem("interviewInfo");
    }
  }, [interviewInfo]);

  /* ================= SOCKET.IO CONNECTION ================= */

  useEffect(() => {
    if (!user?._id) return;

    socket.connect();
    socket.emit("user-join-room", user._id);

    if (user.role === "admin" || user.role === "super_admin") {
      socket.emit("admin-join-room");
    }

    // Optional: you can also join interview-specific room
    // if (interviewInfo?.interviewId) {
    //   socket.emit("join-interview-room", interviewInfo.interviewId);
    // }

    return () => {
      socket.disconnect();
    };
  }, [user]);

  /* ================= LOGOUT ================= */

  const logout = () => {
    // Clear all auth-related storage
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("interviewInfo");

    // Disconnect socket cleanly
    socket.disconnect();

    // Reset state
    setUser(null);
    setInterviewInfo(null);
    setUserData(null);

    // Redirect (using your encrypted/admin path helper)
    window.location.replace(`/admin${adminPath("login")}`);
  };

  /* ================= CONTEXT VALUE ================= */

  const value: AuthContextType = {
    user,
    setUser,
    loading,
    logout,
    interviewInfo,
    setInterviewInfo,
    userData,
    setUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/* ================= CUSTOM HOOK ================= */

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};