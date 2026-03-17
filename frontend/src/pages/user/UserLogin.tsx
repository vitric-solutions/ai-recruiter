import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AxiosError } from "axios";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { userService } from "../../services/service/userService";
import { useAuth } from "../../context/context";
import { userPath } from "../../routes/EncryptRoute";

interface LoginFormData {
  email: string;
  password: string;
}

const UserLogin: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { id } = useParams();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  // Generate dots configuration - dots will circle throughout the whole background
  const dots = Array.from({ length: 80 }, (_, i) => {
    const angle = Math.random() * 2 * Math.PI; // Random starting angle
    const radiusVariation = Math.random() * 150 + 50; // Distance from center point (50-200px)

    return {
      id: i,
      radius: radiusVariation,
      duration: Math.random() * 15 + 20, // Speed of rotation (20-35 seconds)
      size: Math.random() * 2 + 1, // Small dot size (1-2.5px)
      delay: Math.random() * -20, // Random start position
      startAngle: angle,
      opacity: Math.random() * 0.4 + 0.2, // Opacity (0.2-0.6)
      centerX: Math.random() * 100, // Random center X (0-100% of screen)
      centerY: Math.random() * 100, // Random center Y (0-100% of screen)
    };
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await userService.login(id!, data);

      console.log(response);

      const { token, interviewId, candidateEntry } = response;

      if (!candidateEntry && !token && interviewId) {
        setError("Invalid response from server.");
        setIsLoading(false);
        return;
      }

      // Save tokens in sessionStorage
      sessionStorage.setItem("accessToken", token);
      sessionStorage.setItem("interviewId", interviewId);
      sessionStorage.setItem(
        "candidateDetails",
        JSON.stringify(candidateEntry),
      );
      // // Set user in context
      setUser(response);


      // Navigate to user dashboard or next page
     navigate(userPath("systemCheck", interviewId));
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
    <div
      className="min-h-screen relative overflow-hidden
  bg-[#050A24]
  bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]"
    >
      {/* Circular Moving Dots Background - Spread across entire screen */}
      <div className="absolute inset-0 overflow-hidden">
        {dots.map((dot) => (
          <motion.div
            key={dot.id}
            className="absolute rounded-full bg-white"
            style={{
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              left: `${dot.centerX}%`,
              top: `${dot.centerY}%`,
              opacity: dot.opacity,
            }}
            animate={{
              x: [
                Math.cos(dot.startAngle) * dot.radius,
                Math.cos(dot.startAngle + Math.PI / 2) * dot.radius,
                Math.cos(dot.startAngle + Math.PI) * dot.radius,
                Math.cos(dot.startAngle + (3 * Math.PI) / 2) * dot.radius,
                Math.cos(dot.startAngle + 2 * Math.PI) * dot.radius,
              ],
              y: [
                Math.sin(dot.startAngle) * dot.radius,
                Math.sin(dot.startAngle + Math.PI / 2) * dot.radius,
                Math.sin(dot.startAngle + Math.PI) * dot.radius,
                Math.sin(dot.startAngle + (3 * Math.PI) / 2) * dot.radius,
                Math.sin(dot.startAngle + 2 * Math.PI) * dot.radius,
              ],
            }}
            transition={{
              duration: dot.duration,
              repeat: Infinity,
              ease: "linear",
              delay: dot.delay,
            }}
          />
        ))}
      </div>

      {/* Gradient orbs - positioned at top-right and bottom-left */}
      <motion.div
        className="absolute -top-20 -right-20 w-50 h-50 md:w-[200px] md:h-[200px] bg-[#2D55FB] rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -50, 20, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-20 -left-20 w-50 h-50 md:w-[200px] md:h-[200px] bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 40, -30, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Logo */}
        <motion.div
          className="p-4 sm:p-6 md:p-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-white text-2xl sm:text-3xl font-bold">
            Vitric IQ
          </h1>
        </motion.div>

        {/* Login Form Container */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 py-8">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Login Card */}
            <motion.div
              className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/10"
              whileHover={{
                boxShadow: "0 20px 60px rgba(45, 85, 251, 0.3)",
              }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-white text-xl sm:text-2xl font-semibold text-center mb-6 sm:mb-8">
                Login to your account
              </h2>

              {/* Error Message */}
              {error && (
                <motion.div
                  className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-sm text-red-200 text-center">{error}</p>
                </motion.div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5 sm:space-y-6"
              >
                {/* Email Field */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">
                    Email
                  </label>
                  <motion.input
                    type="email"
                    placeholder="user@demo.com"
                    className={`w-full px-4 py-2.5 sm:py-3 bg-[#0a1342]/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2D55FB] focus:ring-2 focus:ring-[#2D55FB]/50 transition-all text-sm sm:text-base ${
                      errors.email ? "border-red-500" : "border-gray-700/50"
                    }`}
                    whileFocus={{ scale: 1.01 }}
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <motion.input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className={`w-full px-4 py-2.5 sm:py-3 bg-[#0a1342]/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2D55FB] focus:ring-2 focus:ring-[#2D55FB]/50 transition-all pr-12 text-sm sm:text-base ${
                        errors.password
                          ? "border-red-500"
                          : "border-gray-700/50"
                      }`}
                      whileFocus={{ scale: 1.01 }}
                      {...register("password", {
                        required: "Password is required",
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters",
                        },
                      })}
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </motion.button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2.5 sm:py-3 bg-[#2D55FB] text-white font-medium rounded-lg transition-all duration-300 shadow-lg text-sm sm:text-base ${
                    isLoading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-[#1e3fd4]"
                  }`}
                  whileHover={!isLoading ? { scale: 1.02 } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                >
                  {isLoading ? "Logging in..." : "Access Interview Portal"}
                </motion.button>

                {/* Support Link */}
                <div className="text-center mt-4 sm:mt-6">
                  <span className="text-gray-400 text-xs sm:text-sm">
                    Need Assistance?{" "}
                  </span>
                  <motion.a
                    href="#"
                    className="text-[#2D55FB] text-xs sm:text-sm font-medium hover:underline transition-all"
                    whileHover={{ scale: 1.05 }}
                  >
                    Contact Support
                  </motion.a>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
