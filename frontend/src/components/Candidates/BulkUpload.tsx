import { useState } from "react";
import Papa from "papaparse";
import { adminService } from "../../services/service/adminService";
import toast from "react-hot-toast";
import Upload from "../../assets/admin/upload.png";
import Docs from "../../assets/admin/docs.png";
import Download from "../../assets/admin/download.png";

const BulkUpload = () => {
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
    console.log("selectedFile", selectedFile);
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("csvFile", selectedFile);
      console.log(formData)

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
          <h3 className="text-2xl tracking-tighter font-semibold text-gray-900 mb-4">
            Upload Candidates
          </h3>

          <div className="rounded-xl  w-full">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-[#FFFFFF73]">
              <div className="flex flex-col items-center gap-4 p-1">
                <div className="w-14 h-14 rounded-full  flex items-center justify-center text-gray-500 text-2xl">
                  <img src={Upload} alt="" />
                </div>

                <p className="text-xl font-semibold text-gray-900">
                  Upload CSV File
                </p>

                <p className="text-sm text-gray-500">
                  Drag and drop your CSV file here, or click to browse
                </p>

                <label>
                  <span className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#000000] bg-[#F4F7FE] border border-[#00000033] rounded-lg cursor-pointer hover:bg-gray-50 ">
                    <img src={Docs} className="w-4 h-4" alt="" /> Choose File
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
  <h3 className="text-2xl font-semibold text-gray-900 mb-6">
    Preview & Import
  </h3>

  {previewData.length === 0 ? (
    /* EMPTY STATE */
    <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center shadow-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <img src={Docs} className="w-6 opacity-70" />
        </div>

        <h4 className="text-xl font-semibold text-gray-800">
          No File Uploaded
        </h4>

        <p className="text-sm text-gray-500 max-w-xs">
          Upload a CSV file to preview candidates before importing.
        </p>
      </div>
    </div>
  ) : (
    /* PREVIEW CARD */
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 transition-all duration-300">
      
      {/* File Info Row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <img src={Docs} className="w-5 opacity-70" />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-800">
              {selectedFile?.name}
            </p>
            <p className="text-xs text-gray-500">
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
  <div className="max-h-[320px] overflow-y-auto overflow-x-auto">

    <table className="min-w-full text-sm text-left">
      
      {/* Sticky Header */}
      <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider sticky top-0 z-10">
        <tr>
          {Object.keys(previewData[0]).map((key) => (
            <th key={key} className="px-5 py-3 font-semibold border-b">
              {key.replaceAll("_", " ")}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-100 bg-white">
        {previewData.map((row, index) => (
          <tr key={index} className="hover:bg-gray-50 transition">
            {Object.values(row).map((value: any, i) => (
              <td key={i} className="px-5 py-4 text-gray-700 whitespace-nowrap">
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
        <div className="bg-[#FFFFFF73] rounded-xl p-6 w-[49%]">
          <h3 className="text-2xl tracking-tighter font-semibold text-gray-900 mb-5">
            CSV Format Requirements
          </h3>

          <ul className="space-y-3 text-sm text-gray-600">
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
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-white border border-[#00000033] rounded-lg hover:bg-gray-100  transition"
          >
            <img src={Download} className="w-6 h-6" alt="" /> Download Sample
            CSV
          </button>
        </div>
      </div>
    </>
  );
};

export default BulkUpload;
