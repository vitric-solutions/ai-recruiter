// import React, { useState, useRef, useCallback, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   ArrowLeft,
//   Upload,
//   Camera,
//   CheckCircle,
//   AlertTriangle,
//   User,
//   RefreshCw,
//   Shield,
// } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import { userService } from "../../services/service/userService";
// import toast from "react-hot-toast";
// import Tesseract from "tesseract.js";
// import * as faceapi from "@vladmandic/face-api";

// // ─── face-api.js model source ─────────────────────────────────────────────────
// // Option A (CDN – no setup):
// const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
// // Option B (self-hosted – copy /node_modules/@vladmandic/face-api/model → /public/models):
// // const MODEL_URL = "/models";

// let faceModelsLoaded = false;
// const loadFaceModels = async () => {
//   if (faceModelsLoaded) return;
//   await Promise.all([
//     faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
//     faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
//   ]);
//   faceModelsLoaded = true;
// };

// // ─── Aadhaar OCR validation (tesseract.js) ────────────────────────────────────

// const fileToDataUrl = (file: File): Promise<string | null> =>
//   new Promise((resolve) => {
//     if (file.type === "application/pdf") return resolve(null);
//     const reader = new FileReader();
//     reader.onload = (e) => resolve((e.target?.result as string) ?? null);
//     reader.onerror = () => resolve(null);
//     reader.readAsDataURL(file);
//   });

// /**
//  * Runs OCR on the uploaded image and checks for Aadhaar-specific markers:
//  *   Group 1 – Keywords : "AADHAAR" / "AADHAR" / "UIDAI" / "UID"
//  *   Group 2 – 12-digit number: #### #### #### (spaces/hyphens OK, partial masking OK)
//  *   Group 3 – "GOVERNMENT OF INDIA" or "UIDAI"
//  * Requires ≥ 2 of 3 groups to pass.
//  * PDFs are forwarded to the backend without OCR (cannot render PDF pixels client-side).
//  */
// const validateAadhaarWithOCR = async (
//   file: File
// ): Promise<{ isValid: boolean; reason: string }> => {
//   if (file.type === "application/pdf") {
//     return { isValid: true, reason: "PDF forwarded to backend" };
//   }

//   const dataUrl = await fileToDataUrl(file);
//   if (!dataUrl) return { isValid: false, reason: "Could not read the file" };

//   try {
//     const { data: { text } } = await Tesseract.recognize(dataUrl, "eng", {
//       logger: () => {}, // suppress verbose progress logs
//     });

//     const upper = text.toUpperCase();

//     const hasAadhaarKeyword = /AADHAAR|AADHAR|UIDAI/.test(upper) || /\bUID\b/.test(upper);
//     const has12Digit =
//       /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/.test(upper) ||
//       /[X\d]{4}[\s\-]?[X\d]{4}[\s\-]?[X\d]{4}/i.test(upper);
//     const hasGovt = /GOVERNMENT\s+OF\s+INDIA|GOVT\.?\s+OF\s+INDIA/.test(upper);

//     const passed = [hasAadhaarKeyword, has12Digit, hasGovt].filter(Boolean).length;

//     if (passed >= 2) {
//       return { isValid: true, reason: "Aadhaar card detected via OCR" };
//     }

//     const missing: string[] = [];
//     if (!hasAadhaarKeyword) missing.push("Aadhaar/UIDAI branding");
//     if (!has12Digit) missing.push("12-digit Aadhaar number");
//     if (!hasGovt) missing.push('"Government of India" text');

//     return {
//       isValid: false,
//       reason: `Could not confirm this is an Aadhaar card. Missing: ${missing.join(
//         ", "
//       )}. Please upload a clear, unobstructed photo of your Aadhaar card.`,
//     };
//   } catch (err) {
//     console.error("Tesseract OCR error:", err);
//     return { isValid: true, reason: "OCR check skipped due to an error" }; // fail-open
//   }
// };

// // ─── Face validation (face-api.js) ───────────────────────────────────────────

// /**
//  * Uses TinyFaceDetector + 68-point landmarks to validate the captured selfie:
//  *   1. Exactly ONE face detected with confidence ≥ 0.55
//  *   2. Both eye landmark groups present (proxy for eyes open/visible)
//  *   3. Face roughly front-facing (nose tip near jaw midpoint, offset < 28 %)
//  */
// const validateFaceWithLibrary = async (
//   imageDataUrl: string
// ): Promise<{ isValid: boolean; reason: string }> => {
//   try {
//     await loadFaceModels();

//     const img = document.createElement("img");
//     img.src = imageDataUrl;
//     await new Promise<void>((resolve, reject) => {
//       img.onload = () => resolve();
//       img.onerror = () => reject(new Error("Image load failed"));
//     });

//     const detections = await faceapi
//       .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
//       .withFaceLandmarks(true);

//     if (detections.length === 0) {
//       return {
//         isValid: false,
//         reason: "No face detected. Please ensure your face is clearly visible and well-lit.",
//       };
//     }
//     if (detections.length > 1) {
//       return {
//         isValid: false,
//         reason: "Multiple faces detected. Please make sure only you are in the frame.",
//       };
//     }

//     const { detection, landmarks } = detections[0];

//     if (detection.score < 0.55) {
//       return {
//         isValid: false,
//         reason: "Face not clearly detected. Please improve lighting and ensure your face fills the frame.",
//       };
//     }

//     const leftEye = landmarks.getLeftEye();
//     const rightEye = landmarks.getRightEye();
//     if (!leftEye?.length || !rightEye?.length) {
//       return {
//         isValid: false,
//         reason: "Eyes not clearly visible. Please remove sunglasses or any obstruction and try again.",
//       };
//     }

//     // Front-facing check via nose/jaw geometry
//     const nose = landmarks.getNose();
//     const jaw = landmarks.getJawOutline();
//     if (nose?.length && jaw?.length) {
//       const jawLeft = jaw[0].x;
//       const jawRight = jaw[jaw.length - 1].x;
//       const jawWidth = jawRight - jawLeft;
//       if (jawWidth > 0) {
//         const jawCenter = (jawLeft + jawRight) / 2;
//         const noseTip = nose[nose.length - 1].x;
//         const offset = Math.abs(noseTip - jawCenter) / jawWidth;
//         if (offset > 0.28) {
//           return {
//             isValid: false,
//             reason: "Please face the camera directly. Your face appears to be turned to the side.",
//           };
//         }
//       }
//     }

//     return { isValid: true, reason: "Face verified successfully" };
//   } catch (err) {
//     console.error("face-api.js error:", err);
//     return { isValid: true, reason: "Face check skipped due to an error" }; // fail-open
//   }
// };

// // ─── Types ────────────────────────────────────────────────────────────────────
// type Step = "document" | "selfie";
// type UploadStatus = "idle" | "uploading" | "verified" | "error";
// type CameraStatus = "idle" | "active" | "validating" | "processing" | "completed";

// // ─── Component ────────────────────────────────────────────────────────────────
// const IdentityVerification: React.FC = () => {
//   const navigate = useNavigate();
//   const interviewId = sessionStorage.getItem("interviewId");

//   const [currentStep, setCurrentStep] = useState<Step>("document");
//   const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
//   const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; file: File } | null>(null);
//   const [isDragOver, setIsDragOver] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
//   const [capturedImage, setCapturedImage] = useState<string | null>(null);
//   const [scanLinePos, setScanLinePos] = useState(0);
//   const videoRef = useRef<HTMLVideoElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const animFrameRef = useRef<number | null>(null);
//   const scanRef = useRef({ pos: 0, dir: 1 });

//   // Pre-load face models on mount so they're ready when camera starts
//   useEffect(() => {
//     loadFaceModels().catch(console.error);
//   }, []);

//   const getInterviewId = () => sessionStorage.getItem("interviewId") ?? null;

//   const formatFileSize = (bytes: number) =>
//     bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(2)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

//   // ── Document upload ──────────────────────────────────────────────────────────

//   const handleFile = async (file: File) => {
//     const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
//     if (!validTypes.includes(file.type)) {
//       toast.error("Invalid file type. Please upload JPG, PNG, or PDF");
//       return;
//     }
//     if (file.size > 5 * 1024 * 1024) {
//       toast.error("File size must be less than 5MB");
//       return;
//     }

//     setUploadStatus("uploading");
//     setUploadedFile({ name: file.name, size: formatFileSize(file.size), file });

//     // Step 1 – OCR Aadhaar check
//     const ocrResult = await validateAadhaarWithOCR(file);
//     if (!ocrResult.isValid) {
//       setUploadStatus("error");
//       toast.error(ocrResult.reason);
//       return;
//     }

//     // Step 2 – Backend verification
//     try {
//       const userId = getInterviewId();
//       if (!userId) { toast.error("User not authenticated"); setUploadStatus("error"); return; }

//       const response = await userService.adharVerification(userId, file);
//       if (response.status === 200 || response.data?.success) {
//         setUploadStatus("verified");
//         toast.success("Aadhaar verified successfully!");
//       } else {
//         setUploadStatus("error");
//         toast.error("Verification failed. Please try again.");
//       }
//     } catch (error: any) {
//       console.error("Aadhaar verification error:", error);
//       setUploadStatus("error");
//       toast.error(error.response?.data?.message ?? "Verification failed. Please try again.");
//     }
//   };

