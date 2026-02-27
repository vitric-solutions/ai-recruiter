import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../../common/AdminLayout";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import {
  Search,
  SlidersHorizontal,
  Eye,
  Calendar,
  Clock,
  MessageSquare,
  TrendingUp,
  Users,
  CheckCircle,
  FileText,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { adminService } from "../../services/service/adminService";

interface ScoreType {
  _id: string;
  totalScore: number;
  maxScore: number;
  summary: string;
  pdfPath: string;
  createdAt: string;
  candidateId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  interviewId: {
    test_title?: string;
    position?: string;
    duration: string;
    examType: string;
    difficulty?: string;
    passing_score?: number;
  };
  updatedAt: string;
  examType?: string;
  feedback?: any;
  behaviorReport?: any;
  interview_id?: any;
  transcript?: any[];
  completedAt?: string;
  score?: number;
  scores?: any[];
}

const TableSkeleton = () => {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="animate-pulse">
          {[...Array(8)].map((__, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

const ReportsInsights = () => {
  const [activeTab, setActiveTab] = useState<"AI" | "MCQ">("AI");
  const [scores, setScores] = useState<ScoreType[]>([]);
  const [selectedScore, setSelectedScore] = useState<ScoreType | null>(null);
  const [showDetailedScorecard, setShowDetailedScorecard] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiCurrentPage, setAiCurrentPage] = useState(1);
  const aiItemsPerPage = 5;
  const [filters, setFilters] = useState({
    name: "",
    minScore: "",
    maxScore: "",
    startDate: "",
    endDate: "",
  });

  const [aiFilters, setAiFilters] = useState({
    search: "",
    verdict: "",
    minScore: "",
    startDate: "",
    endDate: "",
  });

  const filteredScores = scores.filter((row) => {
    const percentage =
      row.maxScore > 0 ? Math.round((row.totalScore / row.maxScore) * 100) : 0;

    const matchesName =
      !filters.name ||
      row.candidateId?.name?.toLowerCase().includes(filters.name.toLowerCase());

    const matchesMin =
      !filters.minScore || percentage >= Number(filters.minScore);

    const matchesMax =
      !filters.maxScore || percentage <= Number(filters.maxScore);

    const rowDate = new Date(row.updatedAt).getTime();
    const start = filters.startDate
      ? new Date(filters.startDate).getTime()
      : null;
    const end = filters.endDate ? new Date(filters.endDate).getTime() : null;

    const matchesStart = !start || rowDate >= start;
    const matchesEnd = !end || rowDate <= end;

    return (
      matchesName && matchesMin && matchesMax && matchesStart && matchesEnd
    );
  });
  const filteredAIScores = scores.filter((row) => {
    const nameMatch =
      !aiFilters.search ||
      row.feedback?.candidateName
        ?.toLowerCase()
        .includes(aiFilters.search.toLowerCase());

    const verdictMatch =
      !aiFilters.verdict || row.feedback?.overallVerdict === aiFilters.verdict;

    const scoreMatch =
      !aiFilters.minScore || (row.score || 0) >= Number(aiFilters.minScore);

    const rowDate = new Date(row.completedAt || row.createdAt).getTime();

    const startMatch =
      !aiFilters.startDate ||
      rowDate >= new Date(aiFilters.startDate).getTime();

    const endMatch =
      !aiFilters.endDate || rowDate <= new Date(aiFilters.endDate).getTime();

    return nameMatch && verdictMatch && scoreMatch && startMatch && endMatch;
  });

  const fetchScores = async (type: "AI" | "MCQ") => {
    try {
      setLoading(true);
      const res = await adminService.getScore(type);

      if (res?.success) {
        if (type === "AI" && res.data) {
          setScores(res.data || []);
        } else {
          setScores(res.scores || []);
        }
      }
    } catch (err) {
      console.error("Error fetching scores:", err);
      setScores([]);
    } finally {
      setLoading(false);
    }
  };
  useAdminSocket({
    "interview-submitted": () => {
      fetchScores(activeTab);
    },
  });
  useEffect(() => {
    fetchScores(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (scores.length > 0 && activeTab === "AI") {
      setExpandedCardId(scores[0]._id);
      setAiCurrentPage(1);
    }
  }, [scores, activeTab]);

  // AI pagination computed values
  // AI pagination computed values
  const aiTotalPages = Math.ceil(filteredAIScores.length / aiItemsPerPage);

  const aiPaginatedScores =
    activeTab === "AI"
      ? filteredAIScores.slice(
          (aiCurrentPage - 1) * aiItemsPerPage,
          aiCurrentPage * aiItemsPerPage,
        )
      : [];

  // Auto-expand first card on page change
  useEffect(() => {
    if (aiPaginatedScores.length > 0) {
      setExpandedCardId(aiPaginatedScores[0]._id);
    }
  }, [aiCurrentPage]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2) || "NA"
    );
  };

  const handleViewDetailedScorecard = (result: ScoreType) => {
    setSelectedScore(result);
    setShowDetailedScorecard(true);
  };

  const handleViewAIAnalysis = (result: ScoreType) => {
    setSelectedScore(result);
    setShowAIAnalysis(true);
  };
  useEffect(() => {
    setAiCurrentPage(1);
  }, [aiFilters]);
  // Compute stats dynamically from scores
  const stats = useMemo(() => {
    const total = scores.length;

    if (activeTab === "MCQ") {
      // MCQ-specific stats
      const avgPercent =
        total > 0
          ? (
              scores.reduce(
                (sum, s) => sum + Math.round((s.totalScore / s.maxScore) * 100),
                0,
              ) / total
            ).toFixed(1)
          : "0.0";

      const passCount = scores.filter(
        (s) =>
          Math.round((s.totalScore / s.maxScore) * 100) >=
          (s.interviewId?.passing_score || 60),
      ).length;
      const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

      const failCount = total - passCount;
      const failRate = total > 0 ? Math.round((failCount / total) * 100) : 0;

      const avgDuration =
        total > 0
          ? scores.map((s) => s.interviewId?.duration || "N/A").find(Boolean) ||
            "N/A"
          : "N/A";

      return [
        {
          title: "Average MCQ Score",
          value: `${avgPercent}%`,
          icon: TrendingUp,
          color: "text-green-600",
          bgColor: "bg-green-50",
        },
        {
          title: "MCQ Pass Rate",
          value: `${passRate}%`,
          icon: Users,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
        },
        {
          title: "MCQ Tests Completed",
          value: String(total),
          icon: CheckCircle,
          color: "text-pink-600",
          bgColor: "bg-pink-50",
        },
        {
          title: "Fail Rate",
          value: `${failRate}%`,
          icon: TrendingUp,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
        },
      ];
    }

    // AI tab stats (original logic)
    const avgScore =
      total > 0
        ? (scores.reduce((sum, s) => sum + (s.score || 0), 0) / total).toFixed(
            1,
          )
        : "0.0";

    const passCount =
      total > 0
        ? scores.filter(
            (s) => (s.score || 0) >= (s.interview_id?.passingScore || 70),
          ).length
        : 0;
    const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

    const rejectCount = scores.filter(
      (s) => s.feedback?.overallVerdict === "reject",
    ).length;
    const rejectRate = total > 0 ? Math.round((rejectCount / total) * 100) : 0;

    return [
      {
        title: "Average AI Score",
        value: `${avgScore}%`,
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50",
      },
      {
        title: "AI Pass Rate",
        value: `${passRate}%`,
        icon: Users,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
      },
      {
        title: "AI Interviews Completed",
        value: String(total),
        icon: CheckCircle,
        color: "text-pink-600",
        bgColor: "bg-pink-50",
      },
      {
        title: "Rejection Rate",
        value: `${rejectRate}%`,
        icon: TrendingUp,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
      },
    ];
  }, [scores, activeTab]);

  return (
    <AdminLayout
      heading="Reports & Insights"
      subheading="View Reports and Insights"
      showSearch={false}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.bgColor} rounded-lg p-2.5`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("AI")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "AI"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            AI Interview Result
          </button>

          <button
            onClick={() => setActiveTab("MCQ")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "MCQ"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            MCQ Test Result
          </button>
        </div>
      </div>

      {/* AI Interview Tab */}
      {activeTab === "AI" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              AI Interview Result
            </h2>
            <div className="text-sm text-gray-500">
              Showing{" "}
              {filteredAIScores.length === 0
                ? "0"
                : `${(aiCurrentPage - 1) * aiItemsPerPage + 1}-${Math.min(aiCurrentPage * aiItemsPerPage, scores.length)}`}{" "}
              of {filteredAIScores.length} candidates
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-wrap gap-3 bg-white p-2 rounded-sm">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Search candidate..."
                value={aiFilters.search}
                onChange={(e) =>
                  setAiFilters((f) => ({ ...f, search: e.target.value }))
                }
                className="pl-9 pr-4 py-2 w-56 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Verdict Filter */}
            <select
              value={aiFilters.verdict}
              onChange={(e) =>
                setAiFilters((f) => ({ ...f, verdict: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">All Status</option>
              <option value="hire">Hire</option>
              <option value="consider">Consider</option>
              <option value="reject">Reject</option>
            </select>

            {/* Min Score */}
            <input
              type="number"
              placeholder="Min Score %"
              value={aiFilters.minScore}
              onChange={(e) =>
                setAiFilters((f) => ({ ...f, minScore: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-32"
            />

            {/* Date Range */}
            <input
              type="date"
              value={aiFilters.startDate}
              onChange={(e) =>
                setAiFilters((f) => ({ ...f, startDate: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />

            <input
              type="date"
              value={aiFilters.endDate}
              onChange={(e) =>
                setAiFilters((f) => ({ ...f, endDate: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {/* No Data State */}
          {!loading && filteredAIScores.length === 0 && (
            <div className="w-full flex items-center justify-center py-12 text-gray-500">
              No Data Available
            </div>
          )}

          {/* AI Interview Results Cards */}
          <div className="space-y-3">
            {!loading &&
              aiPaginatedScores.map((result) => {
                const feedback = result.feedback;
                const isExpanded = expandedCardId === result._id;

                return (
                  <div
                    key={result._id}
                    className={`bg-white rounded-xl border-2 ${
                      isExpanded
                        ? "border-indigo-200 shadow-md"
                        : "border-gray-200 shadow-sm hover:border-gray-300"
                    } transition-all`}
                  >
                    {/* Clickable Header */}
                    <div
                      className="flex items-center justify-between p-5 cursor-pointer select-none"
                      onClick={() =>
                        setExpandedCardId(isExpanded ? null : result._id)
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
                          {getInitials(feedback?.candidateName || "NA")}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {feedback?.candidateName || "Unknown Candidate"}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                            <span>{feedback?.role || "N/A"}</span>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(
                                result.completedAt || result.createdAt,
                              )}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {result.interview_id?.duration || "N/A"}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {result.transcript?.length || 0} responses
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                            feedback?.overallVerdict === "accept" ||
                            feedback?.overallVerdict === "hire"
                              ? "bg-green-100 text-green-700"
                              : feedback?.overallVerdict === "reject"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {feedback?.overallVerdict || "N/A"}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                          AI Score: {result.score || 0}%
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-100">
                        {/* Score Cards */}
                        <div className="grid grid-cols-4 gap-4 mt-4 mb-5">
                          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                            <p className="text-xs text-gray-600 mb-2 font-medium">
                              Technical Skills
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {feedback?.technicalScore || 0}%
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                            <p className="text-xs text-gray-600 mb-2 font-medium">
                              Communication
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {feedback?.speechPatterns?.clarityScore || 0}%
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                            <p className="text-xs text-gray-600 mb-2 font-medium">
                              Confidence
                            </p>
                            <p
                              className={`text-xl font-bold ${
                                feedback?.confidenceLabel
                                  ?.toLowerCase()
                                  ?.includes("high")
                                  ? "text-green-600"
                                  : feedback?.confidenceLabel
                                        ?.toLowerCase()
                                        ?.includes("medium")
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {feedback?.confidenceLabel || "N/A"}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                            <p className="text-xs text-gray-600 mb-2 font-medium">
                              Relevance
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {feedback?.relevanceScore || 0}%
                            </p>
                          </div>
                        </div>

                        {/* Assessment Summary */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-5 border border-blue-100">
                          <p className="text-xs text-gray-600 mb-2 font-semibold">
                            Assessment summary
                          </p>
                          <p className="text-sm text-gray-800 italic">
                            "{feedback?.verdictReason || "No summary available"}
                            "
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetailedScorecard(result);
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                            View Detailed Scorecard
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAIAnalysis(result);
                            }}
                            className="flex items-center gap-2 px-6 py-3 text-gray-700 bg-white border-2 border-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            AI Analysis Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Pagination */}
          {!loading && filteredAIScores.length > aiItemsPerPage && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                Page {aiCurrentPage} of {aiTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={aiCurrentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                {Array.from({ length: aiTotalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setAiCurrentPage(page)}
                      className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                        page === aiCurrentPage
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  onClick={() =>
                    setAiCurrentPage((p) => Math.min(aiTotalPages, p + 1))
                  }
                  disabled={aiCurrentPage === aiTotalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MCQ Test Tab */}
      {activeTab === "MCQ" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              MCQ Assessment Result
            </h2>
            <div className="text-sm text-gray-500">
              Showing{" "}
              {filteredAIScores.length === 0
                ? "0"
                : `${(aiCurrentPage - 1) * aiItemsPerPage + 1}-${Math.min(aiCurrentPage * aiItemsPerPage, scores.length)}`}{" "}
              of {filteredAIScores.length} candidates
            </div>
          </div>
          {/* Filters Card */}
          <div className="flex flex-wrap gap-3 bg-white p-2 rounded-sm ">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Search candidate..."
                value={filters.name}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, name: e.target.value }))
                }
                className="pl-9 pr-4 py-2 w-56 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            {/* Min Score */}
            <input
              type="number"
              placeholder="Min Score %"
              value={filters.minScore}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minScore: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-32 focus:ring-2 focus:ring-indigo-600 outline-none"
            />

            {/* Max Score */}
            <input
              type="number"
              placeholder="Max Score %"
              value={filters.maxScore}
              onChange={(e) =>
                setFilters((f) => ({ ...f, maxScore: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-32 focus:ring-2 focus:ring-indigo-600 outline-none"
            />

            {/* Start Date */}
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((f) => ({ ...f, startDate: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
            />

            {/* End Date */}
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters((f) => ({ ...f, endDate: e.target.value }))
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
            />

            {/* Clear Button */}
            <button
              onClick={() =>
                setFilters({
                  name: "",
                  minScore: "",
                  maxScore: "",
                  startDate: "",
                  endDate: "",
                })
              }
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900">
                MCQ Test Result
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sr. No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Candidates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Test Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Marks
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <TableSkeleton />
                  ) : filteredScores?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-6 text-gray-500"
                      >
                        No Data Available
                      </td>
                    </tr>
                  ) : (
                    filteredScores.map((row, i) => (
                      <tr key={row._id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm">{i + 1}</td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium">
                            {row?.candidateId?.name || "N/A"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {row?.candidateId?.email || "N/A"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {row?.interviewId?.test_title || "N/A"}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {Math.round((row.totalScore / row.maxScore) * 100)}%
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {row?.totalScore}/{row?.maxScore || "N/A"}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {row?.interviewId?.duration || "N/A"}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {formatDate(row.updatedAt)}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setSelectedScore(row)}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MCQ Modal */}
            {selectedScore && selectedScore?.examType === "MCQ" && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white w-[1200px] max-h-[95vh] overflow-y-auto rounded-xl shadow-2xl p-6 relative animate-fadeIn">
                  <button
                    onClick={() => setSelectedScore(null)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-black text-lg"
                  >
                    ✕
                  </button>

                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Exam Detailed Report
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedScore?.interviewId?.test_title}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Candidate Details
                      </h3>
                      <p>
                        <strong>Name:</strong> {selectedScore?.candidateId.name}
                      </p>
                      <p>
                        <strong>Email:</strong>{" "}
                        {selectedScore?.candidateId?.email}
                      </p>
                      <p>
                        <strong>Role:</strong>{" "}
                        {selectedScore?.candidateId?.role}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Exam Details
                      </h3>
                      <p>
                        <strong>Difficulty:</strong>{" "}
                        {selectedScore?.interviewId?.difficulty}
                      </p>
                      <p>
                        <strong>Duration:</strong>{" "}
                        {selectedScore?.interviewId?.duration}
                      </p>
                      <p>
                        <strong>Passing Score:</strong>{" "}
                        {selectedScore?.interviewId?.passing_score}%
                      </p>
                      <p>
                        <strong>Completed:</strong>{" "}
                        {formatDate(selectedScore?.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-indigo-50 p-5 rounded-lg mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Overall Score
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-indigo-600">
                          {Math.round(
                            (selectedScore?.totalScore /
                              selectedScore?.maxScore) *
                              100,
                          )}
                          %
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedScore?.totalScore}/{selectedScore?.maxScore}
                        </p>
                      </div>
                      <a
                        href={selectedScore?.pdfPath}
                        download
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                      >
                        Download Scorecard
                      </a>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      AI Assessment Summary
                    </h3>
                    <p className="text-sm text-gray-700">
                      {selectedScore?.summary}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Question Wise Analysis
                    </h3>
                    <div className="space-y-4">
                      {selectedScore?.scores?.map((q, index) => {
                        const question = q?.questionId;
                        const candidateAnswer = question?.answers?.find(
                          (a: any) =>
                            a.candidateId === selectedScore?.candidateId?._id,
                        );
                        const isCorrect =
                          candidateAnswer?.answerText ===
                          question?.correctAnswer;

                        return (
                          <div
                            key={q._id}
                            className="border border-gray-100 rounded-lg p-4 bg-gray-50"
                          >
                            <p className="font-medium text-gray-900 mb-2">
                              Q{index + 1}. {question?.questionText || "N/A"}
                            </p>
                            {question?.options && (
                              <div className="space-y-1 mb-3">
                                {question?.options.map(
                                  (opt: string, i: number) => (
                                    <div
                                      key={i}
                                      className={`text-sm px-3 py-1 rounded-md ${
                                        opt === question?.correctAnswer
                                          ? "bg-green-100 text-green-700"
                                          : opt === candidateAnswer?.answerText
                                            ? "bg-red-100 text-red-700"
                                            : "bg-white"
                                      }`}
                                    >
                                      {opt}
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-sm">
                                <span className="font-medium">
                                  Candidate Answer:
                                </span>{" "}
                                {candidateAnswer?.answerText || "Not Answered"}
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`px-3 py-1 text-xs rounded-full font-medium ${
                                    isCorrect
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {isCorrect ? "Correct" : "Wrong"}
                                </span>
                                <span className="text-sm font-semibold">
                                  Score: {q.score}
                                </span>
                              </div>
                            </div>
                            {q.feedback && (
                              <p className="mt-2 text-sm text-gray-600">
                                Feedback: {q.feedback}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Scorecard Modal */}
      {showDetailedScorecard && selectedScore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Detailed Scorecard
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedScore.feedback?.candidateName || "Candidate"}{" "}
                  &middot;{" "}
                  {selectedScore.feedback?.role ||
                    selectedScore.interview_id?.position ||
                    "N/A"}
                </p>
              </div>
              <button
                onClick={() => setShowDetailedScorecard(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* Overall Performance */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      Overall Performance
                    </h3>
                    <div className="flex items-center gap-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                          (selectedScore.score || 0) >=
                          (selectedScore.interview_id?.passingScore || 70)
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {(selectedScore.score || 0) >=
                        (selectedScore.interview_id?.passingScore || 70) ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        L1 Screening:{" "}
                        {(selectedScore.score || 0) >=
                        (selectedScore.interview_id?.passingScore || 70)
                          ? "PASSED"
                          : "FAILED"}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                          selectedScore.feedback?.overallVerdict === "accept" ||
                          selectedScore.feedback?.overallVerdict === "hire"
                            ? "bg-green-100 text-green-700"
                            : selectedScore.feedback?.overallVerdict ===
                                "reject"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        Verdict:{" "}
                        {selectedScore.feedback?.overallVerdict || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-indigo-600">
                      {selectedScore.score || 0}%
                    </div>
                    <div className="text-sm text-gray-500">AI Score</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Passing: {selectedScore.interview_id?.passingScore || 70}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Interview Details */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Position</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedScore.interview_id?.position || "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Difficulty</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedScore.interview_id?.difficulty || "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Duration</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedScore.interview_id?.duration || "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Questions</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedScore.interview_id?.numberOfQuestions || "N/A"}
                  </p>
                </div>
              </div>

              {/* Skills Tags */}
              {selectedScore.interview_id?.skills?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Skills Evaluated
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedScore.interview_id.skills.map(
                      (skill: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200"
                        >
                          {skill}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Two Column: Technical Competency + Speech & Communication */}
              <div className="grid grid-cols-2 gap-6">
                {/* Technical Competency */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Technical Competency
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {selectedScore.feedback?.technicalCompetency?.map(
                      (item: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            item.status === "good"
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {item.status === "good" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <p className="text-sm font-semibold text-gray-900">
                              {item.title}
                            </p>
                          </div>
                          <p className="text-xs text-gray-600 ml-6">
                            {item.description}
                          </p>
                        </div>
                      ),
                    ) || (
                      <p className="text-sm text-gray-500">No data available</p>
                    )}
                  </div>
                </div>

                {/* Speech & Communication */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Speech & Communication
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">
                          Clarity Score
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {selectedScore.feedback?.speechPatterns
                            ?.clarityScore || 0}
                          %
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{
                            width: `${selectedScore.feedback?.speechPatterns?.clarityScore || 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">
                          Confidence Level
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {selectedScore.feedback?.speechPatterns
                            ?.confidenceLevel || 0}
                          %
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{
                            width: `${selectedScore.feedback?.speechPatterns?.confidenceLevel || 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                        <p className="text-lg font-bold text-gray-900">
                          {selectedScore.feedback?.speechPatterns
                            ?.avgResponseTime || "N/A"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Avg Response Time
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                        <p className="text-lg font-bold text-gray-900">
                          {selectedScore.feedback?.speechPatterns
                            ?.complexityScore || 0}
                        </p>
                        <p className="text-xs text-gray-500">
                          Complexity Score
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Behavioral Assessment */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Behavioral Assessment
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {selectedScore.feedback?.behavioralInsights?.map(
                    (item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          item.status === "good"
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        {item.status === "good" ? (
                          <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ),
                  ) || (
                    <p className="text-sm text-gray-500">No data available</p>
                  )}
                </div>
              </div>

              {/* Assessment Summary */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Assessment Summary
                </h3>
                <p className="text-sm text-gray-800 italic">
                  "
                  {selectedScore.feedback?.verdictReason ||
                    "No summary available"}
                  "
                </p>
              </div>

              {/* Recommendations */}
              {selectedScore.feedback?.recommendations &&
                selectedScore.feedback.recommendations.length > 0 && (
                  <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {selectedScore.feedback.recommendations.map(
                        (rec: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <span className="text-indigo-600 mt-0.5 font-bold">
                              •
                            </span>
                            <span>{rec}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {/* Download Scorecard */}
              {selectedScore.pdfPath && (
                <div className="flex justify-end">
                  <a
                    href={selectedScore.pdfPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Download Scorecard PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Details Modal */}
      {showAIAnalysis && selectedScore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  AI Analysis Details
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedScore.feedback?.candidateName || "Candidate"}{" "}
                  &middot;{" "}
                  {selectedScore.feedback?.role ||
                    selectedScore.interview_id?.position ||
                    "N/A"}
                </p>
              </div>
              <button
                onClick={() => setShowAIAnalysis(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* AI Confidence Analysis */}
              <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    AI Confidence Analysis
                  </h3>
                  <span
                    className={`px-4 py-1.5 text-sm font-bold rounded-full ${
                      (selectedScore.feedback?.confidenceScore || 0) >= 70
                        ? "bg-green-200 text-green-800"
                        : (selectedScore.feedback?.confidenceScore || 0) >= 40
                          ? "bg-yellow-200 text-yellow-800"
                          : "bg-red-200 text-red-800"
                    }`}
                  >
                    {selectedScore.feedback?.confidenceLabel || "N/A"}:{" "}
                    {selectedScore.feedback?.confidenceScore || 0}%
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Our AI model analyzed speech patterns, response timing,
                  technical accuracy, and communication clarity to generate this
                  assessment.
                </p>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Behavioral Insights */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Behavioral Insights
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {selectedScore.feedback?.behavioralInsights?.map(
                      (insight: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            insight.status === "good"
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          {insight.status === "good" ? (
                            <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
                          )}
                          <div>
                            <p className="font-semibold text-sm text-gray-900">
                              {insight.title}
                            </p>
                            <p className="text-xs text-gray-600">
                              {insight.description}
                            </p>
                          </div>
                        </div>
                      ),
                    ) || (
                      <p className="text-sm text-gray-500">
                        No behavioral data available
                      </p>
                    )}
                  </div>
                </div>

                {/* Technical Competency */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Technical Competency
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {selectedScore.feedback?.technicalCompetency?.map(
                      (comp: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            comp.status === "good"
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          {comp.status === "good" ? (
                            <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
                          )}
                          <div>
                            <p className="font-semibold text-sm text-gray-900">
                              {comp.title}
                            </p>
                            <p className="text-xs text-gray-600">
                              {comp.description}
                            </p>
                          </div>
                        </div>
                      ),
                    ) || (
                      <p className="text-sm text-gray-500">
                        No technical data available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Speech Pattern Analysis */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Speech Pattern Analysis
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="text-3xl font-bold text-blue-600">
                      {selectedScore.feedback?.speechPatterns?.clarityScore ||
                        0}
                      %
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Clarity Score
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="text-3xl font-bold text-green-600">
                      {selectedScore.feedback?.speechPatterns
                        ?.avgResponseTime || "N/A"}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Avg Response Time
                    </div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="text-3xl font-bold text-purple-600">
                      {selectedScore.feedback?.speechPatterns
                        ?.confidenceLevel || 0}
                      %
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Confidence Level
                    </div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="text-3xl font-bold text-orange-600">
                      {selectedScore.feedback?.speechPatterns
                        ?.complexityScore || 0}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Complexity Score
                    </div>
                  </div>
                </div>
              </div>

              {/* Behavior Report */}
              {selectedScore.behaviorReport && (
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Behavior Report
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                      <p className="text-2xl font-bold text-gray-900">
                        {selectedScore.behaviorReport.totalEvents || 0}
                      </p>
                      <p className="text-xs text-gray-500">Total Events</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                      <p className="text-2xl font-bold text-gray-900">
                        {selectedScore.behaviorReport.noFaceCount || 0}
                      </p>
                      <p className="text-xs text-gray-500">No Face Detected</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                      <p className="text-2xl font-bold text-gray-900">
                        {selectedScore.behaviorReport.multipleFacesCount || 0}
                      </p>
                      <p className="text-xs text-gray-500">Multiple Faces</p>
                    </div>
                  </div>
                  {selectedScore.behaviorReport.events?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-semibold text-gray-700">
                        Events:
                      </p>
                      {selectedScore.behaviorReport.events.map(
                        (event: any, idx: number) => (
                          <div
                            key={idx}
                            className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-100"
                          >
                            {event.type ||
                              event.description ||
                              JSON.stringify(event)}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Verdict Summary */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Verdict Summary
                </h3>
                <p className="text-sm text-gray-800 italic">
                  "
                  {selectedScore.feedback?.verdictReason ||
                    "No summary available"}
                  "
                </p>
              </div>

              {/* AI Recommendations - All */}
              {selectedScore.feedback?.recommendations &&
                selectedScore.feedback.recommendations.length > 0 && (
                  <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                      AI Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {selectedScore.feedback.recommendations.map(
                        (rec: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <div className="h-5 w-5 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-indigo-700 font-bold text-xs">
                                {idx + 1}
                              </span>
                            </div>
                            <span>{rec}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ReportsInsights;
