import Admin from "../../models/Admin.js";
import jwt from "jsonwebtoken";
import Score from "../../models/Score.js";
import mongoose from "mongoose";
import MCQ_Interview from "../../models/MCQ_Interview.js";
import AI_Interview from "../../models/AI_Interview.js";
import InterviewFeedback from "../../models/feedback.js";
import Candidate from "../../models/Candidate.js";
import {
  sendMCQInterviewLink,
  sendInterviewCancellationEmail,
  sendAIInterviewLink,
} from "../../services/emailService.js";

export const RegisterUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    admin = new Admin({ email, password, role: "admin" });
    await admin.save();

    const accessToken = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );

    const refreshToken = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    admin.refreshToken = refreshToken;
    await admin.save();

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    };

    return res
      .status(201)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        user: {
          _id: admin._id,
          email: admin.email,
          role: admin.role,
        },
        accessToken,
        refreshToken,
      });
  } catch (error) {
    res.status(500).json({ error });
  }
};

export const LoginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );

    const refreshToken = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    admin.refreshToken = refreshToken;
    await admin.save();

    const options = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        user: {
          _id: admin._id,
          email: admin.email,
          role: admin.role,
          userName: admin.userName,
        },
        accessToken,
        refreshToken,
      });
  } catch (error) {
    res.status(500).json({ error });
  }
};

