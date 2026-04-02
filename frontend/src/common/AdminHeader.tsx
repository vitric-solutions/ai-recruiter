import React from "react";
import { Bell, User } from "lucide-react";
import ThemeToggle from "./Themetoggle";
import { useTheme } from "../context/Themecontext";

interface HeaderProps {
  heading?: string;
  subheading?: string;
}

const Header: React.FC<HeaderProps> = ({
  heading,
  subheading,
}) => {
  const { theme } = useTheme();

  return (
    <header className="flex h-16 items-center justify-between px-8">
      <div className="flex flex-col gap-3">
        {heading && (
          <h2 className={`text-3xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{heading}</h2>
        )}
        {subheading && (
          <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-500'}`}>{subheading}</p>
        )}
      </div>

      <div className={`flex items-center gap-3 p-2 rounded-3xl ${theme === 'dark' ? 'bg-slate-900 text-slate-300' : 'bg-[#FFFFFF] text-gray-600'}`}>
        {/* Toggle Theme */}
           <ThemeToggle />
      
        {/* Bell Icon */}
        <button className="relative rounded-full p-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Bell className="h-4.5 w-4.5" />
        </button>

        {/* User Avatar Icon */}
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white cursor-pointer hover:bg-indigo-700 transition-colors">
          <User className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
};

export default Header;
