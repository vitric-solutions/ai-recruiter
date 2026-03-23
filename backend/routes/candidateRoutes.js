import express from "express";
import jwt from "jsonwebtoken";
import { upload } from "../middleware/upload.js";
import cloudinary from "../config/cloudinary.js";
import Candidate from "../models/Candidate.js";
import Interview from "../models/MCQ_Interview.js";
import AI_Interview from "../models/AI_Interview.js";
import MCQ_Interview from "../models/MCQ_Interview.js";
import Question from "../models/Question.js";
import Score from "../models/Score.js";
import auth from "../middleware/auth.js";

import { generateSummary } from "../services/aiServiceold.js";
import { generateScorecardPDFBuffer } from "../services/pdfService.js";
import { getMCQInterviewById } from "../controllers/adminControllers/AssessmentController.js";
import { getIO } from "../socket.js";

const router = express.Router();

// Candidate login for interview
router.post("/login/:id", async (req, res) => {
  const { email, password } = req.body;
  const { id } = req.params;

  try {
    // 1️⃣ Try finding in Interview
    let interview = await Interview.findById(id).populate(
      "candidates.candidateId",
      "email",
    );

    // 2️⃣ If not found → Try AI_Interview
    if (!interview) {
      interview = await AI_Interview.findById(id).populate(
        "candidates.candidateId",
        "email",
      );
    }

    // 3️⃣ If still not found
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // 4️⃣ Find candidate
    const candidateEntry = interview.candidates.find(
      (c) =>
        c.candidateId &&
        c.candidateId.email === email &&
        c.password === password,
    );

    console.log(candidateEntry)
    if (!candidateEntry) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

      if (candidateEntry.status === "completed") {
      return res.status(403).json({
        message: "Interview already completed",
      });
    }

    // // 5️⃣ Date Check
    // const now = new Date();
    // const startDate = new Date(candidateEntry.start_Date);
    // const endDate = new Date(candidateEntry.end_Date);

    // if (now < startDate) {
    //   return res.status(403).json({
    //     message: "Interview has not started yet",
    //   });
    // }

    // if (now > endDate) {
    //   candidateEntry.status = "expired";
    //   await interview.save();

    //   return res.status(403).json({
    //     message: "Interview has expired",
    //   });
    // }

  

    // 6️⃣ Generate Token
    const token = jwt.sign(
      { id: candidateEntry.candidateId._id, role: "candidate" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    // 🔌 Emit real-time event to admins
  
      // getIO().to("admins").emit("candidate-logged-in", {
      //   candidateId: candidateEntry.candidateId._id,
      //   candidateName: candidateEntry.candidateId.email,
      //   interviewId: id,
      // });

    res.json({
      token,
      interviewId: id,
      candidateEntry,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({error});
  }
});

// // Configure multer for multiple file uploads for candidate documents
// const documentsStorage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     let uploadPath = "uploads";

//     if (file.fieldname === "aadharCard") {
//       uploadPath = "uploads/aadharCards";
//     } else if (file.fieldname === "photo") {
//       uploadPath = "uploads/candidate-photo";
//     }

//     // Create folder if it doesn't exist
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }

//     cb(null, uploadPath);
//   },

//   filename: function (req, file, cb) {
//     const ext = path.extname(file.originalname);

//     const fileName = `${req.user.id}_${file.fieldname}_${Date.now()}${ext}`;

//     cb(null, fileName);
//   }
// });

// const documentsUpload = multer({
//   storage: documentsStorage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
// });

// Upload candidate documents: aadharFront, aadharBack, photo
router.put(
  "/:id/upload-aadharCard",
  auth("candidate"),
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "aadharCard", maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    try {
      // Remove debug return so code executes
      const candidate = await Candidate.findById(req.user.id);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      // Update fields if files are uploaded, convert backslashes to forward slashes
      if (req.files["aadharCard"]) {
        candidate.aadharCard = req.files["aadharCard"][0].path.replace(
          /\\/g,
          "/",
        );
      }
      await candidate.save();
      res.json({
        message: "Document uploaded and candidate updated",
        aadharCard: candidate.aadharCard,
      });
    } catch (error) {
      res.status(500).json({error});
    }
  },
);

router.put(
  "/:id/upload-photo",
  auth("candidate"),
  upload.fields([{ name: "photo", maxCount: 1 }]),
  async (req, res) => {
    const { id } = req.params;
    try {
      // Remove debug return so code executes
      const candidate = await Candidate.findById(req.user.id);

      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      // Update fields if files are uploaded, convert backslashes to forward slashes

      if (req.files["photo"]) {
        candidate.photo = req.files["photo"][0].path.replace(/\\/g, "/");
      }
      await candidate.save();
      res.json({
        message: "Document uploaded and candidate updated",
        photo: candidate.photo,
      });
    } catch (error) {
      res.status(500).json({error});
    }
  },
);

// Get MCQ interview template for candidate
router.get("/assessment/template/:id", auth("candidate"), getMCQInterviewById);

router.get("/interview/:id", auth("candidate"), async (req, res) => {
  try {
    const { id } = req.params;
    const candidateId = req.user.id;

    const interview = await MCQ_Interview.findById(id);
    if (!interview)
      return res.status(404).json({ message: "Interview not found" });

    const candidateEntry = interview.candidates.find(
      (c) => c.candidateId.toString() === candidateId,
    );

    if (!candidateEntry)
      return res.status(403).json({ message: "Not authorized" });

    const now = new Date();
    if (now < candidateEntry.start_Date || now > candidateEntry.end_Date) {
      return res.status(403).json({ message: "Interview not active" });
    }

    const questionLimit = interview.no_of_questions;

    let questions;

    // ✅ If already assigned → return same
    if (candidateEntry.assignedQuestions.length > 0) {
      questions = await Question.find({
        _id: { $in: candidateEntry.assignedQuestions },
      }).select("-correctAnswer -answers");
    } else {
      // ✅ Randomly assign only once
      const randomQuestions = await Question.aggregate([
        {
          $match: {
            interviewId: interview._id,
            examType: "MCQ",
          },
        },
        { $sample: { size: questionLimit } },
        { $project: { correctAnswer: 0, answers: 0 } },
      ]);

      candidateEntry.assignedQuestions = randomQuestions.map((q) => q._id);
      candidateEntry.status = "in_progress";

      await interview.save();

      // 🔌 Emit real-time event to admins
      try {
        getIO().to("admins").emit("interview-started", {
          candidateId,
          interviewId: id,
        });
      } catch (_) {}

      questions = randomQuestions;
    }

    res.json({ interview, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({error});
  }
});

//get interview MCQ question
router.get("/interview/:id/questions", auth("candidate"), async (req, res) => {
  const { id } = req.params;
  try {
    const questions = await Question.find({ interviewId: id });
    res.json({ questions });
  } catch (error) {
    res.status(500).json({error});
  }
});

// router.post("/interview/:id/answer", auth("candidate"), async (req, res) => {
//   const { id } = req.params;
//   const { questionId, answerText } = req.body;
//   try {
//     const interview = await Interview.findById(id);
//     const question = await Question.findById(questionId);
//     if (!question)
//       return res.status(404).json({ message: "Question not found" });

//     // Check if the candidate already answered this question
//     const existingAnswerIndex = question.answers.findIndex(
//       (a) => a.candidateId.toString() === req.user.id,
//     );

//     let evaluation;
//     //console.log("interview.Exam_Type", interview);

//     // For MCQ, check if answer is correct, feedback should be blank
//     const isCorrect =
//       question.correctAnswer && answerText === question.correctAnswer;
//     evaluation = {
//       questionId,
//       candidateId: req.user.id,
//       answerText,
//       score: isCorrect ? 10 : 0,
//       feedback: "",
//     };

//     if (existingAnswerIndex !== -1) {
//       // Update existing answer
//       question.answers[existingAnswerIndex].answerText = answerText;
//       question.answers[existingAnswerIndex].score = evaluation.score;
//       question.answers[existingAnswerIndex].feedback = evaluation.feedback;
//     } else {
//       // Add new answer
//       question.answers.push({
//         questionId,
//         candidateId: req.user.id,
//         answerText,
//         score: evaluation.score,
//         feedback: evaluation.feedback,
//       });
//     }

//     await question.save();

//     res.json({ message: "Answer submitted", evaluation });
//   } catch (error) {
//     //console.log(error);
//     res.status(500).json({error});
//   }
// });

router.post("/interview/:id/answer", auth("candidate"), async (req, res) => {
  const { id } = req.params;
  const { questionId, answerText } = req.body;

  // //console.log("Answer submission received:", { id, questionId, answerText });

  try {
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Calculate score (MCQ logic)
    const isCorrect =
      question.correctAnswer &&
      answerText.trim() === question.correctAnswer.trim();

    const score = isCorrect ? 10 : 0;
    // //console.log(question);
    // //console.log(req);
    // Find existing answer for same candidate
    const existingAnswer = question.answers.find(
      (a) => a.candidateId.toString() === req.user.id,
    );
    // //console.log("Existing Answer:", existingAnswer);
    if (existingAnswer) {
      // ✅ UPDATE existing score
      existingAnswer.answerText = answerText;
      existingAnswer.score = score;
      existingAnswer.feedback = "";
    } else {
      // ✅ CREATE new answer entry
      question.answers.push({
        questionId,
        candidateId: req.user.id,
        answerText,
        score,
        feedback: "",
      });
    }

    await question.save();

    res.json({
      success: true,
      message: existingAnswer
        ? "Answer updated successfully"
        : "Answer submitted successfully",
      score,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({error});
  }
});

router.post("/interview/:id/submit", auth("candidate"), async (req, res) => {
  try {
    const { id } = req.params;
    const candidateId = req.user.id;

    // //console.log("Submit called for interview", id);

    // 🔥 1️⃣ Try finding interview in both collections
    let interview = await MCQ_Interview.findById(id);
    let interviewModel = "MCQ_Interview";


    if (!interview) {
      interview = await AI_Interview.findById(id);
      interviewModel = "AI_Interview";
    }

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // 🔥 2️⃣ Find candidate inside interview
    const candidateEntry = interview.candidates.find(
      (c) => c.candidateId.toString() === candidateId,
    );

    if (!candidateEntry) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (candidateEntry.status === "completed") {
      return res.status(400).json({
        message: "Interview already submitted",
      });
    }

    let totalScore = 0;
    let scores = [];

    // ==================================================
    // 🔥 3️⃣ HANDLE MCQ INTERVIEW
    // ==================================================
    if (interview.examType === "MCQ") {
      const assignedQuestions = candidateEntry.assignedQuestions;

      if (!assignedQuestions?.length) {
        return res.status(400).json({
          message: "No assigned questions found",
        });
      }

      const questions = await Question.find({
        _id: { $in: assignedQuestions },
      });

      questions.forEach((q) => {
        const answer = q.answers.find(
          (a) => a.candidateId.toString() === candidateId,
        );

        const score = answer?.score || 0;
        totalScore += score;

        scores.push({
          questionId: q._id,
          questionText: q.questionText || "",
          options: q.options || [],
          correctAnswer: q.correctAnswer || "",
          userAnswer: answer?.answerText || "",
          score,
          feedback: answer?.feedback || "",
        });
      });
    }

    // ==================================================
    // 🔥 4️⃣ HANDLE AI INTERVIEW
    // ==================================================
    if (interview.examType === "AI") {
      // Assume answers stored differently
      const aiAnswers = req.body.answers || [];

      aiAnswers.forEach((a) => {
        totalScore += a.score;

        scores.push({
          questionId: a.questionId,
          questionText: a.questionText || "",
          options: a.options || [],
          correctAnswer: a.correctAnswer || "",
          userAnswer: a.userAnswer || "",
          score: a.score,
          feedback: a.feedback || "",
        });
      });
    }

    const maxScore = scores.length * 10;
    const percentage = (totalScore / maxScore) * 100;

    // 🔥 5️⃣ Generate summary
    const summary = await generateSummary(scores);

    // 🔥 6️⃣ Generate PDF BEFORE saving to DB
    // (Score.create strips extra fields like questionText, options, etc. by reference)
    const candidate = await Candidate.findById(candidateId);

    const pdfBuffer = await generateScorecardPDFBuffer(
      candidate,
      scores,
      totalScore,
      summary,
    );

    // ✅ Upload via stream — most reliable for raw PDFs
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "scorecards",
          resource_type: "raw",
          format: "pdf",
          public_id: `scorecard-${candidateId}-${Date.now()}`,
          access_mode: "public",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      uploadStream.end(pdfBuffer);
    });

    // 🔥 7️⃣ Save score document (after PDF is generated)
    const scoreDoc = await Score.create({
      interviewId: interview._id,
      interviewModel,
      examType: interview.examType,
      candidateId,
      scores,
      totalScore,
      maxScore,
      summary,
      pdfPath: uploadResult.secure_url.replace("/upload/", "/upload/fl_attachment/"),
    });

    // 🔥 8️⃣ Update candidate status
    candidateEntry.status = "completed";
    candidateEntry.score = totalScore;
    candidateEntry.submittedAt = new Date();

    await interview.save();

    // 🔌 Emit real-time event to admins
    try {
      getIO().to("admins").emit("interview-submitted", {
        candidateId,
        candidateName: candidate?.name || "Unknown",
        interviewId: interview._id,
        totalScore,
        percentage: Math.round(percentage),
      });
    } catch (_) {}

    res.json({
      message: "Interview submitted successfully",
      totalScore,
      percentage: Math.round(percentage),
      pdfPath: uploadResult.secure_url,
    });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ message: error.message });
  }
});

// In your candidateRoutes or adminRoutes
router.get("/download-scorecard", auth("admin"), async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || !url.startsWith("https://res.cloudinary.com")) {
      return res.status(400).json({ message: "Invalid URL" });
    }

    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ message: "Failed to fetch PDF from Cloudinary" });
    }

    const buffer = await response.arrayBuffer();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="scorecard.pdf"`,
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Download failed" });
  }
});
export default router;
