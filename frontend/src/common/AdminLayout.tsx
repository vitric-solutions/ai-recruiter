import React, { type ReactNode, useState } from "react";
import Sidebar from "./AdminSidebar";
import Header from "./AdminHeader";
import { useTheme } from "../context/Themecontext";

interface AdminLayoutProps {
  children: ReactNode;
  heading?: string;
  subheading?: string;
  showSearch?: boolean;
  activeMenuItem?: string;
  onMenuItemClick?: (item: string) => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  heading,
  subheading,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme } = useTheme();

  return (
    <div className={`flex min-h-screen w-full ${theme === 'dark' ? 'bg-[#02040a] text-slate-100' : 'bg-[#F4F7FE] text-slate-900'}`}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      {/* Shift content using CSS transition — no framer-motion */}
      <div
        style={{ marginLeft: sidebarOpen ? 240 : 68 }}
        className="flex flex-1 flex-col pt-14 transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        <Header
          heading={heading}
          subheading={subheading}
        />

        <main className="flex-1 overflow-auto px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;