import express from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── Multer: memory storage for screen recording chunks ──────────────────────
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per chunk
});

// ─── Multer: memory storage for webcam/interview recording chunks ─────────────
const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB per chunk
});

// ─── Helper: make sure a directory exists ─────────────────────────────────────
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── Base directory for screen recordings ─────────────────────────────────────
const RECORDINGS_BASE = path.join(__dirname, "../public/screen-recordings");

// ─── Base directory for interview (webcam) recordings ─────────────────────────
const INTERVIEW_RECORDINGS_DIR = path.join(__dirname, "../public/recordings");

// ─── Helper: merge all chunk_XXXXXX.* files in a session folder ───────────────
async function mergeChunks(sessionDir, ext, interview_id, candidate_id) {
  const chunkFiles = fs
    .readdirSync(sessionDir)
    .filter((f) => f.startsWith("chunk_") && f.endsWith(`.${ext}`))
    .sort(); // lexicographic sort works because we zero-padded

  if (chunkFiles.length === 0) {
    console.warn("[ScreenRec] No chunks found to merge in", sessionDir);
    return null;
  }

  const finalName = `recording_${interview_id}_${candidate_id}.${ext}`;
  const finalPath = path.join(sessionDir, finalName);
  const writeStream = fs.createWriteStream(finalPath);

  await new Promise((resolve, reject) => {
    const writeNext = (index) => {
      if (index >= chunkFiles.length) {
        writeStream.end();
        return;
      }
      const data = fs.readFileSync(path.join(sessionDir, chunkFiles[index]));
      const ok = writeStream.write(data);
      if (ok) {
        writeNext(index + 1);
      } else {
        writeStream.once("drain", () => writeNext(index + 1));
      }
    };

    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    writeNext(0);
  });

  for (const cf of chunkFiles) {
    try { fs.unlinkSync(path.join(sessionDir, cf)); } catch (_) {}
  }

  const relativePath = `/screen-recordings/${path.basename(sessionDir)}/${finalName}`;
  console.log(`[ScreenRec] Merged ${chunkFiles.length} chunks → ${relativePath}`);
  return relativePath;
}

// ─── Helper: merge interview (webcam) recording chunks ────────────────────────
async function mergeInterviewChunks(sessionDir, ext = "webm") {
  const chunkFiles = fs
    .readdirSync(sessionDir)
    .filter((f) => /^chunk_\d+\.\w+$/.test(f))
    .sort((a, b) => {
      const idxA = parseInt(a.match(/chunk_(\d+)/)?.[1] ?? "0", 10);
      const idxB = parseInt(b.match(/chunk_(\d+)/)?.[1] ?? "0", 10);
      return idxA - idxB;
    });

  if (chunkFiles.length === 0) {
    console.warn("[Recording] No chunks found to merge in", sessionDir);
    return null;
  }

  const finalFilename = `recording.${ext}`;
  const finalPath = path.join(sessionDir, finalFilename);
  const writeStream = fs.createWriteStream(finalPath);

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);

    const writeChunk = (index) => {
      if (index >= chunkFiles.length) {
        writeStream.end();
        return;
      }
      const data = fs.readFileSync(path.join(sessionDir, chunkFiles[index]));
      const ok = writeStream.write(data);
      if (ok) {
        writeChunk(index + 1);
      } else {
        writeStream.once("drain", () => writeChunk(index + 1));
      }
    };

    writeChunk(0);
  });

  for (const f of chunkFiles) {
    try { fs.unlinkSync(path.join(sessionDir, f)); } catch (_) {}
  }

  const totalSizeBytes = fs.statSync(finalPath).size;
  console.log(
    `[Recording] Merged ${chunkFiles.length} chunks → ${finalFilename}`,
    `(${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB)`,
  );

  return {
    filename: finalFilename,
    path: finalPath,
    relativePath: `/recordings/${path.basename(sessionDir)}/${finalFilename}`,
    sizeBytes: totalSizeBytes,
    chunkCount: chunkFiles.length,
  };
}