export const getMe = async (req, res) => {
  // console.log("getMe called with user ID:", req.user);
  try {
    const user = await Admin.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const accessToken = jwt.sign(
      { id: user._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );

    res.status(200).json({
      success: true,
      user,
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error });
  }
};

export const GetTopPerformance = async (req, res) => {
  try {
    const { examType, limit = 10 } = req.query;

    if (!examType || !["AI", "MCQ"].includes(examType)) {
      return res.status(400).json({
        success: false,
        message: "examType must be AI or MCQ",
      });
    }

    if (examType === "AI") {
      const aiData = await InterviewFeedback.find({
        examType: "AI",
      })
        .populate({
          path: "interview_id",
          populate: {
            path: "candidates.candidateId",
            model: "Candidate",
            select: "name email candidate_status",
          },
        })
        .sort({ score: -1 });

      return res.status(200).json({
        success: true,
        type: "AI",
        total: aiData.length,
        data: aiData, // 🔥 returning full document
      });
    }

    if (examType === "MCQ") {
      const mcqData = await Score.aggregate([
        {
          $match: { examType: "MCQ" },
        },

        {
          $lookup: {
            from: mongoose.model("MCQ_Interview").collection.name,
            localField: "interviewId",
            foreignField: "_id",
            as: "interview",
          },
        },
        {
          $unwind: {
            path: "$interview",
            preserveNullAndEmptyArrays: false,
          },
        },

        {
          $lookup: {
            from: mongoose.model("Candidate").collection.name,
            localField: "candidateId",
            foreignField: "_id",
            as: "candidate",
          },
        },
        {
          $unwind: {
            path: "$candidate",
            preserveNullAndEmptyArrays: false,
          },
        },

        {
          $addFields: {
            percentage: {
              $cond: [
                { $eq: ["$maxScore", 0] },
                0,
                {
                  $multiply: [{ $divide: ["$totalScore", "$maxScore"] }, 100],
                },
              ],
            },
          },
        },

        { $sort: { percentage: -1 } },
        { $limit: Number(limit) },

        {
          $project: {
            _id: 0,
            candidate: {
              name: "$candidate.name",
              email: "$candidate.email",
            },
            interview: {
              id: "$interview._id",
              title: "$interview.test_title",
              difficulty: "$interview.difficulty",
              examType: "$examType",
              JobsDescription: "$interview.jobDescription",
              position: "$interview.position",
            },
            totalScore: "$totalScore",
            maxScore: "$maxScore",
            percentage: { $round: ["$percentage", 2] },
            completedAt: "$updatedAt",
          },
        },
      ]);

      const formattedMCQ = mcqData.map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

      return res.status(200).json({
        success: true,
        type: "MCQ",
        total: formattedMCQ.length,
        data: formattedMCQ,
      });
    }
  } catch (error) {
    console.error("GetTopPerformance Error:", error);
    return res.status(500).json({
      success: false,
      error,
    });
  }
};

// export const GetAllSchedule = async (req, res) => {
//   try {
//     const now = new Date();

//     /* =====================================================
//        1️⃣ MCQ INTERVIEWS
//     ===================================================== */

//     const mcqData = await MCQ_Interview.aggregate([
//       { $unwind: "$candidates" },

//       {
//         $lookup: {
//           from: "candidates",
//           localField: "candidates.candidateId",
//           foreignField: "_id",
//           as: "candidateDetails",
//         },
//       },
//       {
//         $unwind: {
//           path: "$candidateDetails",
//           preserveNullAndEmptyArrays: true,
//         },
//       },

//       {
//         $project: {
//           _id: 1,
//           type: { $literal: "MCQ" },
//           title: "$test_title",
//           examType: 1,
//           difficulty: 1,

//           candidate: {
//             _id: "$candidateDetails._id",
//             name: "$candidateDetails.name",
//             email: "$candidateDetails.email",
//             mobile: "$candidateDetails.mobile",
//             role: "$candidateDetails.role",
//             year_of_experience:
//               "$candidateDetails.year_of_experience",
//             status: "$candidateDetails.status",
//             candidate_status:
//               "$candidateDetails.candidate_status",
//           },

//           startDate: "$candidates.start_Date",
//           endDate: "$candidates.end_Date",
//           interviewStatus: "$candidates.status",
//           interviewLink: "$candidates.interviewLink",
//           password: "$candidates.password",
//         },
//       },
//     ]);

//     /* =====================================================
//        2️⃣ AI INTERVIEWS
//     ===================================================== */

//     const aiData = await AI_Interview.aggregate([
//       { $unwind: "$candidates" },

//       {
//         $lookup: {
//           from: "candidates",
//           localField: "candidates.candidateId",
//           foreignField: "_id",
//           as: "candidateDetails",
//         },
//       },
//       {
//         $unwind: {
//           path: "$candidateDetails",
//           preserveNullAndEmptyArrays: true,
//         },
//       },

//       {
//         $project: {
//           _id: 1,
//           type: { $literal: "AI" },
//           title: "$position",
//           examType: 1,
//           difficulty: 1,

//           candidate: {
//             _id: "$candidateDetails._id",
//             name: "$candidateDetails.name",
//             email: "$candidateDetails.email",
//             mobile: "$candidateDetails.mobile",
//             role: "$candidateDetails.role",
//             year_of_experience:
//               "$candidateDetails.year_of_experience",
//             status: "$candidateDetails.status",
//             candidate_status:
//               "$candidateDetails.candidate_status",
//           },

//           startDate: "$candidates.scheduledStartDate",
//           endDate: "$candidates.scheduledEndDate",
//           interviewStatus: "$candidates.status",
//           interviewLink: "$candidates.interviewLink",
//           password: "$candidates.password",
//         },
//       },
//     ]);

//     /* =====================================================
//        3️⃣ MERGE + FILTER
//        Remove:
//        - No interview link
//        - No password
//        - Cancelled interviews
//     ===================================================== */

//     const allInterviews = [...mcqData, ...aiData]
//       .filter(
//         (item) =>
//           item.interviewLink &&
//           item.password &&
//           item.interviewStatus !== "cancelled" // 🔥 Exclude cancelled
//       )
//       .map(({ password, ...rest }) => rest); // Remove password

//     /* =====================================================
//        4️⃣ CATEGORIZE
//     ===================================================== */

//     const upcoming = [];
//     const ongoing = [];
//     const past = [];

//     allInterviews.forEach((item) => {
//       if (!item.startDate || !item.endDate) return;

//       const start = new Date(item.startDate);
//       const end = new Date(item.endDate);

//       if (now < start) {
//         upcoming.push(item);
//       } else if (now >= start && now <= end) {
//         ongoing.push(item);
//       } else {
//         past.push(item);
//       }
//     });

//     /* =====================================================
//        5️⃣ RESPONSE
//     ===================================================== */

//     return res.status(200).json({
//       totalScheduledTests: allInterviews.length,
//       upcomingCount: upcoming.length,
//       ongoingCount: ongoing.length,
//       pastCount: past.length,
//       upcoming,
//       ongoing,
//       past,
//     });
//   } catch (error) {
//     console.error("GetAllSchedule Error:", error);
//     return res.status(500).json({ error });
//   }
// };

export const GetAllSchedule = async (req, res) => {
  try {
    const now = new Date();

    //  MCQ INTERVIEWS
    const MCQ = await MCQ_Interview.find()
      .populate("candidates.candidateId")
      .lean();

    console.log(JSON.stringify(MCQ, null, 2));
    const mcqData = await MCQ_Interview.aggregate([
      { $unwind: "$candidates" },
      {
        $lookup: {
          from: "candidates",
          localField: "candidates.candidateId",
          foreignField: "_id",
          as: "candidateDetails",
        },
      },
      {
        $unwind: {
          path: "$candidateDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          type: { $literal: "MCQ" },
          title: "$test_title",
          examType: 1,
          difficulty: 1,
          candidate: {
            _id: "$candidateDetails._id",
            name: "$candidateDetails.name",
            email: "$candidateDetails.email",
            mobile: "$candidateDetails.mobile",
            role: "$candidateDetails.role",
            year_of_experience: "$candidateDetails.year_of_experience",
            status: "$candidateDetails.status",
            candidate_status: "$candidateDetails.candidate_status",
          },
          startDate: "$candidates.start_Date",
          endDate: "$candidates.end_Date",
          interviewStatus: "$candidates.status",
          interviewLink: "$candidates.interviewLink",
          password: "$candidates.password",
        },
      },
    ]);

    //  AI INTERVIEWS
    const aiData = await AI_Interview.aggregate([
      { $unwind: "$candidates" },
      {
        $lookup: {
          from: "candidates",
          localField: "candidates.candidateId",
          foreignField: "_id",
          as: "candidateDetails",
        },
      },
      {
        $unwind: {
          path: "$candidateDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          type: { $literal: "AI" },
          title: "$position",
          examType: 1,
          difficulty: 1,
          candidate: {
            _id: "$candidateDetails._id",
            name: "$candidateDetails.name",
            email: "$candidateDetails.email",
            mobile: "$candidateDetails.mobile",
            role: "$candidateDetails.role",
            year_of_experience: "$candidateDetails.year_of_experience",
            status: "$candidateDetails.status",
            candidate_status: "$candidateDetails.candidate_status",
          },
          startDate: "$candidates.scheduledStartDate",
          endDate: "$candidates.scheduledEndDate",
          interviewStatus: "$candidates.status",
          interviewLink: "$candidates.interviewLink",
          password: "$candidates.password",
        },
      },
    ]);

    //  🔥 NEW: COUNT MCQ & AI SCHEDULED

    const sheduled_mcq_interview = mcqData.filter(
      (item) =>
        item.interviewLink &&
        item.password &&
        item.interviewStatus !== "cancelled",
    ).length;

    const sheduled_ai_interview = aiData.filter(
      (item) =>
        item.interviewLink &&
        item.password &&
        item.interviewStatus !== "cancelled",
    ).length;

    //  MERGE + FILTER

    const allInterviews = [...mcqData, ...aiData]
      .filter(
        (item) =>
          item.interviewLink &&
          item.password &&
          item.interviewStatus !== "cancelled",
      )
      .map(({ password, ...rest }) => rest);

    // CATEGORIZE

    const upcoming = [];
    const past = [];

    allInterviews.forEach((item) => {
      if (!item.startDate || !item.endDate) return;

      const end = new Date(item.endDate);

      // ✅ Rule 1: If completed → always past
      if (item.interviewStatus === "completed") {
        past.push(item);
      }

      // ✅ Rule 2: Not completed & still valid → upcoming
      else if (end >= now) {
        upcoming.push(item);
      }

      // ✅ Rule 3: Not completed but date passed → past
      else {
        past.push(item);
      }
    });
    // 🔥 Sort upcoming by nearest first (today first, then tomorrow)
    upcoming.sort((a, b) => {
      return new Date(a.startDate) - new Date(b.startDate);
    });

    // 🔥 Sort past by latest first
    past.sort((a, b) => {
      return new Date(b.endDate) - new Date(a.endDate);
    });

    // response with counts and categorized interviews

    return res.status(200).json({
      totalScheduledTests: allInterviews.length,

      // 🔥 Newly Added Counts
      sheduled_mcq_interview,
      sheduled_ai_interview,

      upcomingCount: upcoming.length,
      pastCount: past.length,

      upcoming,
      past,
    });
  } catch (error) {
    console.error("GetAllSchedule Error:", error);
    return res.status(500).json({ error });
  }
};

export const rescheduleInterview = async (req, res) => {
  try {
    const { type, interviewId } = req.params;
    const { candidateId, newStartDate, newEndDate } = req.body;

    if (!candidateId || !newStartDate || !newEndDate) {
      return res.status(400).json({
        message: "candidateId, newStartDate, newEndDate required",
      });
    }

    let interview;

    if (type === "MCQ") {
      interview = await MCQ_Interview.findById(interviewId).populate(
        "candidates.candidateId",
      );
    } else if (type === "AI") {
      interview = await AI_Interview.findById(interviewId).populate(
        "candidates.candidateId",
      );
    } else {
      return res.status(400).json({ message: "Invalid interview type" });
    }

    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    const candidateEntry = interview.candidates.find(
      (c) => c.candidateId._id.toString() === candidateId,
    );

    if (!candidateEntry)
      return res.status(404).json({ message: "Candidate not found" });

    // ❌ Prevent rescheduling completed/cancelled
    if (
      candidateEntry.status === "completed" ||
      candidateEntry.status === "cancelled"
    ) {
      return res.status(400).json({
        message: "Cannot reschedule completed/cancelled interview",
      });
    }

    // ✅ Update Dates
    if (type === "MCQ") {
      candidateEntry.start_Date = new Date(newStartDate);
      candidateEntry.end_Date = new Date(newEndDate);
    } else {
      candidateEntry.scheduledStartDate = new Date(newStartDate);
      candidateEntry.scheduledEndDate = new Date(newEndDate);
    }

    candidateEntry.status = "scheduled";

    await interview.save();

    // 🔥 Update Candidate main status
    await Candidate.findByIdAndUpdate(candidateId, {
      status: "scheduled",
    });

    // ===================================================
    // 🔥 SEND EMAIL AFTER RESCHEDULE
    // ===================================================

    const candidate = candidateEntry.candidateId;

    const interviewLink = candidateEntry.interviewLink;
    const username = candidateEntry.username;
    const password = candidateEntry.password;

    try {
      if (type === "MCQ") {
        await sendMCQInterviewLink(
          candidate.email,
          candidate.name,
          interviewLink,
          username,
          password,
          interview.test_title,
          interview.difficulty,
          interview.duration,
          interview.no_of_questions,
          interview.passing_score,
          interview.primary_skill,
          interview.secondary_skill,
          new Date(newStartDate),
          new Date(newEndDate),
        );
      } else {
        const finalMessage = `Your AI Interview has been rescheduled. Please attend within the new time window.`;

        await sendAIInterviewLink(
          candidate.email,
          interviewLink,
          password,
          `AI Interview Rescheduled - ${interview.testTitle}`,
          interview.passingScore,
          finalMessage,
          new Date(newEndDate),
          new Date(newStartDate),
        );
      }

      console.log("Reschedule email sent to:", candidate.email);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.status(200).json({
      message: "Interview rescheduled successfully & email sent",
    });
  } catch (error) {
    console.error("Reschedule Error:", error);
    res.status(500).json({ error });
  }
};

export const cancelInterview = async (req, res) => {
  try {
    const { type, interviewId } = req.params;
    const { candidateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({ message: "candidateId required" });
    }

    let interview;

    if (type === "MCQ") {
      interview = await MCQ_Interview.findById(interviewId).populate(
        "candidates.candidateId",
      );
    } else if (type === "AI") {
      interview = await AI_Interview.findById(interviewId).populate(
        "candidates.candidateId",
      );
    } else {
      return res.status(400).json({ message: "Invalid interview type" });
    }

    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    const candidateEntry = interview.candidates.find(
      (c) => c.candidateId._id.toString() === candidateId,
    );

    if (!candidateEntry)
      return res.status(404).json({ message: "Candidate not found" });

    candidateEntry.status = "cancelled";
    await interview.save();

    await Candidate.findByIdAndUpdate(candidateId, {
      status: "cancelled",
    });

    // 🔥 SEND EMAIL TO BOTH
    await sendInterviewCancellationEmail(
      candidateEntry.candidateId.email,
      candidateEntry.candidateId.name,
      type,
      interview.test_title,
      candidateEntry.start_Date || candidateEntry.scheduledStartDate,
      "hr@yourcompany.com", // Replace with real HR email
    );

    res.status(200).json({
      message: "Interview cancelled and email sent",
    });
  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({ error });
  }
};

export const getStudentScores = async (req, res) => {
  try {
    const { examType } = req.query;

    if (!examType || !["MCQ", "AI"].includes(examType)) {
      return res.status(400).json({
        success: false,
        message: "examType must be MCQ or AI",
      });
    }
    if (examType === "AI") {
      const aiData = await InterviewFeedback.find({
        examType: "AI",
      })
        .populate({
          path: "interview_id",
          populate: {
            path: "candidates.candidateId",
            model: "Candidate",
            select: "name email candidate_status",
          },
        })
        .lean();
      console.log("aiData", aiData);
      // Compute score for records that don't have it
      const data = aiData.map((item) => {
        if (item.score != null) return item;

        const fb = item.feedback || {};
        const techItems = fb.technicalCompetency || [];
        const behaviorItems = fb.behavioralInsights || [];

        // Calculate technicalScore if missing
        let technicalScore = fb.technicalScore;
        if (technicalScore == null) {
          const totalTech = techItems.length || 1;
          const techGood = techItems.filter((i) => i.status === "good").length;
          const techWarning = techItems.filter(
            (i) => i.status === "warning",
          ).length;
          const techScoreRaw = (techGood * 1 + techWarning * 0.5) / totalTech;
          const complexityScore = fb.speechPatterns?.complexityScore || 1;
          technicalScore = Math.min(
            100,
            Math.round(techScoreRaw * 60 + (complexityScore / 5) * 40),
          );
        }

        // Calculate relevanceScore if missing
        let relevanceScore = fb.relevanceScore;
        if (relevanceScore == null) {
          const totalBehavior = behaviorItems.length || 1;
          const behaviorGood = behaviorItems.filter(
            (i) => i.status === "good",
          ).length;
          const behaviorWarning = behaviorItems.filter(
            (i) => i.status === "warning",
          ).length;
          const behaviorScoreRaw =
            (behaviorGood * 1 + behaviorWarning * 0.5) / totalBehavior;
          const clarityScore = fb.speechPatterns?.clarityScore || 0;
          relevanceScore = Math.min(
            100,
            Math.round(behaviorScoreRaw * 50 + clarityScore * 0.5),
          );
        }

        item.score = Math.round(technicalScore * 0.6 + relevanceScore * 0.4);
        if (!fb.technicalScore) item.feedback.technicalScore = technicalScore;
        if (!fb.relevanceScore) item.feedback.relevanceScore = relevanceScore;

        return item;
      });

      return res.status(200).json({
        success: true,
        type: "AI",
        total: data.length,
        data,
      });
    }

    const scores = await Score.find({ examType })
      .populate("interviewId")
      .populate("candidateId")
      .populate("scores.questionId");

    return res.status(200).json({
      success: true,
      totalStudents: scores.length,
      scores,
    });
  } catch (error) {
    console.error("getStudentScores Error:", error);
    return res.status(500).json({
      success: false,
      error,
    });
  }
};
