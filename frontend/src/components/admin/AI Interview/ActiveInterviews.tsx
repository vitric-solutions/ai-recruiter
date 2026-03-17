import { Button } from "../../../ui/button";
import { useEffect, useState, useMemo } from "react";
import { FileText, Clock, X, CheckCircle2, Users } from "lucide-react";
import { adminService } from "../../../services/service/adminService";

interface ActiveInterviewsProps {
  onNavigateToInterviewSetup: (assessment: any) => void;
  onEditInterview: (assessment: any) => void;
}

const ROWS_PER_PAGE = 5;

const ActiveInterviews: React.FC<ActiveInterviewsProps> = ({
  onNavigateToInterviewSetup,
  onEditInterview,
}) => {
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);
  console.log("Assessments:", assessments);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);

  // Filter & pagination state for candidate modal
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameSearch, setNameSearch] = useState("");
  const [page, setPage] = useState(1);

  const handleViewCandidates = async (assessment: any) => {
    const res = await adminService.getDraft(assessment._id);
    setSelectedInterview(res.data);
    // Reset filters when opening modal
    setStatusFilter("all");
    setNameSearch("");
    setPage(1);
    setIsResultOpen(true);
  };

  const handleCloseModal = () => {
    setIsResultOpen(false);
    setStatusFilter("all");
    setNameSearch("");
    setPage(1);
  };

  useEffect(() => {
    
    let isMounted = true;
    const loadAssessments = async () => {
      setTemplatesLoading(true);
      try {
        const res: any = await adminService.getDraft();
        console.log("API Response for getDraft:", res);

        const interviews =
          res?.data?.interviews || res?.interviews || res?.drafts || [];

        setAssessments(interviews);
      } catch (error) {
        console.error("Error fetching assessments:", error);
        setAssessments([]); // never allow undefined
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadAssessments();

    return () => {
      isMounted = false;
    };
  }, []);

  /* ================= FILTER LOGIC ================= */
  const filteredCandidates = useMemo(() => {
    if (!selectedInterview?.candidates) return [];
    return selectedInterview.candidates.filter((candidate: any) => {
      const statusMatch =
        statusFilter === "all" || candidate.status === statusFilter;
      const nameMatch =
        !nameSearch ||
        candidate.candidateId?.name
          ?.toLowerCase()
          .includes(nameSearch.toLowerCase()) ||
        candidate.candidateId?.email
          ?.toLowerCase()
          .includes(nameSearch.toLowerCase());
      return statusMatch && nameMatch;
    });
  }, [selectedInterview, statusFilter, nameSearch]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredCandidates.length / ROWS_PER_PAGE);

  const paginatedCandidates = filteredCandidates.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );
  console.log(paginatedCandidates);

  // const getTimeAgo = (dateString: string) => {
  //   const now = new Date();
  //   const past = new Date(dateString);

  //   const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  //   if (diffInSeconds < 60) {
  //     return "Just now";
  //   }

  //   const diffInMinutes = Math.floor(diffInSeconds / 60);
  //   if (diffInMinutes < 60) {
  //     return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
  //   }

  //   const diffInHours = Math.floor(diffInMinutes / 60);
  //   if (diffInHours < 24) {
  //     return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  //   }

  //   const diffInDays = Math.floor(diffInHours / 24);
  //   return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  // };

  return (
    <div className=" flex  ">
      <div className="w-full">
        <div className="pt-12">
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
                  </div>
                </div>
              ))}
            </div>
          ) : assessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center w-full">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No templates yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Create an assessment and save it as a template
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {assessments.map((assessment: any) => {
                const difficultyConfig: Record<
                  string,
                  { bg: string; text: string; dot: string }
                > = {
                  Advanced: {
                    bg: "bg-orange-50",
                    text: "text-orange-600",
                    dot: "bg-orange-400",
                  },
                  Easy: {
                    bg: "bg-emerald-50",
                    text: "text-emerald-600",
                    dot: "bg-emerald-400",
                  },
                  Medium: {
                    bg: "bg-sky-50",
                    text: "text-sky-600",
                    dot: "bg-sky-400",
                  },
                };
                const diff =
                  difficultyConfig[assessment.difficulty] ??
                  difficultyConfig["Medium"];
                const skills: string[] = assessment.skills ?? [];
                const MAX_VISIBLE = 5;
                const visibleSkills = skills.slice(0, MAX_VISIBLE);
                const remainingCount = skills.length - MAX_VISIBLE;

                return (
                  <div
                    key={assessment._id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-200 flex flex-col"
                    style={{ minHeight: "320px" }}
                  >
                    {/* Card Header */}
                    <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                          {assessment.examType ?? "AI"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${diff.bg} ${diff.text} shrink-0`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${diff.dot}`}
                          />
                          {assessment.difficulty}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">
                        {assessment.test_title || assessment.position}
                      </h3>

                      <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {assessment.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-gray-400" />
                          {assessment.numberOfQuestions} Qs
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />
                          Pass:{" "}
                          {assessment.passingScore ??
                            assessment.passing_score ??
                            60}
                          %
                        </span>
                      </div>
                    </div>

                    {/* Skills Section — flex-1 fills remaining space so all cards are equal height */}
                    <div className="px-5 py-4 flex-1">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                        Skills
                      </p>
                      {skills.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">
                          No skills listed
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {visibleSkills.map((skill, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {skill}
                            </span>
                          ))}
                          {remainingCount > 0 && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                              +{remainingCount} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 pb-5 pt-3 border-t border-gray-100">
                      {assessment.createdAt && (
                        <p className="text-xs text-gray-400 mb-3">
                          Created{" "}
                          {new Date(assessment.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onNavigateToInterviewSetup(assessment)}
                          className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all duration-150"
                        >
                          Use Template
                        </button>
                        <button
                          onClick={() => handleViewCandidates(assessment)}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
                          title="View Candidates"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onEditInterview(assessment)}
                          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
                          title="Edit"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= CANDIDATE MODAL ================= */}
      {isResultOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedInterview?.position}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Candidate Details</p>
              </div>

              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {/* ================= FILTERS ================= */}
              <div className="flex flex-wrap gap-4 items-center justify-end">
                {/* Name / Email Search */}
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={nameSearch}
                  onChange={(e) => {
                    setNameSearch(e.target.value);
                    setPage(1);
                  }}
                  className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64"
                />

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="border border-gray-200 rounded-lg px-4 py-2 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <button
                  onClick={() => {
                    setNameSearch("");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* ================= TABLE ================= */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        UserName
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        End Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Scorecard
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12">
                          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">
                            No candidates found
                          </p>
                          <p className="text-gray-400 text-sm mt-1">
                            Try adjusting your filters
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedCandidates.map(
                        (candidate: any, index: number) => {
                          const globalIndex =
                            (page - 1) * ROWS_PER_PAGE + index + 1;
                          return (
                            <tr
                              key={candidate._id || index}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {globalIndex}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                                {candidate.candidateId.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                                {candidate.candidateId.email}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(
                                  candidate.scheduledStartDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(
                                  candidate.scheduledEndDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    candidate.status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : candidate.status === "in_progress"
                                        ? "bg-blue-100 text-blue-700"
                                        : candidate.status === "cancelled"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {candidate.status === "in_progress"
                                    ? "In Progress"
                                    : candidate.status.charAt(0).toUpperCase() +
                                      candidate.status.slice(1)}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                {candidate.feedback?.pdfPath ? (
                                  <a
                                    href={`${candidate.feedback?.pdfPath}`}
                                    target="_blank"
                                    download
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                                  >
                                    Download
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-xs">
                                    Not Available
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* ================= PAGINATION ================= */}
              {totalPages > 1 && (
                <div className="flex w-full justify-end items-center gap-2 pt-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    ‹
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1 rounded transition-colors ${
                          page === p
                            ? "bg-indigo-600 text-white"
                            : "border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}

                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    ›
                  </button>
                </div>
              )}

              {/* Records Count */}
              <div className="text-sm text-gray-500 text-center">
                Showing{" "}
                {paginatedCandidates.length > 0
                  ? (page - 1) * ROWS_PER_PAGE + 1
                  : 0}{" "}
                to {Math.min(page * ROWS_PER_PAGE, filteredCandidates.length)}{" "}
                of {filteredCandidates.length} candidates
              </div>
            </div>
          </div>
        </div>
      )}

      {isReminderOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Send Interview Reminders
              </h2>
              <button
                onClick={() => setIsReminderOpen(false)}
                className="text-red-500 text-2xl font-bold hover:opacity-75"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This will send email reminders to all 6 pending candidates for the
              Frontend Developer position. The reminder will include the
              interview link and instructions.
            </p>
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                className="text-sm"
                onClick={() => setIsReminderOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm">
                Send Reminders
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveInterviews;