// Candidate login for interview
router.post("/login/:id", async (req, res) => {
  const { email, password } = req.body;
  const { id } = req.params;

  try {
    let interview = await Interview.findById(id).populate(
      "candidates.candidateId",
      "email",
    );

    if (!interview) {
      interview = await AI_Interview.findById(id).populate(
        "candidates.candidateId",
        "email",
      );
    }

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const candidateEntry = interview.candidates.find(
      (c) =>
        c.candidateId &&
        c.candidateId.email === email &&
        c.password === password,
    );

    console.log(candidateEntry);
    if (!candidateEntry) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (candidateEntry.status === "completed") {
      return res.status(403).json({
        message: "Interview already completed",
      });
    }

    const token = jwt.sign(
      { id: candidateEntry.candidateId._id, role: "candidate" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      token,
      interviewId: id,
      candidateEntry,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

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
      const candidate = await Candidate.findById(req.user.id);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
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
      res.status(500).json({ error });
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
      const candidate = await Candidate.findById(req.user.id);

      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      if (req.files["photo"]) {
        candidate.photo = req.files["photo"][0].path.replace(/\\/g, "/");
      }
      await candidate.save();
      res.json({
        message: "Document uploaded and candidate updated",
        photo: candidate.photo,
      });
    } catch (error) {
      res.status(500).json({ error });
    }
  },
);

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

    if (candidateEntry.assignedQuestions.length > 0) {
      questions = await Question.find({
        _id: { $in: candidateEntry.assignedQuestions },
      }).select("-correctAnswer -answers");
    } else {
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
    res.status(500).json({ error: err });
  }
});

router.get("/interview/:id/questions", auth("candidate"), async (req, res) => {
  const { id } = req.params;
  try {
    const questions = await Question.find({ interviewId: id });
    res.json({ questions });
  } catch (error) {
    res.status(500).json({ error });
  }
});

