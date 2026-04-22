// import {
//   useState,
//   type DragEvent,
//   type ChangeEvent,
//   useEffect,
//   useRef,
// } from "react";
// import toast from "react-hot-toast";
// import { CheckCircle2, X } from "lucide-react";
// import AdminLayout from "../../common/AdminLayout";
// import AI from "../../assets/admin/AI_Power.png";
// import Mail from "../../assets/admin/Mail_Icon.png";
// import Upload from "../../assets/admin/Upload.png";
// import Send_Invite from "../../assets/admin/send_Invite.png";
// import SendEmail from "../../assets/admin/send.png";
// import Calender from "../../assets/admin/calender.png";
// import Bookmark from "../../assets/admin/assessment/bookmark.png";
// import Edit from "../../assets/admin/assessment/edit1.png";
// import ActiveInterviews from "../../components/admin/AI Interview/ActiveInterviews";
// import { userPath } from "../../routes/EncryptRoute";
// import { adminService } from "../../services/service/adminService";
// import AddCandidateModal from "../../components/Candidates/AddCandidate";
// import { useTheme } from "../../context/Themecontext";
// export default function InterviewSetup() {
//   const [fileName, setFileName] = useState<string | null>(null);
//   const [file, setFile] = useState<File | null>(null);
//   const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
//   const [description, setDescription] = useState<string>("");
//   const [secondaryJobDescription, setSecondaryJobDescription] =
//     useState<string>("");
//   const [position, setPosition] = useState<string>("");
//   const [skills, setSkills] = useState<string[]>([]);
//   const [inputValue, setInputValue] = useState("");
//   const [duration, setDuration] = useState("");
//   const [passingScore, setPassingScore] = useState("");
//   const [numberOfQuestions, setNumberOfQuestions] = useState("");
//   const [difficulty, setDifficulty] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [_, setSubject] = useState("");
//   const [messageBody, setMessageBody] = useState("");
//   const [__, setInterviewLink] = useState("");
//   const [startDate, setStartDate] = useState<Date | null>(null);
//   const [endDate, setEndDate] = useState<Date | null>(null);
//   const [isGenerated, setIsGenerated] = useState(false);
//   const [createdJobId, setCreatedJobId] = useState<string | null>(null);
//   const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
//   //console.log(interviewLink);
//   //console.log(subject);
//   // Candidate States
//   const [candidates, setCandidates] = useState<any[]>([]);
//   const [filteredCandidates, setFilteredCandidates] = useState<any[]>([]);
//   const [selectedCandidates, setSelectedCandidates] = useState<any[]>([]);
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [searchTerm, setSearchTerm] = useState("");

//   const [activeTab, setActiveTab] = useState("setup");

//   //edit
//   const [editMode, setEditMode] = useState(false);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [useTemplateMode, setUseTemplateMode] = useState(false);

//   const [jdLoading, setJdLoading] = useState(false);
//   const [candidatesLoading, setCandidatesLoading] = useState(false);
//   const [editLoading, setEditLoading] = useState(false);
//   const [jdAnalysis, setJdAnalysis] = useState<any>(null);
//   const [scoredCandidates, setScoredCandidates] = useState<any[]>([]);
//   const [groqLoading, setGroqLoading] = useState(false);
//   const [reDirect, setReDirect] = useState(false);
//   const [showCandidateModal, setShowCandidateModal] = useState(false);
//   const [candidateSearch, setCandidateSearch] = useState("");

//   const { theme } = useTheme();
//   const handleFileDrop = async (e: DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     const droppedFile = e.dataTransfer.files[0];

//     if (!droppedFile || !/\.(pdf|docx?|txt)$/i.test(droppedFile.name)) {
//       toast.error("Invalid file type");
//       return;
//     }

//     // Simulate input change
//     const fakeEvent = {
//       target: { files: [droppedFile] },
//     } as any;

//     await handleFileChange(fakeEvent);
//   };
//   const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

//   const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
//     const selectedFile = e.target.files?.[0];
//     if (!selectedFile || !/\.(pdf|docx?|txt)$/i.test(selectedFile.name)) {
//       toast.error("Invalid file type");
//       return;
//     }

//     setFileName(selectedFile.name);
//     setFile(selectedFile);

//     try {
//       setJdLoading(true);
//       const fd = new FormData();
//       fd.append("jobDescription", selectedFile);

//       const res = await adminService.analyzeJD(fd);
//       const analysis = res.analysis;

//       if (!analysis) return;
//       setJdAnalysis(analysis);

//       // 🔥 Map difficulty
//       const difficultyLevel =
//         mapExperienceToDifficulty(
//           analysis?.experienceLevel,
//           analysis?.experienceYears,
//         ) || "";

//       const autoQuestions = getDefaultQuestions(difficultyLevel);
//       const autoDuration = getDefaultDuration(difficultyLevel);

//       // 🔥 Auto-fill without overwriting user values
//       setPosition((prev) => prev || analysis?.jobTitle || "");
//       setDescription(
//         (prev) =>
//           prev || analysis?.jobSummary || analysis?.fullJobDescription || "",
//       );
//       setDifficulty((prev) => prev || difficultyLevel);
//       setNumberOfQuestions((prev) => prev || autoQuestions);
//       setDuration((prev) => prev || autoDuration);
//       setPassingScore((prev) => prev || "70");

//       // 🔥 Merge skills (requiredSkills + niceToHaveSkills)
//       const combinedSkills = [
//         ...(analysis?.requiredSkills || []),
//         ...(analysis?.niceToHaveSkills || []),
//       ]; 

//       if (combinedSkills.length > 0) {
//         setSkills((prev) => {
//           const unique = new Set([...prev, ...combinedSkills]);
//           return Array.from(unique);
//         });
//       }

//       toast.success("JD analyzed & fields auto-filled ✅");
//     } catch (error: any) {
//       console.error(error);
//       toast.error("Failed to analyze JD");
//     } finally {
//       setJdLoading(false);
//     }
//   };

//   const scoreCandidatesWithGroq = async (
//     candidates: any[],
//     jdAnalysis: any,
//   ) => {
//     if (!jdAnalysis || candidates.length === 0) return candidates;

//     // 🔥 Step 1: Extract keywords (same as your other file logic)
//     const extractKeywords = (skills: string[]) => {
//       return skills.flatMap(
//         (skill) =>
//           skill
//             .toLowerCase()
//             .replace(/[^\w\s]/g, "")
//             .split(" ")
//             .filter((word) => word.length > 3), // ignore small words
//       );
//     };

//     const requiredSkills = jdAnalysis.requiredSkills || [];
//     const keywords = extractKeywords(requiredSkills);

//     // 🔥 Step 2: Filter candidates based on keyword match
//     const filtered = candidates.filter((c: any) => {
//       const candidateSkills = (
//         c.skills ||
//         c.key_Skills ||
//         c.primarySkill ||
//         c.secondarySkill ||
//         ""
//       )
//         .toString()
//         .toLowerCase();

//       return keywords.some((word) => candidateSkills.includes(word));
//     });

//     // 🔥 Step 3: Fallback (IMPORTANT)
//     // If nothing matched → return all candidates
//     return filtered.length > 0 ? filtered : candidates;
//   };

//   // AI candidates (dropdown)
//   // const aiCandidates = scoredCandidates || [];

//   // Manual candidates (modal)
//   // const manualCandidates = candidates.filter(
//   //   (c: any) => !aiCandidates.some((ai: any) => ai._id === c._id),
//   // );
//   const toggleCandidateSelection = (candidate: any) => {
//     const exists = selectedCandidates.some((c) => c._id === candidate._id);

//     if (exists) {
//       setSelectedCandidates((prev) =>
//         prev.filter((c) => c._id !== candidate._id),
//       );
//     } else {
//       setSelectedCandidates((prev) => [...prev, candidate]);
//     }
//   };

//  useEffect(() => {
//   if (!jdAnalysis) {
//     setScoredCandidates(candidates); // ← seed when no JD uploaded
//     return;
//   }
//   const runAI = async () => {
//     try {
//       setGroqLoading(true);
//       const filtered = await scoreCandidatesWithGroq(candidates, jdAnalysis);
//       setScoredCandidates(filtered);
//     } catch (error) {
//       console.error("AI filtering error:", error);
//       setScoredCandidates(candidates);
//     } finally {
//       setGroqLoading(false);
//     }
//   };
//   runAI();
// }, [jdAnalysis, candidates]);
//   const handleGenerateAndSendInvites = async () => {
//     try {
//       if (!file) {
//         toast.error("Please upload job description file");
//         return;
//       }

//       setLoading(true);

//       const formData = new FormData();

//       formData.append("jobDescription", file);
//       formData.append("position", position);
//       formData.append("description", description);
//       formData.append("difficulty", difficulty);
//       formData.append("duration", duration);
//       formData.append("passingScore", passingScore);
//       formData.append("secondaryJobDescription", secondaryJobDescription);
//       formData.append("numberOfQuestions", numberOfQuestions);

//       skills.forEach((skill) => {
//         formData.append("skills", skill);
//       });

//       const response = await adminService.generateAIInterview(formData);
//       //console.log("Interview Created:", response);
//       setCreatedJobId(response.jobId);

//       setIsGenerated(true);
//       await fetchCandidates();
//       setInterviewLink(
//         `${import.meta.env.FRONTEND_URL || "http://localhost:5173"}${userPath("loginWithId", response.jobId)},`,
//       );

//       setSubject("Invitations to Complete Your AI Video Interview");

//       setMessageBody(
//         `Hi Dear ,\n\nYou have been invited to complete an AI-powered interview for the ${position} position.\n\nBest of luck!`,
//       );
//     } catch (error: any) {
//       console.error(error.response?.data || error.message);
//       toast.error(error.response?.data?.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };
//   const handleDraft = async () => {
//     try {
//       if (!file) {
//         toast.error("Please upload job description file");
//         return;
//       }

//       setLoading(true);

//       const formData = new FormData();

//       formData.append("jobDescription", file);
//       formData.append("position", position);
//       formData.append("description", description);
//       formData.append("difficulty", difficulty);
//       formData.append("duration", duration);
//       formData.append("passingScore", passingScore);
//       formData.append("secondaryJobDescription", secondaryJobDescription);
//       formData.append("numberOfQuestions", numberOfQuestions);
//       skills.forEach((skill) => {
//         formData.append("skills", skill);
//       });

//       const response = await adminService.generateAIInterview(formData);
//       //console.log("Interview Created:", response);
//       setCreatedJobId(response.jobId);
//       setActiveTab("template");
//     } catch (error: any) {
//       console.error(error.response?.data || error.message);
//       toast.error(error.response?.data?.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onNavigateToInterviewSetup = async (assessment: any) => {
//     //console.log("Navigating to Interview Setup with assessment:", assessment);
//     setActiveTab("setup");
//     setUseTemplateMode(true);

//     setInterviewLink(
//       `${import.meta.env.FRONTEND_URL || "http://localhost:5173"}${userPath("loginWithId", assessment.jobId)}`,
//     );

//     try {
//       setReDirect(true);
//       const res = await adminService.getDraft(assessment._id);
//       const data = res.data; // ✅ correct structure

//       // This is USE mode (not edit)
//       setEditMode(false);
//       setEditingId(null);

//       // Save jobId for sending invites
//       setCreatedJobId(data._id);

//       // Fill form fields from API response
//       setPosition(data.position || "");
//       setDescription(data.description || "");
//       setPassingScore(data.passingScore || "");
//       setNumberOfQuestions(data.numberOfQuestions || "");
//       setSecondaryJobDescription(data.secondaryJobDescription || "");
//       setDifficulty(data.difficulty || "");
//       setDuration(data.duration || "");
//       setSkills(data.skills || []);

//       // ✅ Handle existing file
//       if (data.jobDescription) {
//         setExistingFilePath(data.jobDescription);
//         setFileName(data.jobDescription.split("/").pop());
//       } else {
//         setExistingFilePath(null);
//         setFileName(null);
//       }

//       // Open email section
//       setIsGenerated(true);
//       await fetchCandidates();

//       // Default email
//       setSubject("Invitations to Complete Your AI Video Interview");
//       setMessageBody(
//         `Hi Dear ,\n\nYou have been invited to complete an AI-powered interview for the ${data.position} position.\n\nBest of luck!`,
//       );
//     } catch (error) {
//       console.error("Failed to load interview", error);
//     } finally {
//       setReDirect(false);
//     }
//   };

//   const fetchCandidates = async () => {
//   try {
//     setCandidatesLoading(true);
//     const res: any = await adminService.getAllCandidate(1, 100, "all");
//     const list = res.data || [];
//     setCandidates(list);
//     if (!jdAnalysis) setScoredCandidates(list); // ← ADD THIS
//   } catch (error) {
//     console.error("Failed to fetch candidates", error);
//   } finally {
//     setCandidatesLoading(false);
//   }
// };

//   useEffect(() => {
//     fetchCandidates();
//   }, [showAddCandidateModal]);

//   useEffect(() => {
//   const base = scoredCandidates.length > 0 ? scoredCandidates : candidates;
//   if (!searchTerm.trim()) {
//     setFilteredCandidates(base); // ← populates on first open too
//     return;
//   }
//   const filtered = base.filter((c: any) =>
//     c.name.toLowerCase().includes(searchTerm.toLowerCase())
//   );
//   setFilteredCandidates(filtered);
// }, [searchTerm, scoredCandidates, candidates]); // ← add candidates as dep

//   const handleSendInvitations = async () => {
//     try {
//       setLoading(true);

//       if (!createdJobId) return toast.error("Create interview first");
//       if (!selectedCandidates.length) return toast.error("Select candidates");
//       if (!startDate || !endDate) return toast.error("Select dates");

//       const payload = {
//         jobId: createdJobId,
//         candidateIds: selectedCandidates.map((c) => c._id),
//         messageBody,
//         startDate,
//         endDate,
//         testTitle: position,
//       };

//       const res = await adminService.sendInvitations(payload);
//       //console.log(res);

//       const invited = res.invitedEmails || [];
//       const skipped = res.skippedEmails || [];

//       // 🔴 CASE 1: ALL SKIPPED (MOST IMPORTANT FIX)
//       if (res.isPartial && invited.length === 0) {
//         toast.error(`All candidates already invited: ${skipped.join(", ")}`);
//         return; // ❌ stop further execution
//       }

//       // 🟡 CASE 2: PARTIAL SUCCESS
//       if (res.isPartial) {
//         if (invited.length > 0) {
//           toast.success(`Invited: ${invited.join(", ")}`);
//         }

//         if (skipped.length > 0) {
//           setTimeout(() => {
//             toast.error(`Skipped (already invited): ${skipped.join(", ")}`);
//           }, 300);
//         }
//       }

//       // 🟢 CASE 3: FULL SUCCESS
//       else {
//         toast.success(`Invitations sent to ${invited.length} candidate(s)`);
//       }

//       // ✅ reset UI
//       setSelectedCandidates([]);
//       setActiveTab("template");
//     } catch (error: any) {
//       //console.log(error);
//       toast.error(error?.res?.message || "Failed to send invitations");
//     } finally {
//       setLoading(false);
//     }
//   };
//   const candidateDropdownRef = useRef<HTMLDivElement | null>(null);
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         candidateDropdownRef.current &&
//         !candidateDropdownRef.current.contains(event.target as Node)
//       ) {
//         setShowDropdown(false);
//       }
//     };

//     document.addEventListener("mousedown", handleClickOutside);

//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, []);

//   const handleUpdateInterview = async () => {
//     if (!editingId) return;

//     try {
//       setLoading(true);

//       const formData = new FormData();

//       // ✅ Only append file if new file selected
//       if (file instanceof File) {
//         formData.append("jobDescription", file);
//       }

//       // ✅ Always send required fields
//       formData.append("position", position.trim());
//       formData.append("description", description.trim());
//       formData.append("difficulty", difficulty);
//       formData.append("duration", duration);
//       formData.append("passingScore", String(Number(passingScore)));
//       formData.append("secondaryJobDescription", secondaryJobDescription);
//       formData.append("numberOfQuestions", String(Number(numberOfQuestions)));

//       // ✅ Append skills properly
//       if (skills && skills.length > 0) {
//         skills.forEach((skill) => {
//           formData.append("skills", skill);
//         });
//       }

//       await adminService.updateAITemplate(editingId, formData);

//       toast.success("Interview updated successfully ✅");

//       // ✅ Reset everything
//       setEditMode(false);
//       setEditingId(null);
//       setCreatedJobId(null);
//       setFile(null);
//       setFileName(null);
//       setPosition("");
//       setDescription("");
//       setPassingScore("");
//       setNumberOfQuestions("");
//       setDifficulty("");
//       setDuration("");
//       setSecondaryJobDescription("");
//       setSkills([]);
//       setIsGenerated(false);

//       // Go back to templates
//       setActiveTab("template");
//     } catch (error: any) {
//       console.error(error);
//       toast.error(error.response?.data?.message || "Update failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleEditAssessment = async (assessment: any) => {
//     //console.log("Editing assessment:", assessment);
//     setActiveTab("setup");
//     setUseTemplateMode(false); // ✅ ADD THIS LINE

//     try {
//       setEditLoading(true);
//       const res = await adminService.getDraft(assessment._id);
//       //console.log("Fetched Interview for Editing:", res);
//       const data = res.data;

//       setEditingId(data._id);
//       setEditMode(true);
//       setIsGenerated(false);
//       setSecondaryJobDescription(data.secondaryJobDescription || ""); // new field
//       setPosition(data.position || "");
//       setDescription(data.description || "");
//       setPassingScore(data.passingScore || "");
//       setNumberOfQuestions(data.numberOfQuestions || "");
//       setDifficulty(data.difficulty || "");
//       setDuration(data.duration || "");
//       setSkills(data.skills || []);
//     } catch (error) {
//       console.error("Failed to load interview", error);
//     } finally {
//       setEditLoading(false);
//     }
//   };

//   // ================= AI AUTO FILL HELPERS =================

//   const mapExperienceToDifficulty = (level?: string, years?: string) => {
//     if (!level && !years) return "";

//     const lvl = level?.toLowerCase();

//     if (lvl?.includes("entry") || lvl?.includes("junior")) return "Easy";
//     if (lvl?.includes("mid")) return "Medium";
//     if (lvl?.includes("senior") || lvl?.includes("lead")) return "Hard";

//     const y = Number(years);
//     if (!isNaN(y)) {
//       if (y <= 1) return "Easy";
//       if (y <= 4) return "Medium";
//       return "Hard";
//     }

//     return "";
//   };

//   const getDefaultQuestions = (difficulty: string) => {
//     switch (difficulty) {
//       case "Easy":
//         return "10";
//       case "Medium":
//         return "15";
//       case "Hard":
//         return "20";
//       default:
//         return "";
//     }
//   };

//   const getDefaultDuration = (difficulty: string) => {
//     switch (difficulty) {
//       case "Easy":
//         return "15 minutes";
//       case "Medium":
//         return "30 minutes";
//       case "Hard":
//         return "60 minutes";
//       default:
//         return "";
//     }
//   };
//   const handleRemoveFile = () => {
//     // 🧹 File reset
//     setFile(null);
//     setFileName(null);
//     setExistingFilePath(null);
//     setJdAnalysis(null);

//     // 🧹 Form reset
//     setPosition("");
//     setDescription("");
//     setSecondaryJobDescription("");
//     setSkills([]);
//     setInputValue("");

//     setDuration("");
//     setPassingScore("");
//     setNumberOfQuestions("");
//     setDifficulty("");

//     // 🧹 Email + interview reset
//     setSubject("");
//     setMessageBody("");
//     setInterviewLink("");

//     setStartDate(null);
//     setEndDate(null);

//     // 🧹 Candidates reset
//     setSelectedCandidates([]);
//     setScoredCandidates([]);
//     setCandidates([]);

//     // 🧹 UI states reset
//     setIsGenerated(false);
//     setCreatedJobId(null);
//     setEditMode(false);
//     setEditingId(null);
//     setUseTemplateMode(false);

//     // optional UX
//     setShowDropdown(false);
//     setSearchTerm("");
//   };

//   return (
//     <>
//       <AdminLayout
//         heading="AI Video Interview"
//         subheading="AI-powered video interviews"
//         showSearch={false}
//       >
//         {/* ── Full-page loader overlay ── */}
//         {(loading || jdLoading || editLoading || reDirect || groqLoading) && (
//           <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-4">
//             <div className="relative flex items-center justify-center">
//               <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
//               <div className="absolute h-13 w-13 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
//             </div>

//             <p className="text-sm font-medium text-indigo-700">
//               {jdLoading
//                 ? "Analyzing Job Description..."
//                 : groqLoading
//                   ? "AI is ranking candidates by JD match..."
//                   : editLoading
//                     ? "Updating interview details..."
//                     : reDirect
//                       ? "Redirecting to interview page..."
//                       : "Please wait..."}
//             </p>
//           </div>
//         )}

//         {loading && (
//           <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
//             <div className="flex flex-col items-center gap-4">
//               <div className="w-12 h-12 border-4 border-indigo-200 border-t-[#4318FF] rounded-full animate-spin" />
//               <p className="text-sm text-gray-500 font-medium">
//                 Please wait...
//               </p>
//             </div>
//           </div>
//         )}

//         <div className="min-h-screen">
//           {/* Tabs */}
//           <div className="flex items-center justify-between mb-6">
//             {/* Tabs */}
//             <div className={`inline-flex rounded-lg p-2 ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
//   <button
//     onClick={() => setActiveTab("setup")}
//     className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
//       activeTab === "setup"
//         ? theme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'bg-[#F4F7FE] text-gray-900 shadow-sm'
//         : theme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
//     }`}
//   >
//     Interview Setup
//   </button>
//   <button
//     onClick={() => setActiveTab("template")}
//     className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
//       activeTab === "template"
//         ? theme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'bg-[#F4F7FE] text-gray-900 shadow-sm'
//         : theme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
//     }`}
//   >
//     AI Interview Template
//   </button>
// </div>
//           </div>
//           {/* Right Side Controls */}
//           {activeTab === "template" && (
//             <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
//               <ActiveInterviews
//                 onEditInterview={handleEditAssessment}
//                 onNavigateToInterviewSetup={onNavigateToInterviewSetup}
//               />
//             </div>
//           )}

//           {activeTab === "setup" && (
//             <>
//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
//                 {/* Left: AI Generator */}
//                 <div
//                   className={`bg-white p-4 sm:p-6 rounded-xl shadow-sm relative ${
//                     useTemplateMode ? "opacity-90 pointer-events-none" : ""
//                   }`}
//                 >
//                   <div className="flex items-center mb-4">
//                     <div className="p-2 rounded-lg">
//                       <img
//                         className="w-10 h-10 sm:w-12 sm:h-12"
//                         src={AI}
//                         alt="ai"
//                       />
//                     </div>
//                     <div>
//                       <h2 className="font-semibold text-base sm:text-lg">
//                         AI - Powered Interview Generator
//                       </h2>
//                       <p className="text-xs sm:text-sm text-gray-500">
//                         Upload job description to generate intelligent questions
//                       </p>
//                     </div>
//                   </div>

//                   {/* ── Upload zone: only shown when NO file is selected ── */}
//                   {!fileName && !existingFilePath && (
//                     <div
//                       onDrop={handleFileDrop}
//                       onDragOver={handleDragOver}
//                       className="relative flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center transition-all duration-200 hover:border-indigo-400 hover:bg-indigo-50/30"
//                     >
//                       {/* Upload Icon */}
//                       <div className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-100">
//                         <img
//                           src={Upload}
//                           alt="upload"
//                           className="w-6 h-6 opacity-80"
//                         />
//                       </div>

//                       {/* Text */}
//                       <div>
//                         <p className="text-sm font-medium text-gray-700">
//                           Drag & drop your job description here
//                         </p>
//                         <p className="text-xs text-gray-400 mt-1">
//                           Supports PDF, DOC, DOCX, TXT (Max 5MB)
//                         </p>
//                       </div>

//                       {/* Browse Button */}
//                       <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 transition">
//                         Browse Files
//                         <input
//                           type="file"
//                           accept=".pdf,.doc,.docx,.txt"
//                           className="hidden"
//                           onChange={handleFileChange}
//                         />
//                       </label>
//                     </div>
//                   )}

//                   {/* File Preview — shown when a file IS selected */}
//                   {(fileName || existingFilePath) && (
//                     <div className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
//                       {/* Left side */}
//                       <div className="flex items-center gap-3 overflow-hidden">
//                         <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 font-semibold text-sm">
//                           📄
//                         </div>

//                         <div className="flex flex-col overflow-hidden">
//                           <span className="text-sm font-medium text-gray-800 truncate">
//                             {fileName || existingFilePath?.split("/").pop()}
//                           </span>
//                           <span className="text-xs text-gray-400">
//                             Job Description File
//                           </span>
//                         </div>
//                       </div>

//                       {/* Remove */}
//                       <button
//                         type="button"
//                         onClick={handleRemoveFile}
//                         className="text-sm font-medium text-red-500 hover:text-red-600 transition"
//                       >
//                         <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
//                       </button>
//                     </div>
//                   )}

//                   <h3 className="text-gray-800 pb-2 text-xs sm:text-sm mt-4">
//                     Position
//                   </h3>
//                   <input
//                     type="text"
//                     className="w-full p-2 mb-3 border border-gray-300 rounded-lg outline-none text-xs sm:text-sm"
//                     value={position}
//                     onChange={(e) => {
//                       setPosition(e.target.value);
//                     }}
//                   />

//                   <textarea
//                     className=" w-full p-3 border border-gray-300 rounded-md text-xs sm:text-sm resize-none outline-none"
//                     rows={4}
//                     placeholder="Paste your job descriptions here..."
//                     value={description}
//                     onChange={(e) => setDescription(e.target.value)}
//                   ></textarea>

//                   <div className="w-full flex items-center justify-between gap-5">
//                     <div className="w-full md:w-1/2">
//                       <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">
//                         Passing Score
//                       </h3>
//                       <input
//                         type="text"
//                         placeholder="e.g. 70%"
//                         className="w-full p-2 mb-3 border border-gray-300 rounded-lg outline-none text-xs sm:text-sm"
//                         value={passingScore}
//                         onChange={(e) => {
//                           setPassingScore(e.target.value);
//                         }}
//                       />
//                     </div>
//                     <div className="w-full md:w-1/2">
//                       <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">
//                         Number of Questions
//                       </h3>
//                       <input
//                         type="text"
//                         placeholder="e.g. 10"
//                         className="w-full p-2 mb-3 border border-gray-300 rounded-lg outline-none text-xs sm:text-sm"
//                         value={numberOfQuestions}
//                         onChange={(e) => {
//                           setNumberOfQuestions(e.target.value);
//                         }}
//                       />
//                     </div>
//                   </div>
//                   <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">
//                     Skills
//                   </h3>

//                   <div className="w-full p-2 mb-3 border border-gray-300 rounded-lg flex flex-wrap gap-2 items-center">
//                     {/* Existing Skill Tags */}
//                     {skills.map((skill, index) => (
//                       <div
//                         key={index}
//                         className="flex items-center bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs sm:text-sm"
//                       >
//                         {skill}
//                         <button
//                           type="button"
//                           onClick={() =>
//                             setSkills(skills.filter((_, i) => i !== index))
//                           }
//                           className="ml-2 text-indigo-500 hover:text-indigo-700"
//                         >
//                           ✕
//                         </button>
//                       </div>
//                     ))}

//                     {/* Input */}
//                     <input
//                       type="text"
//                       value={inputValue}
//                       onChange={(e) => setInputValue(e.target.value)}
//                       onKeyDown={(e) => {
//                         // Add skill when user presses comma or Enter
//                         if (e.key === "," || e.key === "Enter") {
//                           e.preventDefault();

//                           const newSkill = inputValue.trim().replace(",", "");

//                           if (newSkill && !skills.includes(newSkill)) {
//                             setSkills([...skills, newSkill]);
//                           }

//                           setInputValue("");
//                         }

//                         // Remove last skill when backspace and input empty
//                         if (e.key === "Backspace" && !inputValue) {
//                           setSkills((prev) => prev.slice(0, -1));
//                         }
//                       }}
//                       className="flex-1 min-w-[120px] outline-none text-xs sm:text-sm"
//                       placeholder="Type skill and press comma..."
//                     />
//                   </div>

