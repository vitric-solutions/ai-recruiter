import { useState, useEffect } from "react";
import AdminLayout from "../../common/AdminLayout";
import { adminService } from "../../services/service/adminService";
import toast from "react-hot-toast";
import { FaUsers, FaClipboardList, FaFileAlt, FaRobot } from "react-icons/fa";
import { Plus, UserPlus, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import { useAuth } from "../../context/context";
import { useTheme } from "../../context/Themecontext";
import { adminPath } from "../../routes/EncryptRoute";

// Stat Card Component
const StatCard = ({
  icon: Icon,
  title,
  value,
  change,
  changeColor,
  bgColor,
  iconColor,
}: any) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className={`text-xs mt-2 ${changeColor}`}>{change}</p>
        </div>
        <div className={`${bgColor} dark:opacity-80 rounded-lg p-3`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};

type NavigateType =
  | string
  | {
      page: string;
      tab?: string;
    };

// Quick Actions Component
const QuickActions = ({
  onNavigate,
}: {
  onNavigate: (data: NavigateType) => void;
}) => {
  const actions = [
    {
      title: "Create New Assessment",
      icon: Plus,
      navigateTo: "Tests & Assessments",
    },
    {
      title: "Bulk Add Candidates",
      icon: UserPlus,
      navigateTo: { page: "Candidates", tab: "bulk" },
    },
    {
      title: "Schedule Interviews",
      icon: Calendar,
      navigateTo: "AI Video Interview",
    },
    {
      title: "View Analytics",
      icon: TrendingUp,
      navigateTo: "Reports & Insights",
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-5 border border-gray-200 dark:border-slate-700 transition-colors">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">          Most Common Recruitment tasks
        </p>
      </div>

      <div className="space-y-2">
        {actions.map((action, i) => {
          const Icon = action.icon;

          return (
            <button
              key={i}
              onClick={() => onNavigate(action.navigateTo)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{action.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TopPerformance = () => {
  const [examType, setExamType] = useState("AI");
  const [performers, setPerformers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTopPerformance = async (type: string) => {
    try {
      setLoading(true);

      const res = await adminService.getTopPerformance(type);

      if (res?.success) {
        const ranked = res.data.slice(0, 3).map((item: any, index: number) => {
          const isAI = res.type === "AI";

          return {
            rank: index + 1,
            name: isAI
              ? item.interview_id?.candidates?.[0]?.candidateId?.name || "-"
              : item.candidate?.name || "-",
            email: isAI
              ? item.interview_id?.candidates?.[0]?.candidateId?.email || "-"
              : item.candidate?.email || "-",
            score: isAI ? `${item.score}%` : `${item.totalScore}%`,
            percentage: isAI ? `${item.score}%` : `${item.percentage}%`,
            examType: isAI ? item.examType : item.interview?.examType,
            testTitle: isAI
              ? item.interview_id?.position
              : item.interview?.title,
            difficulty: isAI
              ? item.interview_id?.difficulty
              : item.interview?.difficulty,
            verdict: isAI ? item.feedback?.overallVerdict : null,
          };
        });

        setPerformers(ranked);
      } else {
        setPerformers([]);
      }
    } catch (error: any) {
      toast.error("Top Performance Error");
      setPerformers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopPerformance(examType);
  }, [examType]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Top Performance
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Top Scorers</p>
        </div>

        <div className="flex gap-2">
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded px-2 py-1 text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-indigo-600"
          >
            <option value="MCQ">MCQ</option>
            <option value="AI">AI</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      ) : performers.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          No Data Available
        </div>
      ) : (
        <div className="space-y-3 overflow-x-auto">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Candidate</div>
            <div className="col-span-3">Score</div>
            <div className="col-span-3">Test</div>
          </div>

          {performers.map((performer) => (
            <div
              key={performer.rank}
              className="grid grid-cols-12 gap-2 items-center py-2"
            >
              <div className="col-span-1 text-sm font-medium text-gray-900 dark:text-white">
                {performer.rank}
              </div>

              <div className="col-span-5">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {performer.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{performer.email}</p>
              </div>

              <div className="col-span-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {performer.score}
              </div>

              <div className="col-span-3 text-xs text-gray-600 dark:text-gray-400">
                {performer.testTitle}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UpcomingInterviews = ({
  interviews,
  onReschedule,
  onCancel,
}: {
  interviews: any[];
  onReschedule: (interview: any) => void;
  onCancel: (interview: any) => void;
}) => {
  const { theme } = useTheme();
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="flex w-full bg-white dark:bg-gray-800 flex-col px-5 gap-3 py-4 border-b border-gray-200 dark:border-gray-700 transition-colors">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Upcoming Interviews</h3>

      {interviews.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No upcoming interviews scheduled
        </p>
      ) : (
        interviews.map((interview, i) => (
          <div
            key={i}
            className="flex justify-between items-center px-4 py-3 rounded-lg border-2 border-gray-100 dark:border-gray-700 transition-colors"
          >
            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0 overflow-hidden">
                {getInitials(interview?.candidate?.name || "?")}
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {interview?.candidate?.name || "Unknown"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    theme === 'dark'
                      ? 'text-white bg-blue-900/40 border border-blue-500'
                      : 'text-green-600 bg-green-100'
                  }`}>
                    Upcoming
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {interview?.candidate?.role || interview.title}
                </span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">
                  {formatTime(interview.startDate)}
                </span>
              </div>
            </div>

            {/* Right: Buttons + Date */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onReschedule(interview)}
                  className="px-4 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => onCancel(interview)}
                  className="px-4 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer transition-colors"
                >
                  Cancel Interview
                </button>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(interview.startDate)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const { theme } = useTheme();
  const [totalCandidates, setTotalCandidates] = useState("0");
  const [mcqScheduledCount, setMcqScheduledCount] = useState("0");
  const [aiScheduledCount, setAiScheduledCount] = useState("0");
  const [totalScheduledTests, setTotalScheduledTests] = useState("0");
  const [upcomingInterviews, setUpcomingInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelInterview, setCancelInterview] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();

  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const candidateRes = await adminService.getAllCandidate(1, 100, "all");
      if (candidateRes?.status === 200) {
        setTotalCandidates(candidateRes.totalRecords?.toString() || "0");
      }

      const scheduleRes = await adminService.getTotalSchedule();

      if (scheduleRes?.status === 200) {
        setTotalScheduledTests(
          scheduleRes.totalScheduledTests?.toString() || "0"
        );
        setMcqScheduledCount(
          scheduleRes.sheduled_mcq_interview?.toString() || "0"
        );
        setAiScheduledCount(
          scheduleRes.sheduled_ai_interview?.toString() || "0"
        );
        setUpcomingInterviews(scheduleRes.upcoming || []);
      }
    } catch (err: any) {
      toast.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useAdminSocket({
    "interview-submitted": (data: any) => {
      toast.success(`${data.candidateName} submitted — ${data.percentage}%`);
      fetchDashboardData();
    },
    "candidate-logged-in": (data: any) => {
      toast(`Candidate logged in: ${data.candidateName}`, { icon: "👤" });
    },
    "interview-started": () => {
      fetchDashboardData();
    },
  });

  const handleReschedule = (interview: any) => {
    setSelectedInterview(interview);
    setNewStartDate("");
    setNewEndDate("");
    setShowModal(true);
  };

  const submitReschedule = async () => {
    if (!selectedInterview || !newStartDate || !newEndDate) return;

    try {
      setActionLoading(true);

      const candidateId =
        selectedInterview.candidate?._id || selectedInterview.candidateId;

      if (!candidateId) {
        toast.error("Candidate ID not found");
        setActionLoading(false);
        return;
      }

      await adminService.reScheduleInterview(
        selectedInterview.type,
        selectedInterview._id,
        {
          candidateId: selectedInterview.candidate._id,
          newStartDate: new Date(newStartDate).toISOString(),
          newEndDate: new Date(newEndDate).toISOString(),
        }
      );

      setShowModal(false);
      fetchDashboardData();
      toast.success("Interview re-Schedule Successfully");
    } catch (err) {
      console.error("Reschedule Error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (interview: any) => {
    setCancelInterview(interview);
    setShowCancelModal(true);
  };

  const confirmCancelInterview = async () => {
    if (!cancelInterview) return;

    try {
      setActionLoading(true);

      await adminService.cancleInterview(
        cancelInterview.type,
        cancelInterview._id,
        {
          candidateId: cancelInterview.candidate._id,
        }
      );

      toast.success("Interview Cancelled Successfully");
      setShowCancelModal(false);
      fetchDashboardData();
    } catch (err: any) {
      toast.error("Cancel Error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickActionNavigate = (data: any) => {
    if (typeof data === "string") {
      const routeMap: Record<string, string> = {
        Dashboard: `/admin${adminPath("dashboard")}`,
        Candidates: `/admin${adminPath("candidates")}`,
        "Tests & Assessments": `/admin${adminPath("tests")}`,
        "AI Video Interview": `/admin${adminPath("video")}`,
        "Reports & Insights": `/admin${adminPath("reports")}`,
        Settings: `/admin${adminPath("settings")}`,
      };

      navigate(routeMap[data]);
    } else {
      const routeMap: Record<string, string> = {
        Candidates: `/admin${adminPath("candidates")}`,
      };

      navigate(routeMap[data.page], {
        state: { tab: data.tab },
      });
    }
  };

  return (
    <AdminLayout heading={`Hi ${user?.userName}`} showSearch>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FaUsers}
          title="Total Candidates"
          value={loading ? "..." : totalCandidates}
          change="+12% from Last Month"
          changeColor="text-green-600 dark:text-green-400"
          bgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatCard
          icon={FaClipboardList}
          title="Tests Scheduled"
          value={loading ? "..." : totalScheduledTests}
          change="+5% from Last Month"
          changeColor="text-green-600 dark:text-green-400"
          bgColor="bg-green-100"
          iconColor="text-green-600"
        />

        <StatCard
          icon={FaFileAlt}
          title="MCQ Scheduled"
          value={loading ? "..." : mcqScheduledCount}
          change="MCQ Interviews"
          changeColor="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-100"
          iconColor="text-blue-600"
        />

        <StatCard
          icon={FaRobot}
          title="AI Interviews"
          value={loading ? "..." : aiScheduledCount}
          change="AI Interviews"
          changeColor="text-indigo-600 dark:text-indigo-400"
          bgColor="bg-indigo-100"
          iconColor="text-indigo-600"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <QuickActions onNavigate={handleQuickActionNavigate} />
        </div>
        <div className="lg:col-span-3">
          <TopPerformance />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-1 gap-4">
        <div className="lg:col-span-3">
          <UpcomingInterviews
            interviews={upcomingInterviews}
            onReschedule={handleReschedule}
            onCancel={handleCancel}
          />
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[90%] sm:w-[400px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Reschedule Interview
            </h3>

            <input
              type="datetime-local"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded mb-3"
              value={newStartDate}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setNewStartDate(e.target.value)}
            />

            <input
              type="datetime-local"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded mb-4"
              value={newEndDate}
              min={
                newStartDate
                  ? newStartDate
                  : new Date(
                      Date.now() - new Date().getTimezoneOffset() * 60000
                    )
                      .toISOString()
                      .slice(0, 16)
              }
              onChange={(e) => setNewEndDate(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                Cancel
              </button>

              <button
                disabled={actionLoading}
                onClick={submitReschedule}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[90%] sm:w-[400px]">
            <h3 className="text-lg font-semibold mb-3 text-red-600 dark:text-red-400">
              Cancel Interview
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to cancel this interview?
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                No
              </button>

              <button
                disabled={actionLoading}
                onClick={confirmCancelInterview}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Dashboard;