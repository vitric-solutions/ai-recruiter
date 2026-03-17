import React, { useMemo, useState } from "react";
import {
  X,
  Download,
  Mail,
  Phone,
  Briefcase,
  Clock,
  Trophy,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";

interface ViewCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateData: any;
}

const ROWS_PER_PAGE = 5;

const ViewCandidateModal: React.FC<ViewCandidateModalProps> = ({
  isOpen,
  onClose,
  candidateData,
}) => {
  if (!isOpen || !candidateData) return null;

  const { candidate, summary, interviews } = candidateData;

  const [examFilter, setExamFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [page, setPage] = useState(1);

  /* ── Initials + color ──────────────────────── */
  const initials = candidate.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "??";

  /* ── Filter ──────────────────────────────── */
  const filteredInterviews = useMemo(() => {
    return interviews.filter((iv: any) => {
      const passed = iv.score >= iv.passingScore;
      const examMatch = examFilter === "all" || iv.examType === examFilter;
      const resultMatch =
        resultFilter === "all" ||
        (resultFilter === "pass" && passed) ||
        (resultFilter === "fail" && !passed);
      return examMatch && resultMatch;
    });
  }, [interviews, examFilter, resultFilter]);

  /* ── Pagination ──────────────────────────── */
  const totalPages = Math.ceil(filteredInterviews.length / ROWS_PER_PAGE);
  const paginatedData = filteredInterviews.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );

  const passRate =
    summary.totalInterviews > 0
      ? Math.round((summary.passed / summary.totalInterviews) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── TOP HERO HEADER ── */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-8 pt-8 pb-6 flex-shrink-0">
          {/* subtle pattern */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
          />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={16} />
          </button>

          <div className="relative flex items-center gap-5">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-lg">
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white leading-tight truncate">
                {candidate.name}
              </h2>
              <p className="text-indigo-200 text-sm mt-0.5">{candidate.role}</p>

              {/* Quick pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs">
                  <Mail size={11} /> {candidate.email}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs">
                  <Phone size={11} /> {candidate.mobile}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs">
                  <Clock size={11} /> {candidate.year_of_experience} yrs exp
                </span>
              </div>
            </div>

            {/* Pass rate ring */}
            <div className="flex-shrink-0 text-center hidden sm:block">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="white" strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - passRate / 100)}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white font-bold text-lg leading-none">{passRate}%</span>
                  <span className="text-indigo-200 text-[9px] mt-0.5">Pass Rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: "Total Interviews", value: summary.totalInterviews, icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Completed",        value: summary.completed,        icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Passed",           value: summary.passed,           icon: Trophy,       color: "text-amber-600",  bg: "bg-amber-50"  },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-4 px-6 py-5">
                <div className={`${bg} ${color} h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── SKILLS + INFO ROW ── */}
          <div className="px-8 py-5 border-b border-gray-100 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Briefcase size={14} className="text-gray-400" />
              <span className="font-medium text-gray-700">Skills:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(candidate.key_Skills || "")
                .split(/[|,]/)
                .map((s: string) => s.trim())
                .filter(Boolean)
                .map((skill: string, i: number) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100"
                  >
                    {skill}
                  </span>
                ))}
            </div>
          </div>

          {/* ── INTERVIEW RECORDS ── */}
          <div className="px-8 py-6">
            {/* Section header + filters */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Interview Records
                <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-normal">
                  {filteredInterviews.length}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={examFilter}
                  onChange={(e) => { setExamFilter(e.target.value); setPage(1); }}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-600"
                >
                  <option value="all">All Types</option>
                  <option value="MCQ">MCQ</option>
                  <option value="AI">AI</option>
                </select>
                <select
                  value={resultFilter}
                  onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-600"
                >
                  <option value="all">All Results</option>
                  <option value="pass">Passed</option>
                  <option value="fail">Failed</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Title", "Type", "Status", "Score", "Result", "Scorecard"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <Layers size={28} className="opacity-40" />
                          <span className="text-sm">No interview records found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((interview: any) => {
                      const passed = interview.score >= interview.passingScore;
                      const pct = interview.passingScore > 0
                        ? Math.round((interview.score / interview.passingScore) * 100)
                        : 0;

                      return (
                        <tr
                          key={interview.interviewId}
                          className="hover:bg-gray-50/70 transition-colors"
                        >
                          {/* Title */}
                          <td className="px-5 py-4">
                            <span className="font-medium text-gray-800">{interview.title}</span>
                          </td>

                          {/* Type */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${interview.examType === "AI"
                                ? "bg-violet-50 text-violet-700 border border-violet-100"
                                : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
                              {interview.examType}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className="capitalize text-gray-600 text-xs">{interview.status}</span>
                          </td>

                          {/* Score with mini bar */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${passed ? "bg-emerald-500" : "bg-red-400"}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-gray-700 text-xs whitespace-nowrap">
                                {interview.score} / {interview.passingScore}
                              </span>
                            </div>
                          </td>

                          {/* Result */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${passed
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-red-50 text-red-700 border border-red-100"}`}>
                              {passed
                                ? <><CheckCircle2 size={11} /> Passed</>
                                : <><XCircle size={11} /> Failed</>}
                            </span>
                          </td>

                          {/* Scorecard */}
                          <td className="px-5 py-4">
                            {interview.pdfPath ? (
                              <a
                                href={interview.pdfPath}
                                download
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
                              >
                                <Download size={12} />
                                Download
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-gray-500">
                  Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filteredInterviews.length)} of {filteredInterviews.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        page === p
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewCandidateModal;