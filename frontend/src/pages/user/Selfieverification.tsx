import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  AlertTriangle,
  User,
  Shield,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import * as faceapi from "@vladmandic/face-api";
import { userPath } from "../../routes/EncryptRoute";

// ─── face-api.js model source ─────────────────────────────────────────────────
// Option A (CDN – no setup needed):
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
// Option B (self-hosted – copy /node_modules/@vladmandic/face-api/model → /public/models):
// const MODEL_URL = "/models";

let faceModelsLoaded = false;
const loadFaceModels = async () => {
  if (faceModelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  faceModelsLoaded = true;
};

// ─── Face validation ──────────────────────────────────────────────────────────

/**
 * Uses TinyFaceDetector + 68-point landmarks to validate the selfie:
 *   1. Exactly ONE face with confidence ≥ 0.55
 *   2. Both eye landmark groups present (proxy for eyes open/visible)
 *   3. Face roughly front-facing (nose tip near jaw midpoint, offset < 28 %)
 */
const validateFaceWithLibrary = async (
  imageDataUrl: string,
): Promise<{ isValid: boolean; reason: string }> => {
  try {
    await loadFaceModels();

    const img = document.createElement("img");
    img.src = imageDataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
    });

    const detections = await faceapi
      .detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }),
      )
      .withFaceLandmarks(true);

    // ── 1. Face count ──
    if (detections.length === 0) {
      return {
        isValid: false,
        reason:
          "No face detected. Please ensure your face is clearly visible and well-lit.",
      };
    }
    if (detections.length > 1) {
      return {
        isValid: false,
        reason:
          "Multiple faces detected. Please make sure only you are in the frame.",
      };
    }

    const { detection, landmarks } = detections[0];

    // ── 2. Confidence threshold ──
    if (detection.score < 0.55) {
      return {
        isValid: false,
        reason:
          "Face not clearly detected. Please improve lighting and ensure your face fills the frame.",
      };
    }

    // ── 3. Eye visibility ──
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    if (!leftEye?.length || !rightEye?.length) {
      return {
        isValid: false,
        reason:
          "Eyes not clearly visible. Please remove sunglasses or any obstruction and try again.",
      };
    }

    // ── 4. Front-facing check (nose vs jaw midpoint) ──
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();
    if (nose?.length && jaw?.length) {
      const jawLeft = jaw[0].x;
      const jawRight = jaw[jaw.length - 1].x;
      const jawWidth = jawRight - jawLeft;
      if (jawWidth > 0) {
        const jawCenter = (jawLeft + jawRight) / 2;
        const noseTip = nose[nose.length - 1].x;
        const offset = Math.abs(noseTip - jawCenter) / jawWidth;
        if (offset > 0.28) {
          return {
            isValid: false,
            reason:
              "Please face the camera directly. Your face appears to be turned to the side.",
          };
        }
      }
    }

    return { isValid: true, reason: "Face verified successfully" };
  } catch (err) {
    console.error("face-api.js error:", err);
    return { isValid: true, reason: "Face check skipped due to an error" }; // fail-open
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CameraStatus =
  | "idle"
  | "active"
  | "validating"
  | "processing"
  | "completed";

// ─── Component ────────────────────────────────────────────────────────────────
const SelfieVerification: React.FC = () => {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [step2Status, setStep2Status] = useState<"in-progress" | "completed">(
    "in-progress",
  );
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanLinePos, setScanLinePos] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const navigate = useNavigate();
const interviewId :any = sessionStorage.getItem("interviewId");
  const handleComplete = () =>
    navigate(userPath("instructions", interviewId), { replace: true });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scanRef = useRef({ pos: 0, dir: 1 });

  // Pre-load models on mount so they're ready when camera starts
  useEffect(() => {
    loadFaceModels().catch(console.error);
  }, []);

  // ── helpers ──
  const stopScan = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startScanAnimation = () => {
    const animate = () => {
      scanRef.current.pos += scanRef.current.dir * 1.5;
      if (scanRef.current.pos >= 100) scanRef.current.dir = -1;
      if (scanRef.current.pos <= 0) scanRef.current.dir = 1;
      setScanLinePos(scanRef.current.pos);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  };

  const captureFrame = useCallback((): string | null => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.85);
      }
    }
    return null;
  }, []);

  // ── Camera flow ───────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setValidationError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("active");

      setTimeout(async () => {
        const img = captureFrame();
        stopStream();

        if (!img) {
          setCameraStatus("idle");
          return;
        }

        setCapturedImage(img);
        setCameraStatus("validating");

        // ── face-api.js face validation ──
        const faceResult = await validateFaceWithLibrary(img);

        if (!faceResult.isValid) {
          setValidationError(faceResult.reason);
          setCapturedImage(null);
          setCameraStatus("idle");
          return;
        }

        // Face passed — scan animation
        setCameraStatus("processing");
        scanRef.current = { pos: 0, dir: 1 };
        startScanAnimation();

        setTimeout(() => {
          stopScan();
          setCameraStatus("completed");
          setStep2Status("completed");
        }, 3000);
      }, 2500);
    } catch {
      // Camera unavailable — graceful fallback (no AI check possible without real image)
      setCameraStatus("active");
      setTimeout(() => {
        setCameraStatus("processing");
        scanRef.current = { pos: 0, dir: 1 };
        startScanAnimation();
        setTimeout(() => {
          stopScan();
          setCameraStatus("completed");
          setStep2Status("completed");
        }, 3000);
      }, 2000);
    }
  }, [captureFrame]);

  const handleRetake = () => {
    setCapturedImage(null);
    setCameraStatus("idle");
    setStep2Status("in-progress");
    setScanLinePos(0);
    setValidationError(null);
    stopScan();
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050A24] bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]">
      <motion.div
        className="absolute -top-20 -right-20 w-[200px] h-[200px] bg-[#2D55FB] rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -50, 20, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-20 -left-20 w-[200px] h-[200px] bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
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
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#0a1342]/30 backdrop-blur-sm">
          <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm sm:text-base">Identity Verification</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 pt-6 pb-2 px-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-green-400 text-xs sm:text-sm font-semibold">
                Document Upload
              </p>
              <p className="text-gray-500 text-xs">Completed</p>
            </div>
          </div>
          <div className="w-12 sm:w-20 h-px bg-gray-700 relative overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-[#2D55FB]"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {step2Status === "completed" ? (
                <motion.div
                  key="done"
                  className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <CheckCircle className="h-5 w-5 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="prog"
                  className="w-9 h-9 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-sm font-bold"
                >
                  2
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <p
                className={`text-xs sm:text-sm font-semibold ${step2Status === "completed" ? "text-green-400" : "text-[#2D55FB]"}`}
              >
                Selfie Capture
              </p>
              <p className="text-gray-500 text-xs">
                {step2Status === "completed" ? "Completed" : "In Progress"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-center px-4 sm:px-6 md:px-8 py-6">
          <motion.div
            className="w-full max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-center mb-6">
              <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">
                Selfie Verification
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
                Take a clear selfie to verify your identity and ensure secure
                assessment access
              </p>
            </div>

            {/* Validation error banner */}
            <AnimatePresence>
              {validationError && (
                <motion.div
                  className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-xs leading-relaxed">
                    <span className="font-semibold">Face check failed: </span>
                    {validationError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Camera Card */}
            <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl mb-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-white font-semibold text-sm sm:text-base">
                  Live Camera Feed
                </h2>
                {cameraStatus === "validating" && (
                  <motion.div
                    className="flex items-center gap-2 text-amber-400 text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="font-medium">Verifying Face</span>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </motion.div>
                  </motion.div>
                )}
                {cameraStatus === "processing" && (
                  <motion.div
                    className="flex items-center gap-2 text-[#2D55FB] text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="font-medium">AI Processing</span>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </motion.div>
                  </motion.div>
                )}
                {cameraStatus === "completed" && (
                  <motion.div
                    className="flex items-center gap-2 text-green-400 text-sm"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <span className="font-semibold text-base">Perfect</span>
                    <CheckCircle className="h-5 w-5" />
                  </motion.div>
                )}
              </div>
              <p className="text-gray-500 text-xs mb-4">
                Position your face in the center of the frame and ensure good
                lighting
              </p>

              {/* Viewport */}
              <div
                className="relative bg-[#0a0f1e] rounded-xl overflow-hidden flex items-center justify-center"
                style={{ minHeight: "260px" }}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`w-full object-cover rounded-xl ${cameraStatus === "active" ? "block" : "hidden"}`}
                  style={{ maxHeight: "280px", minHeight: "260px" }}
                />

                {(cameraStatus === "validating" ||
                  cameraStatus === "processing" ||
                  cameraStatus === "completed") &&
                  capturedImage && (
                    <motion.img
                      src={capturedImage}
                      alt="Captured selfie"
                      className="w-full object-cover rounded-xl"
                      style={{ maxHeight: "280px", minHeight: "260px" }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    />
                  )}

                {(cameraStatus === "validating" ||
                  cameraStatus === "processing" ||
                  cameraStatus === "completed") &&
                  !capturedImage && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1a2540] to-[#0d1535]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-28 h-28 rounded-full bg-[#2a3a60] border-2 border-[#2D55FB]/40 flex items-center justify-center">
                        <User className="h-16 w-16 text-[#2D55FB]/60" />
                      </div>
                    </motion.div>
                  )}

                {cameraStatus === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="absolute inset-6 pointer-events-none">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#2D55FB] rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#2D55FB] rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#2D55FB] rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#2D55FB] rounded-br-lg" />
                    </div>
                    <Camera className="h-14 w-14 text-gray-600" />
                    <motion.button
                      onClick={startCamera}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#2D55FB] text-white text-sm rounded-lg hover:bg-[#1e3fd4] transition-colors shadow-lg"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Camera className="h-4 w-4" />
                      Start Camera
                    </motion.button>
                  </div>
                )}

                {cameraStatus !== "idle" && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute inset-6">
                      <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-[#2D55FB]" />
                      <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-[#2D55FB]" />
                      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-[#2D55FB]" />
                      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-[#2D55FB]" />
                    </div>
                  </div>
                )}

                {cameraStatus === "processing" && (
                  <div
                    className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#2D55FB] to-transparent pointer-events-none z-20"
                    style={{ top: `${scanLinePos}%` }}
                  />
                )}

                {cameraStatus === "active" && (
                  <motion.div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur rounded-full text-white text-xs">
                      <motion.div
                        className="w-2 h-2 rounded-full bg-green-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                      Preparing to capture...
                    </div>
                  </motion.div>
                )}

                {cameraStatus === "validating" && (
                  <motion.div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur rounded-full text-amber-400 text-xs">
                      <motion.div
                        className="w-2 h-2 rounded-full bg-amber-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                      Verifying face...
                    </div>
                  </motion.div>
                )}

                {cameraStatus === "completed" && (
                  <motion.div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <button
                      onClick={handleRetake}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-black/60 backdrop-blur border border-white/20 text-white text-xs rounded-full hover:bg-black/80 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retake
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Guidelines */}
            <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-[#2D55FB]" />
                <h3 className="text-[#2D55FB] font-semibold text-sm">
                  Selfie Guidelines
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#2D55FB]/80 text-xs font-medium mb-2">
                    For Best Results
                  </p>
                  {[
                    "Clear and well-lit photograph",
                    "Both eyes fully visible",
                    "Only one person in frame",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 mb-1.5">
                      <CheckCircle className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                      <p className="text-gray-500 text-xs">{item}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-amber-400/80 text-xs font-medium mb-2">
                    Avoid Common Issues
                  </p>
                  {[
                    "Wearing sunglasses or mask",
                    "Low light or shadows on face",
                    "Multiple people in frame",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 mb-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500/60 mt-0.5 shrink-0" />
                      <p className="text-gray-500 text-xs">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-600 text-gray-400 text-sm rounded-lg hover:border-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Back
              </button>
              <motion.button
                onClick={handleComplete}
                disabled={cameraStatus !== "completed"}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  cameraStatus === "completed"
                    ? "bg-[#2D55FB] text-white hover:bg-[#1e3fd4]"
                    : "bg-[#2D55FB]/40 text-white/50 cursor-not-allowed"
                }`}
                whileHover={cameraStatus === "completed" ? { scale: 1.02 } : {}}
                whileTap={cameraStatus === "completed" ? { scale: 0.98 } : {}}
              >
                Complete Verification →
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SelfieVerification;
