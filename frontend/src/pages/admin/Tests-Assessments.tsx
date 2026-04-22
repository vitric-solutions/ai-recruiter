import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../common/AdminLayout";
import {
  FileText,
  Clock,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
  Star,
} from "lucide-react";
import { useTheme } from "../../context/Themecontext";
import { adminService } from "../../services/service/adminService";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import ViewAssignedCandidate from "../../components/admin/TestAssessgnment/ViewAssignedCandidate";
import AddCandidateModal from "../../components/Candidates/AddCandidate";

const EMPTY_FORM = {
  candidates: [],
  startDate: "",
  endDate: "",
  testTitle: "",
  noOfQuestions: "",
  primarySkill: "",
  passingScore: "",
  secondarySkill: "",
  examLevel: "",
  duration: "",
  jobDescription: "",
  secondry_jobDescription: "",
  jobDescriptionText: "",
};

// ─── Groq candidate scorer ────────────────────────────────────────────────────
const scoreCandidatesWithGroq = async (
  candidates: any[],
  jdAnalysis: any,
): Promise<any[]> => {
  if (
    !import.meta.env.VITE_GROQ_API_KEY ||
    !jdAnalysis ||
    candidates.length === 0
  )
    return candidates;

  const jobTitle = jdAnalysis.jobTitle || "";
  const requiredSkills: string[] = jdAnalysis.requiredSkills || [];
  const niceToHaveSkills: string[] = jdAnalysis.niceToHaveSkills || [];

  const candidateSummaries = candidates.map((c, i) => ({
    index: i,
    name: c.name,
    role: c.role || c.jobTitle || c.designation || "",
    experience:
      c.experience ||
      c.experienceYears ||
      c.yearsOfExperience ||
      c.year_of_experience ||
      "",
    skills: Array.isArray(c.skills)
      ? c.skills.join(", ")
      : Array.isArray(c.key_Skills)
        ? c.key_Skills.join(", ")
        : c.skills || c.key_Skills || c.primarySkill || c.secondarySkill || "",
    email: c.email,
  }));

  const prompt = `You are a technical recruiter AI.

Score candidates based primarily on **skill match** with the required skills.

SCORING RULE:
- 80–100 → Strong Match (most required skills present)
- 60–79 → Good Match
- 40–59 → Partial Match
- 0–39 → Low Match

JOB DESCRIPTION:
- Job Title: ${jobTitle}
- Required Skills: ${requiredSkills.join(", ")}
- Nice-to-have Skills: ${niceToHaveSkills.join(", ")}

CANDIDATES:
${JSON.stringify(candidateSummaries, null, 2)}

Return JSON array with:
- index
- matchScore
- matchLabel
- matchReason

IMPORTANT:
Return ONLY JSON array.`;
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      },
    );
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "[]";
    const clean = raw.replace(/```json|```/g, "").trim();
    const scores: any[] = JSON.parse(clean);

    return candidates
      .map((c, i) => {
        const scored = scores.find((s) => s.index === i);
        return scored
          ? {
              ...c,
              matchScore: scored.matchScore,
              matchLabel: scored.matchLabel,
              matchReason: scored.matchReason,
            }
          : { ...c, matchScore: 0, matchLabel: "Low Match", matchReason: "" };
      })
      .filter((c) => c.matchScore >= 50);
  } catch (err) {
    console.error("Groq scoring error:", err);
    return candidates;
  }
};

// ─── Match label badge styles ─────────────────────────────────────────────────
const matchStyles: Record<string, { badge: string; card: string }> = {
  "Strong Match": {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    card: "border-l-4 border-l-emerald-500 bg-emerald-50",
  },
  "Good Match": {
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    card: "border-l-4 border-l-indigo-500 bg-indigo-50",
  },
  "Partial Match": {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    card: "border-l-4 border-l-amber-400 bg-amber-50",
  },
  "Low Match": {
    badge: "bg-gray-100 text-gray-500 border-gray-200",
    card: "",
  },
};

type FormErrors = {
  candidates?: string;
  startDate?: string;
  endDate?: string;
  testTitle?: string;
  noOfQuestions?: string;
  primarySkill?: string;
  passingScore?: string;
  examLevel?: string;
  duration?: string;
  jobDescription?: string;
  jobDescriptionText?: string;
  secondarySkill?: string;
};
type SubmitStatus = {
  type: "success" | "error";
  message: string;
} | null;
type Candidate = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  skills?: string[] | string;
  key_Skills?: string[] | string;
  primarySkill?: string;
  secondarySkill?: string;
  matchScore?: number;
  matchLabel?: string;
  matchReason?: string;
};
type JDAnalysis = {
  jobTitle?: string;
  requiredSkills?: string[];
  niceToHaveSkills?: string[];
  experienceLevel?: string;
  experienceYears?: string;
  fullJobDescription?: string;
  primarySkill?: string;
  secondarySkill?: string;
  jobDescription?: string;
};
type FormDataType = {
  candidates: Candidate[];
  startDate: string;
  endDate: string;
  testTitle: string;
  noOfQuestions: string;
  primarySkill: string;
  passingScore: string;
  secondarySkill: string;
  examLevel: string;
  duration: string;
  jobDescription: File | string | null;
  secondry_jobDescription: string;
  jobDescriptionText: string;
};