//                   <div className="mt-4 flex flex-col md:flex-row gap-4">
//                     <div className="w-full md:w-1/2">
//                       <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">
//                         Interview Durations
//                       </h3>
//                       <select
//                         value={duration}
//                         onChange={(e) => setDuration(e.target.value)}
//                         className="w-full border border-gray-300 outline-none p-2 rounded-md text-xs sm:text-sm text-gray-700"
//                       >
//                         <option value="">Select Duration</option>
//                         <option value="15 minutes">15 minutes</option>
//                         <option value="30 minutes">30 minutes</option>
//                         <option value="60 minutes">60 minutes</option>
//                       </select>
//                     </div>
//                     <div className="w-full md:w-1/2">
//                       <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">
//                         Difficulty Level
//                       </h3>
//                       <select
//                         className="w-full border border-gray-300 outline-none p-2 rounded-md text-xs sm:text-sm text-gray-700"
//                         onChange={(e) => setDifficulty(e.target.value)}
//                         value={difficulty}
//                       >
//                         <option>Select Level</option>
//                         <option>Easy</option>
//                         <option>Medium</option>
//                         <option>Hard</option>
//                       </select>
//                     </div>
//                   </div>
//                   <div className="mt-6">
//                     {/* ================= EDIT MODE ================= */}
//                     {editMode && (
//                       <button
//                         onClick={handleUpdateInterview}
//                         disabled={loading}
//                         className="w-full bg-[#4318FF] text-white text-sm py-3 rounded-md hover:bg-[#3214cc] transition disabled:opacity-50"
//                       >
//                         {loading ? "Updating..." : "Update Interview"}
//                       </button>
//                     )}

//                     {/* ================= CREATE MODE ================= */}
//                     {!editMode && !isGenerated && !useTemplateMode && (
//                       <div className="flex justify-end gap-4">
//                         <button
//                           onClick={handleDraft}
//                           disabled={loading}
//                           className="flex items-center justify-center gap-2 rounded-lg bg-white text-[#4318FFE5] border border-[#4318FFE5] px-4 py-2 hover:bg-indigo-50 transition disabled:opacity-50"
//                         >
//                           <img src={Bookmark} alt="" className="w-5 h-5" />
//                           <span className="text-sm">
//                             {loading
//                               ? "Saving..."
//                               : "Generate & Save as template"}
//                           </span>
//                         </button>

//                         <button
//                           onClick={handleGenerateAndSendInvites}
//                           disabled={loading}
//                           className="flex items-center justify-center gap-2 bg-[#4318FF] px-4 py-2 rounded-lg hover:bg-[#3214cc] transition disabled:opacity-50"
//                         >
//                           <img src={Edit} alt="" className="w-5 h-5" />
//                           <span className="text-white text-sm">
//                             {loading
//                               ? "Generating..."
//                               : "Generate & Send Invites"}
//                           </span>
//                         </button>
//                       </div>
//                     )}

//                     {/* ================= GENERATED MODE ================= */}
//                     {!editMode && isGenerated && (
//                       <button
//                         className="w-full bg-[#2AAC7E] text-white text-sm py-3 rounded-md flex items-center justify-center gap-2 hover:bg-[#23996d] transition"
//                         onClick={() => setIsGenerated(false)}
//                       >
//                         <img src={Edit} alt="edit" className="w-5 h-5" />
//                         <span>Regenerate AI Interview</span>
//                       </button>
//                     )}
//                   </div>
//                 </div>

//                 {/* Right: Email Invitations */}
//                 <div className="bg-white h-fit p-4 sm:p-6 rounded-xl flex flex-col items-start justify-start relative">
//                   <div className="flex items-center w-full mb-4">
//                     <div className="p-2 rounded-lg">
//                       <img
//                         className="w-10 h-10 sm:w-12 sm:h-12"
//                         src={Mail}
//                         alt="mail"
//                       />
//                     </div>
//                     <div>
//                       <h2 className="font-semibold text-base sm:text-lg">
//                         Email Invitations
//                       </h2>
//                       <p className="text-xs sm:text-sm text-gray-500">
//                         Customize and send interview invitations
//                       </p>
//                     </div>
//                   </div>

//                   {!isGenerated && (
//                     <div className="mt-6 text-center w-full flex flex-col items-center justify-center">
//                       <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-[#F4F7FE]">
//                         <img
//                           className="w-8 h-8 sm:w-10 sm:h-10"
//                           src={Send_Invite}
//                           alt="send_invite"
//                         />
//                       </div>
//                       <p className="text-lg sm:text-xl font-medium tracking-tight mt-6 sm:mt-10">
//                         Ready To Send Invitations?
//                       </p>
//                       <p className="text-xs sm:text-[13px] text-gray-500 mt-1">
//                         Generate AI questions first to create email templates
//                       </p>
//                     </div>
//                   )}

//                   {isGenerated && (
//                     <div
//                       className="relative w-full mt-4"
//                       ref={candidateDropdownRef}
//                     >
//                       <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Candidate
//                         {selectedCandidates.length > 0 && (
//                           <span className="ml-2 text-xs text-indigo-600">
//                             {selectedCandidates.length} Selected
//                           </span>
//                         )}
//                       </label>

//                       {/* Candidate Dropdown Trigger */}
//                       <div
//                         className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-all"
//                         onClick={() => {
//                           setShowDropdown(!showDropdown);
//                           if (candidates.length === 0) {
//                             fetchCandidates();
//                           }
//                         }}
//                       >
//                         {selectedCandidates.length === 0 ? (
//                           <span className="text-gray-400 text-sm">
//                             Select Candidates to invite
//                           </span>
//                         ) : (
//                           <div className="flex flex-wrap gap-2">
//                             {selectedCandidates.map((c: any) => (
//                               <span
//                                 key={c._id}
//                                 className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md"
//                               >
//                                 {c.name}
//                                 <X
//                                   className="h-3 w-3 cursor-pointer hover:text-indigo-900"
//                                   onClick={(e) => {
//                                     e.stopPropagation();
//                                     setSelectedCandidates((prev) =>
//                                       prev.filter((item) => item._id !== c._id),
//                                     );
//                                   }}
//                                 />
//                               </span>
//                             ))}
//                           </div>
//                         )}
//                       </div>

//                       {/* Dropdown */}
//                       {showDropdown && (
//                         <>
//                           <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'}`}>
//                             {/* Search */}
//                             <div className={`p-2 border-b ${theme === 'dark' ? 'border-slate-600' : 'border-gray-200'}`}>
//                               <input
//                                 type="text"
//                                 placeholder="Search by name or role..."
//                                 value={searchTerm}
//                                 onChange={(e) => setSearchTerm(e.target.value)}
//                                 onClick={(e) => e.stopPropagation()}
//                                 className={`w-full px-3 py-2 text-sm border rounded-md outline-none ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'border-gray-300'}`}
//                               />
//                             </div>

//                             {/* List */}
//                             <div className="max-h-48 overflow-y-auto">
//                               {candidatesLoading ? (
//                                 <div className="flex items-center justify-center py-6">
//                                   <div className="flex items-center gap-2 text-indigo-600 text-sm">
//                                     <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
//                                     Loading candidates...
//                                   </div>
//                                 </div>
//                               ) : filteredCandidates.length === 0 ? (
//                                 <div className={`px-4 py-3 text-sm text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
//                                   No candidates found
//                                 </div>
//                               ) : (
//                                 filteredCandidates.map((candidate: any) => {
//                                   const isSelected = selectedCandidates.some(
//                                     (c) => c._id === candidate._id,
//                                   );

//                                   return (
//                                     <div
//                                       key={candidate._id}
//                                       className={`px-4 py-2 cursor-pointer transition-colors ${
//                                         isSelected
//                                           ? theme === 'dark'
//                                             ? "bg-indigo-900/40 hover:bg-indigo-900/60"
//                                             : "bg-indigo-50 hover:bg-indigo-100"
//                                           : theme === 'dark'
//                                             ? "hover:bg-slate-700"
//                                             : "hover:bg-gray-50"
//                                       }`}
//                                       onClick={(e) => {
//                                         e.stopPropagation();

//                                         if (isSelected) {
//                                           setSelectedCandidates((prev) =>
//                                             prev.filter(
//                                               (c) => c._id !== candidate._id,
//                                             ),
//                                           );
//                                         } else {
//                                           setSelectedCandidates((prev) => [
//                                             ...prev,
//                                             candidate,
//                                           ]);
//                                         }
//                                       }}
//                                     >
//                                       <div className="flex items-center justify-between">
//                                         <div>
//                                           <div className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
//                                             {candidate.name}
//                                             {candidate.role && (
//                                               <span className={`ml-1 text-xs font-normal ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`}>
//                                                 — {candidate.role}
//                                               </span>
//                                             )}
//                                           </div>
//                                           <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
//                                             {candidate.email}
//                                           </div>
//                                         </div>

//                                         {isSelected && (
//                                           <CheckCircle2 className="h-4 w-4 text-indigo-600" />
//                                         )}
//                                       </div>
//                                     </div>
//                                   );
//                                 })
//                               )}
//                             </div>
//                           </div>
//                         </>
//                       )}
//                       <div className="flex justify-end mt-3">
//                         <button
//                           onClick={() => setShowCandidateModal(true)}
//                           className="flex items-center gap-1.5 text-xs px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
//                         >
//                           + Add More Candidates
//                         </button>
//                       </div>
//                       <div className="w-full mt-4">
//                         <label className="block text-xs sm:text-sm text-gray-500 mb-1">
//                           Message Body
//                         </label>
//                         <textarea
//                           value={messageBody}
//                           onChange={(e) => setMessageBody(e.target.value)}
//                           className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm h-28"
//                         />
//                       </div>

//                       <div className="w-full mt-4 flex gap-4">
//                         {/* Start Date */}
//                         <div className="w-1/2">
//                           <label className="block text-xs sm:text-sm text-gray-600 mb-1">
//                             Start Date
//                           </label>

//                           <div className="relative">
//                             <input
//                               type="datetime-local"
//                               value={
//                                 startDate
//                                   ? startDate.toISOString().substring(0, 16)
//                                   : ""
//                               }
//                               min={new Date().toISOString().substring(0, 16)}
//                               onChange={(e) => {
//                                 const value = e.target.value;
//                                 const selected = value ? new Date(value) : null;
//                                 setStartDate(selected);

