import React, {type ReactNode, useState } from "react";
import Sidebar from "./AdminSidebar";
import Header from "./AdminHeader";

interface AdminLayoutProps {
  children: ReactNode;
  heading?: string;
  subheading?: string;
  showSearch?: boolean;
  userName?: string;
  userInitial?: string;
  activeMenuItem?: string;
  onMenuItemClick?: (item: string) => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  heading = "Hi, John",
  subheading,
  userName = "John",
  userInitial = "A",
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen w-full bg-[#F4F7FE]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      {/* Shift content using CSS transition — no framer-motion */}
      <div
        style={{ marginLeft: sidebarOpen ? 240 : 68 }}
        className="flex flex-1 flex-col pt-14 transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        <Header
          heading={heading}
          subheading={subheading}
          userName={userName}
          userInitial={userInitial}
        />

        <main className="flex-1 overflow-auto px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;