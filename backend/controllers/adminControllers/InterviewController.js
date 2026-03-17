import { randomUUID } from "crypto";
import AI_Interview from "../../models/AI_Interview.js";
import MCQ_Interview from "../../models/MCQ_Interview.js";
import Candidate from "../../models/Candidate.js";
import Score from "../../models/Score.js";
import { sendAIInterviewLink } from "../../services/emailService.js";
import mongoose from "mongoose";
import InterviewFeedback from "../../models/feedback.js";
export const CreateAITemplate = async (req, res) => {
  try {
    const {
      position,
      description,
      passingScore,
      difficulty,
      skills,
      duration,
      numberOfQuestions,
    } = req.body;

    const file = req.file;

    // ================= VALIDATION =================
    if (
      !file ||
      !difficulty ||
      !duration ||
      !position ||
      !description ||
      !skills ||
      !passingScore ||
      !numberOfQuestions
    ) {
      return res.status(400).json({
        message:
          "Job description file, difficulty, duration, position, description, passing score,skills and number of questions are required.",
      });
    }

    // ================= FORMAT FILE PATH =================
    const jobDescription = file.path.replace(/\\/g, "/");
    // examType = "Interview";
    // ================= GENERATE QUESTIONS USING AI =================
    // const questions = await generateQuestions(
    //   jobDescription,
    //   position,
    //   difficulty,
    //   examType,
    //   parseInt(numberOfQuestions)
    // );

    // ================= CREATE INTERVIEW =================
    const interview = await AI_Interview.create({
      jobDescription: jobDescription,
      position,
      difficulty,
      duration,
      skills,
      passingScore,
      numberOfQuestions,
      description: description,
      createdBy: req.user.id, // from auth middleware
      // questions,
      candidates: [],
      status: "draft", // default
    });

    console.log("Created AI Interview:", interview);

    // ================= RESPONSE =================
    return res.status(201).json({
      jobId: interview._id,
      interview: {
        _id: interview._id,
        position: interview.position,
        difficulty: interview.difficulty,
        duration: interview.duration,
        createdAt: interview.createdAt,
        questions: interview.questions,
        skills: interview.skills,
        passingScore: interview.passingScore,
        description: interview.description,
        jobDescription: interview.jobDescription,
        numberOfQuestions: interview.numberOfQuestions,
      },
      // questions,
    });
  } catch (error) {
    console.error("Generate AI Interview Error:", error);
    return res.status(500).json({
      message: "Server error while generating AI interview",
      error: error.message,
    });
  }
};
// export const GetAllAIInterview = async (req, res) => {
//   try {
//     const adminId = req.user.id;
//     const { id } = req.query;

//     /* ================= GET SINGLE INTERVIEW ================= */
//     if (id) {
//       // Validate ObjectId
//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid interview ID",
//         });
//       }

//       const interview = await AI_Interview.findOne({
//         _id: id,
//         createdBy: adminId,
//       }).populate({
//   path: "candidates.candidateId",
//   select: "name email mobile",
// });

//       // console.log("interview",interview)
//       if (!interview) {
//         return res.status(404).json({
//           success: false,
//           message: "Interview not found",
//         });
//       }

//       return res.status(200).json({
//         success: true,
//         data: interview,
//       });
//     }

//     /* ================= GET ALL DRAFT INTERVIEWS ================= */

//     const drafts = await AI_Interview.find({
//       createdBy: adminId,
//     }).sort({ createdAt: -1 });

//     const formattedDrafts = drafts.map((item) => ({
//       jobId: item._id,
//       _id: item._id,
//       position: item.position,
//       difficulty: item.difficulty,
//       duration: item.duration,
//       skills: item.skills,
//       passingScore: item.passingScore,
//       numberOfQuestions: item.numberOfQuestions,
//       description: item.description,
//       status: item.status,
//       createdAt: item.createdAt,
//     }));

//     return res.status(200).json({
//       success: true,
//       totalDrafts: formattedDrafts.length,
//       drafts: formattedDrafts,
//     });
//   } catch (error) {
//     console.error("Get AI Interview Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

