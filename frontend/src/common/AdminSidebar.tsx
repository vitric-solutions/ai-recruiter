import React from "react";
import {
  Home,
  Users,
  FileText,
  Video,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/context";
import { adminPath } from "../routes/EncryptRoute";

const navItems = [
  { title: "Dashboard",         icon: Home,     path: `/admin${adminPath("dashboard")}` },
  { title: "Candidates",        icon: Users,    path: `/admin${adminPath("candidates")}` },
  { title: "Tests & Assessments", icon: FileText, path: `/admin${adminPath("tests")}` },
  { title: "AI Video Interview", icon: Video,    path: `/admin${adminPath("video")}` },
  { title: "Reports & Insights", icon: BarChart3, path: `/admin${adminPath("reports")}` },
  { title: "Settings",          icon: Settings, path: `/admin${adminPath("settings")}` },
];

const SIDEBAR_OPEN  = 240; // px
const SIDEBAR_CLOSED = 68; // px

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onToggle }) => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { logout } = useAuth();

  return (
    <motion.aside
      animate={{ width: open ? SIDEBAR_OPEN : SIDEBAR_CLOSED }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40 flex flex-col overflow-hidden"
    >
      {/* ── Logo + Toggle ── */}
      <div className="flex items-center justify-between px-4 pt-6 pb-6 border-b border-gray-100">
        <AnimatePresence initial={false}>
          {open && (
            <motion.h1
              key="logo-text"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="text-[22px] font-bold text-gray-900 whitespace-nowrap overflow-hidden"
            >
              Vitric IQ
            </motion.h1>
          )}
        </AnimatePresence>

        {/* Toggle button — shifts to center when closed */}
        <motion.button
          onClick={onToggle}
          animate={{ marginLeft: open ? 0 : "auto", marginRight: open ? 0 : "auto" }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="w-7 h-7 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-md transition-colors flex-shrink-0"
          title={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <motion.div
            animate={{ rotate: open ? 0 : 180 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </motion.div>
        </motion.button>
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex-1 py-4 space-y-1 overflow-hidden">
        {navItems.map((item) => {
          const Icon     = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.title}
              onClick={() => navigate(item.path)}
              title={!open ? item.title : undefined}
              className={`relative w-full flex items-center gap-3 py-2.5 font-medium transition-colors group
                ${open ? "px-5" : "px-0 justify-center"}
                ${isActive
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              {/* Active left bar */}
              {isActive && (
                <motion.div
                  layoutId="activeBar"
                  className="absolute right-0 top-0 bottom-0 w-[3px] bg-indigo-600 rounded-l-full"
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                />
              )}

              {/* Active bg pill */}
              {isActive && (
                <motion.div
                  layoutId="activeBg"
                  className={`absolute inset-y-0 ${open ? "inset-x-2" : "inset-x-1"} bg-indigo-50 rounded-lg -z-10`}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                />
              )}

              {/* Icon */}
              <Icon
                className={`flex-shrink-0 h-[18px] w-[18px] transition-colors
                  ${isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"}`}
              />

              {/* Label */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.span
                    key={`label-${item.title}`}
                    initial={{ opacity: 0, x: -8, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: "auto" }}
                    exit={{ opacity: 0, x: -8, width: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className={`text-[15px] whitespace-nowrap overflow-hidden
                      ${isActive ? "font-semibold text-[#2B3674]" : ""}`}
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip when collapsed */}
              {!open && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap
                  transition-opacity duration-150 shadow-lg z-50">
                  {item.title}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div className="pb-5 border-t border-gray-100 pt-3">
        <button
          onClick={async () => { await logout(); navigate(`/admin${adminPath("login")}`); }}
          title={!open ? "Logout" : undefined}
          className={`relative w-full flex items-center gap-3 py-2.5 font-medium
            text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors group
            ${open ? "px-5" : "px-0 justify-center"}`}
        >
          <LogOut className="flex-shrink-0 h-[18px] w-[18px]" />

          <AnimatePresence initial={false}>
            {open && (
              <motion.span
                key="logout-label"
                initial={{ opacity: 0, x: -8, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -8, width: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                className="text-[15px] whitespace-nowrap overflow-hidden"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>

          {/* Tooltip when collapsed */}
          {!open && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg
              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap
              transition-opacity duration-150 shadow-lg z-50">
              Logout
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;