//   const handleDrop = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragOver(false);
//     const file = e.dataTransfer.files[0];
//     if (file) handleFile(file);
//   }, []);

//   const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) handleFile(file);
//   };

//   const handleUploadDifferent = () => {
//     setUploadStatus("idle");
//     setUploadedFile(null);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   // ── Photo / Camera ──────────────────────────────────────────────────────────

//   const stopScan = () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };

//   const startScanAnimation = () => {
//     const animate = () => {
//       scanRef.current.pos += scanRef.current.dir * 1.5;
//       if (scanRef.current.pos >= 100) scanRef.current.dir = -1;
//       if (scanRef.current.pos <= 0) scanRef.current.dir = 1;
//       setScanLinePos(scanRef.current.pos);
//       animFrameRef.current = requestAnimationFrame(animate);
//     };
//     animFrameRef.current = requestAnimationFrame(animate);
//   };

//   const captureFrame = useCallback((): string | null => {
//     if (videoRef.current && canvasRef.current) {
//       const canvas = canvasRef.current;
//       const video = videoRef.current;
//       canvas.width = video.videoWidth || 480;
//       canvas.height = video.videoHeight || 360;
//       const ctx = canvas.getContext("2d");
//       if (ctx) { ctx.drawImage(video, 0, 0); return canvas.toDataURL("image/jpeg", 0.85); }
//     }
//     return null;
//   }, []);

//   const stopStream = () => {
//     if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
//   };

//   const startCamera = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
//       streamRef.current = stream;
//       if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
//       setCameraStatus("active");

//       setTimeout(async () => {
//         const img = captureFrame();
//         stopStream();

//         if (!img) { toast.error("Could not capture image. Please try again."); setCameraStatus("idle"); return; }

//         setCapturedImage(img);
//         setCameraStatus("validating");

//         // face-api.js face validation
//         const faceResult = await validateFaceWithLibrary(img);
//         if (!faceResult.isValid) {
//           toast.error(faceResult.reason);
//           setCapturedImage(null);
//           setCameraStatus("idle");
//           return;
//         }

//         // Passed — start scan animation
//         setCameraStatus("processing");
//         scanRef.current = { pos: 0, dir: 1 };
//         startScanAnimation();

//         // Upload Photo to backend in background
//         (async () => {
//           try {
//             const blob = await (await fetch(img)).blob();
//             const file = new File([blob], "selfie.jpg", { type: blob.type || "image/jpeg" });
//             const userId = getInterviewId();
//             if (!userId) { toast.error("User not authenticated"); return; }
//             await userService.selfieVerification(userId, file);
//           } catch (error) {
//             console.error("Photo upload error:", error);
//             toast.error("Photo upload failed. Please try again.");
//           }
//         })();

//         setTimeout(() => { stopScan(); setCameraStatus("completed"); toast.success("Photo captured successfully!"); }, 3000);
//       }, 2500);
//     } catch (error) {
//       console.error("Camera error:", error);
//       toast.error("Failed to access camera");
//       setCameraStatus("idle");
//     }
//   }, [captureFrame]);

//   const handleRetake = () => { setCapturedImage(null); setCameraStatus("idle"); setScanLinePos(0); stopScan(); };
//   const handleBack = () => navigate(-1);
//   const handleComplete = () => navigate(`/user/${interviewId}/interview-instruction`, { replace: true });

//   useEffect(() => {
//     return () => { stopStream(); stopScan(); };
//   }, []);

//   // ── Render ───────────────────────────────────────────────────────────────────
//   return (
//     <div className="min-h-screen relative overflow-hidden bg-[#050A24] bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]">
//       <motion.div className="absolute -top-20 -right-20 w-[200px] h-[200px] bg-[#2D55FB] rounded-full mix-blend-multiply filter blur-3xl opacity-30"
//         animate={{ x: [0,30,-20,0], y: [0,-50,20,0], scale: [1,1.1,0.9,1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
//       <motion.div className="absolute -bottom-20 -left-20 w-[200px] h-[200px] bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
//         animate={{ x: [0,-40,30,0], y: [0,40,-30,0], scale: [1,0.9,1.1,1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
//       <canvas ref={canvasRef} className="hidden" />

//       <div className="relative z-10 min-h-screen">
//         {/* Header */}
//         <div className="flex items-center justify-between p-4 bg-[#0a1342]/30 backdrop-blur-sm">
//           <button onClick={handleBack} className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
//             <ArrowLeft className="h-5 w-5" /><span className="text-sm sm:text-base">Identity Verification</span>
//           </button>
//           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
//             <User className="h-5 w-5 text-white" />
//           </div>
//         </div>

//         {/* Step Indicator */}
//         <div className="flex items-center justify-center gap-4 pt-6 pb-2 px-4">
//           <div className="flex items-center gap-2">
//             <AnimatePresence mode="wait">
//               {uploadStatus === "verified" ? (
//                 <motion.div key="d1" className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center"
//                   initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
//                   <CheckCircle className="h-5 w-5 text-white" />
//                 </motion.div>
//               ) : (
//                 <motion.div key="p1" className="w-9 h-9 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-sm font-bold">1</motion.div>
//               )}
//             </AnimatePresence>
//             <div>
//               <p className={`text-xs sm:text-sm font-semibold ${uploadStatus === "verified" ? "text-green-400" : "text-[#2D55FB]"}`}>Document Upload</p>
//               <p className="text-gray-500 text-xs">{uploadStatus === "verified" ? "Completed" : "Identity verification"}</p>
//             </div>
//           </div>

//           <div className="w-12 sm:w-20 h-px bg-gray-700 relative overflow-hidden">
//             <motion.div className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-[#2D55FB]"
//               initial={{ width: "0%" }} animate={{ width: uploadStatus === "verified" ? "100%" : "0%" }} transition={{ duration: 0.8 }} />
//           </div>

//           <div className="flex items-center gap-2">
//             <AnimatePresence mode="wait">
//               {cameraStatus === "completed" ? (
//                 <motion.div key="d2" className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center"
//                   initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
//                   <CheckCircle className="h-5 w-5 text-white" />
//                 </motion.div>
//               ) : (
//                 <motion.div key="p2" className="w-9 h-9 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-sm font-bold">2</motion.div>
//               )}
//             </AnimatePresence>
//             <div>
//               <p className={`text-xs sm:text-sm font-semibold ${cameraStatus === "completed" ? "text-green-400" : "text-[#2D55FB]"}`}>Photo Capture</p>
//               <p className="text-gray-500 text-xs">{cameraStatus === "completed" ? "Completed" : "Identity verification"}</p>
//             </div>
//           </div>
//         </div>

//         {/* Main Content */}
//         <div className="flex items-start justify-center px-4 sm:px-6 md:px-8 py-6">
//           <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

//             {currentStep === "document" ? (
//               <>
//                 <div className="text-center mb-6">
//                   <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">Document Verification</h1>
//                   <p className="text-gray-400 text-sm sm:text-base">Please upload a clear photo of your Aadhaar card for secure identity verification</p>
//                 </div>

//                 <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl mb-4">
//                   <h2 className="text-white font-semibold text-sm sm:text-base mb-1">Upload Aadhaar Card</h2>
//                   <p className="text-gray-500 text-xs mb-4">Accepted formats: JPG, PNG, PDF • Maximum size: 5MB • Ensure all corners are visible</p>
//                   <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileInput} />

//                   <AnimatePresence mode="wait">
//                     {uploadStatus === "idle" || uploadStatus === "uploading" ? (
//                       <motion.div key="dz"
//                         className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragOver ? "border-[#2D55FB] bg-[#2D55FB]/10" : "border-gray-600 hover:border-gray-500"} ${uploadStatus === "uploading" ? "pointer-events-none" : ""}`}
//                         onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
//                         onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
//                         onClick={() => fileInputRef.current?.click()}
//                         initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
//                         {uploadStatus === "uploading" ? (
//                           <div className="flex flex-col items-center gap-3">
//                             <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
//                               <RefreshCw className="h-8 w-8 text-[#2D55FB]" />
//                             </motion.div>
//                             <p className="text-gray-400 text-sm">Verifying document...</p>
//                             <p className="text-gray-600 text-xs">{uploadedFile?.name}</p>
//                           </div>
//                         ) : (
//                           <div className="flex flex-col items-center gap-3">
//                             <Upload className="h-10 w-10 text-gray-500" />
//                             <div>
//                               <p className="text-gray-300 text-sm font-medium">Drag and drop your Aadhaar card here</p>
//                               <p className="text-gray-500 text-xs mt-1">or click to select from your device</p>
//                             </div>
//                             <button className="px-4 py-2 bg-[#2D55FB]/20 border border-[#2D55FB]/40 text-[#2D55FB] text-xs rounded-lg hover:bg-[#2D55FB]/30 transition-colors">Choose File</button>
//                           </div>
//                         )}
//                       </motion.div>
//                     ) : uploadStatus === "verified" ? (
//                       <motion.div key="ok" className="border border-green-500/30 bg-green-500/10 rounded-xl p-6 text-center"
//                         initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
//                         <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
//                         <p className="text-green-400 font-semibold text-sm mb-1">Document verified successfully!</p>
//                         <p className="text-gray-500 text-xs mb-1">{uploadedFile?.name}</p>
//                         <p className="text-gray-600 text-xs mb-4">{uploadedFile?.size} • Uploaded and verified</p>
//                         <button onClick={handleUploadDifferent} className="text-xs text-gray-400 hover:text-gray-300 underline transition-colors">Upload Different Document</button>
//                       </motion.div>
//                     ) : (
//                       <motion.div key="err" className="border border-red-500/30 bg-red-500/10 rounded-xl p-6 text-center"
//                         initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
//                         <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
//                         <p className="text-red-400 font-semibold text-sm mb-1">Verification failed</p>
//                         <p className="text-gray-500 text-xs mb-4">Please try uploading again</p>
//                         <button onClick={handleUploadDifferent} className="px-4 py-2 bg-[#2D55FB]/20 border border-[#2D55FB]/40 text-[#2D55FB] text-xs rounded-lg hover:bg-[#2D55FB]/30 transition-colors">Try Again</button>
//                       </motion.div>
//                     )}
//                   </AnimatePresence>
//                 </div>

//                 <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 mb-6">
//                   <div className="flex items-center gap-2 mb-4">
//                     <Shield className="h-4 w-4 text-[#2D55FB]" />
//                     <h3 className="text-[#2D55FB] font-semibold text-sm">Document Guidelines</h3>
//                   </div>
//                   <div className="grid grid-cols-2 gap-4">
//                     <div>
//                       <p className="text-[#2D55FB]/80 text-xs font-medium mb-2">Required Quality</p>
//                       {["Clear and well-lit photograph", "All four corners visible", "Text and numbers readable"].map((item) => (
//                         <div key={item} className="flex items-start gap-2 mb-1.5">
//                           <CheckCircle className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
//                           <p className="text-gray-500 text-xs">{item}</p>
//                         </div>
//                       ))}
//                     </div>
//                     <div>
//                       <p className="text-amber-400/80 text-xs font-medium mb-2">Avoid Common Issues</p>
//                       {["Blurry or tilted images", "Shadows covering text", "Partial or cropped document"].map((item) => (
//                         <div key={item} className="flex items-start gap-2 mb-1.5">
//                           <AlertTriangle className="h-3 w-3 text-amber-500/60 mt-0.5 shrink-0" />
//                           <p className="text-gray-500 text-xs">{item}</p>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="flex justify-center">
//                   <motion.button onClick={() => uploadStatus === "verified" && setCurrentStep("selfie")}
//                     disabled={uploadStatus !== "verified"}
//                     className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${uploadStatus === "verified" ? "bg-[#2D55FB] text-white hover:bg-[#1e3fd4]" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`}
//                     whileHover={uploadStatus === "verified" ? { scale: 1.02 } : {}}
//                     whileTap={uploadStatus === "verified" ? { scale: 0.98 } : {}}>
//                     Next: Photo Verification →
//                   </motion.button>
//                 </div>
//               </>
//             ) : (
//               <>
//                 <div className="text-center mb-6">
//                   <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">Photo Verification</h1>
//                   <p className="text-gray-400 text-sm sm:text-base">Take a clear Photo to verify your identity and ensure secure assessment access</p>
//                 </div>

//                 <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl mb-4">
//                   <div className="flex items-center justify-between mb-1">
//                     <h2 className="text-white font-semibold text-sm sm:text-base">Live Camera Feed</h2>
//                     {cameraStatus === "validating" && (
//                       <motion.div className="flex items-center gap-2 text-amber-400 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
//                         <span className="font-medium">Verifying Face</span>
//                         <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="h-4 w-4" /></motion.div>
//                       </motion.div>
//                     )}
//                     {cameraStatus === "processing" && (
//                       <motion.div className="flex items-center gap-2 text-[#2D55FB] text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
//                         <span className="font-medium">AI Processing</span>
//                         <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="h-4 w-4" /></motion.div>
//                       </motion.div>
//                     )}
//                     {cameraStatus === "completed" && (
//                       <motion.div className="flex items-center gap-2 text-green-400 text-sm" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
//                         <span className="font-semibold text-base">Perfect</span><CheckCircle className="h-5 w-5" />
//                       </motion.div>
//                     )}
//                   </div>
//                   <p className="text-gray-500 text-xs mb-4">Position your face in the center of the frame and ensure good lighting</p>

//                   <div className="relative bg-[#0a0f1e] rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: "260px" }}>
//                     <video ref={videoRef} muted playsInline
//                       className={`w-full object-cover rounded-xl ${cameraStatus === "active" ? "block" : "hidden"}`}
//                       style={{ maxHeight: "280px", minHeight: "260px" }} />

//                     {(cameraStatus === "validating" || cameraStatus === "processing" || cameraStatus === "completed") && capturedImage && (
//                       <motion.img src={capturedImage} alt="Captured Photo" className="w-full object-cover rounded-xl"
//                         style={{ maxHeight: "280px", minHeight: "260px" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
//                     )}

//                     {(cameraStatus === "validating" || cameraStatus === "processing" || cameraStatus === "completed") && !capturedImage && (
//                       <motion.div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1a2540] to-[#0d1535]"
//                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
//                         <div className="w-28 h-28 rounded-full bg-[#2a3a60] border-2 border-[#2D55FB]/40 flex items-center justify-center">
//                           <User className="h-16 w-16 text-[#2D55FB]/60" />
//                         </div>
//                       </motion.div>
//                     )}

//                     {cameraStatus === "idle" && (
//                       <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
//                         <div className="absolute inset-6 pointer-events-none">
//                           <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#2D55FB] rounded-tl-lg" />
//                           <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#2D55FB] rounded-tr-lg" />
//                           <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#2D55FB] rounded-bl-lg" />
//                           <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#2D55FB] rounded-br-lg" />
//                         </div>
//                         <Camera className="h-14 w-14 text-gray-600" />
//                         <motion.button onClick={startCamera}
//                           className="flex items-center gap-2 px-5 py-2.5 bg-[#2D55FB] text-white text-sm rounded-lg hover:bg-[#1e3fd4] transition-colors shadow-lg"
//                           whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
//                           <Camera className="h-4 w-4" />Start Camera
//                         </motion.button>
//                       </div>
//                     )}

//                     {cameraStatus !== "idle" && (
//                       <div className="absolute inset-0 pointer-events-none z-10">
//                         <div className="absolute inset-6">
//                           <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-[#2D55FB]" />
//                           <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-[#2D55FB]" />
//                           <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-[#2D55FB]" />
//                           <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-[#2D55FB]" />
//                         </div>
//                       </div>
//                     )}

//                     {cameraStatus === "processing" && (
//                       <div className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#2D55FB] to-transparent pointer-events-none z-20"
//                         style={{ top: `${scanLinePos}%` }} />
//                     )}

//                     {cameraStatus === "active" && (
//                       <motion.div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
//                         <div className="flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur rounded-full text-white text-xs">
//                           <motion.div className="w-2 h-2 rounded-full bg-green-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
//                           Preparing to capture...
//                         </div>
//                       </motion.div>
//                     )}

//                     {cameraStatus === "validating" && (
//                       <motion.div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
//                         <div className="flex items-center gap-2 px-4 py-1.5 bg-black/60 backdrop-blur rounded-full text-amber-400 text-xs">
//                           <motion.div className="w-2 h-2 rounded-full bg-amber-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
//                           Verifying face...
//                         </div>
//                       </motion.div>
//                     )}

//                     {cameraStatus === "completed" && (
//                       <motion.div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
//                         <button onClick={handleRetake}
//                           className="flex items-center gap-1.5 px-4 py-1.5 bg-black/60 backdrop-blur border border-white/20 text-white text-xs rounded-full hover:bg-black/80 transition-colors">
//                           <RefreshCw className="h-3 w-3" />Retake
//                         </button>
//                       </motion.div>
//                     )}
//                   </div>
//                 </div>

//                 <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 mb-6">
//                   <div className="flex items-center gap-2 mb-4">
//                     <Shield className="h-4 w-4 text-[#2D55FB]" />
//                     <h3 className="text-[#2D55FB] font-semibold text-sm">Photo Guidelines</h3>
//                   </div>
//                   <div className="grid grid-cols-2 gap-4">
//                     <div>
//                       <p className="text-[#2D55FB]/80 text-xs font-medium mb-2">For Best Results</p>
//                       {["Face clearly visible", "Good lighting", "Neutral expression"].map((item) => (
//                         <div key={item} className="flex items-start gap-2 mb-1.5">
//                           <CheckCircle className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
//                           <p className="text-gray-500 text-xs">{item}</p>
//                         </div>
//                       ))}
//                     </div>
//                     <div>
//                       <p className="text-amber-400/80 text-xs font-medium mb-2">Avoid Common Issues</p>
//                       {["Wearing sunglasses", "Low light conditions", "Face partially covered"].map((item) => (
//                         <div key={item} className="flex items-start gap-2 mb-1.5">
//                           <AlertTriangle className="h-3 w-3 text-amber-500/60 mt-0.5 shrink-0" />
//                           <p className="text-gray-500 text-xs">{item}</p>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="flex justify-between">
//                   <button onClick={() => setCurrentStep("document")}
//                     className="flex items-center gap-2 px-4 py-2.5 border border-gray-600 text-gray-400 text-sm rounded-lg hover:border-gray-500 hover:text-gray-300 transition-colors">
//                     ← Back
//                   </button>
//                   <motion.button onClick={handleComplete} disabled={cameraStatus !== "completed"}
//                     className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${cameraStatus === "completed" ? "bg-[#2D55FB] text-white hover:bg-[#1e3fd4]" : "bg-[#2D55FB]/40 text-white/50 cursor-not-allowed"}`}
//                     whileHover={cameraStatus === "completed" ? { scale: 1.02 } : {}}
//                     whileTap={cameraStatus === "completed" ? { scale: 0.98 } : {}}>
//                     Complete Verification →
//                   </motion.button>
//                 </div>
//               </>
//             )}
//           </motion.div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default IdentityVerification;

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Camera,
  CheckCircle,
  AlertTriangle,
  User,
  RefreshCw,
  Shield,
  CreditCard,
  BookOpen,
  Eye,
  Sun,
  Crosshair,
  ZoomIn,
  Smile,
  XCircle,
  ScanLine,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { userService } from "../../services/service/userService";
import toast from "react-hot-toast";
import Tesseract from "tesseract.js";
import * as faceapi from "@vladmandic/face-api";
import SelfieVerification from "./Selfieverification";

// ─── face-api.js model source ─────────────────────────────────────────────────
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

let faceModelsLoaded = false;
const loadFaceModels = async () => {
  if (faceModelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  faceModelsLoaded = true;
};

// ─── File helper ──────────────────────────────────────────────────────────────
const fileToDataUrl = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    if (file.type === "application/pdf") return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

// ─── Aadhaar OCR validation (uploaded file) ───────────────────────────────────
const validateAadhaarWithOCR = async (
  file: File
): Promise<{ isValid: boolean; reason: string }> => {
  if (file.type === "application/pdf")
    return { isValid: true, reason: "PDF forwarded to backend" };
  const dataUrl = await fileToDataUrl(file);
  if (!dataUrl) return { isValid: false, reason: "Could not read the file" };
  try {
    const { data: { text } } = await Tesseract.recognize(dataUrl, "eng", { logger: () => {} });
    const upper = text.toUpperCase();
    const hasAadhaarKeyword = /AADHAAR|AADHAR|UIDAI/.test(upper) || /\bUID\b/.test(upper);
    const has12Digit =
      /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/.test(upper) ||
      /[X\d]{4}[\s\-]?[X\d]{4}[\s\-]?[X\d]{4}/i.test(upper);
    const hasGovt = /GOVERNMENT\s+OF\s+INDIA|GOVT\.?\s+OF\s+INDIA/.test(upper);
    const passed = [hasAadhaarKeyword, has12Digit, hasGovt].filter(Boolean).length;
    if (passed >= 2) return { isValid: true, reason: "Aadhaar card detected via OCR" };
    const missing: string[] = [];
    if (!hasAadhaarKeyword) missing.push("Aadhaar/UIDAI branding");
    if (!has12Digit) missing.push("12-digit Aadhaar number");
    if (!hasGovt) missing.push('"Government of India" text');
    return {
      isValid: false,
      reason: `Could not confirm this is an Aadhaar card. Missing: ${missing.join(", ")}. Please upload a clear, unobstructed photo of your Aadhaar card.`,
    };
  } catch {
    return { isValid: true, reason: "OCR check skipped due to an error" };
  }
};

// ─── Aadhaar OCR validation (dataUrl — camera capture) ───────────────────────
// const validateAadhaarDataUrl = async (
//   dataUrl: string
// ): Promise<{ isValid: boolean; reason: string }> => {
//   try {
//     const { data: { text } } = await Tesseract.recognize(dataUrl, "eng", { logger: () => {} });
//     const upper = text.toUpperCase();
//     const hasAadhaarKeyword = /AADHAAR|AADHAR|UIDAI/.test(upper) || /\bUID\b/.test(upper);
//     const has12Digit =
//       /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/.test(upper) ||
//       /[X\d]{4}[\s\-]?[X\d]{4}[\s\-]?[X\d]{4}/i.test(upper);
//     const hasGovt = /GOVERNMENT\s+OF\s+INDIA|GOVT\.?\s+OF\s+INDIA/.test(upper);
//     const passed = [hasAadhaarKeyword, has12Digit, hasGovt].filter(Boolean).length;
//     if (passed >= 2) return { isValid: true, reason: "Aadhaar card detected via OCR" };
//     const missing: string[] = [];
//     if (!hasAadhaarKeyword) missing.push("Aadhaar/UIDAI text");
//     if (!has12Digit) missing.push("12-digit number");
//     if (!hasGovt) missing.push('"Govt of India" text');
//     return {
//       isValid: false,
//       reason: `Could not verify as Aadhaar card. Missing: ${missing.join(", ")}. Ensure the entire card is visible, well-lit, and held steady.`,
//     };
//   } catch {
//     return { isValid: true, reason: "OCR check skipped due to an error" };
//   }
// };

// ─── Passport OCR validation ──────────────────────────────────────────────────
const validatePassportWithOCR = async (
  file: File
): Promise<{ isValid: boolean; reason: string }> => {
  if (file.type === "application/pdf")
    return { isValid: true, reason: "PDF forwarded to backend" };
  const dataUrl = await fileToDataUrl(file);
  if (!dataUrl) return { isValid: false, reason: "Could not read the file" };
  try {
    const { data: { text } } = await Tesseract.recognize(dataUrl, "eng", { logger: () => {} });
    const upper = text.toUpperCase();
    const hasPassportKeyword = /PASSPORT/.test(upper);
    const hasMRZ = /P[<\s][A-Z<\s]{5,}/.test(upper);
    const hasPassportNumber = /[A-Z]\d{7}/.test(upper);
    const hasIndia = /REPUBLIC\s+OF\s+INDIA|IND\b|INDIA/.test(upper);
    const passed = [hasPassportKeyword, hasMRZ || hasPassportNumber, hasIndia].filter(Boolean).length;
    if (passed >= 2) return { isValid: true, reason: "Passport detected via OCR" };
    const missing: string[] = [];
    if (!hasPassportKeyword) missing.push("Passport branding");
    if (!hasMRZ && !hasPassportNumber) missing.push("Passport number / MRZ");
    if (!hasIndia) missing.push("Country identifier");
    return {
      isValid: false,
      reason: `Could not confirm this is a valid Passport. Missing: ${missing.join(", ")}. Please upload a clear photo of the bio-data page of your passport.`,
    };
  } catch {
    return { isValid: true, reason: "OCR check skipped due to an error" };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SELFIE FACE LOGIC ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const ptDist = (a: faceapi.Point, b: faceapi.Point) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const eyeAspectRatio = (pts: faceapi.Point[]): number => {
  if (pts.length < 6) return 1;
  return (ptDist(pts[1], pts[5]) + ptDist(pts[2], pts[4])) / (2 * ptDist(pts[0], pts[3]));
};

const EAR_THRESHOLD = 0.2;

const getFrameBrightness = (canvas: HTMLCanvasElement): number => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 128;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let total = 0, count = 0;
  for (let i = 0; i < data.length; i += 40) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count++;
  }
  return count > 0 ? total / count : 128;
};

interface LiveChecks {
  faceFound: boolean;
  multipleFaces: boolean;
  eyesOpen: boolean;
  centered: boolean;
  faceSize: "ok" | "too-far" | "too-close";
  lightingOk: boolean;
  frontal: boolean;
  confidence: number;
  allPassed: boolean;
}

const DEFAULT_CHECKS: LiveChecks = {
  faceFound: false, multipleFaces: false, eyesOpen: false,
  centered: false, faceSize: "too-far", lightingOk: false,
  frontal: false, confidence: 0, allPassed: false,
};

const analyzeFrame = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<LiveChecks> => {
  const ctx = canvas.getContext("2d");
  if (!ctx || !video.videoWidth) return DEFAULT_CHECKS;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  const brightness = getFrameBrightness(canvas);
  const lightingOk = brightness > 60 && brightness < 230;

  let detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[];
  try {
    detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
      .withFaceLandmarks(true);
  } catch {
    return { ...DEFAULT_CHECKS, lightingOk };
  }

  if (detections.length === 0) return { ...DEFAULT_CHECKS, lightingOk };
  if (detections.length > 1)
    return { ...DEFAULT_CHECKS, lightingOk, faceFound: true, multipleFaces: true };

  const { detection, landmarks } = detections[0];
  const box = detection.box;
  const imgW = canvas.width, imgH = canvas.height;

  const faceArea = (box.width * box.height) / (imgW * imgH);
  let faceSize: LiveChecks["faceSize"] = "ok";
  if (faceArea < 0.06) faceSize = "too-far";
  else if (faceArea > 0.55) faceSize = "too-close";

  const faceCx = box.x + box.width / 2, faceCy = box.y + box.height / 2;
  const centered =
    Math.abs(faceCx / imgW - 0.5) < 0.20 && Math.abs(faceCy / imgH - 0.5) < 0.22;

  const eyesOpen =
    eyeAspectRatio(landmarks.getLeftEye()) > EAR_THRESHOLD &&
    eyeAspectRatio(landmarks.getRightEye()) > EAR_THRESHOLD;

  let frontal = true;
  const nose = landmarks.getNose(), jaw = landmarks.getJawOutline();
  if (nose?.length && jaw?.length) {
    const jawW = jaw[jaw.length - 1].x - jaw[0].x;
    if (jawW > 0)
      frontal = Math.abs(nose[nose.length - 1].x - (jaw[0].x + jawW / 2)) / jawW < 0.28;
  }

  const confidence = detection.score;
  const faceFound = confidence > 0.45;
  const allPassed =
    faceFound && eyesOpen && centered && faceSize === "ok" && lightingOk && frontal && confidence >= 0.55;

  return { faceFound, multipleFaces: false, eyesOpen, centered, faceSize, lightingOk, frontal, confidence, allPassed };
};

const validateCapturedImage = async (
  imageDataUrl: string
): Promise<{ isValid: boolean; reason: string }> => {
  try {
    await loadFaceModels();
    const img = document.createElement("img");
    img.src = imageDataUrl;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });

    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
      .withFaceLandmarks(true);

    if (detections.length === 0)
      return { isValid: false, reason: "No face detected. Please ensure your face is clearly visible and well-lit." };
    if (detections.length > 1)
      return { isValid: false, reason: "Multiple faces detected. Please make sure only you are in the frame." };

    const { detection, landmarks } = detections[0];
    if (detection.score < 0.55)
      return { isValid: false, reason: "Face not clearly detected. Please improve lighting and ensure your face fills the frame." };

    const earL = eyeAspectRatio(landmarks.getLeftEye());
    const earR = eyeAspectRatio(landmarks.getRightEye());
    if (earL < EAR_THRESHOLD || earR < EAR_THRESHOLD)
      return { isValid: false, reason: "Your eyes appear to be closed. Please keep your eyes open and look at the camera." };

    if (!landmarks.getLeftEye()?.length || !landmarks.getRightEye()?.length)
      return { isValid: false, reason: "Eyes not clearly visible. Please remove sunglasses or any obstruction and try again." };

    const nose2 = landmarks.getNose(), jaw2 = landmarks.getJawOutline();
    if (nose2?.length && jaw2?.length) {
      const jawW = jaw2[jaw2.length - 1].x - jaw2[0].x;
      if (jawW > 0 && Math.abs(nose2[nose2.length - 1].x - (jaw2[0].x + jawW / 2)) / jawW > 0.28)
        return { isValid: false, reason: "Please face the camera directly. Your face appears to be turned to the side." };
    }

    return { isValid: true, reason: "Face verified successfully" };
  } catch {
    return { isValid: true, reason: "Face check skipped due to an error" };
  }
};