export const GetAllAIInterview = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.query;

    /* ======================================================
       GET SINGLE INTERVIEW
    ====================================================== */
    if (id) {

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid interview ID",
        });
      }

      const interview = await AI_Interview.findOne({
        _id: id,
        createdBy: adminId,
      }).populate({
        path: "candidates.candidateId",
        select: "name email mobile",
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          message: "Interview not found",
        });
      }

      // ===== Fetch feedbacks
      const feedbacks = await InterviewFeedback.find({
        interview_id: id,
      });
      // console.log("feedbacks",feedbacks)

      const feedbackMap = new Map();
      console.log("feedbackMap",feedbackMap)

     feedbacks.forEach((f) => {
  if (f?.candidateId) {
    feedbackMap.set(String(f.candidateId), f);
  }
});

      // ===== Attach feedback to candidates
      const updatedCandidates = interview.candidates.map((candidate) => {
        
        const candidateId =
        candidate?.candidateId?._id?.toString()
      
        console.log("candidate",candidateId)

        const matchedFeedback = candidateId
          ? feedbackMap.get(candidateId)
          : null;

          // console.log("matchedFeedback",matchedFeedback)

        return {
          ...candidate.toObject(),
          feedback: matchedFeedback || null,
          score: matchedFeedback?.score ?? null,
          verdict: matchedFeedback?.feedback?.overallVerdict ?? null,
        };
      });

      // console.log("updatedCandidates",updatedCandidates)
      const interviewObj = interview.toObject();

      interviewObj.candidates = updatedCandidates;

      return res.status(200).json({
        success: true,
        data: interviewObj,
      });
    }

    /* ======================================================
       GET ALL INTERVIEWS
    ====================================================== */

    const interviews = await AI_Interview.find({
      createdBy: adminId,
    })
      .sort({ createdAt: -1 })
      .populate("candidates.candidateId", "name email mobile");

    const interviewIds = interviews.map((i) => i._id);

    const feedbacks = await InterviewFeedback.find({
      interview_id: { $in: interviewIds },
    });

    // ===== Create map for faster lookup
    const feedbackMap = {};

    feedbacks.forEach((f) => {

      if (f?.candidateId && f?.interview_id) {

        const key = `${String(f.interview_id)}_${String(f.candidateId)}`;

        feedbackMap[key] = f;
      }
    });

    // ===== Attach feedback to interviews
    const updatedInterviews = interviews.map((interview) => {

      const updatedCandidates = interview.candidates.map((candidate) => {

        const candidateId =
          candidate?.candidateId?._id?.toString() ||
          candidate?.candidateId?.toString();

        const key = candidateId
          ? `${String(interview._id)}_${candidateId}`
          : null;

        const matchedFeedback = key ? feedbackMap[key] : null;

        return {
          ...candidate.toObject(),
          feedback: matchedFeedback || null,
          score: matchedFeedback?.score ?? null,
          verdict: matchedFeedback?.feedback?.overallVerdict ?? null,
        };
      });

      return {
        ...interview.toObject(),
        candidates: updatedCandidates,
      };
    });

    return res.status(200).json({
      success: true,
      totalInterviews: updatedInterviews.length,
      interviews: updatedInterviews,
    });

  } catch (error) {

    console.error("Get AI Interview Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });

  }
};

