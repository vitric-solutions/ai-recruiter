// import React, { useEffect, useState } from "react";
// import { ArrowLeft, User, Briefcase, LayoutGrid, Monitor, BookOpen, AlertTriangle, Clock, FileText, Video } from "lucide-react";
// import { motion } from "framer-motion";
// import { useNavigate, useParams } from "react-router-dom";
// import { adminService } from "../../services/service/adminService";
// import { userService } from "../../services/service/userService";
// import { useAuth } from "../../context/context";

// const fadeUp = (delay = 0) => ({
//   initial: { opacity: 0, y: 18 },
//   animate: { opacity: 1, y: 0 },
//   transition: { duration: 0.5, delay },
// });

// // ── Content config by exam type ──────────────────────────────────────────────

// const MCQ_GUIDELINES = {
//   primary: {
//     label: "During MCQ Assessment :",
//     items: [
//       "Read each question carefully before answering",
//       "You cannot go back to previous questions",
//       "Timer will be visible at all times",
//       "Assessment auto-submits when time expires",
//     ],
//   },
//   secondary: {
//     label: "MCQ Tips & Best Practices :",
//     items: [
//       "Eliminate obviously wrong options first",
//       "Don't spend too long on a single question",
//       "Ensure stable internet before you begin",
//       "Stay focused — no tabs or phone during the test",
//     ],
//   },
// };

// const AI_GUIDELINES = {
//   primary: {
//     label: "During Video Interview :",
//     items: [
//       "Maintain eye contact with the camera",
//       "Speak clearly and at a natural pace",
//       "Take your time to think before answering",
//       "Be authentic and professional",
//     ],
//   },
//   secondary: {
//     label: "Video Interview Tips :",
//     items: [
//       "Sit in a quiet, well-lit environment",
//       "Ensure your camera and microphone are working",
//       "Look into the camera, not the screen",
//       "Have your resume nearby for quick reference",
//     ],
//   },
// };

// const MCQ_NOTICE = [
//   "Once you begin, you must complete the assessment in one session",
//   "Refreshing or closing the browser will end your assessment",
//   "Make sure you have enough uninterrupted time before starting",
//   "Each question has a fixed time — manage your pace wisely",
// ];

// const AI_NOTICE = [
//   "Once you begin, you must complete the entire interview in one session",
//   "Refreshing the page or closing the browser will end your assessment",
//   "Make sure you have enough time to complete the interview",
//   "Have your resume and portfolio links ready for reference",
// ];

// const MCQ_STRUCTURE = [
//   { step: 1, title: "MCQ Assessment", sub: "Technical & aptitude questions" },
//   { step: 2, title: "Auto Submission", sub: "Results evaluated instantly" },
// ];

// const AI_STRUCTURE = [
//   { step: 1, title: "AI Video Interview", sub: "Behavioral & technical questions" },
//   { step: 2, title: "Response Analysis", sub: "AI evaluates your answers" },
// ];

// // ── Component ────────────────────────────────────────────────────────────────

// const InterviewInstructions: React.FC = () => {
//   const navigate = useNavigate();
//   const { id } = useParams();
//   const [interview, setInterview] = useState<any>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const { setInterviewInfo,setUserData } = useAuth();

//   const isMCQ = interview?.examType === "MCQ";
//   const guidelines = isMCQ ? MCQ_GUIDELINES : AI_GUIDELINES;
//   const notice = isMCQ ? MCQ_NOTICE : AI_NOTICE;
//   const structure = isMCQ ? MCQ_STRUCTURE : AI_STRUCTURE;

//   useEffect(() => {
//     const fetchInterviewInstruction = async (id: string) => {
//       try {
//         const response = await userService.getInterviewInstruction(id!);
//         setInterview(response?.interview);
//         setInterviewInfo(response?.interview);
//         setUserData(response?.user);
//       } catch (error) {
//         console.error(error);
//       }
//     };
//     fetchInterviewInstruction(id!);
//   }, []);

//   const handleStartAssessment = async () => {
//     if (isMCQ) {
//       try {
//         // Show a neutral loading state — candidate doesn't know what's happening behind the scenes
//         setIsLoading(true);

//         // Fire generation silently in the background
//         await userService.generateMCQ(
//           {
//             jobDescription: interview?.jobDescription,
//             topic: interview?.test_title ?? interview?.position,
//             difficulty: interview?.difficulty,
//             examType: "MCQ",
//             count: parseInt(interview?.no_of_questions),
//           },
//           id!
//         );

//         navigate(`/user/${id}/mcq-assessment`, {
//           state: { title: interview?.title, time: interview?.duration },
//         });
//       } catch (error) {
//         console.error("Failed to generate MCQ questions:", error);
//       } finally {
//         setIsLoading(false);
//       }
//     } else {
//       navigate(`/user/${id}/video-interview`, {
//         state: { title: interview?.title, time: interview?.duration },
//       });
//     }
//   };

//   return (
//     <div className="min-h-screen relative overflow-hidden bg-[#050A24] bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]">
//       {/* Orbs */}
//       <motion.div
//         className="absolute -top-20 -right-20 w-[200px] h-[200px] bg-[#2D55FB] rounded-full mix-blend-multiply filter blur-3xl opacity-30"
//         animate={{ x: [0, 30, -20, 0], y: [0, -50, 20, 0], scale: [1, 1.1, 0.9, 1] }}
//         transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
//       />
//       <motion.div
//         className="absolute -bottom-20 -left-20 w-[200px] h-[200px] bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
//         animate={{ x: [0, -40, 30, 0], y: [0, 40, -30, 0], scale: [1, 0.9, 1.1, 1] }}
//         transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
//       />

//       <div className="relative z-10 min-h-screen">
//         {/* Header */}
//         <div className="flex items-center justify-between p-4 sm:p-4 bg-[#0a1342]/30 backdrop-blur-sm">
//           <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
//             <ArrowLeft className="h-5 w-5" />
//             <span className="text-sm">Interview Instructions</span>
//           </button>
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
//               <User className="h-5 w-5 text-white" />
//             </div>
//           </div>
//         </div>

//         {/* Content */}
//         <div className="flex justify-center px-4 sm:px-6 py-6 pb-12">
//           <div className="w-full max-w-2xl space-y-4">

//             {/* Title */}
//             <motion.div className="text-center mb-6" {...fadeUp(0)}>
//               <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">Interview Process Overview</h1>
//               <p className="text-gray-400 text-sm">Please read these instructions carefully before proceeding</p>
//             </motion.div>

//             {/* Job Card */}
//             <motion.div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10" {...fadeUp(0.1)}>
//               <div className="flex items-center gap-3 mb-3">
//                 <div className="w-9 h-9 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
//                   <Briefcase className="h-4 w-4 text-[#2D55FB]" />
//                 </div>
//                 <div>
//                   <h2 className="text-white font-semibold text-sm sm:text-base">
//                     {interview?.test_title ?? interview?.position ?? ""}
//                   </h2>
//                   <p className="text-gray-500 text-xs">Vitric Business Solutions</p>
//                 </div>
//               </div>
//               <div className="border-t border-white/5 pt-3">
//                 <div className="flex items-center gap-2 mb-2">
//                   <FileText className="h-3.5 w-3.5 text-[#2D55FB]" />
//                   <span className="text-[#2D55FB] text-xs font-medium">Job Description</span>
//                 </div>
//                 <p className="text-gray-400 text-xs leading-relaxed">
//                   {interview?.jobDescription ?? "No job description provided."}
//                 </p>
//               </div>
//             </motion.div>