const TestsAssessments = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("create");
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState("Dashboard");
  const [formData, setFormData] = useState<FormDataType>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [candidatesList, setCandidatesList] = useState([]);
  const [scoredCandidates, setScoredCandidates] = useState<any[]>([]);
  const [groqLoading, setGroqLoading] = useState(false);
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null);
  const [mode, setMode] = useState("create");
  const [id, setActiveAssessmentId] = useState<string | null>(null);
  const [assessments, setAssessments] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [jdLoading, setJdLoading] = useState(false);
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null);
  const [, setJdError] = useState(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [reDirect, setReDirect] = useState(false);
  console.log("selectedAssessment", assessments);

  const candidateDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      if (
        candidateDropdownRef.current &&
        !candidateDropdownRef.current.contains(e.target)
      )
        setShowCandidateDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [showAddCandidateModal]);

  useEffect(() => {
    if (activeTab === "templates") fetchAssessments();
  }, [activeTab]);

  useEffect(() => {
    if (jdAnalysis && candidatesList.length > 0) {
      runGroqScoring(candidatesList, jdAnalysis);
    } else {
      setScoredCandidates(candidatesList);
    }
  }, [jdAnalysis, candidatesList]);

  useAdminSocket({
    "interview-submitted": () => {
      fetchAssessments();
    },
  });

  // const aiCandidates = scoredCandidates || [];
  // const manualCandidates = candidatesList.filter(
  //   (c: any) => !aiCandidates.some((ai: any) => ai._id === c._id),
  // );
  // const filteredCandidates = manualCandidates.filter((c: any) =>
  //   `${c.name} ${c.role || ""} ${c.email}`
  //     .toLowerCase()
  //     .includes(candidateSearch.toLowerCase()),
  // );

  const runGroqScoring = async (candidates: any[], analysis: any) => {
    setGroqLoading(true);
    try {
      const extractKeywords = (skills: string[]) =>
        skills.flatMap((skill) =>
          skill
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(" ")
            .filter((word) => word.length > 3),
        );
      const requiredSkills = analysis?.requiredSkills || [];
      const keywords = extractKeywords(requiredSkills);
      const filtered = candidates.filter((c) => {
        const candidateSkills = (
          c.skills ||
          c.key_Skills ||
          c.primarySkill ||
          ""
        ).toLowerCase();
        return keywords.some((word) => candidateSkills.includes(word));
      });
      const baseCandidates = filtered.length > 0 ? filtered : candidates;
      const scored = await scoreCandidatesWithGroq(baseCandidates, analysis);
      const sorted = [...scored].sort(
        (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0),
      );
      setScoredCandidates(sorted);
    } catch (err) {
      console.error("Groq scoring failed:", err);
      setScoredCandidates(candidates);
    } finally {
      setGroqLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await adminService.getAllCandidate(1, 100, "all");
      const list = response.data?.data || response.data || [];
      setCandidatesList(list);
      setScoredCandidates(list);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const fetchAssessments = async (id?: any) => {
    setTemplatesLoading(true);
    try {
      const response = await adminService.getAssesments(id);
      console.log("response", response);
      setAssessments(response.data?.data || response.data || []);
    } catch (err) {
      console.error("Error fetching assessments:", err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleUseTemplate = (item: any) => {
    const toLocalDatetime = (input: any) => {
      if (!input) return "";
      const d = new Date(input);
      if (isNaN(d.getTime())) return "";
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormData({
      ...EMPTY_FORM,
      testTitle: item.test_title,
      noOfQuestions: String(item.no_of_questions),
      primarySkill: item.primary_skill,
      passingScore: item.passing_score,
      secondarySkill: item.secondary_skill || "",
      examLevel: item.difficulty,
      duration: item.duration,
      jobDescription: item.jobDescription || "",
      jobDescriptionText: item.jobDescriptionText || "",
      startDate: item.start_date
        ? toLocalDatetime(item.start_date)
        : toLocalDatetime(today),
      endDate: item.end_date
        ? toLocalDatetime(item.end_date)
        : toLocalDatetime(tomorrow),
    });
    setActiveAssessmentId(item._id);
    setMode("prefill");
    setErrors({});
    setActiveTab("create");
    setCurrentStep(3);
  };

  const handleEditTemplate = async (item: any) => {
    setEditLoading(item._id);
    setReDirect(true);
    try {
      const res = await adminService.getAssesments(item._id);
      const data = Array.isArray(res.data)
        ? res.data.find((item: any) => item._id === item._id)
        : res.data || res;
      if (!data) {
        showToast("error", "Assessment data not found");
        return;
      }
      const toLocalDatetime = (input: any) => {
        if (!input) return "";
        const d = new Date(input);
        if (isNaN(d.getTime())) return "";
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      };
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFormData({
        ...EMPTY_FORM,
        testTitle: data.test_title || "",
        noOfQuestions: String(data.no_of_questions || ""),
        primarySkill: data.primary_skill || "",
        passingScore: data.passing_score || "",
        secondarySkill: data.secondary_skill || "",
        examLevel: data.difficulty || "",
        duration: data.duration || "",
        jobDescriptionText: data.jobDescriptionText || "",
        jobDescription: data.jobDescription || "",
        startDate: data.start_date
          ? toLocalDatetime(data.start_date)
          : toLocalDatetime(today),
        endDate: data.end_date
          ? toLocalDatetime(data.end_date)
          : toLocalDatetime(tomorrow),
      });
      setActiveAssessmentId(data._id);
      setMode("edit");
      setErrors({});
      setActiveTab("create");
      setCurrentStep(1);
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to load assessment for editing");
    } finally {
      setEditLoading(null);
      setReDirect(false);
    }
  };

  const handleResetMode = () => {
    setFormData(EMPTY_FORM);
    setMode("create");
    setActiveAssessmentId(null);
    setErrors({});
    setJdAnalysis(null);
    setJdError(null);
    setScoredCandidates(candidatesList);
  };

  const handleInputChange = (field: keyof FormDataType, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        jobDescription: "Please upload a PDF or DOC file",
      }));
      return;
    }
    handleInputChange("jobDescription", file);
    setJdAnalysis(null);
    setJdError(null);
    setJdLoading(true);
    try {
      const fd = new FormData();
      fd.append("jobDescription", file);
      const response = await adminService.analyzeJD(fd);
      const analysis = response.analysis;
      if (analysis) {
        setJdAnalysis(analysis);
        setFormData((prev) => ({
          ...prev,
          jobDescriptionText: analysis?.fullJobDescription || "",
          testTitle: prev.testTitle || analysis?.jobTitle || "",
          jobDescription: prev.jobDescription || analysis?.jobDescription || "",
          primarySkill:
            prev.primarySkill ||
            (analysis?.requiredSkills?.length
              ? analysis.requiredSkills.join(", ")
              : analysis?.primarySkill || ""),
          secondarySkill:
            prev.secondarySkill ||
            (analysis?.niceToHaveSkills?.length
              ? analysis.niceToHaveSkills.join(", ")
              : analysis?.secondarySkill || ""),
        }));
      }
    } catch (err: any) {
      setJdError(
        err?.response?.data?.message ||
          "Failed to analyze JD. You can proceed manually.",
      );
    } finally {
      setJdLoading(false);
    }
  };

  const getMinDateTime = () => {
    const now: any = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now - tzOffset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    ) {
      handleInputChange("endDate", "");
    }
  }, [formData.startDate]);

  const removeFile = () => {
    setFormData((prev) => ({
      ...prev,
      jobDescription: null,
      jobDescriptionText: "",
      testTitle: "",
      primarySkill: "",
      secondarySkill: "",
    }));
    setJdAnalysis(null);
    setJdError(null);
    setScoredCandidates(candidatesList);
    const el = document.getElementById("jd-upload") as HTMLInputElement;
    if (el) el.value = "";
  };

  const toggleCandidateSelection = (candidate: any) => {
    console.log("candidate", candidate);
    const isSelected = formData.candidates.some(
      (c: any) => c._id === candidate._id,
    );
    handleInputChange(
      "candidates",
      isSelected
        ? formData.candidates.filter((c: any) => c._id !== candidate._id)
        : [...formData.candidates, candidate],
    );
  };

  const removeCandidateChip = (id: any) => {
    handleInputChange(
      "candidates",
      formData.candidates.filter((c: any) => c._id !== id),
    );
  };

  const showToast = (type: any, message: any, duration = 4000) => {
    setSubmitStatus({ type, message });
    setTimeout(() => setSubmitStatus(null), duration);
  };

  const validateStep = (step: number) => {
    const newErrors: any = {};
    if (step === 1) {
      if (!formData.testTitle?.trim())
        newErrors.testTitle = "Test title is required";
      if (!formData.primarySkill?.trim())
        newErrors.primarySkill = "Primary skill is required";
    }
    if (step === 2) {
      if (!formData.noOfQuestions)
        newErrors.noOfQuestions = "Number of questions required";
      if (!formData.examLevel) newErrors.examLevel = "Exam level is required";
      if (!formData.passingScore)
        newErrors.passingScore = "Passing score required";
      if (!formData.duration) newErrors.duration = "Duration required";
      if (!formData.startDate) newErrors.startDate = "Start date required";
      if (!formData.endDate) newErrors.endDate = "End date required";
      if (
        formData.startDate &&
        formData.endDate &&
        new Date(formData.endDate) < new Date(formData.startDate)
      ) {
        newErrors.endDate = "End date must be after start date";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = (requireCandidates = false) => {
    const newErrors: any = {};
    if (!formData.testTitle?.trim())
      newErrors.testTitle = "Test title is required";
    if (!formData.noOfQuestions)
      newErrors.noOfQuestions = "Number of questions is required";
    if (!formData.primarySkill?.trim())
      newErrors.primarySkill = "Primary skill is required";
    if (!formData.passingScore)
      newErrors.passingScore = "Passing score is required";
    if (!formData.examLevel) newErrors.examLevel = "Exam level is required";
    if (!formData.duration) newErrors.duration = "Duration is required";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.endDate) newErrors.endDate = "End date is required";
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    ) {
      newErrors.endDate = "End date must be on or after start date";
    }
    if (formData.passingScore) {
      const score = Number(formData.passingScore);
      if (isNaN(score) || score < 0 || score > 100) {
        newErrors.passingScore = "Score must be between 0 and 100";
      }
    }
    if (requireCandidates && formData.candidates.length === 0) {
      newErrors.candidates =
        "Please select at least one candidate to send invites";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildFd = (includeDatesAndCandidates = false) => {
    const fd = new FormData();
    fd.append("difficulty", formData.examLevel);
    fd.append("duration", formData.duration);
    fd.append("test_title", formData.testTitle);
    fd.append("no_of_questions", formData.noOfQuestions);
    fd.append("primary_skill", formData.primarySkill);
    fd.append("secondary_skill", formData.secondarySkill || "");
    fd.append("passing_score", formData.passingScore);
    if (formData.jobDescriptionText) {
      fd.append("jobDescriptionText", formData.jobDescriptionText);
    }
    if (formData.jobDescription) {
      fd.append("jobDescription", formData.jobDescription);
    }
    if (includeDatesAndCandidates) {
      fd.append("start_date", formData.startDate);
      fd.append("end_date", formData.endDate);
      fd.append(
        "candidates",
        JSON.stringify(formData.candidates.map((c: any) => c._id)),
      );
    }
    return fd;
  };

  const handleGenerateAndSave = async () => {
    if (!validateForm(false)) {
      showToast("error", "Please fill all required fields correctly");
      return;
    }
    setLoading(true);
    try {
      await adminService.createAssessmentTemplate(buildFd());
      showToast("success", "Assessment template created successfully!", 2000);
      setTimeout(() => {
        setFormData(EMPTY_FORM);
        setMode("create");
        setActiveTab("templates");
        fetchAssessments();
      }, 2000);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to create template",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAndSendInvites = async () => {
    if (!validateForm(true)) {
      showToast(
        "error",
        "Please fill all required fields and select candidates",
      );
      return;
    }
    setLoading(true);
    try {
      await adminService.generateAndInvite(buildFd(true));
      showToast(
        "success",
        `Invitations sent to ${formData.candidates.length} candidate(s)!`,
        2000,
      );
      setTimeout(() => {
        setFormData(EMPTY_FORM);
        setMode("create");
        setActiveTab("templates");
        fetchAssessments();
      }, 2000);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to send invites",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssessment = async () => {
    if (!validateForm(false)) {
      showToast("error", "Please fill all required fields correctly");
      return;
    }
    setLoading(true);
    try {
      if (!id) return;
      await adminService.updateAssessmentTemplate(id, buildFd());
      showToast("success", "Assessment updated successfully!", 2000);
      setTimeout(() => {
        setFormData(EMPTY_FORM);
        setMode("create");
        setActiveAssessmentId(null);
        setActiveTab("templates");
        fetchAssessments();
      }, 2000);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to update assessment",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInviteOnly = async () => {
    const newErrors: any = {};
    if (formData.candidates.length === 0)
      newErrors.candidates = "Please select at least one candidate";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.endDate) newErrors.endDate = "End date is required";
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    )
      newErrors.endDate = "End date must be on or after start date";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast(
        "error",
        "Please select at least one candidate to send invites",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await adminService.sendInvites(id, {
        candidateIds: formData.candidates.map((c) => c._id),
        start_date: formData.startDate,
        end_date: formData.endDate,
      });
      const data = res.data;
      const invited = res.invitedEmails || [];
      const skipped = res.skippedEmails || [];
      if (res.isPartial && invited.length === 0 && skipped.length > 0) {
        showToast(
          "error",
          `All selected candidates are already invited: ${skipped.join(", ")}`,
        );
      } else if (data.isPartial) {
        if (invited.length > 0) {
          showToast("success", `Invited: ${invited.join(", ")}`);
        }
        if (skipped.length > 0) {
          setTimeout(() => {
            showToast("error", `Already invited: ${skipped.join(", ")}`);
          }, 300);
        }
      } else {
        showToast(
          "success",
          `Invitations sent to ${invited.length} candidate(s)!`,
        );
      }
      setTimeout(() => {
        setFormData(EMPTY_FORM);
        setMode("create");
      }, 2000);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to send invites",
      );
    } finally {
      setActiveTab("templates");
      setLoading(false);
    }
  };

  const handleViewCandidates = (assessment: any) => {
    setSelectedAssessment(assessment);
    setShowCandidateModal(true);
  };

  const closeCandidateModal = () => {
    setShowCandidateModal(false);
    setSelectedAssessment(null);
  };

  const hasGroqScores = scoredCandidates.some(
    (c) => c.matchScore !== undefined,
  );

  // ─── Shared input classes ─────────────────────────────────────────────────
  const inputCls = `w-full px-4 py-2.5 border rounded-lg outline-none ${
    isDark
      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
      : "border-gray-300 text-gray-900"
  }`;

  const selectCls = `w-full px-4 py-2.5 border rounded-lg outline-none ${
    isDark
      ? "bg-slate-700 border-slate-600 text-white"
      : "border-gray-300 text-gray-900"
  }`;

  const labelCls = `block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <AdminLayout
      heading="Tests & Assessments"
      subheading="Create and manage assessments"
      showSearch={false}
      activeMenuItem={activeMenuItem}
      onMenuItemClick={setActiveMenuItem}
    >
      {/* ── Full-page loader overlay ── */}
      {(loading ||
        jdLoading ||
        candidatesLoading ||
        !!editLoading ||
        groqLoading ||
        reDirect) && (
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
                : reDirect
                  ? "Redirecting to assessment page..."
                  : !editLoading
                    ? "Loading assessment..."
                    : candidatesLoading
                      ? "Loading candidates..."
                      : "Please wait..."}
          </p>
        </div>
      )}

      {submitStatus && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            submitStatus.type === "success"
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {submitStatus.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span
            className={`text-sm font-medium ${
              submitStatus.type === "success"
                ? "text-green-800"
                : "text-red-800"
            }`}
          >
            {submitStatus.message}
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center justify-between mb-6">
        <div
          className={`inline-flex rounded-lg p-2 ${isDark ? "bg-slate-900 border border-slate-700" : "bg-white"}`}
        >
          <button
            onClick={() => {
              setActiveTab("create");
              handleResetMode();
            }}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "create"
                ? isDark
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-[#F4F7FE] text-gray-900 shadow-sm"
                : isDark
                  ? "text-slate-300 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Create Assessments
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "templates"
                ? isDark
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-[#F4F7FE] text-gray-900 shadow-sm"
                : isDark
                  ? "text-slate-300 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Tests Templates
          </button>
        </div>
      </div>

      {/* ── Create Tab ── */}
      {activeTab === "create" && (
        <div
          className={`rounded-lg p-5 ${isDark ? "bg-slate-800" : "bg-white"}`}
        >
          {/* STEP INDICATOR */}
          <div className="relative mb-10">
            <div
              className={`absolute top-5 left-0 w-full h-[3px] rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
            />
            <div
              className="absolute top-5 left-0 h-[3px] bg-indigo-600 rounded-full transition-all duration-500"
              style={{
                width:
                  currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
              }}
            />
            <div className="relative flex justify-between">
              {[
                { id: 1, label: "Job Details" },
                { id: 2, label: "Test Setup" },
                { id: 3, label: "Select Candidates" },
              ].map((step) => (
                <div key={step.id} className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-semibold z-10 transition-all duration-300 ${
                      currentStep === step.id
                        ? "bg-indigo-600 text-white scale-110 shadow-lg"
                        : currentStep > step.id
                          ? "bg-green-500 text-white"
                          : isDark
                            ? "bg-slate-700 border-2 border-slate-600 text-slate-400"
                            : "bg-white border-2 border-gray-300 text-gray-500"
                    }`}
                  >
                    {currentStep > step.id ? "✓" : step.id}
                  </div>
                  <span
                    className={`mt-3 text-sm font-medium ${
                      currentStep === step.id
                        ? "text-indigo-600"
                        : currentStep > step.id
                          ? "text-green-600"
                          : isDark
                            ? "text-slate-500"
                            : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ================= STEP 1 ================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3
                  className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Job Description Setup
                </h3>
                <p
                  className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  Upload JD or manually enter details
                </p>
              </div>

              {/* JD Upload */}
              <div>
                <label className={labelCls}>Upload Job Description</label>
                {!formData.jobDescription ? (
                  <>
                    <label
                      htmlFor="jd-upload"
                      className={`flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition ${
                        isDark
                          ? "border-slate-600 bg-slate-700 hover:border-indigo-500 hover:bg-slate-600"
                          : "border-gray-300 bg-white hover:border-indigo-500 hover:bg-indigo-50"
                      }`}
                    >
                      <Upload
                        className={`h-7 w-7 mb-2 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                      />
                      <span
                        className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-700"}`}
                      >
                        Upload JD
                      </span>
                      <span
                        className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                      >
                        PDF, DOC, DOCX (Max 5MB)
                      </span>
                    </label>
                    <input
                      id="jd-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </>
                ) : (
                  <div
                    className={`flex items-center justify-between p-4 border rounded-xl shadow-sm hover:shadow-md transition ${isDark ? "border-slate-600 bg-slate-700" : "border-gray-200 bg-white"}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <FileText className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${isDark ? "text-slate-200" : "text-gray-800"}`}
                        >
                          {formData.jobDescription instanceof File
                            ? formData.jobDescription.name
                            : typeof formData.jobDescription === "string"
                              ? formData.jobDescription.split("/").pop() ||
                                formData.jobDescription
                              : ""}
                        </p>

                        <p
                          className={`text-xs ${isDark ? "text-slate-400" : "text-gray-400"}`}
                        >
                          Uploaded successfully
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      className="p-2 rounded-md hover:bg-red-50 transition"
                    >
                      <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* INPUT GRID */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Test Title</label>
                  <input
                    value={formData.testTitle}
                    onChange={(e) =>
                      handleInputChange("testTitle", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    placeholder="e.g. Frontend Developer Test"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Primary Skill</label>
                  <input
                    value={formData.primarySkill}
                    onChange={(e) =>
                      handleInputChange("primarySkill", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    placeholder="e.g. React.js"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Secondary Skill (Optional)</label>
                  <input
                    value={formData.secondarySkill}
                    onChange={(e) =>
                      handleInputChange("secondarySkill", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    placeholder="e.g. TypeScript"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Job Description</label>
                <textarea
                  rows={4}
                  value={formData.jobDescriptionText}
                  disabled={mode === "prefill"}
                  onChange={(e) =>
                    handleInputChange("jobDescriptionText", e.target.value)
                  }
                  placeholder="Paste or edit job description..."
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* ================= STEP 2 ================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3
                  className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Assessment Configuration
                </h3>
                <p
                  className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  Configure test settings (auto-filled from JD if available)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>Exam Level</label>
                  <select
                    value={formData.examLevel}
                    onChange={(e) =>
                      handleInputChange("examLevel", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    className={selectCls}
                  >
                    <option value="">Select level</option>
                    <option>Easy</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>No. of Questions</label>
                  <select
                    value={formData.noOfQuestions}
                    onChange={(e) =>
                      handleInputChange("noOfQuestions", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    className={selectCls}
                  >
                    <option value="">Select</option>
                    {[10, 20, 30, 40].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Passing Score (%)</label>
                  <input
                    type="number"
                    value={formData.passingScore}
                    onChange={(e) =>
                      handleInputChange("passingScore", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Duration</label>
                  <select
                    value={formData.duration}
                    onChange={(e) =>
                      handleInputChange("duration", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    className={selectCls}
                  >
                    <option value="">Select</option>
                    <option>30 min</option>
                    <option>60 min</option>
                    <option>90 min</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    min={getMinDateTime()}
                    onChange={(e) =>
                      handleInputChange("startDate", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    min={getMinDateTime()}
                    onChange={(e) =>
                      handleInputChange("endDate", e.target.value)
                    }
                    disabled={mode === "prefill"}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3 ================= */}
          {currentStep === 3 && (
            <div className="grid grid-cols-1">
              <div className="relative" ref={candidateDropdownRef}>
                <label
                  className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  Add Candidates
                  <span
                    className={`ml-2 text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {mode === "prefill" ? "(Required)" : "(Optional)"}
                  </span>
                  {formData.candidates.length > 0 && (
                    <span className="ml-2 text-xs text-indigo-500">
                      {formData.candidates.length} Selected
                    </span>
                  )}
                  {hasGroqScores && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                      <Sparkles className="h-3 w-3" />
                      AI Ranked
                    </span>
                  )}
                </label>

                <div
                  className={`w-full min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                    errors.candidates
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : isDark
                        ? "border-slate-600 hover:border-slate-500 bg-slate-700"
                        : "border-gray-300 hover:border-gray-400"
                  }`}
                  onClick={() =>
                    setShowCandidateDropdown(!showCandidateDropdown)
                  }
                >
                  {formData.candidates.length === 0 ? (
                    <span
                      className={`text-sm ${isDark ? "text-slate-400" : "text-gray-400"}`}
                    >
                      {hasGroqScores
                        ? "Candidates ranked by JD match — select to invite"
                        : "Select Candidates to invite"}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formData.candidates.map((c: any) => (
                        <span
                          key={c._id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md"
                        >
                          {c.name}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-indigo-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCandidateChip(c._id);
                            }}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {errors.candidates && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.candidates}
                    </span>
                  </div>
                )}

                {/* ── Candidate Dropdown ── */}
                {showCandidateDropdown && (
                  <div
                    className={`absolute z-10 w-full mt-1 border rounded-lg shadow-lg max-h-72 overflow-hidden ${
                      isDark
                        ? "bg-slate-800 border-slate-600"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {/* Search */}
                    <div
                      className={`p-2 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
                    >
                      <input
                        type="text"
                        placeholder="Search by name or role..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none ${
                          isDark
                            ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                            : "border-gray-300 text-gray-900"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* AI banner */}
                    {hasGroqScores && (
                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 border-b ${
                          isDark
                            ? "bg-violet-900/30 border-violet-800"
                            : "bg-violet-50 border-violet-100"
                        }`}
                      >
                        <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
                        <span
                          className={`text-xs font-medium ${isDark ? "text-violet-300" : "text-violet-700"}`}
                        >
                          Sorted by AI match score based on uploaded JD
                        </span>
                      </div>
                    )}

                    {/* List */}
                    {/* <div className="max-h-52 overflow-y-auto">
                      {candidatesLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-4">
                          <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                            Loading candidates...
                          </span>
                        </div>
                      ) : filteredCandidates?.length === 0 ? (
                        <div className={`px-4 py-3 text-sm text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                          No candidates found
                        </div>
                      ) : (
                        filteredCandidates?.map((candidate: any) => {
                          const isSelected = formData.candidates.some((c: any) => c._id === candidate._id);
                          const label = candidate.matchLabel;
                          const style = matchStyles[label] || matchStyles["Low Match"];
                          const score = candidate.matchScore;
                          const isLowMatch = label === "Low Match" || score === undefined;

                          return (
                            <div
                              key={candidate._id}
                              className={`px-4 py-2.5 cursor-pointer transition-colors ${
                                isSelected
                                  ? isDark
                                    ? "bg-indigo-900/40 hover:bg-indigo-900/60"
                                    : "bg-indigo-50 hover:bg-indigo-100"
                                  : isLowMatch && hasGroqScores
                                    ? isDark
                                      ? "opacity-50 hover:opacity-75 hover:bg-slate-700"
                                      : "opacity-50 hover:opacity-75 hover:bg-gray-50"
                                    : isDark
                                      ? "hover:bg-slate-700"
                                      : "hover:bg-gray-50"
                              }`}
                              onClick={(e) => { e.stopPropagation(); toggleCandidateSelection(candidate); }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-medium ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                                      {candidate.name}
                                    </span>
                                    {candidate.role && (
                                      <span className={`text-xs font-normal ${isDark ? "text-slate-400" : "text-gray-400"}`}>
                                        — {candidate.role}
                                      </span>
                                    )}
                                    {label && (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.badge}`}>
                                        {label === "Strong Match" && <Star className="h-2.5 w-2.5 fill-current" />}
                                        {label}
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                                    {candidate.email}
                                  </div>
                                  {candidate.matchReason && (
                                    <div className={`text-xs mt-0.5 italic truncate ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                                      {candidate.matchReason}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {score !== undefined && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      score >= 70
                                        ? isDark ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                        : score >= 40
                                          ? isDark ? "bg-amber-900/40 text-amber-400" : "bg-amber-100 text-amber-700"
                                          : isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500"
                                    }`}>
                                      {score}%
                                    </span>
                                  )}
                                  {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-500" />}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div> */}

                    <div className="max-h-52 overflow-y-auto">
                      {candidatesLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-4">
                          <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span
                            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                          >
                            Loading candidates...
                          </span>
                        </div>
                      ) : candidatesList?.length === 0 ? (
                        <div
                          className={`px-4 py-3 text-sm text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}
                        >
                          No candidates found
                        </div>
                      ) : (
                        candidatesList?.map((candidate:any) => {
                          const isSelected = formData.candidates.some(
                            (c: any) => c._id === candidate._id,
                          );
                          const label = candidate.matchLabel;
                          const style =
                            matchStyles[label] || matchStyles["Low Match"];
                          const score = candidate.matchScore;
                          const isLowMatch =
                            label === "Low Match" || score === undefined;

                          return (
                            <div
                              key={candidate._id}
                              className={`px-4 py-2.5 cursor-pointer transition-colors ${
                                isSelected
                                  ? isDark
                                    ? "bg-indigo-900/40 hover:bg-indigo-900/60"
                                    : "bg-indigo-50 hover:bg-indigo-100"
                                  : isLowMatch && hasGroqScores
                                    ? isDark
                                      ? "opacity-50 hover:opacity-75 hover:bg-slate-700"
                                      : "opacity-50 hover:opacity-75 hover:bg-gray-50"
                                    : isDark
                                      ? "hover:bg-slate-700"
                                      : "hover:bg-gray-50"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCandidateSelection(candidate);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-sm font-medium ${isDark ? "text-slate-100" : "text-gray-900"}`}
                                    >
                                      {candidate.name}
                                    </span>
                                    {candidate.role && (
                                      <span
                                        className={`text-xs font-normal ${isDark ? "text-slate-400" : "text-gray-400"}`}
                                      >
                                        — {candidate.role}
                                      </span>
                                    )}
                                    {label && (
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.badge}`}
                                      >
                                        {label === "Strong Match" && (
                                          <Star className="h-2.5 w-2.5 fill-current" />
                                        )}
                                        {label}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}
                                  >
                                    {candidate.email}
                                  </div>
                                  {candidate.matchReason && (
                                    <div
                                      className={`text-xs mt-0.5 italic truncate ${isDark ? "text-slate-500" : "text-gray-400"}`}
                                    >
                                      {candidate.matchReason}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {score !== undefined && (
                                    <span
                                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        score >= 70
                                          ? isDark
                                            ? "bg-emerald-900/40 text-emerald-400"
                                            : "bg-emerald-100 text-emerald-700"
                                          : score >= 40
                                            ? isDark
                                              ? "bg-amber-900/40 text-amber-400"
                                              : "bg-amber-100 text-amber-700"
                                            : isDark
                                              ? "bg-slate-700 text-slate-400"
                                              : "bg-gray-100 text-gray-500"
                                      }`}
                                    >
                                      {score}%
                                    </span>
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setShowCandidateModal(true)}
                  className="text-xs px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  + Add More Candidates
                </button>
              </div>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="flex justify-between mt-6 mb-3">
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className={`px-5 py-2 border rounded-lg ${isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                Back
              </button>
            ) : (
              <div />
            )}
            {currentStep < 3 && (
              <button
                onClick={() => {
                  if (!validateStep(currentStep)) {
                    showToast("error", "Fill required fields");
                    return;
                  }
                  setCurrentStep((prev) => prev + 1);
                }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Next
              </button>
            )}
          </div>

          {/* ── Final Buttons ── */}
          {currentStep === 3 && (
            <div
              className={`flex justify-end gap-4 pt-6 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
            >
              {mode === "create" && (
                <>
                  <button
                    onClick={handleGenerateAndSave}
                    disabled={loading}
                    className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? "text-slate-300 bg-slate-700 border-slate-600 hover:bg-slate-600"
                        : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {loading ? "Saving..." : "Generate & Save as template"}
                  </button>
                  <button
                    onClick={handleGenerateAndSendInvites}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    )}
                    {loading ? "Sending..." : "Generate & Send Invites"}
                  </button>
                </>
              )}
              {mode === "prefill" && (
                <button
                  onClick={handleInviteOnly}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  )}
                  {loading ? "Sending..." : "Send Invite"}
                </button>
              )}
              {mode === "edit" && (
                <button
                  onClick={handleUpdateAssessment}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  {loading ? "Updating..." : "Update Assessment"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Templates Tab ── */}
      {activeTab === "templates" && (
        <div>
          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-6 animate-pulse ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div
                      className={`h-5 w-12 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                    <div
                      className={`h-5 w-20 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                  </div>
                  <div className="mb-4 space-y-2">
                    <div
                      className={`h-5 w-3/4 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                    <div
                      className={`h-4 w-1/2 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div
                      className={`h-4 w-full rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                    <div
                      className={`h-4 w-2/3 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <div
                      className={`flex-1 h-9 rounded-lg ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                    <div
                      className={`h-9 w-10 rounded-lg ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                    <div
                      className={`h-9 w-10 rounded-lg ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : assessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText
                className={`h-10 w-10 mb-3 ${isDark ? "text-slate-600" : "text-gray-300"}`}
              />
              <p
                className={`font-medium ${isDark ? "text-slate-300" : "text-gray-500"}`}
              >
                No templates yet
              </p>
              <p
                className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-400"}`}
              >
                Create an assessment and save it as a template
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assessments?.map((item: any) => {
                const primarySkills = item.primary_skill
                  ? item.primary_skill
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                  : [];
                const secondarySkills = item.secondary_skill
                  ? item.secondary_skill
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                  : [];
                const allSkills = [...primarySkills, ...secondarySkills];
                const MAX_VISIBLE = 6;
                const visibleSkills = allSkills.slice(0, MAX_VISIBLE);
                const remainingCount = allSkills.length - MAX_VISIBLE;
                const difficultyStyles: Record<string, string> = {
                  Advanced: "bg-orange-50 text-orange-600 border-orange-200",
                  Easy: "bg-emerald-50 text-emerald-600 border-emerald-200",
                  Medium: "bg-sky-50 text-sky-600 border-sky-200",
                };
                const diffStyle =
                  difficultyStyles[item.difficulty] ??
                  difficultyStyles["Medium"];

                return (
                  <div
                    key={item._id}
                    className={`rounded-xl border flex flex-col h-full transition-all duration-200 ${isDark ? "bg-slate-900 border-slate-700 hover:border-indigo-500 hover:shadow-lg" : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg"}`}
                  >
                    <div
                      className={`px-5 pt-5 pb-4 border-b ${isDark ? "border-slate-700" : "border-gray-100"}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.examType ?? "MCQ"}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${diffStyle}`}
                        >
                          {item.difficulty}
                        </span>
                      </div>
                      <h3
                        className={`text-base font-semibold leading-snug line-clamp-2 mb-3 ${isDark ? "text-slate-100" : "text-gray-900"}`}
                      >
                        {item.test_title}
                      </h3>
                      <div
                        className={`flex flex-wrap gap-2 text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                      >
                        {[
                          {
                            icon: (
                              <Clock
                                className={`h-3 w-3 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                              />
                            ),
                            text: item.duration,
                          },
                          {
                            icon: (
                              <FileText
                                className={`h-3 w-3 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                              />
                            ),
                            text: `${item.no_of_questions} Questions`,
                          },
                          {
                            icon: (
                              <CheckCircle2
                                className={`h-3 w-3 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                              />
                            ),
                            text: `Pass: ${item.passing_score}%`,
                          },
                        ].map((badge, i) => (
                          <span
                            key={i}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-gray-50 border-gray-200 text-gray-500"}`}
                          >
                            {badge.icon}
                            {badge.text}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="px-5 py-4 flex-1">
                      <p
                        className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                      >
                        Skills
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleSkills.map((skill: string, i: number) => (
                          <span
                            key={i}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                              i < primarySkills.length
                                ? isDark
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-violet-50 text-violet-700 border-violet-200"
                                : isDark
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {skill}
                          </span>
                        ))}
                        {remainingCount > 0 && (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                          >
                            +{remainingCount} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`px-5 pb-5 pt-3 border-t ${isDark ? "border-slate-700" : "border-gray-100"}`}
                    >
                      {item.createdAt && (
                        <p
                          className={`text-xs mb-3 ${isDark ? "text-slate-400" : "text-gray-400"}`}
                        >
                          Created{" "}
                          {new Date(item.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUseTemplate(item)}
                          className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all duration-150"
                        >
                          Use Template
                        </button>
                        <button
                          onClick={() => handleViewCandidates(item)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${isDark ? "text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700" : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"}`}
                          title="View Candidates"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditTemplate(item)}
                          disabled={editLoading === item._id}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[42px] ${isDark ? "text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700" : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"}`}
                        >
                          {editLoading === item._id ? (
                            <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add Candidates Modal ── */}
      {showCandidateModal && !selectedAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className={`w-full max-w-2xl rounded-xl shadow-xl overflow-hidden ${isDark ? "bg-slate-800" : "bg-white"}`}
          >
            {/* HEADER */}
            <div
              className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
            >
              <div>
                <h3
                  className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Add Candidates
                </h3>
                <p
                  className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  Select additional candidates for this assessment
                </p>
              </div>
              <button onClick={() => setShowCandidateModal(false)}>
                <X
                  className={`h-5 w-5 ${isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-700"}`}
                />
              </button>
            </div>

            {/* SEARCH */}
            <div
              className={`p-3 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
            >
              <input
                type="text"
                placeholder="Search by name or role..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    : "border-gray-300 text-gray-900"
                }`}
              />
            </div>

            {/* INFO BAR */}
            <div
              className={`flex items-center justify-between px-4 py-2 border-b text-xs ${isDark ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-gray-50 border-gray-100 text-gray-500"}`}
            >
              <span>{candidatesList.length} candidates available</span>
              {formData.candidates.length > 0 && (
                <span className="text-indigo-500 font-medium">
                  {formData.candidates.length} selected
                </span>
              )}
            </div>

            {/* LIST */}
            <div className="max-h-72 overflow-y-auto">
              {candidatesList
                .filter((c: any) =>
                  `${c.name} ${c.role || ""} ${c.email}`
                    .toLowerCase()
                    .includes(candidateSearch.toLowerCase()),
                )
                .map((candidate: any) => {
                  const isSelected = formData.candidates.some(
                    (c: any) => c._id === candidate._id,
                  );
                  return (
                    <div
                      key={candidate._id}
                      onClick={() => toggleCandidateSelection(candidate)}
                      className={`px-4 py-3 cursor-pointer transition ${
                        isSelected
                          ? isDark
                            ? "bg-indigo-900/40 hover:bg-indigo-900/60 border-l-4 border-indigo-500"
                            : "bg-indigo-50 hover:bg-indigo-100 border-l-4 border-indigo-500"
                          : isDark
                            ? "hover:bg-slate-700"
                            : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-medium ${isDark ? "text-slate-100" : "text-gray-900"}`}
                            >
                              {candidate.name}
                            </span>
                            {candidate.role && (
                              <span
                                className={`text-xs ${isDark ? "text-slate-400" : "text-gray-400"}`}
                              >
                                — {candidate.role}
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}
                          >
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
              {candidatesList.length === 0 && (
                <div
                  className={`px-4 py-6 text-center text-sm ${isDark ? "text-slate-400" : "text-gray-400"}`}
                >
                  No candidates available
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div
              className={`flex justify-between items-center px-5 py-4 border-t ${isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-gray-50"}`}
            >
              <span
                className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
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

      {/* ── View Assigned Candidates Modal ── */}
      {showCandidateModal && selectedAssessment && (
        <ViewAssignedCandidate
          isOpen={showCandidateModal}
          onClose={closeCandidateModal}
          assessmentData={selectedAssessment}
        />
      )}

      {showAddCandidateModal && (
        <AddCandidateModal
          isOpen={showAddCandidateModal}
          onClose={() => setShowAddCandidateModal(false)}
          onAdd={() => {
            setShowAddCandidateModal(false);
          }}
          onUpdate={() => {}}
        />
      )}
    </AdminLayout>
  );
};

export default TestsAssessments;
