import WatchIcon from "../assets/icons/report/eyes.png";
import Comment from "../assets/icons/report/comment2.png";
import Calendar from "../assets/icons/report/calendar.png";
import CheckMark from "../assets/icons/report/check1.png";
// import FeedbackPopup from "../components/admin/Report/PopUP/FeedbackPopUp";
// import { useState } from "react";

interface VideoInterviewResultCardProps {
  candidate: string;
  testName: string;
  date: string;
  views: number;
  status: "Reviewed" | "Pending";
  confidence: string;
  score: string;
  topics: string[];
  communication?: string; // Added to handle the communication field
}

export default function VideoInterviewResultCard({
  candidate,
  testName,
  date,
  views,
  status,
  confidence,
  score,
  topics,
  communication,
}: VideoInterviewResultCardProps) {
  // Badge styling
  const statusColor =
    status === "Reviewed"
      ? "bg-green-100 text-green-700"
      : "bg-orange-100 text-orange-700";

      // const [isAddComment, setIsAddComment] = useState(false);

      const handleOpenAddComment = () => {
    // setIsAddComment(true);
  };

  // const handleCloseAddComment = () => {
  //   setIsAddComment(false);
  // };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 w-full max-w-2xl space-y-4 h-auto min-h-[320px]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-relaxed">
            {candidate}
          </h3>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{testName}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>
          {status}
        </span>
      </div>

      <div className="flex items-center text-xs text-gray-500 gap-4">
        <div className="flex items-center gap-1 mb-3">
          <img src={Calendar} alt="Calendar" className="w-4 h-4 text-gray-400" />
          {date}
        </div>
        <div className="flex items-center gap-1 mb-3">
          <img src={CheckMark} alt="Views" className="w-4 h-4 text-gray-400" />
          {views} views
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 leading-relaxed">AI Confidence Level:</span>
          <span className="flex items-center justify-center w-14 h-6 rounded-full bg-[#DCFCE7] text-[#19A44C] leading-relaxed text-xs">
            {confidence}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 leading-relaxed">Communication Skill:</span>
          <span className="font-normal flex items-center justify-center text-[#121212] leading-relaxed">
            {communication}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 leading-relaxed">Manual Score:</span>
          <span className="text-[#4318FF] font-medium leading-relaxed">{score}</span>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2 leading-relaxed">Key Topics Detected:</p>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="text-xs bg-[#DBEAFE] text-[#4318FF] px-2 py-1 rounded-full leading-relaxed"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 text-xs font-medium rounded-md px-3 py-1.5 bg-[#4318FF] text-white flex items-center gap-2">
          <img src={WatchIcon} alt="Watch" className="w-4 h-4" />
          Watch Answer
        </button>
        <button className="flex-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 px-3 py-1.5 flex items-center gap-2"onClick={handleOpenAddComment}>
          <img src={Comment} alt="Comment" className="w-4 h-4" />
          Add Comments
        </button>
      </div>

       {/* <FeedbackPopup open={isAddComment} onClose={handleCloseAddComment} /> */}
    </div>
  );
}