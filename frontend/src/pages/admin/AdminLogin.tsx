import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AxiosError } from "axios";
import { adminService } from "../../services/service/adminService";
import { useAuth } from "../../context/context";
import SignIN_BG_Image from "../../assets/sign_in_bg.png";

interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await adminService.login(data);
      console.log(response)

      const { accessToken, refreshToken, user } = response;

      if (!user || user.role !== "admin") {
        setError("Unauthorized access. Only admins can log in.");
        setIsLoading(false);
        return;
      }

      // 🔥 Save Tokens Properly
      if (data.rememberMe) {
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
      } else {
        sessionStorage.setItem("accessToken", accessToken);
        sessionStorage.setItem("refreshToken", refreshToken);
      }

      // 🔥 Set User In Context
      setUser(user);

      // Optional: store user for persistence
      localStorage.setItem("user", JSON.stringify(user));

      // 🔥 Navigate AFTER user is set
      navigate("/admin/dashboard", { replace: true });

    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;

      if (axiosError.response) {
        setError(
          axiosError.response.data.message || "Invalid email or password",
        );
      } else if (axiosError.request) {
        setError("Network error. Please check your connection.");
      } else {
        setError("Something went wrong. Please try again.");
      }

      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center py-8 relative">
      <div className="relative w-[95%] h-[99%] mr-20">
        <img
          src={SignIN_BG_Image}
          className="sticky w-full h-full"
          alt="Background"
        />

        <div className="absolute w-[90%] top-0 left-1/2 -translate-x-1/2 flex items-center justify-between px-8 py-12 md:py-24">
          
          {/* Left Branding */}
          <div className="text-white">
            <div className="text-2xl mb-4 font-bold">Vitric IQ</div>
            <h1 className="text-2xl md:text-4xl font-bold leading-snug">
              Streamline Interview <br /> Management Easily
            </h1>
          </div>

          {/* Login Card */}
          <div className="w-[36%] rounded-xl py-10 px-10 bg-white shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Please enter your email & password
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              
              {/* Email */}
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  className={`w-full px-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  }`}
                  {...register("email", {
                    required: "Email is required",
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Password
                </label>
                <input
                  type="password"
                  className={`w-full px-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  }`}
                  {...register("password", {
                    required: "Password is required",
                  })}
                />
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input type="checkbox" className="mr-2" {...register("rememberMe")} />
                <label className="text-sm text-gray-600">
                  Keep me signed in
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-md text-sm font-semibold transition-all disabled:opacity-50"
              >
                {isLoading ? "Logging in..." : "Login →"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