router.post("/interview/:id/answer", auth("candidate"), async (req, res) => {
  const { id } = req.params;
  const { questionId, answerText } = req.body;

  try {
    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect =
      question.correctAnswer &&
      answerText.trim() === question.correctAnswer.trim();

    const score = isCorrect ? 10 : 0;

    const existingAnswer = question.answers.find(
      (a) => a.candidateId.toString() === req.user.id,
    );

    if (existingAnswer) {
      existingAnswer.answerText = answerText;
      existingAnswer.score = score;
      existingAnswer.feedback = "";
    } else {
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
    res.status(500).json({ error });
  }
});

router.post("/interview/:id/submit", auth("candidate"), async (req, res) => {
  try {
    const { id } = req.params;
    const candidateId = req.user.id;

    let interview = await MCQ_Interview.findById(id);
    let interviewModel = "MCQ_Interview";

    if (!interview) {
      interview = await AI_Interview.findById(id);
      interviewModel = "AI_Interview";
    }

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

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

    if (interview.examType === "AI") {
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

    const summary = await generateSummary(scores);

    const candidate = await Candidate.findById(candidateId);

    const pdfBuffer = await generateScorecardPDFBuffer(
      candidate,
      scores,
      totalScore,
      summary,
    );

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
        },
      );

      uploadStream.end(pdfBuffer);
    });

    const scoreDoc = await Score.create({
      interviewId: interview._id,
      interviewModel,
      examType: interview.examType,
      candidateId,
      scores,
      totalScore,
      maxScore,
      summary,
      pdfPath: uploadResult.secure_url.replace(
        "/upload/",
        "/upload/fl_attachment/",
      ),
    });

    candidateEntry.status = "completed";
    candidateEntry.score = totalScore;
    candidateEntry.submittedAt = new Date();

    await interview.save();

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

// =============================================================================
// SCREEN RECORDING — CHUNKED UPLOAD (existing)
// POST /candidate/recording-chunk  — screen share chunks
// =============================================================================
router.post(
  "/recording-chunk",
  chunkUpload.single("chunk"),
  async (req, res) => {
    try {
      if (!req.file || req.file.size === 0) {
        return res.status(400).json({ success: false, message: "No chunk data received" });
      }

      const {
        interview_id,
        candidate_id,
        session_id,
        chunk_index,
        is_final,
        mime_type,
      } = req.body;

      if (!interview_id || !candidate_id || !session_id) {
        return res.status(400).json({
          success: false,
          message: "interview_id, candidate_id and session_id are required",
        });
      }

      const chunkIdx = parseInt(chunk_index, 10) || 0;
      const isFinal = is_final === "true";
      const ext = (mime_type || "video/webm").includes("mp4") ? "mp4" : "webm";

      const sessionDir = path.join(RECORDINGS_BASE, session_id);
      ensureDir(sessionDir);

      const paddedIdx = String(chunkIdx).padStart(6, "0");
      const chunkFile = path.join(sessionDir, `chunk_${paddedIdx}.${ext}`);
      fs.writeFileSync(chunkFile, req.file.buffer);

      console.log(
        `[ScreenRec] chunk ${chunkIdx} saved → ${chunkFile} (${req.file.size} bytes)${isFinal ? " [FINAL]" : ""}`,
      );

      let finalPath = null;
      if (isFinal) {
        finalPath = await mergeChunks(sessionDir, ext, interview_id, candidate_id);
      }

      return res.status(200).json({
        success: true,
        chunkIndex: chunkIdx,
        isFinal,
        sessionId: session_id,
        ...(finalPath ? { recordingPath: finalPath } : {}),
      });
    } catch (err) {
      console.error("[ScreenRec] chunk upload error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// =============================================================================
// SCREEN RECORDING — UPLOAD-SCREEN-CHUNK (existing)
// POST /candidate/upload-screen-chunk
// =============================================================================
router.post("/upload-screen-chunk", chunkUpload.single("chunk"), async (req, res) => {
  try {
    const { interview_id, candidateId, chunkNumber } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No chunk data provided" });
    }

    if (!interview_id || !candidateId || !chunkNumber) {
      return res.status(400).json({
        message: "Missing required fields: interview_id, candidateId, chunkNumber",
      });
    }

    const timestamp = Date.now();
    const sessionDir = path.join(
      RECORDINGS_BASE,
      `screen_recording_${interview_id}_${candidateId}_${timestamp}`,
    );
    ensureDir(sessionDir);

    const chunkFilename = `chunk_${chunkNumber}.webm`;
    const chunkPath = path.join(sessionDir, chunkFilename);

    fs.writeFileSync(chunkPath, req.file.buffer);

    console.log(`✓ Chunk uploaded: ${chunkFilename} (${req.file.size} bytes)`);

    res.json({
      message: "Chunk uploaded successfully",
      chunkNumber,
      sessionDir: path.basename(sessionDir),
      path: `/screen-recordings/${path.basename(sessionDir)}/${chunkFilename}`,
    });
  } catch (err) {
    console.error("[ScreenRec] chunk upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /candidate/recordings/:interview_id — list screen recordings (existing)
router.get("/recordings/:interview_id", auth("admin"), async (req, res) => {
  try {
    const { interview_id } = req.params;

    if (!fs.existsSync(RECORDINGS_BASE)) {
      return res.json({ recordings: [] });
    }

    const sessions = fs.readdirSync(RECORDINGS_BASE).filter((s) =>
      s.startsWith(interview_id),
    );

    const recordings = [];
    for (const session of sessions) {
      const sessionDir = path.join(RECORDINGS_BASE, session);
      const files = fs.readdirSync(sessionDir).filter((f) =>
        f.startsWith("recording_"),
      );
      for (const file of files) {
        const stat = fs.statSync(path.join(sessionDir, file));
        recordings.push({
          session,
          file,
          path: `/screen-recordings/${session}/${file}`,
          sizeKB: Math.round(stat.size / 1024),
          created: stat.birthtime,
        });
      }
    }

    res.json({ recordings });
  } catch (err) {
    console.error("[ScreenRec] list recordings error:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================================================
// INTERVIEW WEBCAM RECORDING — NEW ROUTES
// Records the candidate's webcam + microphone stream in 30-second chunks.
// Saves to: public/recordings/<session_id>/recording.webm
//
// POST /candidate/interview-recording-chunk  — receive one chunk
// GET  /candidate/interview-recordings/:interview_id — list recordings (admin)
// =============================================================================

// POST /candidate/interview-recording-chunk
// Body (multipart/form-data):
//   chunk         — binary webm blob
//   interview_id  — string
//   candidate_id  — string
//   session_id    — string  (unique per attempt, e.g. "intId_candId_timestamp")
//   chunk_index   — number  (0-based, strictly increasing)
//   is_final      — "true" | "false"
//   mime_type     — string  (e.g. "video/webm;codecs=vp9,opus")
router.post(
  "/interview-recording-chunk",
  recordingUpload.single("chunk"),
  async (req, res) => {
    try {
      // ── Validate ────────────────────────────────────────────────────────
      if (!req.file || req.file.size === 0) {
        return res.status(400).json({ success: false, message: "No chunk data received" });
      }

      const {
        interview_id,
        candidate_id,
        session_id,
        chunk_index,
        is_final,
        mime_type,
      } = req.body;

      if (!interview_id || !candidate_id || !session_id) {
        return res.status(400).json({
          success: false,
          message: "interview_id, candidate_id and session_id are required",
        });
      }

      const chunkIdx = parseInt(chunk_index ?? "0", 10);
      const isFinal  = is_final === "true";
      const ext      = (mime_type ?? "video/webm").includes("mp4") ? "mp4" : "webm";

      // ── Session directory: public/recordings/<session_id>/ ───────────────
      const sessionDir = path.join(INTERVIEW_RECORDINGS_DIR, session_id);
      ensureDir(sessionDir);

      // ── Write chunk file ─────────────────────────────────────────────────
      // Zero-pad to 6 digits so lexicographic sort == numeric sort
      const paddedIdx = String(chunkIdx).padStart(6, "0");
      const chunkFile = path.join(sessionDir, `chunk_${paddedIdx}.${ext}`);
      fs.writeFileSync(chunkFile, req.file.buffer);

      console.log(
        `[Recording] chunk ${chunkIdx} → ${path.basename(sessionDir)}/chunk_${paddedIdx}.${ext}`,
        `(${(req.file.size / 1024).toFixed(1)} KB)`,
        isFinal ? "[FINAL]" : "",
      );

      // ── Write / update meta.json ─────────────────────────────────────────
      const metaPath = path.join(sessionDir, "meta.json");
      let meta = {};
      try {
        if (fs.existsSync(metaPath)) {
          meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        }
      } catch (_) {}

      meta = {
        ...meta,
        session_id,
        interview_id,
        candidate_id,
        ext,
        chunkCount:  chunkIdx + 1,
        startedAt:   meta.startedAt ?? new Date().toISOString(),
        lastChunkAt: new Date().toISOString(),
        status:      isFinal ? "merging" : "in_progress",
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

      // ── Merge all chunks on final ────────────────────────────────────────
      let merged = null;
      if (isFinal) {
        merged = await mergeInterviewChunks(sessionDir, ext);

        meta.status      = "completed";
        meta.mergedFile  = merged?.filename ?? null;
        meta.sizeBytes   = merged?.sizeBytes ?? 0;
        meta.completedAt = new Date().toISOString();
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      }

      return res.status(200).json({
        success:    true,
        chunkIndex: chunkIdx,
        isFinal,
        sessionId:  session_id,
        ...(merged ? {
          recording: {
            path:       merged.relativePath,
            sizeBytes:  merged.sizeBytes,
            chunkCount: merged.chunkCount,
          },
        } : {}),
      });
    } catch (err) {
      console.error("[Recording] chunk upload error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /candidate/interview-recordings/:interview_id
// List all completed webcam recordings for a given interview (admin use).
router.get("/interview-recordings/:interview_id", auth("admin"), async (req, res) => {
  try {
    const { interview_id } = req.params;

    if (!fs.existsSync(INTERVIEW_RECORDINGS_DIR)) {
      return res.json({ recordings: [] });
    }

    const sessions = fs
      .readdirSync(INTERVIEW_RECORDINGS_DIR)
      .filter((s) => {
        const metaPath = path.join(INTERVIEW_RECORDINGS_DIR, s, "meta.json");
        if (!fs.existsSync(metaPath)) return false;
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          return meta.interview_id === interview_id;
        } catch (_) {
          return false;
        }
      });

    const recordings = [];
    for (const session of sessions) {
      const sessionDir = path.join(INTERVIEW_RECORDINGS_DIR, session);
      if (!fs.statSync(sessionDir).isDirectory()) continue;

      // Read metadata
      const metaPath = path.join(sessionDir, "meta.json");
      let meta = {};
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      } catch (_) {}

      // Find merged recording file
      const recordingFile = fs
        .readdirSync(sessionDir)
        .find((f) => f === "recording.webm" || f === "recording.mp4");

      if (recordingFile) {
        const stat = fs.statSync(path.join(sessionDir, recordingFile));
        recordings.push({
          sessionId:   session,
          interviewId: meta.interview_id ?? interview_id,
          candidateId: meta.candidate_id ?? "unknown",
          file:        recordingFile,
          path:        `/recordings/${session}/${recordingFile}`,
          sizeBytes:   stat.size,
          sizeMB:      (stat.size / 1024 / 1024).toFixed(2),
          chunkCount:  meta.chunkCount ?? "?",
          startedAt:   meta.startedAt ?? null,
          completedAt: meta.completedAt ?? null,
          status:      meta.status ?? "completed",
        });
      } else {
        // Incomplete session — chunks exist but no merged file yet
        const chunkCount = fs
          .readdirSync(sessionDir)
          .filter((f) => f.startsWith("chunk_")).length;
        if (chunkCount > 0) {
          recordings.push({
            sessionId:   session,
            interviewId: meta.interview_id ?? interview_id,
            candidateId: meta.candidate_id ?? "unknown",
            file:        null,
            path:        null,
            chunkCount,
            startedAt:   meta.startedAt ?? null,
            status:      "incomplete",
          });
        }
      }
    }

    return res.json({ recordings });
  } catch (err) {
    console.error("[Recording] list error:", err);
    return res.status(500).json({ message: err.message });
  }
});

export default router;