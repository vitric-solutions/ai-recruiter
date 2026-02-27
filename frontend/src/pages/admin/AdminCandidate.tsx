import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../common/AdminLayout";
import ViewCandidateModal from "../../components/Candidates/ViewCandidate";
import ViewCandidateReportModal from "../../components/Candidates/ViewCandidateReport";
import {
  Plus,
  Filter,
  MoreVertical,
  Search,
  SlidersHorizontal,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import BulkUpload from "../../components/Candidates/BulkUpload";
import toast from "react-hot-toast";
import { socket } from "../../utils/socket";
import { adminService } from "../../services/service/adminService";
import { useLocation } from "react-router-dom";

interface Candidate {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  year_of_experience: string;
  key_Skills: string;
  description?: string;
  status?: string;
  candidate_status?: string;
}

/* ─────────────────────────────────────────────
   Reusable Resume Upload + Form Modal
   Used for BOTH Add and Edit — same design
───────────────────────────────────────────── */
const CandidateFormModal = ({
  isOpen,
  mode, // "add" | "edit"
  candidate, // only for edit — pre-fills form
  onClose,
  onSuccess, // receives the saved/created candidate
}: {
  isOpen: boolean;
  mode: "add" | "edit";
  candidate?: Candidate | null;
  onClose: () => void;
  onSuccess: (c: Candidate) => void;
}) => {
  const blank = {
    name: "",
    email: "",
    mobile: "",
    role: "",
    year_of_experience: "",
    key_Skills: "",
    description: "",
  };

  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Populate form on open, reset fileName each time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setFileName(""); // clear previous file name on every open
    if (mode === "edit" && candidate) {
      setForm({
        name: candidate.name ?? "",
        email: candidate.email ?? "",
        mobile: candidate.mobile ?? "",
        role: candidate.role ?? "",
        year_of_experience: candidate.year_of_experience ?? "",
        key_Skills: candidate.key_Skills ?? "",
        description: candidate.description ?? "",
      });
    } else {
      setForm({ ...blank });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, candidate]);

  if (!isOpen) return null;

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ── Resume upload ─────────────────────────
     API response shape:
     { success: true, analysis: { name, email, mobile, role,
       year_of_experience, key_Skills, description }, resumeUrl }
  ─────────────────────────────────────────── */
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name); // ✅ store the file name to display
    setResumeLoading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await adminService.analyzeResume(formData);

      // ✅ API returns res.analysis (not res.data)
      const d = res?.analysis ?? res?.data;

      if (res?.success && d) {
        setForm((f) => ({
          name: d.name || f.name,
          email: d.email || f.email,
          mobile: d.mobile || f.mobile,
          role: d.role || f.role,
          year_of_experience: d.year_of_experience || f.year_of_experience,
          key_Skills: d.key_Skills || f.key_Skills,
          description: d.description || f.description,
        }));
        toast.success("Resume analyzed — fields auto-filled!");
      } else {
        toast.error("Could not extract data from resume");
      }
    } catch {
      toast.error("Resume analysis failed");
    } finally {
      setResumeLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.mobile) {
      toast.error("Name, email and mobile are required");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && candidate) {
        // ── Edit ──────────────────────────────
        const res = await adminService.updateCandidate(candidate._id, form);
        const updated = res?.data?.data ??
          res?.data ?? { ...candidate, ...form };
        onSuccess(updated as Candidate);
        toast.success("Candidate updated successfully!");
      } else {
        // ── Add ───────────────────────────────
        const res = await adminService.addCandidate(form);
        const added = res?.data?.data ?? res?.data ?? form;
        onSuccess(added as Candidate);
        toast.success("Candidate added successfully!");
      }
      onClose();
    } catch {
      toast.error(`Failed to ${mode === "edit" ? "update" : "add"} candidate`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === "edit" ? "Edit Candidate" : "Add Candidate"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload resume and manage candidate information
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Resume Upload Zone */}
        <div className="px-6 pt-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
          >
            {resumeLoading ? (
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
            ) : (
              <Upload className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-indigo-600">
                {resumeLoading
                  ? "Analyzing resume…"
                  : fileName
                    ? fileName
                    : "Upload Resume to Auto-fill (PDF / DOCX)"}
              </p>
              <p className="text-xs text-gray-400">
                {fileName && !resumeLoading
                  ? "Fields auto-filled from resume"
                  : "Fields will be automatically filled from resume"}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeUpload}
            />
          </div>
        </div>

        {/* Form Fields */}
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { label: "Full Name", key: "name", type: "text" },
              { label: "Email", key: "email", type: "email" },
              { label: "Mobile", key: "mobile", type: "text" },
              { label: "Role", key: "role", type: "text" },
              {
                label: "Years of Experience",
                key: "year_of_experience",
                type: "text",
              },
              { label: "Key Skills", key: "key_Skills", type: "text" },
            ] as const
          ).map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {label}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={set(key)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          ))}

          <div className="col-span-1 sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Professional Summary
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={set("description")}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving
              ? "Saving…"
              : mode === "edit"
                ? "Save Candidate"
                : "Add Candidate"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Skills Cell — click "+N more" to open fixed popup
───────────────────────────────────────────── */
const SkillsCell = ({ skillsStr }: { skillsStr: string }) => {
  const [open, setOpen] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);

  const skills = skillsStr
    ? skillsStr
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const visible = skills.slice(0, 2);
  const remaining = skills.length - 2;

  return (
    <div className="flex flex-wrap gap-1 items-center relative">
      {visible.map((skill, i) => (
        <span
          key={i}
          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md"
        >
          {skill}
        </span>
      ))}

      {remaining > 0 && (
        <>
          {/* Badge */}
          <span
            ref={badgeRef}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-600 rounded-md cursor-pointer hover:bg-indigo-200 select-none"
          >
            +{remaining} more
          </span>

          {/* Popup */}
          {open && (
            <div
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              className="fixed top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-auto bg-white text-black text-sm rounded-lg p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">All Skills</span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-500 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 rounded-full text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
/* ─────────────────────────────────────────────
   Action Menu — position: fixed, no scroll clip
───────────────────────────────────────────── */
const ActionMenu = ({
  row,
  onView,
  onEdit,
  onReport,
  onStatusChange,
}: {
  row: Candidate;
  onView: () => void;
  onEdit: () => void;
  onReport: () => void;
  onStatusChange: (s: "active" | "inactive") => void;
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 30, left: rect.right - 230 });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        className="text-gray-400 hover:text-gray-600"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[9999] w-52 bg-white rounded-xl shadow-2xl border border-gray-200 py-2"
        >
          <button
            onClick={() => {
              setOpen(false);
              onView();
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            View
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            Edit
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onReport();
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            Report
          </button>
          {row.candidate_status === "active" ? (
            <button
              onClick={() => {
                setOpen(false);
                onStatusChange("inactive");
              }}
              className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition"
            >
              Mark as Inactive
            </button>
          ) : (
            <button
              onClick={() => {
                setOpen(false);
                onStatusChange("active");
              }}
              className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition"
            >
              Mark as Active
            </button>
          )}
        </div>
      )}
    </>
  );
};

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
const Candidates = () => {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(location.state?.tab || "list");
  const [activeMenuItem, setActiveMenuItem] = useState("Dashboard");

  const [data, setData] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(5);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [skillsFilter, setSkillsFilter] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [expOptions, setExpOptions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);
  // Modals
  const [formModal, setFormModal] = useState<{
    open: boolean;
    mode: "add" | "edit";
  }>({
    open: false,
    mode: "add",
  });
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isViewReportModalOpen, setIsViewReportModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null,
  );

  /* ── Fetch ───────────────────────────────── */
  const fetchCandidates = async (
    pageNumber = 1,
    ov?: {
      search?: string;
      role?: string;
      experience?: string;
      skills?: string;
      status?: string;
      activeOnly?: boolean;
    },
  ) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pageNumber),
        limit: String(rowsPerPage),
        status:
          (ov?.activeOnly ?? showOnlyActive)
            ? "active"
            : (ov?.status ?? statusFilter),
      };
      const s = ov?.search ?? search;
      const r = ov?.role ?? roleFilter;
      const ex = ov?.experience ?? experienceFilter;
      const sk = ov?.skills ?? skillsFilter;
      if (s) params.search = s;
      if (r) params.role = r;
      if (ex) params.experience = ex;
      if (sk) params.skills = sk;

      const res = await adminService.getFilteredCandidates(params);
      if (res?.success) {
        setData(Array.isArray(res.data) ? res.data : []);
        setTotalPages(res.totalPages || 1);
        setTotalRecords(res.totalRecords || 0);
        if (res.meta?.roles?.length) setRoleOptions(res.meta.roles);
        if (res.meta?.experiences?.length) setExpOptions(res.meta.experiences);
        if (pageNumber > (res.totalPages || 1)) setPage(res.totalPages);
      }
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates(page);
  }, [page, statusFilter, showOnlyActive]); // eslint-disable-line

  useEffect(() => {
    socket.on("candidate-added", () => fetchCandidates(page));
    socket.on("candidate-updated", () => fetchCandidates(page));
    return () => {
      socket.off("candidate-added");
      socket.off("candidate-updated");
    };
  }, [page, statusFilter, showOnlyActive]); // eslint-disable-line

  /* ── Debounced text filters ──────────────── */
  const debounced = (key: "search" | "skills", val: string) => {
    if (key === "search") setSearch(val);
    else setSkillsFilter(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchCandidates(1, { [key]: val });
    }, 500);
  };

  /* ── Pagination ──────────────────────────── */
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page > 3) pages.push(1, "...");
      const s = Math.max(1, page - 2),
        e = Math.min(totalPages, page + 2);
      for (let i = s; i <= e; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...", totalPages);
    }
    return pages;
  };

  /* ── Handlers ────────────────────────────── */
  const handleFormSuccess = (saved: Candidate) => {
    if (formModal.mode === "edit") {
      setData((prev) => prev.map((c) => (c._id === saved._id ? saved : c)));
    } else {
      setData((prev) => [saved, ...prev]);
      setPage(1);
    }
  };

  const handleViewCandidate = async (candidate: Candidate) => {
    try {
      setLoading(true);
      const res = await adminService.getCandidateProfile(candidate._id);
      if (res.status === 200) {
        setSelectedCandidate(res);
        setIsViewModalOpen(true);
      }
    } catch {
      toast.error("Failed to load candidate profile");
    } finally {
      setLoading(false);
    }
  };

  const handleViewReportCandidate = async (candidate: Candidate) => {
    try {
      setLoading(true);
      const res = await adminService.getCandidateProfile(candidate._id);
      if (res.status === 200) {
        setSelectedCandidate(res);
        setIsViewReportModalOpen(true);
      }
    } catch {
      toast.error("Failed to load candidate profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCandidateStatus = async (
    id: string,
    newStatus: "active" | "inactive",
  ) => {
    try {
      const res = await adminService.updateCandidate(id, {
        candidate_status: newStatus,
      });
      if (res.data?.data) {
        setData((prev) => prev.map((c) => (c._id === id ? res.data.data : c)));
        toast.success(`Candidate marked as ${newStatus}!`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const SkeletonRow = () => (
    <tr className="animate-pulse border-b border-gray-100 last:border-0">
      {/* Sr. No */}
      <td className="px-6 py-[18px]">
        <div className="h-3.5 w-5 bg-gray-200 rounded" />
      </td>

      {/* Candidate — circle avatar + name line + email line */}
      <td className="px-6 py-[18px]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-28 bg-gray-200 rounded" />
            <div className="h-2.5 w-36 bg-gray-100 rounded" />
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-6 py-[18px]">
        <div className="h-3.5 w-24 bg-gray-200 rounded" />
      </td>

      {/* Status — pill */}
      <td className="px-6 py-[18px]">
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
      </td>

      {/* Experience */}
      <td className="px-6 py-[18px]">
        <div className="h-3.5 w-14 bg-gray-200 rounded" />
      </td>

      {/* Skills — two tag shapes + small +more badge */}
      <td className="px-6 py-[18px]">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-14 bg-gray-200 rounded-md" />
          <div className="h-6 w-16 bg-gray-200 rounded-md" />
          <div className="h-6 w-10 bg-gray-100 rounded-md" />
        </div>
      </td>

      {/* Phone */}
      <td className="px-6 py-[18px]">
        <div className="h-3.5 w-24 bg-gray-200 rounded" />
      </td>

      {/* Action — dot menu placeholder */}
      <td className="px-6 py-[18px]">
        <div className="h-5 w-5 bg-gray-200 rounded" />
      </td>
    </tr>
  );

  /* ── Render ──────────────────────────────── */
  return (
    <AdminLayout
      heading="Candidate Management"
      subheading="Manage and Review Candidates"
      showSearch={false}
      activeMenuItem={activeMenuItem}
      onMenuItemClick={setActiveMenuItem}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex bg-white rounded-lg p-2">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "list" ? "bg-[#F4F7FE] text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Candidates List
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "bulk" ? "bg-[#F4F7FE] text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            Bulk Add
          </button>
        </div>

        <div
          className={`items-center gap-3 ${activeTab === "bulk" ? "hidden" : "flex"}`}
        >
          <button
            onClick={() => {
              setSelectedCandidate(null);
              setFormModal({ open: true, mode: "add" });
            }}
            className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-[#00000033] rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Candidates
          </button>
          {/* <div className="flex cursor-pointer items-center gap-2 bg-white rounded-lg px-2 border border-[#00000033]">
            <Filter className="h-4 w-4 text-gray-600" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm cursor-pointer border-none outline-none focus:ring-0"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">In-Active</option>
            </select>
          </div> */}
        </div>
      </div>

      {/* Filter Bar */}
      {activeTab === "list" && (
        <div className="bg-white border border-[#00000033] rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, mobile…"
              value={search}
              onChange={(e) => debounced("search", e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
              fetchCandidates(1, { role: e.target.value });
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
          >
            <option value="">All Roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={experienceFilter}
            onChange={(e) => {
              setExperienceFilter(e.target.value);
              setPage(1);
              fetchCandidates(1, { experience: e.target.value });
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
          >
            <option value="">All Experience</option>
            {expOptions.map((exp) => (
              <option key={exp} value={exp}>
                {exp} yrs
              </option>
            ))}
          </select>
          <div className="relative min-w-[160px]">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Skills (React, Node…)"
              value={skillsFilter}
              onChange={(e) => debounced("skills", e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => {
              setShowOnlyActive((v) => !v);
              setPage(1);
            }}
          >
            <div
              className={`relative w-10 h-5 rounded-full transition-colors ${showOnlyActive ? "bg-indigo-600" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showOnlyActive ? "translate-x-5" : "translate-x-0"}`}
              />
            </div>
            <span className="text-xs text-gray-600">
              {showOnlyActive ? "Active only" : "All statuses"}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      {activeTab === "list" && (
        <div className="bg-white rounded-lg border border-[#00000033]">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      "Sr. No",
                      "Candidates",
                      "Role",
                      "Status",
                      "Experience",
                      "Skills",
                      "Phone",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {[...Array(rowsPerPage)].map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-gray-400 mb-2">No candidates found</div>
              <button
                onClick={() => setFormModal({ open: true, mode: "add" })}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                Add your first candidate
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-[#00000033]">
                    <tr>
                      {[
                        "Sr. No",
                        "Candidates",
                        "Role",
                        "Status",
                        "Experience",
                        "Skills",
                        "Phone",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, index) => (
                      <tr
                        key={row._id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {(page - 1) * rowsPerPage + index + 1}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                              {row.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {row.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {row.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-900">
                          {row.role}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${row.candidate_status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {row.candidate_status === "active"
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-900">
                          {row.year_of_experience} years
                        </td>

                        <td className="px-6 py-4">
                          <SkillsCell skillsStr={row.key_Skills} />
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {row.mobile}
                        </td>

                        <td className="px-6 py-4">
                          <ActionMenu
                            row={row}
                            onView={() => handleViewCandidate(row)}
                            onEdit={() => {
                              setSelectedCandidate(row);
                              setFormModal({ open: true, mode: "edit" });
                            }}
                            onReport={() => handleViewReportCandidate(row)}
                            onStatusChange={(s) =>
                              handleUpdateCandidateStatus(row._id, s)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="z-0 flex flex-col md:flex-row justify-between items-center gap-4 px-6 py-4 border-t border-[#5e5e5e33]">
                <div className="text-sm text-gray-700">
                  {totalRecords === 0
                    ? "No results found"
                    : `Showing ${(page - 1) * rowsPerPage + 1} to ${Math.min(page * rowsPerPage, totalRecords)} of ${totalRecords} results`}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  {getVisiblePages().map((p, i) =>
                    p === "..." ? (
                      <span key={i} className="px-2 py-1 text-sm text-gray-500">
                        ...
                      </span>
                    ) : (
                      <button
                        key={i}
                        onClick={() => setPage(Number(p))}
                        className={`px-3 py-1 text-sm rounded transition-all ${page === p ? "bg-indigo-600 text-white shadow-md" : "border hover:bg-gray-50"}`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "bulk" && <BulkUpload />}

      {/* ✅ Single unified modal for both Add and Edit */}
      <CandidateFormModal
        isOpen={formModal.open}
        mode={formModal.mode}
        candidate={formModal.mode === "edit" ? selectedCandidate : null}
        onClose={() => {
          setFormModal({ open: false, mode: "add" });
          setSelectedCandidate(null);
        }}
        onSuccess={handleFormSuccess}
      />

      <ViewCandidateModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedCandidate(null);
        }}
        candidateData={selectedCandidate}
      />

      <ViewCandidateReportModal
        isOpen={isViewReportModalOpen}
        onClose={() => {
          setIsViewReportModalOpen(false);
          setSelectedCandidate(null);
        }}
        candidateData={selectedCandidate}
      />
    </AdminLayout>
  );
};

export default Candidates;