//             {/* Assessment Structure + Technical Requirements */}
//             <motion.div className="grid grid-cols-2 gap-4" {...fadeUp(0.15)}>
//               {/* Assessment Structure — dynamic per type */}
//               <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
//                 <div className="flex items-center gap-2 mb-3">
//                   <div className="w-8 h-8 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
//                     {isMCQ ? (
//                       <LayoutGrid className="h-4 w-4 text-[#2D55FB]" />
//                     ) : (
//                       <Video className="h-4 w-4 text-[#2D55FB]" />
//                     )}
//                   </div>
//                   <h3 className="text-white font-semibold text-xs sm:text-sm">Assessment Structure</h3>
//                 </div>
//                 <div className="space-y-2.5">
//                   {structure.map(({ step, title, sub }) => (
//                     <div key={step} className="flex items-start gap-2">
//                       <div className="w-5 h-5 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
//                         {step}
//                       </div>
//                       <div>
//                         <p className="text-white text-xs font-medium">{title}</p>
//                         <p className="text-gray-500 text-xs">{sub}</p>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Technical Requirements */}
//               <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
//                 <div className="flex items-center gap-2 mb-3">
//                   <div className="w-8 h-8 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
//                     <Monitor className="h-4 w-4 text-[#2D55FB]" />
//                   </div>
//                   <h3 className="text-white font-semibold text-xs sm:text-sm">Technical Requirements</h3>
//                 </div>
//                 <div className="space-y-2">
//                   {(isMCQ
//                     ? [
//                         "Stable internet connection",
//                         "Quiet, distraction-free environment",
//                         "Chrome, Firefox, or Safari browser",
//                         "Do not open other tabs or apps",
//                       ]
//                     : [
//                         "Camera and microphone enabled",
//                         "Stable internet connection",
//                         "Quiet, well-lit environment",
//                         "Chrome, Firefox, or Safari browser",
//                       ]
//                   ).map((req) => (
//                     <div key={req} className="flex items-center gap-2">
//                       <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
//                       <p className="text-gray-400 text-xs">{req}</p>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </motion.div>

