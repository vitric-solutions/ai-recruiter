import { useState } from "react";
import Papa from "papaparse";
import { useTheme } from "../../context/Themecontext";
import { adminService } from "../../services/service/adminService";
import toast from "react-hot-toast";
import { FiUpload, FiFileText, FiDownload } from "react-icons/fi";

const BulkUpload = () => {
  const { theme } = useTheme();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Only CSV files are allowed");
      return;
    }

    setSelectedFile(file);

    // Parse CSV for preview
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results:any) => {
        setPreviewData(results.data.slice(0, 5)); // show first 5 rows
      },
    });
  };

  // Upload to Backend
  const handleBulkUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a CSV file");
      return;
    }
    //console.log("selectedFile", selectedFile);
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("csvFile", selectedFile);
      //console.log(formData)

      const res = await adminService.bulk_add_candidate(formData);

      toast.success(res?.data?.message || "Candidates added successfully");

      setPreviewData([]);
      setSelectedFile(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `name,email,mobile,role,year_of_experience,key_Skills
John Doe,john@example.com,9876543210,Frontend Developer,3,React|JavaScript
Jane Smith,jane@example.com,9123456789,Backend Developer,5,Node.js|MongoDB`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample-candidates.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Top Grid */}
      <div className="flex flex-col lg:flex-row items-start justify-center gap-10 mb-5">
        {/* Upload Section */}
        <div className="w-1/2 h-full">
          <h3 className={`text-2xl tracking-tighter font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Upload Candidates
          </h3>

          <div className="rounded-xl w-full">
            <div className={`border-2 border-dashed rounded-xl p-12 text-center ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-gray-300 bg-[#FFFFFF73]'}`}>
              <div className="flex flex-col items-center gap-4 p-1">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'text-gray-500'}`}>
                  <FiUpload className={`w-7 h-7 ${theme === 'dark' ? 'text-slate-100 opacity-90' : 'text-slate-600 opacity-80'}`} />
                </div>

                <p className={`text-xl font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-900'}`}>
                  Upload CSV File
                </p>

                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                  Drag and drop your CSV file here, or click to browse
                </p>

                <label>
                  <span className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#000000] bg-[#F4F7FE] border border-[#00000033] rounded-lg cursor-pointer hover:bg-gray-50 ">
                    <FiFileText className="w-4 h-4" /> Choose File
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csvInput"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

 {/* Preview Section */}
<div className="w-full lg:w-1/2">
  <h3 className={`text-2xl font-semibold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
    Preview & Import
  </h3>

  {previewData.length === 0 ? (
    /* EMPTY STATE */
    <div className={`rounded-2xl border p-14 text-center shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
          <FiFileText className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-700'}`} />
        </div>

        <h4 className={`text-xl font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>
          No File Uploaded
        </h4>

        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} max-w-xs`}>
          Upload a CSV file to preview candidates before importing.
        </p>
      </div>
    </div>
  ) : (
    /* PREVIEW CARD */
    <div className={`rounded-2xl border shadow-sm p-6 transition-all duration-300 ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
      
      {/* File Info Row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'} w-10 h-10 rounded-xl flex items-center justify-center`}>
            <FiFileText className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-100 opacity-90' : 'text-slate-700 opacity-80'}`} />
          </div>

          <div>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-gray-800'}`}>
              {selectedFile?.name}
            </p>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              {previewData.length} records previewed
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedFile(null);
            setPreviewData([]);
          }}
          className="text-sm font-medium text-red-500 hover:text-red-600 transition"
        >
          Remove
        </button>
      </div>

      {/* Table */}
  <div className="max-h-80 overflow-y-auto overflow-x-auto">

    <table className="min-w-full text-sm text-left">
      
      {/* Sticky Header */}
      <thead className={`${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-gray-50 text-gray-600'} uppercase text-xs tracking-wider sticky top-0 z-10`}>
        <tr>
          {Object.keys(previewData[0]).map((key) => (
            <th key={key} className="px-5 py-3 font-semibold border-b">
              {key.replaceAll("_", " ")}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className={`${theme === 'dark' ? 'divide-y divide-slate-700 bg-slate-950' : 'divide-y divide-gray-100 bg-white'}`}>
        {previewData.map((row, index) => (
          <tr key={index} className={`${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-50'} transition`}>
            {Object.values(row).map((value: any, i) => (
              <td key={i} className={`px-5 py-4 whitespace-nowrap ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>

    </table>
  </div>

      {/* Import Button */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleBulkUpload}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-[#003635] text-white font-medium hover:opacity-90 transition disabled:opacity-50 shadow-sm"
        >
          {loading ? "Uploading..." : "Import Candidates"}
        </button>
      </div>
    </div>
  )}
</div>

      </div>
     
      <div className="w-full  flex items-center justify-start ">
        {/* CSV Requirements */}
        <div className={`rounded-xl p-6 w-[49%] ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-[#FFFFFF73]'}`}>
          <h3 className={`text-2xl tracking-tighter font-semibold mb-5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            CSV Format Requirements
          </h3>

          <ul className={`space-y-3 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
            <li className="flex items-start gap-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
              File must be in CSV format (.csv extension)
            </li>
            <li className="flex items-start gap-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
              Required Columns: Name, Email, Phone, Positions
            </li>
            <li className="flex items-start gap-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
              Optional Columns: Experience, Skills, Locations
            </li>
            <li className="flex items-start gap-3">
              <span className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
              Maximum file size: 10MB
            </li>
          </ul>

          <button
            onClick={downloadSampleCSV}
            className={`mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${theme === 'dark' ? 'text-white bg-slate-800 border border-slate-700 hover:bg-slate-700' : 'text-black bg-white border border-[#00000033] hover:bg-gray-100'}`}
          >
            <FiDownload className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-700'}`} /> Download Sample
            CSV
          </button>
        </div>
      </div>
    </>
  );
};

export default BulkUpload;
