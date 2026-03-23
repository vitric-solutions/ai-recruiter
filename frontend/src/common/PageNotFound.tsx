import React from "react";
import { ArrowLeft, Home } from "lucide-react";
import { adminPath } from "../routes/EncryptRoute";

const PageNotFound: React.FC = () => {
  const handleGoHome = () => {
    window.location.href = `/admin${adminPath("dashboard")}`;
  };

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">

        {/* 404 Number */}
        <h1 className="text-7xl md:text-8xl font-extrabold text-gray-200 tracking-widest">
          404
        </h1>

        {/* Card */}
        <div className="mt-6 bg-white shadow-xl rounded-2xl p-8 md:p-10 border border-gray-100">
          
          {/* Icon */}
          <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-gray-800 mb-3">
            Page not found
          </h2>

          <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-8">
            The page you’re looking for doesn’t exist or has been moved.
            Please check the URL or return to the homepage.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={handleGoHome}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Home size={16} />
              Go to Home
            </button>

            <button
              onClick={handleGoBack}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
          </div>
        </div>

        {/* Footer Text */}
        <p className="mt-6 text-xs text-gray-400">
          If you believe this is an error, please contact support.
        </p>

      </div>
    </div>
  );
};

export default PageNotFound;