//                                 // Reset end date if invalid
//                                 if (endDate && selected && endDate < selected) {
//                                   setEndDate(null);
//                                 }
//                               }}
//                               className="calender w-full border border-gray-300 rounded-md px-4 py-2 text-sm outline-none"
//                             />

//                             <img
//                               src={Calender}
//                               alt="calendar"
//                               className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60 pointer-events-none"
//                             />
//                           </div>
//                         </div>

//                         {/* End Date */}
//                         <div className="w-1/2">
//                           <label className="block text-xs sm:text-sm text-gray-600 mb-1">
//                             End Date
//                           </label>

//                           <div className="relative">
//                             <input
//                               type="datetime-local"
//                               value={
//                                 endDate
//                                   ? endDate.toISOString().substring(0, 16)
//                                   : ""
//                               }
//                               min={
//                                 startDate
//                                   ? startDate.toISOString().substring(0, 16)
//                                   : new Date().toISOString().substring(0, 16)
//                               }
//                               onChange={(e) => {
//                                 const value = e.target.value;
//                                 setEndDate(value ? new Date(value) : null);
//                               }}
//                               className="calender w-full border border-gray-300 rounded-md px-4 py-2 text-sm outline-none"
//                             />

//                             <img
//                               src={Calender}
//                               alt="calendar"
//                               className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60 pointer-events-none"
//                             />
//                           </div>
//                         </div>
//                       </div>

//                       <div className="w-full mt-6 flex justify-end gap-2 flex-wrap">
//                         <button
//                           onClick={handleSendInvitations}
//                           disabled={loading}
//                           className="flex items-center gap-2 px-4 py-2 bg-[#4318FF] text-white rounded-md text-xs sm:text-sm"
//                         >
//                           <img src={SendEmail} alt="send" className="w-4 h-4" />
//                           {loading ? "Sending..." : "Send Invitations"}
//                         </button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </>
//           )}
//         </div>
//         {showCandidateModal && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
//             <div className={`w-full max-w-2xl rounded-xl shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
              
//               {/* HEADER */}
//               <div className={`flex items-center justify-between px-5 py-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
//                 <div>
//                   <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
//                     Add Candidates
//                   </h3>
//                   <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
//                     Select additional candidates for this assessment
//                   </p>
//                 </div>
//                 <button onClick={() => setShowCandidateModal(false)}>
//                   <X className={`h-5 w-5 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`} />
//                 </button>
//               </div>
 
//               {/* SEARCH */}
//               <div className={`p-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
//                 <input
//                   type="text"
//                   placeholder="Search by name or role..."
//                   value={candidateSearch}
//                   onChange={(e) => setCandidateSearch(e.target.value)}
//                   className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none ${
//                     theme === 'dark'
//                       ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
//                       : 'border-gray-200 text-gray-900'
//                   }`}
//                 />
//               </div>
 
//               {/* INFO BAR */}
//               <div className={`flex items-center justify-between px-4 py-2 border-b text-xs ${
//                 theme === 'dark'
//                   ? 'bg-slate-900 border-slate-700 text-slate-400'
//                   : 'bg-gray-50 border-gray-200 text-gray-500'
//               }`}>
//                 <span>{candidates.length} candidates available</span>
//                 {selectedCandidates.length > 0 && (
//                   <span className="text-indigo-500 font-medium">
//                     {selectedCandidates.length} selected
//                   </span>
//                 )}
//               </div>
 
//               {/* LIST */}
//               <div className="max-h-72 overflow-y-auto">
//                 {candidates
//                   .filter((c: any) =>
//                     `${c.name} ${c.role || ""} ${c.email}`
//                       .toLowerCase()
//                       .includes(candidateSearch.toLowerCase()),
//                   )
//                   .map((candidate: any) => {
//                     const isSelected = selectedCandidates.some(
//                       (c: any) => c._id === candidate._id,
//                     );
 
//                     return (
//                       <div
//                         key={candidate._id}
//                         onClick={() => toggleCandidateSelection(candidate)}
//                         className={`px-4 py-3 cursor-pointer transition ${
//                           isSelected
//                             ? theme === 'dark'
//                               ? 'bg-indigo-900/40 hover:bg-indigo-900/60 border-l-4 border-indigo-500'
//                               : 'bg-indigo-50 hover:bg-indigo-100 border-l-4 border-indigo-500'
//                             : theme === 'dark'
//                               ? 'hover:bg-slate-700'
//                               : 'hover:bg-gray-50'
//                         }`}
//                       >
//                         <div className="flex items-center justify-between gap-3">
//                           {/* LEFT */}
//                           <div className="flex-1 min-w-0">
//                             <div className="flex items-center gap-2 flex-wrap">
//                               <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
//                                 {candidate.name}
//                               </span>
//                               {candidate.role && (
//                                 <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`}>
//                                   — {candidate.role}
//                                 </span>
//                               )}
//                             </div>
//                             <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
//                               {candidate.email}
//                             </div>
//                           </div>
 
//                           {/* RIGHT */}
//                           {isSelected && (
//                             <CheckCircle2 className="h-5 w-5 text-indigo-500" />
//                           )}
//                         </div>
//                       </div>
//                     );
//                   })}
 
//                 {candidates.length === 0 && (
//                   <div className={`px-4 py-6 text-center text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`}>
//                     No candidates available
//                   </div>
//                 )}
//               </div>
 
//               {/* FOOTER */}
//               <div className={`flex justify-between items-center px-5 py-4 border-t ${
//                 theme === 'dark'
//                   ? 'border-slate-700 bg-slate-900'
//                   : 'border-gray-200 bg-gray-50'
//               }`}>
//                 <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
//                   Click on candidates to select/deselect
//                 </span>
//                 <div className="flex gap-3">
//                   <button
//                     onClick={() => setShowAddCandidateModal(true)}
//                     className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
//                   >
//                     + Add Candidate
//                   </button>
//                   <button
//                     onClick={() => setShowCandidateModal(false)}
//                     className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
//                   >
//                     Done
//                   </button>
//                 </div>
//               </div>
 
//             </div>
//           </div>
//         )}

//         {showAddCandidateModal && (
//           <AddCandidateModal
//             isOpen={showAddCandidateModal}
//             onClose={() => setShowAddCandidateModal(false)}
//             onAdd={() => {
//               setShowAddCandidateModal(false);
//             }}
//             onUpdate={() => {}}
//           />
//         )}
//       </AdminLayout>
//     </>
//   );
// }



import {
  useState,
  type DragEvent,
  type ChangeEvent,
  useEffect,
  useRef,
} from "react";
import toast from "react-hot-toast";
import { CheckCircle2, X } from "lucide-react";
import AdminLayout from "../../common/AdminLayout";
import AI from "../../assets/admin/AI_Power.png";
import Mail from "../../assets/admin/Mail_Icon.png";
import Upload from "../../assets/admin/Upload.png";
import Send_Invite from "../../assets/admin/send_Invite.png";
import SendEmail from "../../assets/admin/send.png";
import Calender from "../../assets/admin/calender.png";
import Bookmark from "../../assets/admin/assessment/bookmark.png";
import Edit from "../../assets/admin/assessment/edit1.png";
import ActiveInterviews from "../../components/admin/AI Interview/ActiveInterviews";
import { userPath } from "../../routes/EncryptRoute";
import { adminService } from "../../services/service/adminService";
import AddCandidateModal from "../../components/Candidates/AddCandidate";
import { useTheme } from "../../context/Themecontext";

