import React, { useMemo, useState } from "react";
import { X, Users } from "lucide-react";

interface ViewAssignedCandidateProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentData: any;
}

const ROWS_PER_PAGE = 5;

const ViewAssignedCandidate: React.FC<ViewAssignedCandidateProps> = ({
  isOpen,
  onClose,
  assessmentData,
}) => {
  if (!isOpen || !assessmentData) return null;
  console.log("assessmentData",assessmentData)

  const { candidates } = assessmentData;

  const [statusFilter, setStatusFilter] = useState("all");
  const [nameSearch, setNameSearch] = useState("");
  const [page, setPage] = useState(1);

  /* ================= FILTER LOGIC ================= */
  const filteredData = useMemo(() => {
    return candidates.filter((candidate: any) => {
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
  }, [candidates, statusFilter, nameSearch]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  const paginatedData = filteredData.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );

 

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {assessmentData.test_title}
            </h2>
            <p className="text-sm text-gray-500">Assigned Candidates</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* ================= FILTERS ================= */}
          <div className="flex flex-wrap gap-4 items-center justify-end">
            {/* Name Search */}
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
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    S.No
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Candidate Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
             
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    End Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Scorecard
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
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
                  paginatedData.map((candidate: any, index: number) => {
                    const globalIndex = (page - 1) * ROWS_PER_PAGE + index + 1;
                    
                    return (
                      <tr
                        key={candidate._id || index}
                        className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm text-gray-900">
                          {globalIndex}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900">
                            {candidate.candidateId?.name || "N/A"}
                          </div>
                          {candidate.candidateId?.role && (
                            <div className="text-xs text-gray-500">
                              {candidate.candidateId.role}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {candidate.candidateId?.email || "N/A"}
                        </td>

                   

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {new Date(candidate.start_Date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {new Date(candidate.end_Date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full font-medium ${
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
                          {candidate.scoreDetails?.pdfPath ?  (
                             <a
                        href={candidate.scoreDetails?.pdfPath}
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ================= PAGINATION ================= */}
          {totalPages > 1 && (
            <div className="flex w-full justify-end items-center gap-2 pt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
              ))}

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
            Showing {paginatedData.length > 0 ? (page - 1) * ROWS_PER_PAGE + 1 : 0} to{" "}
            {Math.min(page * ROWS_PER_PAGE, filteredData.length)} of{" "}
            {filteredData.length} candidates
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewAssignedCandidate;