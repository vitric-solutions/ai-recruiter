import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { adminService } from "../../services/service/adminService";
import { Upload, X, Loader2 } from "lucide-react";

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (candidate: any) => void;
  onUpdate: (candidate: any) => void;
  candidateData?: any;
}

interface CandidateFormData {
  name: string;
  email: string;
  mobile: string;
  role: string;
  year_of_experience: string;
  key_Skills: string;
  description: string;
}

const AddCandidateModal: React.FC<AddCandidateModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  onUpdate,
  candidateData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!candidateData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CandidateFormData>();

  /* ================= Populate Edit Mode ================= */
  useEffect(() => {
    if (candidateData) {
      setValue("name", candidateData.name);
      setValue("email", candidateData.email);
      setValue("mobile", candidateData.mobile);
      setValue("role", candidateData.role);
      setValue("year_of_experience", candidateData.year_of_experience);
      setValue("key_Skills", candidateData.key_Skills);
      setValue("description", candidateData.description || "");
      setResumeUrl(candidateData.resume || "");
    } else {
      reset();
      setResumeUrl("");
      setResumeFile(null);
    }
  }, [candidateData, setValue, reset]);

  /* ================= Analyze Resume ================= */
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setAnalyzing(true);

      const response = await adminService.analyzeResume(formData);

      //console.log("Analyze API Response:", response);

      // Support both axios and direct data return
      const data = response?.data ?? response;

      if (!data?.success) {
        toast.error("Invalid server response.");
        return;
      }

      const { analysis, resumeUrl: url } = data;

      setResumeUrl(url || "");

      // Auto fill safely
      setValue("name", analysis?.name ?? "");
      setValue("email", analysis?.email ?? "");
      setValue("mobile", analysis?.mobile ?? "");
      setValue("role", analysis?.role ?? "");
      setValue("year_of_experience", analysis?.year_of_experience ?? "");
      setValue("key_Skills", analysis?.key_Skills ?? "");
      setValue("description", analysis?.description ?? "");

      toast.success("Resume analyzed — fields auto-filled!");
    } catch (err: any) {
      console.error("Resume Error:", err);
      toast.error(
        err?.response?.data?.message ||
          "Resume analysis failed. Please try again.",
      );
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ================= Submit Candidate ================= */
  const onSubmit = async (data: CandidateFormData) => {
    try {
      setIsLoading(true);

      const loadingToast = toast.loading(
        isEditMode ? "Updating candidate..." : "Adding candidate...",
      );

      const payload = isEditMode
        ? { ...data, id: candidateData._id, resume: resumeUrl }
        : { ...data, resume: resumeUrl };

      const response = await adminService.addCandidate(payload);

      toast.dismiss(loadingToast);
      toast.success(
        isEditMode
          ? "Candidate updated successfully!"
          : "Candidate added successfully!",
      );

      const newCandidate = response.data?.newCandidate;
      if (newCandidate) {
        isEditMode ? onUpdate(newCandidate) : onAdd(newCandidate);
      }

      reset();
      setResumeUrl("");
      setResumeFile(null);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setResumeFile(null);
    setResumeUrl("");
    onClose();
  };

  if (!isOpen) return null;

  const fields: { label: string; key: keyof CandidateFormData; type: string }[] = [
    { label: "Full Name",           key: "name",               type: "text"  },
    { label: "Email",               key: "email",              type: "email" },
    { label: "Mobile",              key: "mobile",             type: "text"  },
    { label: "Role",                key: "role",               type: "text"  },
    { label: "Years of Experience", key: "year_of_experience", type: "text"  },
    { label: "Key Skills",          key: "key_Skills",         type: "text"  },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditMode ? "Edit Candidate" : "Add Candidate"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload resume and manage candidate information
            </p>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Resume Upload */}
        <div className="px-6 pt-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-indigo-200 rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
          >
            {analyzing
              ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
              : <Upload className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            }
            <div>
              <p className="text-sm font-medium text-indigo-600">
                {analyzing
                  ? "Analyzing resume…"
                  : resumeFile
                    ? resumeFile.name
                    : "Upload Resume to Auto-fill (PDF / DOCX)"}
              </p>
              <p className="text-xs text-gray-400">
                Fields will be automatically filled from resume
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={label}
                  {...register(key, { required: `${label} is required` })}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                    errors[key] ? "border-red-400" : "border-gray-200"
                  }`}
                />
                {errors[key] && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {errors[key]?.message as string}
                  </p>
                )}
              </div>
            ))}

            {/* Professional Summary — full width */}
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Professional Summary
              </label>
              <textarea
                rows={4}
                placeholder="Professional Summary"
                {...register("description")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 pb-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || analyzing}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading
                ? isEditMode ? "Updating…" : "Adding…"
                : isEditMode ? "Save Candidate" : "Add Candidate"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AddCandidateModal;