//             {/* Interview Guidelines — dynamic per type */}
//             <motion.div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10" {...fadeUp(0.2)}>
//               <div className="flex items-center gap-2 mb-4">
//                 <div className="w-8 h-8 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
//                   <BookOpen className="h-4 w-4 text-[#2D55FB]" />
//                 </div>
//                 <h3 className="text-white font-semibold text-sm">
//                   {isMCQ ? "MCQ Assessment Guidelines" : "Video Interview Guidelines"}
//                 </h3>
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 {[guidelines.primary, guidelines.secondary].map((section) => (
//                   <div key={section.label}>
//                     <p className="text-gray-400 text-xs font-medium mb-2">{section.label}</p>
//                     <div className="space-y-2">
//                       {section.items.map((item) => (
//                         <div key={item} className="flex items-start gap-2">
//                           <div className="w-1.5 h-1.5 rounded-full bg-[#2D55FB] mt-1.5 shrink-0" />
//                           <p className="text-gray-500 text-xs">{item}</p>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </motion.div>

//             {/* Important Notice — dynamic per type */}
//             <motion.div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20" {...fadeUp(0.25)}>
//               <div className="flex items-center gap-2 mb-3">
//                 <AlertTriangle className="h-4 w-4 text-gray-400" />
//                 <h3 className="text-gray-400 font-semibold text-sm">Important Notice</h3>
//               </div>
//               <div className="space-y-2">
//                 {notice.map((item) => (
//                   <div key={item} className="flex items-start gap-2">
//                     <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
//                     <p className="text-amber-300/70 text-xs">{item}</p>
//                   </div>
//                 ))}
//               </div>
//             </motion.div>

//             {/* Time Summary */}
//             <motion.div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10" {...fadeUp(0.3)}>
//               <div className="grid grid-cols-2 divide-x divide-white/10">
//                 <div className="flex flex-col items-center gap-1 pr-4">
//                   {isMCQ ? (
//                     <>
//                       <FileText className="h-6 w-6 text-[#2D55FB] mb-1" />
//                       <p className="text-white text-lg font-bold">{interview?.duration ?? "15 min"}</p>
//                       <p className="text-gray-500 text-xs">MCQ Assessment</p>
//                     </>
//                   ) : (
//                     <>
//                       <Video className="h-6 w-6 text-[#2D55FB] mb-1" />
//                       <p className="text-white text-lg font-bold">{interview?.duration ?? "30 min"}</p>
//                       <p className="text-gray-500 text-xs">AI Video Interview</p>
//                     </>
//                   )}
//                 </div>
//                 <div className="flex flex-col items-center gap-1 pl-4">
//                   <AlertTriangle className="h-6 w-6 text-[#2D55FB] mb-1" />
//                   <p className="text-white text-lg font-bold">{interview?.difficulty ?? "—"}</p>
//                   <p className="text-gray-500 text-xs">Difficulty Level</p>
//                 </div>
//               </div>
//             </motion.div>

//             {/* CTA */}
//             <motion.div className="flex flex-col items-center gap-3 pt-2" {...fadeUp(0.35)}>
//               <motion.button
//                 onClick={handleStartAssessment}
//                 disabled={isLoading}
//                 className="flex items-center gap-2 px-8 py-3 bg-[#2D55FB] text-white font-semibold rounded-xl hover:bg-[#1e3fd4] transition-all shadow-lg shadow-[#2D55FB]/30 disabled:opacity-70 disabled:cursor-not-allowed"
//                 whileHover={{ scale: isLoading ? 1 : 1.03 }}
//                 whileTap={{ scale: isLoading ? 1 : 0.97 }}
//               >
//                 {isLoading ? (
//                   <>
//                     <svg
//                       className="animate-spin h-4 w-4 text-white"
//                       xmlns="http://www.w3.org/2000/svg"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                     >
//                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
//                     </svg>
//                     Setting up your assessment...
//                   </>
//                 ) : (
//                   "Start Assessment →"
//                 )}
//               </motion.button>
//               <p className="text-gray-600 text-xs text-center">
//                 By clicking "Start Assessment", you confirm that you have read and understood all instructions.
//               </p>
//             </motion.div>

//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default InterviewInstructions;

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  User,
  Briefcase,
  LayoutGrid,
  Monitor,
  BookOpen,
  AlertTriangle,
  Clock,
  FileText,
  Video,
  Maximize,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { adminService } from "../../services/service/adminService";
import { userService } from "../../services/service/userService";
import { useAuth } from "../../context/context";
import { userPath } from "../../routes/EncryptRoute"

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const MCQ_GUIDELINES = {
  primary: {
    label: "During MCQ Assessment :",
    items: [
      "Read each question carefully before answering",
      "You cannot go back to previous questions",
      "Timer will be visible at all times",
      "Assessment auto-submits when time expires",
    ],
  },
  secondary: {
    label: "MCQ Tips & Best Practices :",
    items: [
      "Eliminate obviously wrong options first",
      "Don't spend too long on a single question",
      "Ensure stable internet before you begin",
      "Stay focused — no tabs or phone during the test",
    ],
  },
};

const AI_GUIDELINES = {
  primary: {
    label: "During Video Interview :",
    items: [
      "Maintain eye contact with the camera",
      "Speak clearly and at a natural pace",
      "Take your time to think before answering",
      "Be authentic and professional",
    ],
  },
  secondary: {
    label: "Video Interview Tips :",
    items: [
      "Sit in a quiet, well-lit environment",
      "Ensure your camera and microphone are working",
      "Look into the camera, not the screen",
      "Have your resume nearby for quick reference",
    ],
  },
};

const MCQ_NOTICE = [
  "Once you begin, you must complete the assessment in one session",
  "Refreshing or closing the browser will end your assessment",
  "Make sure you have enough uninterrupted time before starting",
  "Each question has a fixed time — manage your pace wisely",
  "Assessment runs in fullscreen mode — do NOT exit fullscreen",
  "All keyboard shortcuts are disabled during the assessment",
];

const AI_NOTICE = [
  "Once you begin, you must complete the entire interview in one session",
  "Refreshing the page or closing the browser will end your assessment",
  "Make sure you have enough time to complete the interview",
  "Have your resume and portfolio links ready for reference",
  "Interview runs in fullscreen mode — do NOT exit fullscreen",
  "All keyboard shortcuts are disabled during the assessment",
];

const MCQ_STRUCTURE = [
  { step: 1, title: "MCQ Assessment", sub: "Technical & aptitude questions" },
  { step: 2, title: "Auto Submission", sub: "Results evaluated instantly" },
];

const AI_STRUCTURE = [
  {
    step: 1,
    title: "AI Video Interview",
    sub: "Behavioral & technical questions",
  },
  { step: 2, title: "Response Analysis", sub: "AI evaluates your answers" },
];

const AITitle = [{ step: 1, title: "Interview Process Overview" }];
const MCQTitle = [{ step: 1, title: "MCQ Test Process Overview" }];

// ── Fullscreen helper ─────────────────────────────────────────────────────────
async function requestFullscreen(): Promise<boolean> {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      await el.requestFullscreen({ navigationUI: "hide" });
    }
    return true;
  } catch (err) {
    console.warn("Fullscreen request failed:", err);
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const InterviewInstructions: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [interview, setInterview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFSPrompt, setShowFSPrompt] = useState(false);
  const { setInterviewInfo, setUserData } = useAuth();

  const isMCQ = interview?.examType === "MCQ";
  const guidelines = isMCQ ? MCQ_GUIDELINES : AI_GUIDELINES;
  const notice = isMCQ ? MCQ_NOTICE : AI_NOTICE;
  const structure = isMCQ ? MCQ_STRUCTURE : AI_STRUCTURE;
  const instructions = isMCQ ? MCQTitle : AITitle;
  

  useEffect(() => {
    const fetchInterviewInstruction = async (id: string) => {
      try {
        const response = await userService.getInterviewInstruction(id!);
        setInterview(response?.interview);
        setInterviewInfo(response?.interview);
        setUserData(response?.user);
      } catch (error) {
        console.error(error);
      }
    };
    fetchInterviewInstruction(id!);
  }, []);

  const handleStartAssessment = async () => {
    if (isMCQ) {
      try {
        setIsLoading(true);

        // Request fullscreen before anything else
        await requestFullscreen();

        await userService.generateMCQ(
          {
            jobDescription: interview?.jobDescription,
            topic: interview?.test_title ?? interview?.position,
            difficulty: interview?.difficulty,
            examType: "MCQ",
            count: parseInt(interview?.no_of_questions),
          },
          id!,
        );

        navigate(userPath("mcq", id), {
          state: { title: interview?.title, time: interview?.duration },
        });
      } catch (error) {
        console.error("Failed to generate MCQ questions:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Request fullscreen before navigating to video interview
      await requestFullscreen();

      navigate(userPath("videoInterview", id), {
        state: { title: interview?.title, time: interview?.duration },
      });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#050A24] bg-[radial-gradient(circle_at_100%_0%,rgba(45,85,251,0.45),transparent_50%),radial-gradient(circle_at_0%_100%,rgba(45,85,251,0.35),transparent_50%)]">
      {/* Orbs */}
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

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-4 bg-[#0a1342]/30 backdrop-blur-sm">
          <button className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Interview Instructions</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex justify-center px-4 sm:px-6 py-6 pb-12">
          <div className="w-full max-w-2xl space-y-4">
            {/* Title */}
            <motion.div className="text-center mb-6" {...fadeUp(0)}>
              <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">
                {instructions[0].title}
              </h1>
              <p className="text-gray-400 text-sm">
                Please read these instructions carefully before proceeding
              </p>
            </motion.div>

            {/* Job Card */}
            <motion.div
              className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
              {...fadeUp(0.1)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-[#2D55FB]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm sm:text-base">
                    {interview?.test_title ?? interview?.position ?? ""}
                  </h2>
                  <p className="text-gray-500 text-xs">
                    Vitric Business Solutions
                  </p>
                </div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-3.5 w-3.5 text-[#2D55FB]" />
                  <span className="text-[#2D55FB] text-xs font-medium">
                    Job Description
                  </span>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">
                  {(interview?.jobDescriptionText || interview?.description) ??
                    "No job description provided."}
                </p>
              </div>
            </motion.div>

            {/* Assessment Structure + Technical Requirements */}
            <motion.div className="grid grid-cols-2 gap-4" {...fadeUp(0.15)}>
              <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
                    {isMCQ ? (
                      <LayoutGrid className="h-4 w-4 text-[#2D55FB]" />
                    ) : (
                      <Video className="h-4 w-4 text-[#2D55FB]" />
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-xs sm:text-sm">
                    Assessment Structure
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {structure.map(({ step, title, sub }) => (
                    <div key={step} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#2D55FB] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                        {step}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">
                          {title}
                        </p>
                        <p className="text-gray-500 text-xs">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
                    <Monitor className="h-4 w-4 text-[#2D55FB]" />
                  </div>
                  <h3 className="text-white font-semibold text-xs sm:text-sm">
                    Technical Requirements
                  </h3>
                </div>
                <div className="space-y-2">
                  {(isMCQ
                    ? [
                        "Stable internet connection",
                        "Quiet, distraction-free environment",
                        "Chrome, Firefox, or Safari browser",
                        "Do not open other tabs or apps",
                      ]
                    : [
                        "Camera and microphone enabled",
                        "Stable internet connection",
                        "Quiet, well-lit environment",
                        "Chrome, Firefox, or Safari browser",
                      ]
                  ).map((req) => (
                    <div key={req} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      <p className="text-gray-400 text-xs">{req}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Interview Guidelines */}
            <motion.div
              className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
              {...fadeUp(0.2)}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#2D55FB]/20 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-[#2D55FB]" />
                </div>
                <h3 className="text-white font-semibold text-sm">
                  {isMCQ
                    ? "MCQ Assessment Guidelines"
                    : "Video Interview Guidelines"}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[guidelines.primary, guidelines.secondary].map((section) => (
                  <div key={section.label}>
                    <p className="text-gray-400 text-xs font-medium mb-2">
                      {section.label}
                    </p>
                    <div className="space-y-2">
                      {section.items.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2D55FB] mt-1.5 shrink-0" />
                          <p className="text-gray-500 text-xs">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Important Notice */}
            <motion.div
              className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20"
              {...fadeUp(0.25)}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-gray-400" />
                <h3 className="text-gray-400 font-semibold text-sm">
                  Important Notice
                </h3>
              </div>
              <div className="space-y-2">
                {notice.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mt-1.5 shrink-0" />
                    <p className="text-gray-400 text-xs">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Time Summary */}
            <motion.div
              className="bg-[#0d1535]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10"
              {...fadeUp(0.3)}
            >
              <div className="grid grid-cols-2 divide-x divide-white/10">
                <div className="flex flex-col items-center gap-1 pr-4">
                  {isMCQ ? (
                    <>
                      <FileText className="h-6 w-6 text-[#2D55FB] mb-1" />
                      <p className="text-white text-lg font-bold">
                        {interview?.duration ?? "15 min"}
                      </p>
                      <p className="text-gray-500 text-xs">MCQ Assessment</p>
                    </>
                  ) : (
                    <>
                      <Video className="h-6 w-6 text-[#2D55FB] mb-1" />
                      <p className="text-white text-lg font-bold">
                        {interview?.duration ?? "30 min"}
                      </p>
                      <p className="text-gray-500 text-xs">
                        AI Video Interview
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 pl-4">
                  <AlertTriangle className="h-6 w-6 text-[#2D55FB] mb-1" />
                  <p className="text-white text-lg font-bold">
                    {interview?.difficulty ?? "—"}
                  </p>
                  <p className="text-gray-500 text-xs">Difficulty Level</p>
                </div>
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              className="flex flex-col items-center gap-3 pt-2"
              {...fadeUp(0.35)}
            >
              <motion.button
                onClick={handleStartAssessment}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-3 bg-[#2D55FB] text-white font-semibold rounded-xl hover:bg-[#1e3fd4] transition-all shadow-lg shadow-[#2D55FB]/30 disabled:opacity-70 disabled:cursor-not-allowed"
                whileHover={{ scale: isLoading ? 1 : 1.03 }}
                whileTap={{ scale: isLoading ? 1 : 0.97 }}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Setting up your assessment...
                  </>
                ) : (
                  <>
                    <Maximize className="h-4 w-4" />
                    Start Assessment →
                  </>
                )}
              </motion.button>
              <p className="text-gray-600 text-xs text-center">
                By clicking "Start Assessment", you confirm that you have read
                and understood all instructions. The assessment will open in
                fullscreen with all keyboard shortcuts disabled.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewInstructions;
