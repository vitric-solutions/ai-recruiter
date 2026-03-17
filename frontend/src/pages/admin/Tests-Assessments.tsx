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
import { adminService } from "../../services/service/adminService";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import ViewAssignedCandidate from "../../components/admin/TestAssessgnment/ViewAssignedCandidate";

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
  console.log(candidates);
  console.log(jdAnalysis);
  if (
    !import.meta.env.VITE_GROQ_API_KEY ||
    !jdAnalysis ||
    candidates.length === 0
  )
    return candidates;

  const jobTitle = jdAnalysis.jobTitle || "";
  // const experienceYears = jdAnalysis.experienceYears || "";
  const requiredSkills: string[] = jdAnalysis.requiredSkills || [];
  const niceToHaveSkills: string[] = jdAnalysis.niceToHaveSkills || [];

  // Build a compact candidate list for the prompt
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
    console.log("response", response);
    const data = await response.json();
    console.log("data", data);
    const raw = data.choices?.[0]?.message?.content?.trim() || "[]";

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();
    const scores: any[] = JSON.parse(clean);

    // Merge scores back into candidates, then drop anyone below 50%
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

  // AI scoring
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
  const [activeTab, setActiveTab] = useState("create");
  const [activeMenuItem, setActiveMenuItem] = useState("Dashboard");
  const [formData, setFormData] = useState<FormDataType>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [candidatesList, setCandidatesList] = useState([]);
  const [scoredCandidates, setScoredCandidates] = useState<any[]>([]); // Groq-scored list
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
  const [jdError, setJdError] = useState(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(null);

  const [reDirect, setReDirect] = useState(false);

  const candidateDropdownRef = useRef<HTMLDivElement | null>(null);
  const skills = jdAnalysis?.requiredSkills ?? [];
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
  }, []);

  useEffect(() => {
    if (activeTab === "templates") fetchAssessments();
  }, [activeTab]);

  // When jdAnalysis arrives AND we have candidates, run Groq scoring
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

  const runGroqScoring = async (candidates: any[], analysis: any) => {
    setGroqLoading(true);

    try {
      const requiredSkills = analysis?.requiredSkills || [];

      const filtered = candidates.filter((c) => {
        const skills = (
          c.skills ||
          c.key_Skills ||
          c.primarySkill ||
          ""
        ).toLowerCase();

        return requiredSkills.some((skill: string) =>
          skills.includes(skill.toLowerCase()),
        );
      });

      const scored = await scoreCandidatesWithGroq(filtered, analysis);

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
      setScoredCandidates(list); // default: unscored
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const fetchAssessments = async () => {
    setTemplatesLoading(true);
    try {
      const response = await adminService.getAssesments();
      console.log(response);
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
  };

  const handleEditTemplate = async (item: any) => {
    setEditLoading(item._id);
    setReDirect(true);
    try {
      const response = await adminService.getAssesments(item._id);
      const data = response.data;
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
    setScoredCandidates(candidatesList); // reset to unscored
  };

  const handleInputChange = (field: keyof FormDataType, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field in errors) {
  setErrors((prev) => ({
    ...prev,
    [field]: "",
  }));
}
  };

  const mapExperienceToLevel = (level?: string, years?: string) => {
    if (!level && !years) return "";
    const lvl = level?.toLowerCase();
    if (lvl?.includes("entry") || lvl?.includes("junior")) return "Easy";
    if (lvl?.includes("mid")) return "Intermediate";
    if (lvl?.includes("senior") || lvl?.includes("lead")) return "Advanced";
    const y = Number(years);
    if (!isNaN(y)) {
      if (y <= 1) return "Easy";
      if (y <= 4) return "Intermediate";
      return "Advanced";
    }
    return "";
  };

  const getDefaultQuestionsByLevel = (level: string) => {
    switch (level) {
      case "Easy":
        return "20";
      case "Intermediate":
        return "30";
      case "Advanced":
        return "40";
      default:
        return "";
    }
  };

  // const getDefaultDuration = (questions: string) => {
  //   const q = Number(questions);
  //   if (!q) return "";
  //   if (q <= 20) return "30 min";
  //   if (q <= 30) return "60 min";
  //   if (q <= 40) return "90 min";
  //   return "120 min";
  // };

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
        const difficulty =
          mapExperienceToLevel(
            analysis?.experienceLevel,
            analysis?.experienceYears,
          ) || "";
        const defaultQuestions = getDefaultQuestionsByLevel(difficulty);
        console.log(defaultQuestions);
        // const defaultDuration = getDefaultDuration(defaultQuestions);
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

  const removeFile = () => {
    handleInputChange("jobDescription", null);
    handleInputChange("jobDescriptionText", "");
    setJdAnalysis(null);
    setJdError(null);
    setScoredCandidates(candidatesList); // revert to plain list
    const el = document.getElementById("jd-upload") as HTMLInputElement;
    if (el) el.value = "";
  };

  const toggleCandidateSelection = (candidate: any) => {
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

  // Use scoredCandidates for the dropdown (filtered by search)
  const filteredCandidates = scoredCandidates?.filter((c: any) =>
    `${c.name} ${c.role || ""} ${c.email}`
      .toLowerCase()
      .includes(candidateSearch.toLowerCase()),
  );

  const showToast = (type: any, message: any, duration = 4000) => {
    setSubmitStatus({ type, message });
    setTimeout(() => setSubmitStatus(null), duration);
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
    // if (formData.jobDescription instanceof File) {
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
      showToast("error", "Please select candidates and set valid dates");
      return;
    }

    setLoading(true);

    try {
      const res = await adminService.sendInvites(id, {
        candidateIds: formData.candidates.map((c) => c._id),
        start_date: formData.startDate,
        end_date: formData.endDate,
      });

      console.log("FULL RESPONSE:", res);

      const data = res.data;

      // ✅ CORRECT DATA
      const invited = res.invitedEmails || [];
      const skipped = res.skippedEmails || [];

      console.log("invited:", invited);
      console.log("skipped:", skipped);

      // 🔥 CASE 1: ONLY SKIPPED
      if (res.isPartial && invited.length === 0 && skipped.length > 0) {
        showToast(
          "error",
          `All selected candidates are already invited: ${skipped.join(", ")}`,
        );
      }

      // 🔥 CASE 2: PARTIAL (both)
      else if (data.isPartial) {
        if (invited.length > 0) {
          showToast("success", `Invited: ${invited.join(", ")}`);
        }

        if (skipped.length > 0) {
          setTimeout(() => {
            showToast("error", `Already invited: ${skipped.join(", ")}`);
          }, 300);
        }
      }

      // ✅ CASE 3: FULL SUCCESS
      else {
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
      console.log("ERROR:", err);

      showToast(
        "error",
        err.response?.data?.message || "Failed to send invites",
      );
    } finally {
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

  // ─── Helpers for candidate dropdown rendering ────────────────────────────
  const hasGroqScores = scoredCandidates.some(
    (c) => c.matchScore !== undefined,
  );

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

      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex bg-white rounded-lg p-2">
          <button
            onClick={() => {
              setActiveTab("create");
              handleResetMode();
            }}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "create"
                ? "bg-[#F4F7FE] text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Create Assessments
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "templates"
                ? "bg-[#F4F7FE] text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Tests Templates
          </button>
        </div>
      </div>

      {activeTab === "create" && (
        <div className="rounded-lg p-5 bg-white">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {mode === "edit"
                  ? "Edit Assessment"
                  : mode === "prefill"
                    ? "Send Invites"
                    : "Create New Assessment"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {mode === "edit"
                  ? "Update the assessment details below"
                  : mode === "prefill"
                    ? "Select candidates and set dates to send invites"
                    : "Set up a new MCQ-based assessment for your candidates"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* ── Row 1: Candidates + Dates ── */}
            <div className="grid grid-cols-3 gap-6">
              {/* Candidates dropdown */}
              <div className="relative" ref={candidateDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Candidates
                  <span className="ml-2 text-xs text-gray-500">
                    {mode === "prefill" ? "(Required)" : "(Optional)"}
                  </span>
                  {formData.candidates.length > 0 && (
                    <span className="ml-2 text-xs text-indigo-600">
                      {formData.candidates.length} Selected
                    </span>
                  )}
                  {/* AI badge — shown only when Groq has scored */}
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
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  onClick={() =>
                    setShowCandidateDropdown(!showCandidateDropdown)
                  }
                >
                  {formData.candidates.length === 0 ? (
                    <span className="text-gray-400 text-sm">
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

                {showCandidateDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-72 overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-200">
                      <input
                        type="text"
                        placeholder="Search by name or role..."
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* AI ranking notice */}
                    {hasGroqScores && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
                        <Sparkles className="h-3 w-3 text-violet-600 shrink-0" />
                        <span className="text-xs text-violet-700 font-medium">
                          Sorted by AI match score based on uploaded JD
                        </span>
                      </div>
                    )}

                    <div className="max-h-52 overflow-y-auto">
                      {candidatesLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-4">
                          <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-gray-500">
                            Loading candidates...
                          </span>
                        </div>
                      ) : filteredCandidates?.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          No candidates found
                        </div>
                      ) : (
                        filteredCandidates?.map((candidate) => {
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
                                  ? "bg-indigo-50 hover:bg-indigo-100"
                                  : isLowMatch && hasGroqScores
                                    ? "opacity-50 hover:opacity-75 hover:bg-gray-50"
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
                                    <span className="text-sm font-medium text-gray-900">
                                      {candidate.name}
                                    </span>
                                    {candidate.role && (
                                      <span className="text-xs text-gray-400 font-normal">
                                        — {candidate.role}
                                      </span>
                                    )}
                                    {/* Match label badge */}
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
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {candidate.email}
                                  </div>
                                  {/* Match reason */}
                                  {candidate.matchReason && (
                                    <div className="text-xs text-gray-400 mt-0.5 italic truncate">
                                      {candidate.matchReason}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Score pill */}
                                  {score !== undefined && (
                                    <span
                                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        score >= 70
                                          ? "bg-emerald-100 text-emerald-700"
                                          : score >= 40
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-gray-100 text-gray-500"
                                      }`}
                                    >
                                      {score}%
                                    </span>
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
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

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) =>
                    handleInputChange("startDate", e.target.value)
                  }
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                    errors.startDate
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100 focus:ring-red-200"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  }`}
                />
                {errors.startDate && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.startDate}
                    </span>
                  </div>
                )}
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  min={
                    formData.endDate
                      ? formData.endDate
                      : new Date().toISOString().slice(0, 16)
                  }
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                    errors.endDate
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100 focus:ring-red-200"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  }`}
                />
                {errors.endDate && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.endDate}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 2 ── */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Frontend Developer Assessment"
                  value={formData.testTitle}
                  onChange={(e) =>
                    handleInputChange("testTitle", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                    errors.testTitle
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                />
                {errors.testTitle && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.testTitle}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  No. of questions
                </label>
                <select
                  value={formData.noOfQuestions}
                  onChange={(e) =>
                    handleInputChange("noOfQuestions", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none appearance-none bg-white transition-all ${
                    errors.noOfQuestions
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">Select number of questions</option>
                  {[10, 20, 30, 40, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {errors.noOfQuestions && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.noOfQuestions}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 3 ── */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Skill
                </label>
                <input
                  type="text"
                  placeholder="e.g., React.js"
                  value={formData.primarySkill}
                  onChange={(e) =>
                    handleInputChange("primarySkill", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                    errors.primarySkill
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                />
                {errors.primarySkill && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.primarySkill}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passing Score%
                </label>
                <input
                  type="number"
                  placeholder="e.g., 70"
                  min="0"
                  max="100"
                  value={formData.passingScore}
                  onChange={(e) =>
                    handleInputChange("passingScore", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                    errors.passingScore
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                />
                {errors.passingScore && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.passingScore}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 4 ── */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Skill (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., TypeScript"
                  value={formData.secondarySkill}
                  onChange={(e) =>
                    handleInputChange("secondarySkill", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none ${
                    mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select exam level
                </label>
                <select
                  value={formData.examLevel}
                  onChange={(e) =>
                    handleInputChange("examLevel", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none appearance-none bg-white transition-all ${
                    errors.examLevel
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">Select difficulty level</option>
                  <option value="Easy">Easy</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
                {errors.examLevel && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.examLevel}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 5: Duration + JD Upload ── */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    handleInputChange("duration", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none appearance-none bg-white transition-all ${
                    errors.duration
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">Select duration</option>
                  <option value="30 min">30 min</option>
                  <option value="60 min">60 min</option>
                  <option value="90 min">90 min</option>
                  <option value="120 min">120 min</option>
                </select>
                {errors.duration && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.duration}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Job Description (Optional)
                </label>
                {!formData.jobDescription ? (
                  <label
                    htmlFor="jd-upload"
                    className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                      errors.jobDescription
                        ? "border-red-300 bg-red-50 hover:bg-red-100"
                        : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
                    }`}
                  >
                    <Upload className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Upload PDF or DOC
                    </span>
                    <input
                      id="jd-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm text-gray-700 truncate max-w-[200px]">
                          {formData.jobDescription instanceof File
                            ? formData.jobDescription.name
                            : formData.jobDescription}
                        </span>
                      </div>
                      <button
                        onClick={removeFile}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {jdLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <div className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-indigo-700">
                          Analyzing JD and auto-filling fields...
                        </span>
                      </div>
                    )}
                    {jdError && !jdLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                        <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                        <span className="text-xs text-red-600">{jdError}</span>
                      </div>
                    )}
                    {jdAnalysis && !jdLoading && (
                      <div className="px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            Fields auto-filled from JD
                          </span>
                          {hasGroqScores && (
                            <span className="flex items-center gap-1 ml-auto text-xs text-violet-600 font-medium">
                              <Sparkles className="h-3 w-3" />
                              Candidates AI-ranked
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {skills.slice(0, 4).map((skill: string) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-white border border-green-200 text-green-700 text-xs rounded-full"
                            >
                              {skill}
                            </span>
                          ))}

                          {skills.length > 4 && (
                            <span>+{skills.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {errors.jobDescription && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.jobDescription}
                    </span>
                  </div>
                )}
              </div>

              {/* JD Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Add a custom job description or use the uploaded JD to auto-fill this field"
                  value={formData.jobDescriptionText}
                  onChange={(e) =>
                    handleInputChange("jobDescriptionText", e.target.value)
                  }
                  disabled={mode === "prefill"}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
                    errors.jobDescriptionText
                      ? "border-red-300 bg-red-50 ring-2 ring-red-100"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  } ${mode === "prefill" ? "bg-gray-50 cursor-not-allowed" : ""}`}
                />
                {errors.jobDescriptionText && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">
                      {errors.jobDescriptionText}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              {mode === "create" && (
                <>
                  <button
                    onClick={handleGenerateAndSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>
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
                  className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-5 w-12 bg-gray-200 rounded-full" />
                    <div className="h-5 w-20 bg-gray-200 rounded-full" />
                  </div>
                  <div className="mb-4 space-y-2">
                    <div className="h-5 w-3/4 bg-gray-200 rounded" />
                    <div className="h-4 w-1/2 bg-gray-200 rounded" />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 w-full bg-gray-200 rounded" />
                    <div className="h-4 w-2/3 bg-gray-200 rounded" />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <div className="flex-1 h-9 bg-gray-200 rounded-lg" />
                    <div className="h-9 w-10 bg-gray-200 rounded-lg" />
                    <div className="h-9 w-10 bg-gray-200 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : assessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No templates yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Create an assessment and save it as a template
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assessments.map((item: any) => {
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
                    className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 flex flex-col h-full"
                  >
                    <div className="px-5 pt-5 pb-4 border-b border-gray-100">
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
                      <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2 mb-3">
                        {item.test_title}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {item.duration}
                        </span>
                        <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                          <FileText className="h-3 w-3 text-gray-400" />
                          {item.no_of_questions} Questions
                        </span>
                        <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3 text-gray-400" />
                          Pass: {item.passing_score}%
                        </span>
                      </div>
                    </div>

                    <div className="px-5 py-4 flex-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                        Skills
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleSkills.map((skill: string, i: number) => (
                          <span
                            key={i}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                              i < primarySkills.length
                                ? "bg-violet-50 text-violet-700 border-violet-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {skill}
                          </span>
                        ))}
                        {remainingCount > 0 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            +{remainingCount} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-3 border-t border-gray-100">
                      {item.createdAt && (
                        <p className="text-xs text-gray-400 mb-3">
                          Created{" "}
                          {new Date(item.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
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
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
                          title="View Candidates"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditTemplate(item)}
                          disabled={editLoading === item._id}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[42px]"
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

      {/* Candidate Details Modal */}
      {showCandidateModal && selectedAssessment && (
        <ViewAssignedCandidate
          isOpen={showCandidateModal}
          onClose={closeCandidateModal}
          assessmentData={selectedAssessment}
        />
      )}
    </AdminLayout>
  );
};

export default TestsAssessments;