export default function InterviewSetup() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [description, setDescription] = useState<string>("");
  const [secondaryJobDescription, setSecondaryJobDescription] =
    useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [skills, setSkills] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [duration, setDuration] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [loading, setLoading] = useState(false);
  const [_, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [__, setInterviewLink] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);

  // Candidate States
  const [candidates, setCandidates] = useState<any[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [activeTab, setActiveTab] = useState("setup");

  // edit
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [useTemplateMode, setUseTemplateMode] = useState(false);

  const [jdLoading, setJdLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [jdAnalysis, setJdAnalysis] = useState<any>(null);
  const [scoredCandidates, setScoredCandidates] = useState<any[]>([]);
  const [groqLoading, setGroqLoading] = useState(false);
  const [reDirect, setReDirect] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");

  const { theme } = useTheme();

  const handleFileDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile || !/\.(pdf|docx?|txt)$/i.test(droppedFile.name)) {
      toast.error("Invalid file type");
      return;
    }
    const fakeEvent = { target: { files: [droppedFile] } } as any;
    await handleFileChange(fakeEvent);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !/\.(pdf|docx?|txt)$/i.test(selectedFile.name)) {
      toast.error("Invalid file type");
      return;
    }

    setFileName(selectedFile.name);
    setFile(selectedFile);

    try {
      setJdLoading(true);
      const fd = new FormData();
      fd.append("jobDescription", selectedFile);

      const res = await adminService.analyzeJD(fd);
      const analysis = res.analysis;

      if (!analysis) return;
      setJdAnalysis(analysis);

      const difficultyLevel =
        mapExperienceToDifficulty(
          analysis?.experienceLevel,
          analysis?.experienceYears,
        ) || "";

      const autoQuestions = getDefaultQuestions(difficultyLevel);
      const autoDuration = getDefaultDuration(difficultyLevel);

      setPosition((prev) => prev || analysis?.jobTitle || "");
      setDescription(
        (prev) =>
          prev || analysis?.jobSummary || analysis?.fullJobDescription || "",
      );
      setDifficulty((prev) => prev || difficultyLevel);
      setNumberOfQuestions((prev) => prev || autoQuestions);
      setDuration((prev) => prev || autoDuration);
      setPassingScore((prev) => prev || "70");

      const combinedSkills = [
        ...(analysis?.requiredSkills || []),
        ...(analysis?.niceToHaveSkills || []),
      ];

      if (combinedSkills.length > 0) {
        setSkills((prev) => {
          const unique = new Set([...prev, ...combinedSkills]);
          return Array.from(unique);
        });
      }

      toast.success("JD analyzed & fields auto-filled ✅");
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to analyze JD");
    } finally {
      setJdLoading(false);
    }
  };

  const scoreCandidatesWithGroq = async (
    candidates: any[],
    jdAnalysis: any,
  ) => {
    if (!jdAnalysis || candidates.length === 0) return candidates;

    const extractKeywords = (skills: string[]) => {
      return skills.flatMap((skill) =>
        skill
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(" ")
          .filter((word) => word.length > 3),
      );
    };

    const requiredSkills = jdAnalysis.requiredSkills || [];
    const keywords = extractKeywords(requiredSkills);

    const filtered = candidates.filter((c: any) => {
      const candidateSkills = (
        c.skills ||
        c.key_Skills ||
        c.primarySkill ||
        c.secondarySkill ||
        ""
      )
        .toString()
        .toLowerCase();

      return keywords.some((word) => candidateSkills.includes(word));
    });

    return filtered.length > 0 ? filtered : candidates;
  };

  const toggleCandidateSelection = (candidate: any) => {
    const exists = selectedCandidates.some((c) => c._id === candidate._id);
    if (exists) {
      setSelectedCandidates((prev) =>
        prev.filter((c) => c._id !== candidate._id),
      );
    } else {
      setSelectedCandidates((prev) => [...prev, candidate]);
    }
  };

  useEffect(() => {
    if (!jdAnalysis) {
      setScoredCandidates(candidates);
      return;
    }
    const runAI = async () => {
      try {
        setGroqLoading(true);
        const filtered = await scoreCandidatesWithGroq(candidates, jdAnalysis);
        setScoredCandidates(filtered);
      } catch (error) {
        console.error("AI filtering error:", error);
        setScoredCandidates(candidates);
      } finally {
        setGroqLoading(false);
      }
    };
    runAI();
  }, [jdAnalysis, candidates]);

  const handleGenerateAndSendInvites = async () => {
    try {
      if (!file) {
        toast.error("Please upload job description file");
        return;
      }

      setLoading(true);

      const formData = new FormData();
      formData.append("jobDescription", file);
      formData.append("position", position);
      formData.append("description", description);
      formData.append("difficulty", difficulty);
      formData.append("duration", duration);
      formData.append("passingScore", passingScore);
      formData.append("secondaryJobDescription", secondaryJobDescription);
      formData.append("numberOfQuestions", numberOfQuestions);
      skills.forEach((skill) => {
        formData.append("skills", skill);
      });

      const response = await adminService.generateAIInterview(formData);
      setCreatedJobId(response.jobId);
      setIsGenerated(true);
      await fetchCandidates();
      setInterviewLink(
        `${import.meta.env.FRONTEND_URL || "http://localhost:5173"}${userPath("loginWithId", response.jobId)},`,
      );
      setSubject("Invitations to Complete Your AI Video Interview");
      setMessageBody(
        `Hi Dear ,\n\nYou have been invited to complete an AI-powered interview for the ${position} position.\n\nBest of luck!`,
      );
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDraft = async () => {
    try {
      if (!file) {
        toast.error("Please upload job description file");
        return;
      }

      setLoading(true);

      const formData = new FormData();
      formData.append("jobDescription", file);
      formData.append("position", position);
      formData.append("description", description);
      formData.append("difficulty", difficulty);
      formData.append("duration", duration);
      formData.append("passingScore", passingScore);
      formData.append("secondaryJobDescription", secondaryJobDescription);
      formData.append("numberOfQuestions", numberOfQuestions);
      skills.forEach((skill) => {
        formData.append("skills", skill);
      });

      const response = await adminService.generateAIInterview(formData);
      setCreatedJobId(response.jobId);
      setActiveTab("template");
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onNavigateToInterviewSetup = async (assessment: any) => {
    setActiveTab("setup");
    setUseTemplateMode(true);

    setInterviewLink(
      `${import.meta.env.FRONTEND_URL || "http://localhost:5173"}${userPath("loginWithId", assessment.jobId)}`,
    );

    try {
      setReDirect(true);
      const res = await adminService.getDraft(assessment._id);
      const data = res.data;

      setEditMode(false);
      setEditingId(null);
      setCreatedJobId(data._id);
      setPosition(data.position || "");
      setDescription(data.description || "");
      setPassingScore(data.passingScore || "");
      setNumberOfQuestions(data.numberOfQuestions || "");
      setSecondaryJobDescription(data.secondaryJobDescription || "");
      setDifficulty(data.difficulty || "");
      setDuration(data.duration || "");
      setSkills(data.skills || []);

      if (data.jobDescription) {
        setExistingFilePath(data.jobDescription);
        setFileName(data.jobDescription.split("/").pop());
      } else {
        setExistingFilePath(null);
        setFileName(null);
      }

      setIsGenerated(true);
      await fetchCandidates();

      setSubject("Invitations to Complete Your AI Video Interview");
      setMessageBody(
        `Hi Dear ,\n\nYou have been invited to complete an AI-powered interview for the ${data.position} position.\n\nBest of luck!`,
      );
    } catch (error) {
      console.error("Failed to load interview", error);
    } finally {
      setReDirect(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      setCandidatesLoading(true);
      const res: any = await adminService.getAllCandidate(1, 100, "all");
      const list = res.data || [];
      setCandidates(list);
      if (!jdAnalysis) setScoredCandidates(list);
    } catch (error) {
      console.error("Failed to fetch candidates", error);
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [showAddCandidateModal]);

  useEffect(() => {
    const base = scoredCandidates.length > 0 ? scoredCandidates : candidates;
    if (!searchTerm.trim()) {
      setFilteredCandidates(base);
      return;
    }
    const filtered = base.filter((c: any) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredCandidates(filtered);
  }, [searchTerm, scoredCandidates, candidates]);

  const handleSendInvitations = async () => {
    try {
      setLoading(true);

      if (!createdJobId) return toast.error("Create interview first");
      if (!selectedCandidates.length) return toast.error("Select candidates");
      if (!startDate || !endDate) return toast.error("Select dates");

      const payload = {
        jobId: createdJobId,
        candidateIds: selectedCandidates.map((c) => c._id),
        messageBody,
        startDate,
        endDate,
        testTitle: position,
      };

      const res = await adminService.sendInvitations(payload);

      const invited = res.invitedEmails || [];
      const skipped = res.skippedEmails || [];

      if (res.isPartial && invited.length === 0) {
        toast.error(`All candidates already invited: ${skipped.join(", ")}`);
        return;
      }

      if (res.isPartial) {
        if (invited.length > 0) toast.success(`Invited: ${invited.join(", ")}`);
        if (skipped.length > 0) {
          setTimeout(() => {
            toast.error(`Skipped (already invited): ${skipped.join(", ")}`);
          }, 300);
        }
      } else {
        toast.success(`Invitations sent to ${invited.length} candidate(s)`);
      }

      setSelectedCandidates([]);
      setActiveTab("template");
    } catch (error: any) {
      toast.error(error?.res?.message || "Failed to send invitations");
    } finally {
      setLoading(false);
    }
  };

  const candidateDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        candidateDropdownRef.current &&
        !candidateDropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ FIXED: handleUpdateInterview — does NOT send jobDescription as empty object
  const handleUpdateInterview = async () => {
    if (!editingId) return;

    try {
      setLoading(true);

      const formData = new FormData();

      // ✅ Only append file if a NEW file was selected by the user
      if (file instanceof File) {
        formData.append("jobDescription", file);
      }
      // ✅ If no new file but existing path exists, send it as a plain string
      // so backend knows to keep it (backend ignores this field for DB update,
      // it's just a signal — real preservation happens by NOT touching jobDescription)
      else if (existingFilePath) {
        formData.append("existingJobDescription", existingFilePath);
      }

      formData.append("position", position.trim());
      formData.append("description", description.trim());
      formData.append("difficulty", difficulty);
      formData.append("duration", duration);
      formData.append("passingScore", String(Number(passingScore)));
      formData.append("secondaryJobDescription", secondaryJobDescription);
      formData.append("numberOfQuestions", String(Number(numberOfQuestions)));

      // ✅ Only append flat string skills
      skills.forEach((skill) => {
        if (typeof skill === "string") {
          formData.append("skills", skill);
        }
      });

      await adminService.updateAITemplate(editingId, formData);
      toast.success("Interview updated successfully ✅");

      // Reset everything
      setEditMode(false);
      setEditingId(null);
      setCreatedJobId(null);
      setFile(null);
      setFileName(null);
      setExistingFilePath(null);
      setPosition("");
      setDescription("");
      setPassingScore("");
      setNumberOfQuestions("");
      setDifficulty("");
      setDuration("");
      setSecondaryJobDescription("");
      setSkills([]);
      setIsGenerated(false);

      setActiveTab("template");
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAssessment = async (assessment: any) => {
    setActiveTab("setup");
    setUseTemplateMode(false);

    try {
      setEditLoading(true);
      const res = await adminService.getDraft(assessment._id);
      const data = res.data;

      setEditingId(data._id);
      setEditMode(true);
      setIsGenerated(false);
      setSecondaryJobDescription(data.secondaryJobDescription || "");
      setPosition(data.position || "");
      setDescription(data.description || "");
      setPassingScore(data.passingScore || "");
      setNumberOfQuestions(data.numberOfQuestions || "");
      setDifficulty(data.difficulty || "");
      setDuration(data.duration || "");
      setSkills(data.skills || []);

      // ✅ Store existing file path so update handler can reference it
      if (data.jobDescription) {
        setExistingFilePath(data.jobDescription);
        setFileName(data.jobDescription.split("/").pop());
      } else {
        setExistingFilePath(null);
        setFileName(null);
      }
    } catch (error) {
      console.error("Failed to load interview", error);
    } finally {
      setEditLoading(false);
    }
  };

  // ================= AI AUTO FILL HELPERS =================

  const mapExperienceToDifficulty = (level?: string, years?: string) => {
    if (!level && !years) return "";
    const lvl = level?.toLowerCase();
    if (lvl?.includes("entry") || lvl?.includes("junior")) return "Easy";
    if (lvl?.includes("mid")) return "Medium";
    if (lvl?.includes("senior") || lvl?.includes("lead")) return "Hard";
    const y = Number(years);
    if (!isNaN(y)) {
      if (y <= 1) return "Easy";
      if (y <= 4) return "Medium";
      return "Hard";
    }
    return "";
  };

  const getDefaultQuestions = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "10";
      case "Medium": return "15";
      case "Hard": return "20";
      default: return "";
    }
  };

  const getDefaultDuration = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "15 minutes";
      case "Medium": return "30 minutes";
      case "Hard": return "60 minutes";
      default: return "";
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileName(null);
    setExistingFilePath(null);
    setJdAnalysis(null);
    setPosition("");
    setDescription("");
    setSecondaryJobDescription("");
    setSkills([]);
    setInputValue("");
    setDuration("");
    setPassingScore("");
    setNumberOfQuestions("");
    setDifficulty("");
    setSubject("");
    setMessageBody("");
    setInterviewLink("");
    setStartDate(null);
    setEndDate(null);
    setSelectedCandidates([]);
    setScoredCandidates([]);
    setCandidates([]);
    setIsGenerated(false);
    setCreatedJobId(null);
    setEditMode(false);
    setEditingId(null);
    setUseTemplateMode(false);
    setShowDropdown(false);
    setSearchTerm("");
  };

  return (
    <>
      <AdminLayout
        heading="AI Video Interview"
        subheading="AI-powered video interviews"
        showSearch={false}
      >
        {/* Full-page loader overlay */}
        {(loading || jdLoading || editLoading || reDirect || groqLoading) && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
              <div className="absolute h-13 w-13 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-medium text-indigo-700">
              {jdLoading
                ? "Analyzing Job Description..."
                : groqLoading
                  ? "AI is ranking candidates by JD match..."
                  : editLoading
                    ? "Updating interview details..."
                    : reDirect
                      ? "Redirecting to interview page..."
                      : "Please wait..."}
            </p>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-[#4318FF] rounded-full animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Please wait...</p>
            </div>
          </div>
        )}

        <div className="min-h-screen">
          {/* Tabs */}
          <div className="flex items-center justify-between mb-6">
            <div className={`inline-flex rounded-lg p-2 ${theme === "dark" ? "bg-slate-900 border border-slate-700" : "bg-white"}`}>
              <button
                onClick={() => setActiveTab("setup")}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "setup"
                    ? theme === "dark"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-[#F4F7FE] text-gray-900 shadow-sm"
                    : theme === "dark"
                      ? "text-slate-300 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Interview Setup
              </button>
              <button
                onClick={() => setActiveTab("template")}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "template"
                    ? theme === "dark"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-[#F4F7FE] text-gray-900 shadow-sm"
                    : theme === "dark"
                      ? "text-slate-300 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
              >
                AI Interview Template
              </button>
            </div>
          </div>

          {activeTab === "template" && (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
              <ActiveInterviews
                onEditInterview={handleEditAssessment}
                onNavigateToInterviewSetup={onNavigateToInterviewSetup}
              />
            </div>
          )}

          {activeTab === "setup" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
                {/* Left: AI Generator */}
                <div
                  className={`bg-white p-4 sm:p-6 rounded-xl shadow-sm relative ${
                    useTemplateMode ? "opacity-90 pointer-events-none" : ""
                  }`}
                >
                  <div className="flex items-center mb-4">
                    <div className="p-2 rounded-lg">
                      <img className="w-10 h-10 sm:w-12 sm:h-12" src={AI} alt="ai" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-base sm:text-lg">
                        AI - Powered Interview Generator
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Upload job description to generate intelligent questions
                      </p>
                    </div>
                  </div>

                  {/* Upload zone */}
                  {!fileName && !existingFilePath && (
                    <div
                      onDrop={handleFileDrop}
                      onDragOver={handleDragOver}
                      className="relative flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center transition-all duration-200 hover:border-indigo-400 hover:bg-indigo-50/30"
                    >
                      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-100">
                        <img src={Upload} alt="upload" className="w-6 h-6 opacity-80" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Drag & drop your job description here
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Supports PDF, DOC, DOCX, TXT (Max 5MB)
                        </p>
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 transition">
                        Browse Files
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  )}

                  {/* File Preview */}
                  {(fileName || existingFilePath) && (
                    <div className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 font-semibold text-sm">
                          📄
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {fileName || existingFilePath?.split("/").pop()}
                          </span>
                          <span className="text-xs text-gray-400">Job Description File</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="text-sm font-medium text-red-500 hover:text-red-600 transition"
                      >
                        <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                  )}

                  <h3 className="text-gray-800 pb-2 text-xs sm:text-sm mt-4">Position</h3>
                  <input
                    type="text"
                    className="w-full p-2 mb-3 border border-gray-300 rounded-lg outline-none text-xs sm:text-sm"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />

                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-md text-xs sm:text-sm resize-none outline-none"
                    rows={4}
                    placeholder="Paste your job descriptions here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />

                  <div className="w-full flex items-center justify-between gap-5">
                    <div className="w-full md:w-1/2">
                      <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">Passing Score</h3>
                      <input
                        type="text"
                        placeholder="e.g. 70%"
                        className="w-full p-2 mb-3 border border-gray-300 rounded-lg outline-none text-xs sm:text-sm"
                        value={passingScore}
                        onChange={(e) => setPassingScore(e.target.value)}
                      />
                    </div>
                    <div className="w-full md:w-1/2">
                      <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">Number of Questions</h3>
                      <input
                        type="text"
                        placeholder="e.g. 10"
                        className="w-full p-2 mb-3 border border-gray-300 rounded-lg outline-none text-xs sm:text-sm"
                        value={numberOfQuestions}
                        onChange={(e) => setNumberOfQuestions(e.target.value)}
                      />
                    </div>
                  </div>

                  <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">Skills</h3>
                  <div className="w-full p-2 mb-3 border border-gray-300 rounded-lg flex flex-wrap gap-2 items-center">
                    {skills.map((skill, index) => (
                      <div
                        key={index}
                        className="flex items-center bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs sm:text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() =>
                            setSkills(skills.filter((_, i) => i !== index))
                          }
                          className="ml-2 text-indigo-500 hover:text-indigo-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "," || e.key === "Enter") {
                          e.preventDefault();
                          const newSkill = inputValue.trim().replace(",", "");
                          if (newSkill && !skills.includes(newSkill)) {
                            setSkills([...skills, newSkill]);
                          }
                          setInputValue("");
                        }
                        if (e.key === "Backspace" && !inputValue) {
                          setSkills((prev) => prev.slice(0, -1));
                        }
                      }}
                      className="flex-1 min-w-[120px] outline-none text-xs sm:text-sm"
                      placeholder="Type skill and press comma..."
                    />
                  </div>

                  <div className="mt-4 flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-1/2">
                      <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">Interview Durations</h3>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full border border-gray-300 outline-none p-2 rounded-md text-xs sm:text-sm text-gray-700"
                      >
                        <option value="">Select Duration</option>
                        <option value="15 minutes">15 minutes</option>
                        <option value="30 minutes">30 minutes</option>
                        <option value="60 minutes">60 minutes</option>
                      </select>
                    </div>
                    <div className="w-full md:w-1/2">
                      <h3 className="text-gray-800 pb-2 text-xs sm:text-sm">Difficulty Level</h3>
                      <select
                        className="w-full border border-gray-300 outline-none p-2 rounded-md text-xs sm:text-sm text-gray-700"
                        onChange={(e) => setDifficulty(e.target.value)}
                        value={difficulty}
                      >
                        <option>Select Level</option>
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    {/* EDIT MODE */}
                    {editMode && (
                      <button
                        onClick={handleUpdateInterview}
                        disabled={loading}
                        className="w-full bg-[#4318FF] text-white text-sm py-3 rounded-md hover:bg-[#3214cc] transition disabled:opacity-50"
                      >
                        {loading ? "Updating..." : "Update Interview"}
                      </button>
                    )}

                    {/* CREATE MODE */}
                    {!editMode && !isGenerated && !useTemplateMode && (
                      <div className="flex justify-end gap-4">
                        <button
                          onClick={handleDraft}
                          disabled={loading}
                          className="flex items-center justify-center gap-2 rounded-lg bg-white text-[#4318FFE5] border border-[#4318FFE5] px-4 py-2 hover:bg-indigo-50 transition disabled:opacity-50"
                        >
                          <img src={Bookmark} alt="" className="w-5 h-5" />
                          <span className="text-sm">
                            {loading ? "Saving..." : "Generate & Save as template"}
                          </span>
                        </button>
                        <button
                          onClick={handleGenerateAndSendInvites}
                          disabled={loading}
                          className="flex items-center justify-center gap-2 bg-[#4318FF] px-4 py-2 rounded-lg hover:bg-[#3214cc] transition disabled:opacity-50"
                        >
                          <img src={Edit} alt="" className="w-5 h-5" />
                          <span className="text-white text-sm">
                            {loading ? "Generating..." : "Generate & Send Invites"}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* GENERATED MODE */}
                    {!editMode && isGenerated && (
                      <button
                        className="w-full bg-[#2AAC7E] text-white text-sm py-3 rounded-md flex items-center justify-center gap-2 hover:bg-[#23996d] transition"
                        onClick={() => setIsGenerated(false)}
                      >
                        <img src={Edit} alt="edit" className="w-5 h-5" />
                        <span>Regenerate AI Interview</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: Email Invitations */}
                <div className="bg-white h-fit p-4 sm:p-6 rounded-xl flex flex-col items-start justify-start relative">
                  <div className="flex items-center w-full mb-4">
                    <div className="p-2 rounded-lg">
                      <img className="w-10 h-10 sm:w-12 sm:h-12" src={Mail} alt="mail" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-base sm:text-lg">Email Invitations</h2>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Customize and send interview invitations
                      </p>
                    </div>
                  </div>

                  {!isGenerated && (
                    <div className="mt-6 text-center w-full flex flex-col items-center justify-center">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-[#F4F7FE]">
                        <img className="w-8 h-8 sm:w-10 sm:h-10" src={Send_Invite} alt="send_invite" />
                      </div>
                      <p className="text-lg sm:text-xl font-medium tracking-tight mt-6 sm:mt-10">
                        Ready To Send Invitations?
                      </p>
                      <p className="text-xs sm:text-[13px] text-gray-500 mt-1">
                        Generate AI questions first to create email templates
                      </p>
                    </div>
                  )}

                  {isGenerated && (
                    <div className="relative w-full mt-4" ref={candidateDropdownRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Candidate
                        {selectedCandidates.length > 0 && (
                          <span className="ml-2 text-xs text-indigo-600">
                            {selectedCandidates.length} Selected
                          </span>
                        )}
                      </label>

                      {/* Candidate Dropdown Trigger */}
                      <div
                        className="w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-all"
                        onClick={() => {
                          setShowDropdown(!showDropdown);
                          if (candidates.length === 0) fetchCandidates();
                        }}
                      >
                        {selectedCandidates.length === 0 ? (
                          <span className="text-gray-400 text-sm">
                            Select Candidates to invite
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedCandidates.map((c: any) => (
                              <span
                                key={c._id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md"
                              >
                                {c.name}
                                <X
                                  className="h-3 w-3 cursor-pointer hover:text-indigo-900"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCandidates((prev) =>
                                      prev.filter((item) => item._id !== c._id),
                                    );
                                  }}
                                />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dropdown */}
                      {showDropdown && (
                        <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-hidden ${theme === "dark" ? "bg-slate-800 border-slate-600" : "bg-white border-gray-300"}`}>
                          <div className={`p-2 border-b ${theme === "dark" ? "border-slate-600" : "border-gray-200"}`}>
                            <input
                              type="text"
                              placeholder="Search by name or role..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={`w-full px-3 py-2 text-sm border rounded-md outline-none ${theme === "dark" ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400" : "border-gray-300"}`}
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {candidatesLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <div className="flex items-center gap-2 text-indigo-600 text-sm">
                                  <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                  Loading candidates...
                                </div>
                              </div>
                            ) : filteredCandidates.length === 0 ? (
                              <div className={`px-4 py-3 text-sm text-center ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                                No candidates found
                              </div>
                            ) : (
                              filteredCandidates.map((candidate: any) => {
                                const isSelected = selectedCandidates.some(
                                  (c) => c._id === candidate._id,
                                );
                                return (
                                  <div
                                    key={candidate._id}
                                    className={`px-4 py-2 cursor-pointer transition-colors ${
                                      isSelected
                                        ? theme === "dark"
                                          ? "bg-indigo-900/40 hover:bg-indigo-900/60"
                                          : "bg-indigo-50 hover:bg-indigo-100"
                                        : theme === "dark"
                                          ? "hover:bg-slate-700"
                                          : "hover:bg-gray-50"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        setSelectedCandidates((prev) =>
                                          prev.filter((c) => c._id !== candidate._id),
                                        );
                                      } else {
                                        setSelectedCandidates((prev) => [
                                          ...prev,
                                          candidate,
                                        ]);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className={`text-sm font-medium ${theme === "dark" ? "text-slate-100" : "text-gray-900"}`}>
                                          {candidate.name}
                                          {candidate.role && (
                                            <span className={`ml-1 text-xs font-normal ${theme === "dark" ? "text-slate-400" : "text-gray-400"}`}>
                                              — {candidate.role}
                                            </span>
                                          )}
                                        </div>
                                        <div className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                                          {candidate.email}
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => setShowCandidateModal(true)}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                        >
                          + Add More Candidates
                        </button>
                      </div>

                      <div className="w-full mt-4">
                        <label className="block text-xs sm:text-sm text-gray-500 mb-1">
                          Message Body
                        </label>
                        <textarea
                          value={messageBody}
                          onChange={(e) => setMessageBody(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm h-28"
                        />
                      </div>

                      <div className="w-full mt-4 flex gap-4">
                        {/* Start Date */}
                        <div className="w-1/2">
                          <label className="block text-xs sm:text-sm text-gray-600 mb-1">
                            Start Date
                          </label>
                          <div className="relative">
                            <input
                              type="datetime-local"
                              value={startDate ? startDate.toISOString().substring(0, 16) : ""}
                              min={new Date().toISOString().substring(0, 16)}
                              onChange={(e) => {
                                const value = e.target.value;
                                const selected = value ? new Date(value) : null;
                                setStartDate(selected);
                                if (endDate && selected && endDate < selected) {
                                  setEndDate(null);
                                }
                              }}
                              className="calender w-full border border-gray-300 rounded-md px-4 py-2 text-sm outline-none"
                            />
                            <img
                              src={Calender}
                              alt="calendar"
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60 pointer-events-none"
                            />
                          </div>
                        </div>

                        {/* End Date */}
                        <div className="w-1/2">
                          <label className="block text-xs sm:text-sm text-gray-600 mb-1">
                            End Date
                          </label>
                          <div className="relative">
                            <input
                              type="datetime-local"
                              value={endDate ? endDate.toISOString().substring(0, 16) : ""}
                              min={
                                startDate
                                  ? startDate.toISOString().substring(0, 16)
                                  : new Date().toISOString().substring(0, 16)
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setEndDate(value ? new Date(value) : null);
                              }}
                              className="calender w-full border border-gray-300 rounded-md px-4 py-2 text-sm outline-none"
                            />
                            <img
                              src={Calender}
                              alt="calendar"
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60 pointer-events-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="w-full mt-6 flex justify-end gap-2 flex-wrap">
                        <button
                          onClick={handleSendInvitations}
                          disabled={loading}
                          className="flex items-center gap-2 px-4 py-2 bg-[#4318FF] text-white rounded-md text-xs sm:text-sm"
                        >
                          <img src={SendEmail} alt="send" className="w-4 h-4" />
                          {loading ? "Sending..." : "Send Invitations"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add Candidates Modal */}
        {showCandidateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className={`w-full max-w-2xl rounded-xl shadow-xl overflow-hidden ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}>
              {/* HEADER */}
              <div className={`flex items-center justify-between px-5 py-4 border-b ${theme === "dark" ? "border-slate-700" : "border-gray-200"}`}>
                <div>
                  <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    Add Candidates
                  </h3>
                  <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                    Select additional candidates for this assessment
                  </p>
                </div>
                <button onClick={() => setShowCandidateModal(false)}>
                  <X className={`h-5 w-5 ${theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-700"}`} />
                </button>
              </div>

              {/* SEARCH */}
              <div className={`p-3 border-b ${theme === "dark" ? "border-slate-700" : "border-gray-200"}`}>
                <input
                  type="text"
                  placeholder="Search by name or role..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none ${
                    theme === "dark"
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      : "border-gray-200 text-gray-900"
                  }`}
                />
              </div>

              {/* INFO BAR */}
              <div className={`flex items-center justify-between px-4 py-2 border-b text-xs ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-700 text-slate-400"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
                <span>{candidates.length} candidates available</span>
                {selectedCandidates.length > 0 && (
                  <span className="text-indigo-500 font-medium">
                    {selectedCandidates.length} selected
                  </span>
                )}
              </div>

              {/* LIST */}
              <div className="max-h-72 overflow-y-auto">
                {candidates
                  .filter((c: any) =>
                    `${c.name} ${c.role || ""} ${c.email}`
                      .toLowerCase()
                      .includes(candidateSearch.toLowerCase()),
                  )
                  .map((candidate: any) => {
                    const isSelected = selectedCandidates.some(
                      (c: any) => c._id === candidate._id,
                    );
                    return (
                      <div
                        key={candidate._id}
                        onClick={() => toggleCandidateSelection(candidate)}
                        className={`px-4 py-3 cursor-pointer transition ${
                          isSelected
                            ? theme === "dark"
                              ? "bg-indigo-900/40 hover:bg-indigo-900/60 border-l-4 border-indigo-500"
                              : "bg-indigo-50 hover:bg-indigo-100 border-l-4 border-indigo-500"
                            : theme === "dark"
                              ? "hover:bg-slate-700"
                              : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${theme === "dark" ? "text-slate-100" : "text-gray-900"}`}>
                                {candidate.name}
                              </span>
                              {candidate.role && (
                                <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-400"}`}>
                                  — {candidate.role}
                                </span>
                              )}
                            </div>
                            <div className={`text-xs mt-0.5 ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                              {candidate.email}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                {candidates.length === 0 && (
                  <div className={`px-4 py-6 text-center text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-400"}`}>
                    No candidates available
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className={`flex justify-between items-center px-5 py-4 border-t ${
                theme === "dark"
                  ? "border-slate-700 bg-slate-900"
                  : "border-gray-200 bg-gray-50"
              }`}>
                <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                  Click on candidates to select/deselect
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddCandidateModal(true)}
                    className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    + Add Candidate
                  </button>
                  <button
                    onClick={() => setShowCandidateModal(false)}
                    className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddCandidateModal && (
          <AddCandidateModal
            isOpen={showAddCandidateModal}
            onClose={() => setShowAddCandidateModal(false)}
            onAdd={() => setShowAddCandidateModal(false)}
            onUpdate={() => {}}
          />
        )}
      </AdminLayout>
    </>
  );
}