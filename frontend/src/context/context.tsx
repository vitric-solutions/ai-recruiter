import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { socket } from "../utils/socket";

/* ================= TYPES ================= */

type User = {
  _id: string;
  email: string;
  role: "admin" | "super_admin" | "user";
  phone: string;
  name: string;
  userName:string;
  location: string;
};

type InterviewInfo = {
  interviewId: string;
  title?: string;
  type?: "MCQ" | "AI";
} | null;

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  logout: () => void;

  interviewInfo: InterviewInfo;
  setInterviewInfo: React.Dispatch<
    React.SetStateAction<InterviewInfo>
  >;
  userData: any;
  setUserData: React.Dispatch<React.SetStateAction<any>>;
};

/* ================= CONTEXT ================= */

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/* ================= PROVIDER ================= */

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [interviewInfo, setInterviewInfo] =
    useState<InterviewInfo>(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  /* ================= INIT FROM STORAGE ================= */

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedInterview = localStorage.getItem("interviewInfo");
    const token =
      sessionStorage.getItem("accessToken") ||
      localStorage.getItem("accessToken");

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }

    if (storedInterview) {
      try {
        setInterviewInfo(JSON.parse(storedInterview));
      } catch (err) {
        console.error("Failed to parse interview info:", err);
      }
    }

    setLoading(false);
  }, []);

  /* ================= PERSIST INTERVIEW ================= */

  useEffect(() => {
    if (interviewInfo) {
      localStorage.setItem(
        "interviewInfo",
        JSON.stringify(interviewInfo)
      );
    } else {
      localStorage.removeItem("interviewInfo");
    }
  }, [interviewInfo]);

  /* ================= SOCKET CONNECTION ================= */

  useEffect(() => {
    if (!user) return;

    socket.connect();
    socket.emit("user-join-room", user._id);

    if (user.role === "admin") {
      socket.emit("admin-join-room");
    }

    return () => {
      socket.disconnect();
    };
  }, [user]);

  /* ================= LOGOUT ================= */

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("interviewInfo");

    socket.disconnect();

    setUser(null);
    setInterviewInfo(null);

    window.location.replace("/admin/login");
  };

  /* ================= PROVIDER VALUE ================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        logout,
        interviewInfo,
        setInterviewInfo,
        userData, setUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ================= HOOK ================= */

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }
  return context;
};
