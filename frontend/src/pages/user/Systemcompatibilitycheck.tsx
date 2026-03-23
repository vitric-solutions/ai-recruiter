import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Video,
  Mic,
  RefreshCw,
  CheckCircle,
  User,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { userPath } from "../../routes/EncryptRoute";

interface SystemTest {
  id: string;
  name: string;
  description: string;
  status: "checking" | "working" | "failed";
  icon: React.ReactNode;
  errorMessage?: string;
}

const SystemCompatibilityCheck: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tests, setTests] = useState<SystemTest[]>([
    {
      id: "camera",
      name: "Camera Access",
      description: "Required for video interview",
      status: "checking",
      icon: <Video className="h-5 w-5" />,
    },
    {
      id: "microphone",
      name: "Microphone Access",
      description: "Required for audio recording",
      status: "checking",
      icon: <Mic className="h-5 w-5" />,
    },
  ]);

  const [allReady, setAllReady] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Run system checks on mount
  useEffect(() => {
    runSystemChecks();

    // Cleanup: stop media tracks when component unmounts
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Check if all tests passed
  useEffect(() => {
    const allPassed = tests.every((test) => test.status === "working");
    setAllReady(allPassed);
  }, [tests]);

  const runSystemChecks = async () => {
    // Reset all tests to checking
    setTests((prev) =>
      prev.map((test) => ({
        ...test,
        status: "checking",
        errorMessage: undefined,
      })),
    );

    try {
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setMediaStream(stream);

      // Check camera
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].enabled) {
        setTests((prev) =>
          prev.map((test) =>
            test.id === "camera" ? { ...test, status: "working" } : test,
          ),
        );
      } else {
        setTests((prev) =>
          prev.map((test) =>
            test.id === "camera"
              ? {
                  ...test,
                  status: "failed",
                  errorMessage: "Camera not detected",
                }
              : test,
          ),
        );
      }

      // Check microphone
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].enabled) {
        setTests((prev) =>
          prev.map((test) =>
            test.id === "microphone" ? { ...test, status: "working" } : test,
          ),
        );
      } else {
        setTests((prev) =>
          prev.map((test) =>
            test.id === "microphone"
              ? {
                  ...test,
                  status: "failed",
                  errorMessage: "Microphone not detected",
                }
              : test,
          ),
        );
      }
    } catch (error: any) {
      console.error("Media access error:", error);

      // Handle specific permission errors
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        // User denied permission
        setTests((prev) =>
          prev.map((test) => ({
            ...test,
            status: "failed",
            errorMessage: "Permission denied",
          })),
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        // No devices found
        setTests((prev) =>
          prev.map((test) => ({
            ...test,
            status: "failed",
            errorMessage: "Device not found",
          })),
        );
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        // Device is already in use
        setTests((prev) =>
          prev.map((test) => ({
            ...test,
            status: "failed",
            errorMessage: "Device in use",
          })),
        );
      } else {
        // Other errors
        setTests((prev) =>
          prev.map((test) => ({
            ...test,
            status: "failed",
            errorMessage: "Access failed",
          })),
        );
      }
    }
  };

  const handleRunTestsAgain = () => {
    // Stop existing media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    // Re-run tests
    runSystemChecks();
  };

  const handleContinue = () => {
    // Stop media stream before navigation
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    // Navigate to identity verification
    navigate(userPath("identity", id));
  };

  const handleBack = () => {
    // Stop media stream before navigation
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    navigate(-1);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050A24] bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]">
      {/* Gradient orbs - same as login page */}
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
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-4 md:p-4 bg-[#0a1342]/30 backdrop-blur-sm">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm sm:text-base">System Check</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex items-center justify-center px-4 sm:px-6 md:px-8 py-8 sm:py-12">
          <motion.div
            className="w-full max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Title */}
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
                System Compatibility Check
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
                We're testing your device to ensure the best interview
                experience
              </p>
            </div>

            {/* Test Card */}
            <motion.div
              className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-[#2D55FB]" />
                </div>
                <h2 className="text-white text-lg sm:text-xl font-semibold">
                  Hardware & Connection Tests
                </h2>
              </div>

              {/* Tests */}
              <div className="space-y-3 mb-6">
                {tests.map((test) => (
                  <motion.div
                    key={test.id}
                    className="bg-[#0a1342]/50 rounded-xl p-4 flex items-center justify-between border border-gray-700/30"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#1a2850] flex items-center justify-center text-gray-400">
                        {test.icon}
                      </div>
                      <div>
                        <h3 className="text-white text-sm sm:text-base font-medium">
                          {test.name}
                        </h3>
                        <p className="text-gray-400 text-xs sm:text-sm">
                          {test.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {test.status === "checking" && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          <RefreshCw className="h-4 w-4 text-[#2D55FB]" />
                        </motion.div>
                      )}
                      {test.status === "working" && (
                        <motion.div
                          className="flex items-center gap-2"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-green-500 text-xs sm:text-sm font-medium">
                            Working properly
                          </span>
                        </motion.div>
                      )}
                      {test.status === "failed" && (
                        <motion.div
                          className="flex items-center gap-2"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="text-red-500 text-xs sm:text-sm font-medium">
                            {test.errorMessage || "Access denied"}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={handleRunTestsAgain}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 bg-transparent border border-[#2D55FB] text-[#2D55FB] font-medium rounded-lg hover:bg-[#2D55FB]/10 transition-all text-sm sm:text-base"
                >
                  <RefreshCw className="h-4 w-4" />
                  Run tests Again
                </button>
                <motion.button
                  onClick={handleContinue}
                  disabled={!allReady}
                  className={`px-4 py-2.5 sm:py-3 font-medium rounded-lg transition-all text-sm sm:text-base ${
                    allReady
                      ? "bg-[#2D55FB] text-white hover:bg-[#1e3fd4]"
                      : "bg-gray-600 text-gray-400 cursor-not-allowed"
                  }`}
                  whileHover={allReady ? { scale: 1.02 } : {}}
                  whileTap={allReady ? { scale: 0.98 } : {}}
                >
                  Continue To Instructions
                </motion.button>
              </div>
            </motion.div>

            {/* Status Badge */}
            {allReady ? (
              <motion.div
                className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full w-fit mx-auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-500 text-sm font-medium">
                  All systems ready!
                </span>
              </motion.div>
            ) : tests.some((test) => test.status === "failed") ? (
              <motion.div
                className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full w-fit mx-auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-500 text-sm font-medium">
                  Please grant camera and microphone access
                </span>
              </motion.div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SystemCompatibilityCheck;
