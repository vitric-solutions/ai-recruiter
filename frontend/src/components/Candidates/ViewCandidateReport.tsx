import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTheme } from "../../context/Themecontext";

interface ViewCandidateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateData: any;
}

const ROWS_PER_PAGE = 5;

const ViewCandidateReportModal: React.FC<ViewCandidateReportModalProps> = ({
  isOpen,
  onClose,
  candidateData,
}) => {
  const { theme } = useTheme();

  if (!isOpen || !candidateData) return null;

  const { interviews } = candidateData;
  // const BASE_URL = import.meta.env.VITE_BASE_URL;

  const [examFilter, setExamFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [page, setPage] = useState(1);

  /* ================= DOWNLOAD ================= */
  // const handleDownload = (pdfPath: string) => {
  //   const link = document.createElement("a");
  //   link.href = `${BASE_URL}/${pdfPath}`;
  //   link.download = pdfPath.split("/").pop() || "scorecard.pdf";
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };

  /* ================= FILTER LOGIC ================= */
  const filteredData = useMemo(() => {
    return interviews.filter((interview: any) => {
      const passed = interview.score >= interview.passingScore;

      const examMatch =
        examFilter === "all" || interview.examType === examFilter;

      const resultMatch =
        resultFilter === "all" ||
        (resultFilter === "pass" && passed) ||
        (resultFilter === "fail" && !passed);

      return examMatch && resultMatch;
    });
  }, [interviews, examFilter, resultFilter]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  const paginatedData = filteredData.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold">Candidate Report</h2>
            <p className="text-sm text-gray-500">
              Performance overview with filters
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* ================= FILTERS ================= */}
          <div className="flex flex-wrap gap-4 items-center  justify-end">
            {/* Exam Type Filter */}
            <select
              value={examFilter}
              onChange={(e) => {
                setExamFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm"
            >
              <option value="all">All Exam Types</option>
              <option value="MCQ">MCQ</option>
              <option value="AI">AI</option>
            </select>

            {/* Result Filter */}
            <select
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm"
            >
              <option value="all">All Results</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
            </select>

            {/* <div className="text-sm text-gray-500 ml-auto">
              Showing {filteredData.length} records
            </div> */}
          </div>

          {/* ================= TABLE ================= */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className={`border-b ${theme === 'dark' ? 'bg-slate-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <tr>
                  <th className="px-5 py-3 text-left text-gray-700 dark:text-gray-300">Title</th>
                  <th className="px-5 py-3 text-left text-gray-700 dark:text-gray-300">Type</th>
                  <th className="px-5 py-3 text-left text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-5 py-3 text-left text-gray-700 dark:text-gray-300">Score</th>
                  <th className="px-5 py-3 text-left text-gray-700 dark:text-gray-300">Result</th>
                  <th className="px-5 py-3 text-left text-gray-700 dark:text-gray-300">Scorecard</th>
                </tr>
              </thead>

              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400">
                      No interview records found
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((interview: any) => {
                    const passed = interview.score >= interview.passingScore;

                    return (
                      <tr
                        key={interview.interviewId}
                        className={`border-b ${theme === 'dark' ? 'border-gray-700 dark:hover:bg-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <td className="px-5 py-4 font-medium">
                          {interview.title}
                        </td>

                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            theme === 'dark'
                              ? 'bg-indigo-800 text-indigo-100'
                              : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            {interview.examType}
                          </span>
                        </td>

                        <td className="px-5 py-4 capitalize">
                          {interview.status}
                        </td>

                        <td className="px-5 py-4">
                          {interview.score} / 100
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              passed
                                ? theme === 'dark'
                                  ? 'bg-emerald-900/40 text-emerald-200'
                                  : 'bg-green-100 text-green-600'
                                : interview.status === 'scheduled'
                                  ? theme === 'dark'
                                    ? 'bg-slate-700 text-slate-200'
                                    : 'bg-gray-100 text-gray-600'
                                  : theme === 'dark'
                                    ? 'bg-rose-900/40 text-rose-200'
                                    : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {passed
                              ? 'Passed'
                              : interview.status === 'scheduled'
                                ? 'Scheduled'
                                : 'Failed'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {interview.pdfPath ? (
                            // <button
                            //   onClick={() =>
                            //     handleDownload(interview.pdfPath)
                            //   }
                            //   className="flex items-center gap-2 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            // >
                            //   <Download size={14} />
                            //   Download
                            // </button>
                            <a
                              href={interview.pdfPath}
                              download
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                            >
                              Download Scorecard
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
            <div className="flex w-full  justify-end items-center gap-2 pt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-gray-200 rounded disabled:opacity-40"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded ${
                    page === p
                      ? "bg-indigo-600 text-white"
                      : "border  border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-gray-200 rounded disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewCandidateReportModal;