// ─── Live check pills ─────────────────────────────────────────────────────────
// const CHECK_PILLS: { key: string; label: string; icon: React.ReactNode; pass: (c: LiveChecks) => boolean | null }[] = [
//   { key: "face",     label: "Face",        icon: <User size={10} />,       pass: (c) => c.faceFound ? true : false },
//   { key: "eyes",     label: "Eyes Open",   icon: <Eye size={10} />,        pass: (c) => c.faceFound ? c.eyesOpen : null },
//   { key: "light",    label: "Lighting",    icon: <Sun size={10} />,        pass: (c) => c.lightingOk },
//   { key: "center",   label: "Centered",    icon: <Crosshair size={10} />,  pass: (c) => c.faceFound ? c.centered : null },
//   { key: "distance", label: "Distance",    icon: <ZoomIn size={10} />,     pass: (c) => c.faceFound ? c.faceSize === "ok" : null },
//   { key: "frontal",  label: "Looking Fwd", icon: <Smile size={10} />,      pass: (c) => c.faceFound ? c.frontal : null },
// ];

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "document" | "selfie";
type DocType = "aadhaar" | "passport";
// "number" tab replaced with "camera" — physical card shown to webcam
type AadhaarMode = "upload" | "camera";
type UploadStatus = "idle" | "uploading" | "verified" | "error";
type CameraStatus = "idle" | "active" | "validating" | "processing" | "completed";

// States for the card-camera flow
type CardCamStatus =
  | "idle"      // not started yet
  | "active"    // camera running, live preview
  | "scanning"  // Tesseract OCR running on frozen frame
  | "verified"  // OCR passed
  | "error";    // OCR failed — show retake

// ─── Component ────────────────────────────────────────────────────────────────
const IdentityVerification: React.FC = () => {
  const navigate = useNavigate();
  const interviewId = sessionStorage.getItem("interviewId");

  const [currentStep, setCurrentStep] = useState<Step>("document");
  const [docType, setDocType] = useState<DocType>("aadhaar");
  const [aadhaarMode, setAadhaarMode] = useState<AadhaarMode>("upload");

  // ── document upload state ────────────────────────────────────────────────────
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; file: File } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── selfie camera state ──────────────────────────────────────────────────────
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [ setCapturedImage] = useState<string | null>(null);
  const [ setScanLinePos] = useState(0);
  const [liveChecks, setLiveChecks] = useState<LiveChecks>(DEFAULT_CHECKS);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [setFaceValidationError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
console.log(modelsReady)
  // ── card-camera state (new) ──────────────────────────────────────────────────
  const [cardCamStatus, setCardCamStatus] = useState<CardCamStatus>("idle");
  const [cardCamError, setCardCamError] = useState<string | null>(null);
  const [cardScanProgress, setCardScanProgress] = useState(0);
  const [cardScanLinePos, setCardScanLinePos] = useState(0);
  const [cardFrozenFrame, setCardFrozenFrame] = useState<string | null>(null);

  // ── refs: selfie ─────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scanRef = useRef({ pos: 0, dir: 1 });
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownValRef = useRef(3);
  const isCaptureScheduled = useRef(false);
  const readyToCaptureRef = useRef(false);

  // ── refs: card camera (new) ──────────────────────────────────────────────────
  const cardVideoRef = useRef<HTMLVideoElement>(null);
  const cardCanvasRef = useRef<HTMLCanvasElement>(null);
  const cardStreamRef = useRef<MediaStream | null>(null);
  const cardScanRafRef = useRef<number | null>(null);
  const cardScanDirRef = useRef(1);
  const cardScanPosRef = useRef(0);

  useEffect(() => {
    loadFaceModels().then(() => setModelsReady(true)).catch(console.error);
  }, []);

  const getInterviewId = () => sessionStorage.getItem("interviewId") ?? null;

  const formatFileSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(2)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  // document is verified if either upload passed OR card-cam OCR passed
  const isDocumentVerified = uploadStatus === "verified" || cardCamStatus === "verified";

  const resetDocState = () => {
    setUploadStatus("idle");
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    stopCardCamera();
    setCardCamStatus("idle");
    setCardCamError(null);
    setCardScanProgress(0);
    setCardFrozenFrame(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── CARD CAMERA HELPERS ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const stopCardCamera = useCallback(() => {
    if (cardStreamRef.current) {
      cardStreamRef.current.getTracks().forEach((t) => t.stop());
      cardStreamRef.current = null;
    }
    if (cardScanRafRef.current) {
      cancelAnimationFrame(cardScanRafRef.current);
      cardScanRafRef.current = null;
    }
  }, []);

  const runCardScanLine = useCallback(() => {
    const tick = () => {
      cardScanPosRef.current += cardScanDirRef.current * 1.3;
      if (cardScanPosRef.current >= 100) cardScanDirRef.current = -1;
      if (cardScanPosRef.current <= 0)   cardScanDirRef.current = 1;
      setCardScanLinePos(cardScanPosRef.current);
      cardScanRafRef.current = requestAnimationFrame(tick);
    };
    cardScanRafRef.current = requestAnimationFrame(tick);
  }, []);

  const startCardCamera = useCallback(async () => {
    setCardCamError(null);
    setCardFrozenFrame(null);
    setCardCamStatus("idle");
    setCardScanProgress(0);
    cardScanPosRef.current = 0;
    cardScanDirRef.current = 1;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }, // rear cam on mobile is better for cards
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      cardStreamRef.current = stream;
      if (cardVideoRef.current) {
        cardVideoRef.current.srcObject = stream;
        await cardVideoRef.current.play();
      }
      setCardCamStatus("active");
      runCardScanLine();
    } catch {
      toast.error("Camera access denied. Please allow camera permission and try again.");
    }
  }, [runCardScanLine]);

  /**
   * Freeze current frame, stop stream, run Tesseract OCR on captured image.
   * If OCR passes → upload to backend + mark verified.
   * If OCR fails → show error + allow retake.
   */
  const captureAndVerifyCard = useCallback(async () => {
    const video = cardVideoRef.current;
    const canvas = cardCanvasRef.current;
    if (!video || !canvas) return;

    // stop scan line animation
    if (cardScanRafRef.current) {
      cancelAnimationFrame(cardScanRafRef.current);
      cardScanRafRef.current = null;
    }

    // draw frozen frame
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    // stop live stream — user sees frozen frame via <img>
    stopCardCamera();
    setCardFrozenFrame(dataUrl);
    setCardCamStatus("scanning");
    setCardCamError(null);
    setCardScanProgress(0);

    try {
      const result = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m: any) => {
          if (m.status === "recognizing text" && m.progress != null)
            setCardScanProgress(Math.round(m.progress * 100));
        },
      });

      const upper = result.data.text.toUpperCase();
      const hasAadhaarKeyword = /AADHAAR|AADHAR|UIDAI/.test(upper) || /\bUID\b/.test(upper);
      const has12Digit =
        /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/.test(upper) ||
        /[X\d]{4}[\s\-]?[X\d]{4}[\s\-]?[X\d]{4}/i.test(upper);
      const hasGovt = /GOVERNMENT\s+OF\s+INDIA|GOVT\.?\s+OF\s+INDIA/.test(upper);
      const passed = [hasAadhaarKeyword, has12Digit, hasGovt].filter(Boolean).length;

      if (passed >= 2) {
        setCardCamStatus("verified");
        toast.success("Aadhaar card detected and verified!");
        // upload captured image to backend
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "aadhaar_card_cam.jpg", { type: "image/jpeg" });
          const userId = getInterviewId();
          if (userId) await userService.adharVerification(userId, file);
        } catch {
          console.warn("Backend upload failed for card image — OCR already passed");
        }
      } else {
        const missing: string[] = [];
        if (!hasAadhaarKeyword) missing.push("Aadhaar/UIDAI text");
        if (!has12Digit)         missing.push("12-digit number");
        if (!hasGovt)            missing.push('"Govt of India" text');
        setCardCamError(
          `Could not verify as Aadhaar card. Missing: ${missing.join(", ")}. ` +
          `Make sure the full card is visible, text is sharp, and lighting is good.`
        );
        setCardCamStatus("error");
        setCardScanProgress(0);
      }
    } catch {
      setCardCamError("OCR scan failed. Please retake with better lighting.");
      setCardCamStatus("error");
      setCardScanProgress(0);
    }
  }, [stopCardCamera]);

  /** Reset card-camera so user can try again */
  const retakeCard = useCallback(() => {
    stopCardCamera();
    setCardCamStatus("idle");
    setCardCamError(null);
    setCardScanProgress(0);
    setCardFrozenFrame(null);
    cardScanPosRef.current = 0;
    cardScanDirRef.current = 1;
  }, [stopCardCamera]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── DOCUMENT UPLOAD HELPERS ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFile = async (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) { toast.error("Invalid file type. Please upload JPG, PNG, or PDF"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File size must be less than 5MB"); return; }

    setUploadStatus("uploading");
    setUploadedFile({ name: file.name, size: formatFileSize(file.size), file });

    const ocrResult = docType === "aadhaar"
      ? await validateAadhaarWithOCR(file)
      : await validatePassportWithOCR(file);

    if (!ocrResult.isValid) { setUploadStatus("error"); toast.error(ocrResult.reason); return; }

    try {
      const userId = getInterviewId();
      if (!userId) { toast.error("User not authenticated"); setUploadStatus("error"); return; }
      const response = await userService.adharVerification(userId, file);
      if (response.status === 200 || response.data?.success) {
        setUploadStatus("verified");
        toast.success(docType === "aadhaar" ? "Aadhaar verified successfully!" : "Passport verified successfully!");
      } else {
        setUploadStatus("error"); toast.error("Verification failed. Please try again.");
      }
    } catch (error: any) {
      setUploadStatus("error");
      toast.error(error.response?.data?.message ?? "Verification failed. Please try again.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [docType]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFile(file);
  };

  const handleUploadDifferent = () => {
    setUploadStatus("idle"); setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SELFIE CAMERA HELPERS (unchanged) ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const stopScan = () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };

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

  const stopStream = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  const stopLiveAnalysis = () => {
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }
  };

  const stopCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdown(null); countdownValRef.current = 3;
  };

  const scheduleCapture = useCallback(() => {
    if (isCaptureScheduled.current) return;
    isCaptureScheduled.current = true;
    countdownValRef.current = 3;
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      countdownValRef.current -= 1;
      if (countdownValRef.current <= 0) { stopCountdown(); doCapture(); }
      else setCountdown(countdownValRef.current);
    }, 1000);
  }, []);

  const doCapture = useCallback(async () => {
    stopLiveAnalysis();
    const liveCanvas = liveCanvasRef.current, video = videoRef.current;
    if (!liveCanvas || !video) { setCameraStatus("idle"); return; }
    liveCanvas.width = video.videoWidth || 480;
    liveCanvas.height = video.videoHeight || 360;
    const ctx = liveCanvas.getContext("2d");
    if (!ctx) { setCameraStatus("idle"); return; }
    ctx.drawImage(video, 0, 0);
    const img = liveCanvas.toDataURL("image/jpeg", 0.90);

    stopStream();
    setCapturedImage(img);
    setCameraStatus("validating");
    setFaceValidationError(null);

    const result = await validateCapturedImage(img);
    if (!result.isValid) {
      setFaceValidationError(result.reason);
      setCapturedImage(null);
      setCameraStatus("idle");
      setLiveChecks(DEFAULT_CHECKS);
      isCaptureScheduled.current = false;
      readyToCaptureRef.current = false;
      return;
    }

    (async () => {
      try {
        const blob = await (await fetch(img)).blob();
        const file = new File([blob], "selfie.jpg", { type: blob.type || "image/jpeg" });
        const userId = getInterviewId();
        if (userId) await userService.selfieVerification(userId, file);
      } catch (error) {
        console.error("Photo upload error:", error);
        toast.error("Photo upload failed. Please try again.");
      }
    })();

    setCameraStatus("processing");
    scanRef.current = { pos: 0, dir: 1 };
    startScanAnimation();
    setTimeout(() => { stopScan(); setCameraStatus("completed"); toast.success("Photo captured successfully!"); }, 3000);
  }, []);

  const startLiveAnalysis = useCallback(() => {
    liveIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !liveCanvasRef.current) return;
      const checks = await analyzeFrame(videoRef.current, liveCanvasRef.current);
      setLiveChecks(checks);
      if (checks.allPassed && !readyToCaptureRef.current) {
        readyToCaptureRef.current = true;
        scheduleCapture();
      } else if (!checks.allPassed && readyToCaptureRef.current) {
        readyToCaptureRef.current = false;
        isCaptureScheduled.current = false;
        stopCountdown();
      }
    }, 350);
  }, [scheduleCapture]);

  // const startCamera = useCallback(async () => {
  //   setFaceValidationError(null);
  //   setLiveChecks(DEFAULT_CHECKS);
  //   isCaptureScheduled.current = false;
  //   readyToCaptureRef.current = false;
  //   try {
  //     const stream = await navigator.mediaDevices.getUserMedia({
  //       video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
  //     });
  //     streamRef.current = stream;
  //     if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
  //     setCameraStatus("active");
  //     startLiveAnalysis();
  //   } catch {
  //     toast.error("Failed to access camera. Please allow camera permission and try again.");
  //     setCameraStatus("idle");
  //   }
  // }, [startLiveAnalysis]);

  // const handleRetake = () => {
  //   stopStream(); stopLiveAnalysis(); stopCountdown(); stopScan();
  //   setCapturedImage(null); setCameraStatus("idle"); setScanLinePos(0);
  //   setLiveChecks(DEFAULT_CHECKS); setFaceValidationError(null);
  //   isCaptureScheduled.current = false; readyToCaptureRef.current = false;
  // };

  const handleBack = () => navigate(-1);
//  const handleComplete = () => navigate(userPath("instructions", interviewId), { replace: true });

  useEffect(() => {
    return () => { stopStream(); stopLiveAnalysis(); stopCountdown(); stopScan(); stopCardCamera(); };
  }, []);

  // ─── Derived UI values ────────────────────────────────────────────────────────
  const passedCount = liveChecks.faceFound
    ? [liveChecks.eyesOpen, liveChecks.centered, liveChecks.faceSize === "ok", liveChecks.lightingOk, liveChecks.frontal].filter(Boolean).length
    : 0;
  // const ovalStroke = liveChecks.allPassed ? "#22c55e" : passedCount >= 3 ? "#f59e0b" : liveChecks.faceFound ? "#f59e0b" : "#ef4444";

  const getPrimaryMessage = (): { text: string; color: string } => {
    if (!liveChecks.faceFound) return { text: "Position your face inside the oval guide", color: "text-white" };
    if (liveChecks.multipleFaces) return { text: "Only one person allowed in the frame", color: "text-red-400" };
    if (!liveChecks.lightingOk) return { text: "Improve lighting — find a brighter spot", color: "text-amber-400" };
    if (liveChecks.faceSize === "too-far") return { text: "Move closer to the camera", color: "text-amber-400" };
    if (liveChecks.faceSize === "too-close") return { text: "Move a little further away", color: "text-amber-400" };
    if (!liveChecks.centered) return { text: "Center your face in the oval", color: "text-amber-400" };
    if (!liveChecks.frontal) return { text: "Look directly at the camera", color: "text-amber-400" };
    if (!liveChecks.eyesOpen) return { text: "Please open your eyes and look at the camera", color: "text-red-400" };
    if (liveChecks.allPassed && countdown !== null) return { text: `Hold still — capturing in ${countdown}…`, color: "text-green-400" };
    if (liveChecks.allPassed) return { text: "Great! Hold still…", color: "text-green-400" };
    return { text: "Adjusting…", color: "text-white" };
  };
  // const guidance = getPrimaryMessage();

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050A24] bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]">

      <motion.div
        className="absolute -top-20 -right-20 w-[200px] h-[200px] bg-[#2D55FB] rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{ x: [0,30,-20,0], y: [0,-50,20,0], scale: [1,1.1,0.9,1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-20 -left-20 w-[200px] h-[200px] bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{ x: [0,-40,30,0], y: [0,40,-30,0], scale: [1,0.9,1.1,1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Hidden canvases */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={liveCanvasRef} className="hidden" />
      <canvas ref={cardCanvasRef} className="hidden" />

      <div className="relative z-10 min-h-screen">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 bg-[#0a1342]/30 backdrop-blur-sm">
          <button onClick={handleBack} className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm sm:text-base">Identity Verification</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center justify-center gap-4 pt-6 pb-2 px-4">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {isDocumentVerified ? (
                <motion.div key="d1" className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                  <CheckCircle className="h-5 w-5 text-white" />
                </motion.div>
              ) : (
                <motion.div key="p1" className="w-9 h-9 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-sm font-bold">1</motion.div>
              )}
            </AnimatePresence>
            <div>
              <p className={`text-xs sm:text-sm font-semibold ${isDocumentVerified ? "text-green-400" : "text-[#2D55FB]"}`}>Document Upload</p>
              <p className="text-gray-500 text-xs">{isDocumentVerified ? "Completed" : "Identity verification"}</p>
            </div>
          </div>

          <div className="w-12 sm:w-20 h-px bg-gray-700 relative overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-[#2D55FB]"
              initial={{ width: "0%" }}
              animate={{ width: isDocumentVerified ? "100%" : "0%" }}
              transition={{ duration: 0.8 }}
            />
          </div>

          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {cameraStatus === "completed" ? (
                <motion.div key="d2" className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                  <CheckCircle className="h-5 w-5 text-white" />
                </motion.div>
              ) : (
                <motion.div key="p2" className="w-9 h-9 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-sm font-bold">2</motion.div>
              )}
            </AnimatePresence>
            <div>
              <p className={`text-xs sm:text-sm font-semibold ${cameraStatus === "completed" ? "text-green-400" : "text-[#2D55FB]"}`}>Photo Capture</p>
              <p className="text-gray-500 text-xs">{cameraStatus === "completed" ? "Completed" : "Identity verification"}</p>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex items-start justify-center px-4 sm:px-6 md:px-8 py-6">
          <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

            {/* ══════════════════════ DOCUMENT STEP ══════════════════════ */}
            {currentStep === "document" && (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">Document Verification</h1>
                  <p className="text-gray-400 text-sm sm:text-base">Please upload your document for secure identity verification</p>
                </div>

                <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/10 shadow-2xl mb-4">
                  <h2 className="text-white font-semibold text-sm sm:text-base mb-3">Select Document Type</h2>

                  {/* Doc type selector */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {([
                      { type: "aadhaar" as DocType, icon: CreditCard, label: "Aadhaar Card", desc: "12-digit national identity" },
                      { type: "passport" as DocType, icon: BookOpen, label: "Passport", desc: "Travel document / bio-data page" },
                    ] as const).map(({ type, icon: Icon, label, desc }) => (
                      <button
                        key={type}
                        onClick={() => { setDocType(type); resetDocState(); }}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                          docType === type ? "border-[#2D55FB] bg-[#2D55FB]/15" : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${docType === type ? "bg-[#2D55FB]/25 text-[#2D55FB]" : "bg-white/5 text-gray-400"}`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold">{label}</p>
                          <p className="text-gray-500 text-xs">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* ── Aadhaar mode tabs: Upload | Show to Camera ── */}
                  {docType === "aadhaar" && (
                    <div className="flex gap-1 mb-4 bg-[#0a0f1e] rounded-lg p-1 w-fit">
                      {([
                        { mode: "upload" as AadhaarMode, icon: Upload, label: "Upload File" },
                        { mode: "camera" as AadhaarMode, icon: Camera, label: "Show to Camera" },
                      ] as const).map(({ mode, icon: Icon, label }) => (
                        <button
                          key={mode}
                          onClick={() => { setAadhaarMode(mode); resetDocState(); }}
                          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                            aadhaarMode === mode ? "bg-[#2D55FB] text-white" : "text-gray-400 hover:text-gray-300"
                          }`}
                        >
                          <Icon size={12} />{label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ════════════════════════════════════════════════════════
                      MODE: File Upload  (aadhaar upload OR passport)
                  ════════════════════════════════════════════════════════ */}
                  {(docType === "passport" || (docType === "aadhaar" && aadhaarMode === "upload")) && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="text-gray-500 text-xs mb-3">
                        {docType === "aadhaar"
                          ? "Upload a clear photo of your Aadhaar card"
                          : "Upload the bio-data page of your passport"}
                        {" "}· JPG, PNG, PDF · Max 5MB
                      </p>
                      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileInput} />

                      <AnimatePresence mode="wait">
                        {(uploadStatus === "idle" || uploadStatus === "uploading") && (
                          <motion.div
                            key="dz"
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                              isDragOver ? "border-[#2D55FB] bg-[#2D55FB]/10" : "border-gray-600 hover:border-gray-500"
                            } ${uploadStatus === "uploading" ? "pointer-events-none" : ""}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          >
                            {uploadStatus === "uploading" ? (
                              <div className="flex flex-col items-center gap-3">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                  <RefreshCw className="h-8 w-8 text-[#2D55FB]" />
                                </motion.div>
                                <p className="text-gray-400 text-sm">Verifying document...</p>
                                <p className="text-gray-600 text-xs">{uploadedFile?.name}</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3">
                                <Upload className="h-10 w-10 text-gray-500" />
                                <div>
                                  <p className="text-gray-300 text-sm font-medium">
                                    Drag and drop your {docType === "aadhaar" ? "Aadhaar card" : "passport"} here
                                  </p>
                                  <p className="text-gray-500 text-xs mt-1">or click to select from your device</p>
                                </div>
                                <button className="px-4 py-2 bg-[#2D55FB]/20 border border-[#2D55FB]/40 text-[#2D55FB] text-xs rounded-lg hover:bg-[#2D55FB]/30 transition-colors">
                                  Choose File
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {uploadStatus === "verified" && (
                          <motion.div key="ok" className="border border-green-500/30 bg-green-500/10 rounded-xl p-6 text-center"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                            <p className="text-green-400 font-semibold text-sm mb-1">Document verified successfully!</p>
                            <p className="text-gray-500 text-xs mb-1">{uploadedFile?.name}</p>
                            <p className="text-gray-600 text-xs mb-4">{uploadedFile?.size} • Uploaded and verified</p>
                            <button onClick={handleUploadDifferent} className="text-xs text-gray-400 hover:text-gray-300 underline transition-colors">
                              Upload Different Document
                            </button>
                          </motion.div>
                        )}

                        {uploadStatus === "error" && (
                          <motion.div key="err" className="border border-red-500/30 bg-red-500/10 rounded-xl p-6 text-center"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                            <p className="text-red-400 font-semibold text-sm mb-1">Verification failed</p>
                            <p className="text-gray-500 text-xs mb-4">Please try uploading again</p>
                            <button onClick={handleUploadDifferent} className="px-4 py-2 bg-[#2D55FB]/20 border border-[#2D55FB]/40 text-[#2D55FB] text-xs rounded-lg hover:bg-[#2D55FB]/30 transition-colors">
                              Try Again
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ════════════════════════════════════════════════════════
                      MODE: Show Aadhaar Card to Camera  (REPLACES "Enter Number")
                      Flow:
                        idle     → user clicks "Open Camera"
                        active   → live preview + animated scan line overlay + card guide corners
                                   user aligns card, clicks "Capture & Verify"
                        scanning → frozen frame shown, Tesseract runs, progress bar
                        verified → green overlay, "Proceed" unlocked
                        error    → red overlay with reason, "Try Again" retake button
                  ════════════════════════════════════════════════════════ */}
                  {docType === "aadhaar" && aadhaarMode === "camera" && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="text-gray-500 text-xs mb-3">
                        Hold your physical Aadhaar card up to the camera so all four corners and text are fully visible, then tap <strong className="text-white">Capture &amp; Verify</strong>.
                      </p>

                      {/* Camera viewport */}
                      <div
                        className="relative bg-[#070d24] rounded-xl overflow-hidden border border-white/8"
                        style={{ minHeight: 220 }}
                      >
                        {/* Live video */}
                        <video
                          ref={cardVideoRef}
                          muted
                          playsInline
                          className={`w-full rounded-xl object-cover ${cardCamStatus === "active" ? "block" : "hidden"}`}
                          style={{ maxHeight: 270, minHeight: 220 }}
                        />

                        {/* Frozen frame (shown during scanning, error, verified) */}
                        {cardFrozenFrame && cardCamStatus !== "active" && (
                          <img
                            src={cardFrozenFrame}
                            alt="Captured card"
                            className="w-full rounded-xl object-cover"
                            style={{ maxHeight: 270, minHeight: 220, display: "block" }}
                          />
                        )}

                        {/* ── IDLE: placeholder with card outline + Open Camera button ── */}
                        {cardCamStatus === "idle" && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                            {/* Card shape guide */}
                            <div className="relative w-52 h-32 flex items-center justify-center">
                              {/* dashed border */}
                              <div className="absolute inset-0 rounded-lg border-2 border-dashed border-[#2D55FB]/40" />
                              {/* corner brackets */}
                              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#2D55FB] rounded-tl" />
                              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#2D55FB] rounded-tr" />
                              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#2D55FB] rounded-bl" />
                              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#2D55FB] rounded-br" />
                              <CreditCard className="h-10 w-10 text-gray-600" />
                            </div>
                            <motion.button
                              onClick={startCardCamera}
                              className="flex items-center gap-2 px-5 py-2.5 bg-[#2D55FB] text-white text-sm font-medium rounded-xl shadow-lg shadow-[#2D55FB]/25 hover:bg-[#1e3fd4] transition-colors"
                              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            >
                              <Camera className="h-4 w-4" />
                              Open Camera
                            </motion.button>
                          </div>
                        )}

                        {/* ── ACTIVE: card guide overlay + animated scan line ── */}
                        {cardCamStatus === "active" && (
                          <>
                            {/* Dim vignette outside card zone */}
                            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                  <mask id="cardMask">
                                    <rect width="100" height="100" fill="white"/>
                                    <rect x="7" y="19" width="86" height="62" rx="2" fill="black"/>
                                  </mask>
                                </defs>
                                <rect width="100" height="100" fill="rgba(0,0,0,0.42)" mask="url(#cardMask)"/>
                              </svg>
                              {/* card border + corner ticks */}
                              <svg
                                className="absolute"
                                style={{ left: "7%", top: "19%", width: "86%", height: "62%" }}
                                viewBox="0 0 100 73"
                                preserveAspectRatio="none"
                              >
                                <rect x="1" y="1" width="98" height="71" rx="2" fill="none" stroke="#2D55FB" strokeWidth="1.2" strokeDasharray="5 3"/>
                                {/* corner accents */}
                                <path d="M1,13 L1,1 L13,1"  fill="none" stroke="#2D55FB" strokeWidth="3" strokeLinecap="round"/>
                                <path d="M87,1 L99,1 L99,13" fill="none" stroke="#2D55FB" strokeWidth="3" strokeLinecap="round"/>
                                <path d="M1,60 L1,72 L13,72"  fill="none" stroke="#2D55FB" strokeWidth="3" strokeLinecap="round"/>
                                <path d="M87,72 L99,72 L99,60" fill="none" stroke="#2D55FB" strokeWidth="3" strokeLinecap="round"/>
                              </svg>
                            </div>

                            {/* Scan line moving within card zone */}
                            <div
                              className="absolute z-20 pointer-events-none"
                              style={{
                                left: "8%",
                                right: "8%",
                                top: `calc(19% + ${cardScanLinePos / 100 * 62}%)`,
                                height: "1.5px",
                                background: "linear-gradient(to right, transparent, #2D55FB 25%, #93c5fd 50%, #2D55FB 75%, transparent)",
                                boxShadow: "0 0 10px 3px rgba(45,85,251,0.55)",
                              }}
                            />

                            {/* Bottom label */}
                            <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/55 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2">
                              <motion.div
                                className="w-2 h-2 rounded-full bg-[#2D55FB] shrink-0"
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              />
                              <span className="text-white/80 text-xs font-medium">Align all four corners inside the guide, then capture</span>
                            </div>
                          </>
                        )}

                        {/* ── SCANNING: progress overlay on frozen frame ── */}
                        {cardCamStatus === "scanning" && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm rounded-xl gap-4">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                            >
                              <ScanLine className="h-9 w-9 text-[#2D55FB]" />
                            </motion.div>
                            <p className="text-white text-sm font-semibold">Reading Aadhaar card text…</p>
                            {/* progress bar */}
                            <div className="w-44 h-2 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-[#2D55FB] to-blue-400"
                                style={{ width: `${cardScanProgress}%` }}
                                transition={{ duration: 0.08 }}
                              />
                            </div>
                            <p className="text-gray-400 text-xs">{cardScanProgress}% complete</p>
                          </div>
                        )}

                        {/* ── VERIFIED: green success overlay ── */}
                        {cardCamStatus === "verified" && (
                          <motion.div
                            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-green-950/80 backdrop-blur-sm rounded-xl gap-3"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          >
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                            >
                              <CheckCircle className="h-14 w-14 text-green-400" />
                            </motion.div>
                            <p className="text-green-300 font-bold text-base">Aadhaar Verified!</p>
                            <p className="text-green-500/70 text-xs">Card text confirmed via OCR</p>
                            <button
                              onClick={retakeCard}
                              className="text-xs text-gray-400 hover:text-white underline transition-colors mt-1"
                            >
                              Re-capture
                            </button>
                          </motion.div>
                        )}

                        {/* ── ERROR: red failure overlay ── */}
                        {cardCamStatus === "error" && (
                          <motion.div
                            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-sm rounded-xl gap-3 px-5"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          >
                            <XCircle className="h-12 w-12 text-red-400" />
                            <p className="text-red-300 font-bold text-sm text-center">Verification Failed</p>
                            {cardCamError && (
                              <p className="text-red-400/80 text-xs text-center leading-relaxed">{cardCamError}</p>
                            )}
                            <motion.button
                              onClick={retakeCard}
                              className="flex items-center gap-2 px-5 py-2 bg-[#2D55FB] text-white text-xs font-semibold rounded-lg hover:bg-[#1e3fd4] transition-colors mt-1 shadow-lg"
                              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Try Again
                            </motion.button>
                          </motion.div>
                        )}
                      </div>

                      {/* Capture button — only when camera is live */}
                      <AnimatePresence>
                        {cardCamStatus === "active" && (
                          <motion.div
                            className="flex justify-center mt-4"
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          >
                            <motion.button
                              onClick={captureAndVerifyCard}
                              className="flex items-center gap-2 px-7 py-2.5 bg-[#2D55FB] text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#2D55FB]/30 hover:bg-[#1e3fd4] transition-colors"
                              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                            >
                              <ScanLine className="h-4 w-4" />
                              Capture &amp; Verify
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Tips row */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {[
                          "Hold card flat and steady",
                          "All 4 corners visible",
                          "No shadows on text",
                          "Text must be readable",
                        ].map((tip) => (
                          <span key={tip} className="text-[10px] text-gray-500 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                            {tip}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Guidelines card */}
                <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-4 w-4 text-[#2D55FB]" />
                    <h3 className="text-[#2D55FB] font-semibold text-sm">Document Guidelines</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[#2D55FB]/80 text-xs font-medium mb-2">Required Quality</p>
                      {["Clear and well-lit photograph", "All four corners visible", "Text and numbers readable"].map((item) => (
                        <div key={item} className="flex items-start gap-2 mb-1.5">
                          <CheckCircle className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
                          <p className="text-gray-500 text-xs">{item}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-amber-400/80 text-xs font-medium mb-2">Avoid Common Issues</p>
                      {["Blurry or tilted images", "Shadows covering text", "Partial or cropped document"].map((item) => (
                        <div key={item} className="flex items-start gap-2 mb-1.5">
                          <AlertTriangle className="h-3 w-3 text-amber-500/60 mt-0.5 shrink-0" />
                          <p className="text-gray-500 text-xs">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <motion.button
                    onClick={() => isDocumentVerified && setCurrentStep("selfie")}
                    disabled={!isDocumentVerified}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      isDocumentVerified ? "bg-[#2D55FB] text-white hover:bg-[#1e3fd4]" : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    }`}
                    whileHover={isDocumentVerified ? { scale: 1.02 } : {}}
                    whileTap={isDocumentVerified ? { scale: 0.98 } : {}}
                  >
                    Next: Photo Verification →
                  </motion.button>
                </div>
              </>
            )}

            {/* ══════════════════════ SELFIE STEP ══════════════════════ */}
            {currentStep === "selfie" && (
              <SelfieVerification/>
            )}

          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default IdentityVerification;