export const AIInterviewInvitation = async (req, res) => {
  try {
    const { jobId, candidateIds, messageBody, startDate, endDate, testTitle } =
      req.body;

    if (
      !jobId ||
      !candidateIds ||
      !messageBody ||
      !startDate ||
      !endDate ||
      !testTitle
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    const interview = await AI_Interview.findById(jobId);
    // console.log("Interview found:", interview);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found." });
    }

    const candidates = await Candidate.find({
      _id: { $in: candidateIds },
    });

    if (candidates.length !== candidateIds.length) {
      return res.status(400).json({
        message: "Some candidate IDs are invalid.",
      });
    }

    for (const candidate of candidates) {
      const interviewLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/user/login/${interview._id}`;
      const username = `user_${Math.random().toString(36).substring(2, 10)}`;
      const password = randomUUID().slice(0, 8);

      interview.candidates.push({
        candidateId: candidate._id,
        interviewLink,
        password,
        scheduledStartDate: new Date(startDate),
        scheduledEndDate: new Date(endDate),
        emailBody: messageBody,
      });

      const finalMessage = messageBody
        .replace("[Candidate Name]", candidate.name)
        .replace("[Job Role]", testTitle);

      await sendAIInterviewLink(
        candidate.email,
        interviewLink,
        password,
        `AI Interview Invitation - ${testTitle}`,
        interview.passingScore,
        finalMessage,
        new Date(endDate),
        new Date(startDate),
      );
    }

    interview.status = "scheduled";
    await interview.save();

    res.status(200).json({
      message: "Invitations sent successfully",
      totalCandidates: candidates.length,
    });
  } catch (error) {
    console.error("Error sending invitations:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
export const UpdateAIInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await AI_Interview.findById(id);
    console.log("Interview to update:", interview);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }
    if (req.file) {
      if (interview.jobDescription) {
        const oldPath = path.resolve(interview.jobDescription);

        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (err) {
            console.error("Error deleting old job description:", err);
          }
        }
      }
      interview.jobDescription = req.file.path.replace(/\\/g, "/");
    }

    // ✅ Validate status
    const allowedFields = [
      "draft",
      "scheduled",
      "position",
      "description",
      "jobDescription",
      "jobDescriptionText",
      "secondaryJobDescription",
      "difficulty",
      "duration",
      "passingScore",
      "numberOfQuestions",
    ];
    if (req.body.skills) {
  let skills = req.body.skills;

  // If single value convert to array
  if (!Array.isArray(skills)) {
    skills = [skills];
  }

  // Flatten nested arrays
  skills = skills.flat(Infinity);

  // Convert everything to string
  skills = skills.map((s) => String(s));

  interview.skills = skills;
}

    allowedFields.forEach((field) => {
      if (
        req.body[field] !== undefined &&
        req.body[field] !== null &&
        req.body[field] !== ""
      ) {
        interview[field] = req.body[field];
      }
    });
    await interview.save();

    return res.status(200).json({
      message: "Interview updated successfully",
      interview,
    });
  } catch (error) {
    console.error("Update Interview Status Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
export const ScheduleAiInterview = async (req, res) => {
  try {
    const {
      candidates,
      scheduledStartDate,
      scheduledEndDate,
      subjectLine,
      messageBody,
    } = req.body;

    const { interviewId } = req.params;

    if (
      !scheduledStartDate ||
      !scheduledEndDate ||
      !subjectLine ||
      !messageBody ||
      !candidates
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const candidateArray =
      typeof candidates === "string" ? JSON.parse(candidates) : candidates;
    if (!Array.isArray(candidateArray) || candidateArray.length === 0)
      return res.status(400).json({ message: "Candidates must be an array" });

    // 🔍 Get existing interview
    const interview = await AI_Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });
    // console.log("interview existing candidates:", interview);
    const scheduledCandidates = [];
    const cooldownCandidates = [];

    // 7-day cooldown threshold
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const candId of candidateArray) {
      const candidate = await Candidate.findById(candId);
      if (!candidate)
        return res
          .status(404)
          .json({ message: `Candidate ID ${candId} not found` });

      // 🔒 7-day cooldown check across MCQ and AI interviews
      const mcqCooldown = await MCQ_Interview.findOne({
        candidates: {
          $elemMatch: {
            candidateId: candId,
            start_Date: { $gte: sevenDaysAgo },
          },
        },
      });

      const aiCooldown = await AI_Interview.findOne({
        candidates: {
          $elemMatch: {
            candidateId: candId,
            scheduledStartDate: { $gte: sevenDaysAgo },
          },
        },
      });

      if (mcqCooldown || aiCooldown) {
        cooldownCandidates.push({
          candidate: candidate.email,
          reason:
            "Candidate was recently invited to an interview. Please wait 7 days.",
        });
        continue;
      }

      const interviewLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/candidate/login/${interviewId}`;
      const password = Math.random().toString(36).slice(-8);

      const personalizedBody = messageBody
        .replace("[Candidates Name]", candidate.name)
        .replace("[job role]", candidate.role || "your applied role")
        .replace("[Date]", new Date(scheduledEndDate).toDateString())
        .replace("[Interview link]", interviewLink);

      const entry = {
        candidateId: candidate._id,
        interviewLink,
        password,
        scheduledStartDate: new Date(scheduledStartDate),
        scheduledEndDate: new Date(scheduledEndDate),
        emailSubject: subjectLine,
        emailBody: personalizedBody,
      };

      interview.candidates.push(entry);
      scheduledCandidates.push(entry);

      await sendAIInterviewLink(
        candidate.email,
        entry.interviewLink,
        entry.password,
        subjectLine,
        personalizedBody,
        scheduledEndDate,
        scheduledStartDate,
      );
    }

    await interview.save();

    res.status(200).json({
      message: "Interview invitations sent",
      interviewId,
      scheduledCandidates,
      cooldownCandidates,
    });
  } catch (err) {
    console.error("Error scheduling AI interview:", err);
    res.status(500).json({ message: "Server error", details: err.message });
  }
};
export const GetAllAiInterviewSchedule = async (req, res) => {
  try {
    const [{ total } = { total: 0 }] = await AI_Interview.aggregate([
      { $unwind: "$candidates" },
      {
        $match: {
          "candidates.interviewLink": { $type: "string", $ne: null },
          "candidates.password": { $type: "string", $ne: null },
        },
      },
      { $count: "total" },
    ]);

    return res.json({ totalSchedules: total });
  } catch (err) {
    console.error("Error counting schedules:", err.message);

    res.status(500).json({ error });
  }
};
export const rescheduleAiInterview = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { candidateId, newStartDate, newEndDate } = req.body;

    if (!candidateId || !newStartDate || !newEndDate) {
      return res.status(400).json({
        message: "candidateId, newStartDate and newEndDate are required",
      });
    }

    const interview = await AI_Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    const candidateEntry = interview.candidates.find(
      (c) => c.candidateId.toString() === candidateId,
    );

    if (!candidateEntry)
      return res
        .status(404)
        .json({ message: "Candidate not found in interview" });

    // 🚫 Don't allow reschedule if already expired
    if (new Date() > candidateEntry.scheduledEndDate) {
      return res.status(400).json({
        message: "Cannot reschedule expired interview",
      });
    }

    candidateEntry.scheduledStartDate = new Date(newStartDate);
    candidateEntry.scheduledEndDate = new Date(newEndDate);

    await interview.save();

    res.status(200).json({
      message: "Interview rescheduled successfully",
      interviewId,
      candidateId,
      newStartDate,
      newEndDate,
    });
  } catch (error) {
    console.error("Reschedule AI Interview Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
