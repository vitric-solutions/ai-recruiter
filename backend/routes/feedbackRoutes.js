import express from "express";
const router = express.Router();
import InterviewFeedback from "../models/feedback.js";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import cloudinary from "../config/cloudinary.js";
dotenv.config();
import OpenAI from "openai";
import path from "path";
import AI_Interview from "../models/AI_Interview.js";
// ─── POST /feedback ─────────────────────────

// ─── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#FFFFFF",
  headerBg: "#1E1B4B", // deep indigo
  accent: "#7C3AED", // violet
  accentLight: "#EDE9FE", // violet tint
  good: "#16A34A",
  warning: "#D97706",
  bad: "#DC2626",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  cardBg: "#F9FAFB",
  teal: "#0D9488",
  blue: "#2563EB",
  orange: "#EA580C",
};

// ─── Status icon text ─────────────────────────────────────────────────────────
function statusColor(status) {
  if (status === "good") return C.good;
  if (status === "warning") return C.warning;
  return C.bad;
}
function statusDot(status) {
  if (status === "good") return "✓";
  if (status === "warning") return "!";
  return "✗";
}

// ─── PDF Generator ────────────────────────────────────────────────────────────
function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const {
      candidateName = "Candidate",
      role = "Unknown Role",
      confidenceScore = 0,
      confidenceLabel = "N/A",
      behavioralInsights = [],
      technicalCompetency = [],
      speechPatterns = {},
      recommendations = [],
      overallVerdict = "consider",
      verdictReason = "",
    } = data?.feedback || data || {};

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 40, left: 0, right: 0 },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width; // 595
    const PX = 40; // horizontal padding
  const logoPath = path.join(process.cwd(), "../frontend/src/assets/vitric.png");
    // ── Header ─────────────────────────────────────────────────────────────
    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(C.headerBg);

    // Logo
    doc.image(logoPath, PX, 20, {
      width: 36,
    });

    // Shift text after logo
    const textX = PX + 46;

  
    doc
      .fontSize(18)
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .text(`AI Analysis Report — ${candidateName}`, PX, 38);

    doc
      .fontSize(10)
      .fillColor("#C4B5FD")
      .font("Helvetica")
      .text(
        `Role: ${role}   |   Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        PX,
        64,
      );

    // ── Verdict badge (top right) ────────────────────────────────────────────
    const verdictColors = {
      hire: "#16A34A",
      consider: "#D97706",
      reject: "#DC2626",
    };
    const verdictLabels = {
      hire: "HIRE",
      consider: "CONSIDER",
      reject: "REJECT",
    };
    const vc = verdictColors[overallVerdict] || C.accent;
    const vl = verdictLabels[overallVerdict] || overallVerdict.toUpperCase();

    doc.roundedRect(W - 120, 28, 80, 28, 6).fill(vc);
    doc
      .fontSize(11)
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .text(vl, W - 120, 38, { width: 80, align: "center" });

    let y = 106;

    // ── AI Confidence Section ────────────────────────────────────────────────
    doc
      .rect(PX, y, W - PX * 2, 72)
      .fill(C.accentLight)
      .stroke(C.border);

    // Confidence badge
    const badgeX = W - PX - 160;
    doc
      .roundedRect(badgeX, y + 10, 150, 22, 11)
      .fill(
        confidenceScore >= 75
          ? "#D1FAE5"
          : confidenceScore >= 50
            ? "#FEF3C7"
            : "#FEE2E2",
      );
    doc
      .fontSize(10)
      .fillColor(
        confidenceScore >= 75
          ? C.good
          : confidenceScore >= 50
            ? C.warning
            : C.bad,
      )
      .font("Helvetica-Bold")
      .text(`${confidenceLabel}: ${confidenceScore}%`, badgeX, y + 15, {
        width: 150,
        align: "center",
      });

    doc
      .fontSize(13)
      .fillColor(C.accent)
      .font("Helvetica-Bold")
      .text("AI Confidence Analysis", PX + 12, y + 10);

    doc
      .fontSize(9)
      .fillColor(C.sub)
      .font("Helvetica")
      .text(
        "Our AI model analyzed speech patterns, response timing, technical accuracy,\nand communication clarity to generate this assessment.",
        PX + 12,
        y + 28,
        { width: badgeX - PX - 20 },
      );

    y += 88;

    // ── Two-column: Behavioral + Technical ──────────────────────────────────
    const colW = (W - PX * 2 - 16) / 2;
    const col2X = PX + colW + 16;

    function drawInsightSection(
      title,
      iconColor,
      items,
      startX,
      startY,
      width,
    ) {
      let cy = startY;

      // Section title
      doc.circle(startX + 8, cy + 8, 6).fill(iconColor);
      doc
        .fontSize(13)
        .fillColor(C.text)
        .font("Helvetica-Bold")
        .text(title, startX + 20, cy + 1);
      cy += 24;

      items.forEach((item) => {
        const color = statusColor(item.status);
        const dot = statusDot(item.status);

        // Card bg
        doc
          .roundedRect(startX, cy, width, 44, 6)
          .fill(C.cardBg)
          .strokeColor(C.border)
          .lineWidth(0.5)
          .stroke();

        // Status dot
        doc.circle(startX + 14, cy + 14, 8).fill(color);
        doc
          .fontSize(10)
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .text(dot, startX + 10, cy + 9, { width: 8, align: "center" });

        // Title + description
        doc
          .fontSize(10)
          .fillColor(C.text)
          .font("Helvetica-Bold")
          .text(item.title || "", startX + 30, cy + 7, { width: width - 40 });
        doc
          .fontSize(8.5)
          .fillColor(C.sub)
          .font("Helvetica")
          .text(item.description || "", startX + 30, cy + 20, {
            width: width - 40,
          });

        cy += 52;
      });

      return cy;
    }

    const leftBottom = drawInsightSection(
      "Behavioral Insights",
      C.teal,
      behavioralInsights,
      PX,
      y,
      colW,
    );
    const rightBottom = drawInsightSection(
      "Technical Competency",
      C.accent,
      technicalCompetency,
      col2X,
      y,
      colW,
    );

    y = Math.max(leftBottom, rightBottom) + 16;

    // ── Speech Pattern Analysis ──────────────────────────────────────────────
    doc
      .fontSize(13)
      .fillColor(C.text)
      .font("Helvetica-Bold")
      .text("Speech Pattern Analysis", PX, y);
    y += 20;

    const sp = speechPatterns || {};
    const metrics = [
      {
        label: "Clarity Score",
        value:
          sp.clarityScore != null ? `${Math.round(sp.clarityScore)}%` : "N/A",
        color: C.accent,
      },
      {
        label: "Avg Response Time",
        value: sp.avgResponseTime || "N/A",
        color: C.teal,
      },
      {
        label: "Confidence Level",
        value:
          sp.confidenceLevel != null
            ? `${Math.round(sp.confidenceLevel)}%`
            : "N/A",
        color: C.blue,
      },
      {
        label: "Complexity Score",
        value: sp.complexityScore != null ? String(sp.complexityScore) : "N/A",
        color: C.orange,
      },
    ];

    const metW = (W - PX * 2 - 12 * 3) / 4;
    metrics.forEach((m, i) => {
      const mx = PX + i * (metW + 12);
      doc
        .roundedRect(mx, y, metW, 58, 8)
        .fill(C.cardBg)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke();
      doc
        .fontSize(22)
        .fillColor(m.color)
        .font("Helvetica-Bold")
        .text(m.value, mx, y + 10, { width: metW, align: "center" });
      doc
        .fontSize(8.5)
        .fillColor(C.sub)
        .font("Helvetica")
        .text(m.label, mx, y + 40, { width: metW, align: "center" });
    });

    y += 74;

    // ── Recommendations ──────────────────────────────────────────────────────
    if (recommendations.length > 0) {
      doc
        .fontSize(13)
        .fillColor(C.text)
        .font("Helvetica-Bold")
        .text("AI Recommendations", PX, y);
      y += 18;

      doc
        .roundedRect(PX, y, W - PX * 2, recommendations.length * 26 + 16, 8)
        .fill(C.cardBg)
        .strokeColor(C.border)
        .lineWidth(0.5)
        .stroke();

      recommendations.forEach((rec, i) => {
        doc.circle(PX + 14, y + 12 + i * 26, 4).fill(C.accent);
        doc
          .fontSize(9.5)
          .fillColor(C.text)
          .font("Helvetica")
          .text(rec, PX + 26, y + 6 + i * 26, { width: W - PX * 2 - 36 });
      });

      y += recommendations.length * 26 + 28;
    }

    // ── Verdict Reason ───────────────────────────────────────────────────────
    if (verdictReason) {
      doc
        .roundedRect(PX, y, W - PX * 2, 52, 8)
        .fill("#F3F4F6") // light gray background
        .strokeColor("#D1D5DB") // gray border
        .lineWidth(1)
        .stroke();

      doc
        .fontSize(10)
        .fillColor(verdictColors[overallVerdict])
        .font("Helvetica-Bold")
        .text("Verdict Summary", PX + 12, y + 8);
      doc
        .fontSize(9)
        .fillColor(C.text)
        .font("Helvetica")
        .text(verdictReason, PX + 12, y + 22, { width: W - PX * 2 - 24 });

      y += 64;
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .moveTo(PX, y + 8)
      .lineTo(W - PX, y + 8)
      .strokeColor(C.border)
      .lineWidth(1)
      .stroke();
    doc
      .fontSize(8)
      .fillColor(C.sub)
      .font("Helvetica")
      .text(
        "This report was auto-generated by Vitric IQ AI. Confidential — for internal use only.",
        PX,
        y + 16,
        {
          width: W - PX * 2,
          align: "center",
        },
      );

    doc.end();
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────
const calculateScores = (feedback) => {
  if (!feedback) return { technicalScore: 0, relevanceScore: 0 };

  // ---------- Technical Competency ----------
  const techItems = feedback.technicalCompetency || [];

  const techGood = techItems.filter((i) => i.status === "good").length;
  const techWarning = techItems.filter((i) => i.status === "warning").length;
  const techBad = techItems.filter((i) => i.status === "bad").length;

  const totalTech = techItems.length || 1;

  const techScoreRaw =
    (techGood * 1 + techWarning * 0.5 + techBad * 0) / totalTech;

  const complexityScore = feedback?.speechPatterns?.complexityScore || 1;

  const technicalScore = Math.round(
    techScoreRaw * 60 + (complexityScore / 5) * 40,
  );

  // ---------- Relevance ----------
  const behaviorItems = feedback.behavioralInsights || [];

  const behaviorGood = behaviorItems.filter((i) => i.status === "good").length;
  const behaviorWarning = behaviorItems.filter(
    (i) => i.status === "warning",
  ).length;
  const behaviorBad = behaviorItems.filter((i) => i.status === "bad").length;

  const totalBehavior = behaviorItems.length || 1;

  const behaviorScoreRaw =
    (behaviorGood * 1 + behaviorWarning * 0.5 + behaviorBad * 0) /
    totalBehavior;

  const clarityScore = feedback?.speechPatterns?.clarityScore || 0;

  const relevanceScore = Math.round(behaviorScoreRaw * 50 + clarityScore * 0.5);

  return {
    technicalScore: Math.min(100, technicalScore),
    relevanceScore: Math.min(100, relevanceScore),
  };
};

// router.post("/feedback", async (req, res) => {
//   try {
//     const {
//       interview_id,
//       userName,
//       userEmail,
//       feedback,
//       transcript,
//       behaviorReport,
//       completedAt,
//     } = req.body;

//     if (!interview_id) {
//       return res.status(400).json({
//         success: false,
//         message: "interview_id is required",
//       });
//     }

//     //console.log("Generating feedback for:", interview_id);
//  const { technicalScore, relevanceScore } = calculateScores(feedback);

//     // Inject into feedback object
//     feedback.technicalScore = technicalScore;
//     feedback.relevanceScore = relevanceScore;
//     // ===============================
//     // 1️⃣ Generate PDF Buffer
//     // ===============================
//     const pdfBuffer = await generatePDF({
//       feedback,
//       candidateName: userName,
//       role: feedback?.role,
//     });

//     const candidateName =
//       feedback?.candidateName || userName || "Candidate";

//     const role = feedback?.role || "Interview";
//     const verdict = (feedback?.overallVerdict || "consider").toUpperCase();
//     const score = feedback?.confidenceScore ?? "N/A";

//     // ===============================
//     // 2️⃣ Upload PDF to Cloudinary (STREAM - SAFEST METHOD)
//     // ===============================
//     const uploadResult = await new Promise((resolve, reject) => {
//       const uploadStream = cloudinary.uploader.upload_stream(
//         {
//           folder: "scorecards",
//           resource_type: "raw", // 🔥 IMPORTANT
//           public_id: `feedback-${Date.now()}`,
//             format: "pdf",
//             access_mode: "public",
//         },
//         (error, result) => {
//           if (error) return reject(error);
//           resolve(result);
//         }
//       );

//       uploadStream.end(pdfBuffer); // pipe buffer directly
//     });

//     //console.log("Cloudinary upload success:", uploadResult.secure_url);

//     // ===============================
//     // 3️⃣ Send Email with PDF Attachment
//     // ===============================
//     await transporter.sendMail({
//       from: `"Vitric IQ" <${process.env.SMTP_USER}>`,
//       to: "vaibhav@vitric.in",
//       subject: `[${verdict}] Interview Report — ${candidateName} | ${role}`,
//       html: `
//         <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
//           <div style="background:#1E1B4B;padding:24px 28px;border-radius:10px 10px 0 0">
//             <p style="color:#A5B4FC;margin:0 0 4px;font-size:11px;letter-spacing:2px">VITRIC IQ</p>
//             <h2 style="color:#fff;margin:0;font-size:20px">New Interview Report</h2>
//           </div>
//           <div style="background:#F9FAFB;padding:24px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px">
//             <table style="width:100%;border-collapse:collapse">
//               <tr>
//                 <td style="color:#6B7280;padding:4px 0;font-size:13px">Candidate</td>
//                 <td style="font-weight:600;font-size:13px">${candidateName}</td>
//               </tr>
//               <tr>
//                 <td style="color:#6B7280;padding:4px 0;font-size:13px">Role</td>
//                 <td style="font-size:13px">${role}</td>
//               </tr>
//               <tr>
//                 <td style="color:#6B7280;padding:4px 0;font-size:13px">Confidence Score</td>
//                 <td style="font-size:13px">${score}%</td>
//               </tr>
//               <tr>
//                 <td style="color:#6B7280;padding:4px 0;font-size:13px">Verdict</td>
//                 <td>
//                   <span style="
//                     background:${
//                       verdict === "HIRE"
//                         ? "#D1FAE5"
//                         : verdict === "REJECT"
//                         ? "#FEE2E2"
//                         : "#FEF3C7"
//                     };
//                     color:${
//                       verdict === "HIRE"
//                         ? "#065F46"
//                         : verdict === "REJECT"
//                         ? "#991B1B"
//                         : "#92400E"
//                     };
//                     padding:2px 10px;
//                     border-radius:20px;
//                     font-size:12px;
//                     font-weight:600">
//                     ${verdict}
//                   </span>
//                 </td>
//               </tr>
//             </table>
//             <p style="color:#6B7280;font-size:12px;margin-top:20px">
//               Full report attached as PDF.
//             </p>
//           </div>
//         </div>
//       `,
//       attachments: [
//         {
//           filename: `Interview_Report_${candidateName}.pdf`,
//           content: pdfBuffer,
//           contentType: "application/pdf",
//         },
//       ],
//     });

//     //console.log("Email sent successfully");

//     // ===============================
//     // 4️⃣ Save / Update in Database
//     // ===============================
//     const doc = await InterviewFeedback.findOneAndUpdate(
//       { interview_id },
//       {
//         $set: {
//           userName,
//           userEmail,
//           feedback,
//           transcript,
//           examType: "AI",
//           behaviorReport,
//           pdfPath: uploadResult.secure_url,
//           completedAt: completedAt
//             ? new Date(completedAt)
//             : new Date(),
//         },
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     return res.json({
//       success: true,
//       message: "Feedback stored successfully",
//       pdfUrl: uploadResult.secure_url,
//       data: doc,
//     });
//   } catch (error) {
//     console.error("POST Feedback Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// });

// ─── GET Single ─────────────────────────────
router.post("/feedback", async (req, res) => {
  try {
    const {
      interview_id,
      candidateId,
      userName,
      userEmail,
      feedback,
      transcript,
      behaviorReport,
      completedAt,
    } = req.body;

    if (!interview_id) {
      return res.status(400).json({
        success: false,
        message: "interview_id is required",
      });
    }

    // ==================================================
    // 🔥 Calculate Technical & Relevance Scores
    // ==================================================
    const { technicalScore, relevanceScore } = calculateScores(feedback);

    feedback.technicalScore = technicalScore;
    feedback.relevanceScore = relevanceScore;

    // ==================================================
    // 🔥 Calculate Total Score (NEW)
    // ==================================================
    const totalScore = Math.round(technicalScore * 0.6 + relevanceScore * 0.4);

    // ===============================
    // 1️⃣ Generate PDF Buffer
    // ===============================
    const pdfBuffer = await generatePDF({
      feedback,
      candidateName: userName,
      role: feedback?.role,
    });

    const candidateName = feedback?.candidateName || userName || "Candidate";

    const role = feedback?.role || "Interview";
    const verdict = (feedback?.overallVerdict || "consider").toUpperCase();
    const score = feedback?.confidenceScore ?? "N/A";

    // ===============================
    // 2️⃣ Upload PDF to Cloudinary
    // ===============================
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "scorecards",
          resource_type: "raw",
          public_id: `feedback-${Date.now()}`,
          format: "pdf",
          access_mode: "public",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      uploadStream.end(pdfBuffer);
    });

    // ===============================
    // 3️⃣ Send Email
    // ===============================
    await transporter.sendMail({
      from: `"Vitric IQ" <${process.env.SMTP_USER}>`,
      to: "vaibhav@vitric.in",
      subject: `[${verdict}] Interview Report — ${candidateName} | ${role}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <div style="background:#1E1B4B;padding:24px 28px;border-radius:10px 10px 0 0">
            <p style="color:#A5B4FC;margin:0 0 4px;font-size:11px;letter-spacing:2px">VITRIC IQ</p>
            <h2 style="color:#fff;margin:0;font-size:20px">New Interview Report</h2>
          </div>
          <div style="background:#F9FAFB;padding:24px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="color:#6B7280;padding:4px 0;font-size:13px">Candidate</td>
                <td style="font-weight:600;font-size:13px">${candidateName}</td>
              </tr>
              <tr>
                <td style="color:#6B7280;padding:4px 0;font-size:13px">Role</td>
                <td style="font-size:13px">${role}</td>
              </tr>
              <tr>
                <td style="color:#6B7280;padding:4px 0;font-size:13px">Confidence Score</td>
                <td style="font-size:13px">${score}%</td>
              </tr>
              <tr>
                <td style="color:#6B7280;padding:4px 0;font-size:13px">Total Score</td>
                <td style="font-size:13px">${totalScore}%</td>
              </tr>
            </table>
            <p style="color:#6B7280;font-size:12px;margin-top:20px">
              Full report attached as PDF.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Interview_Report_${candidateName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    // ===============================
    // 4️⃣ Save / Update in Database
    // ===============================
    const doc = await InterviewFeedback.findOneAndUpdate(
      { interview_id, interview_id, candidateId },
      {
        $set: {
          interview_id,
          candidateId, // 🔥 THIS WAS MISSING
          userName,
          userEmail,
          feedback,
          transcript,
          examType: "AI",
          score: totalScore, // ✅ Saved in top-level score field
          behaviorReport,
          pdfPath: uploadResult.secure_url,
          completedAt: completedAt ? new Date(completedAt) : new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // ==================================================
    // 6️⃣ Update Candidate Status → completed
    // ==================================================
    await AI_Interview.updateOne(
      {
        _id: interview_id,
        "candidates.candidateId": candidateId,
      },
      {
        $set: {
          "candidates.$.status": "completed",
        },
      },
    );

    // ==================================================
    // 7️⃣ Auto Mark Interview Completed (If All Done)
    // ==================================================
    const interview = await AI_Interview.findById(interview_id);

    const allCompleted = interview.candidates.every(
      (c) => c.status === "completed",
    );

    if (allCompleted) {
      interview.status = "completed";
      await interview.save();
    }

    return res.json({
      success: true,
      message: "Feedback stored successfully",
      pdfUrl: uploadResult.secure_url,
      totalScore, // ✅ Also returning directly
      data: doc,
    });
  } catch (error) {
    console.error("POST Feedback Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/feedback/:interview_id", async (req, res) => {
  try {
    const doc = await InterviewFeedback.findOne({
      interview_id: req.params.interview_id,
    }).lean();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// ─── LIST All ───────────────────────────────
router.get("/feedbacks", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.verdict)
      filter["feedback.overallVerdict"] = req.query.verdict;

    if (req.query.search) {
      filter.$or = [
        { userName: { $regex: req.query.search, $options: "i" } },
        { userEmail: { $regex: req.query.search, $options: "i" } },
        {
          "feedback.candidateName": { $regex: req.query.search, $options: "i" },
        },
      ];
    }

    const [docs, total] = await Promise.all([
      InterviewFeedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InterviewFeedback.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: docs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// ─── DELETE ────────────────────────────────
router.delete("/feedback/:interview_id", async (req, res) => {
  try {
    await InterviewFeedback.findOneAndDelete({
      interview_id: req.params.interview_id,
    });

    res.json({ success: true, message: "Feedback deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// ─── Validation helpers ─────────────────────────────
function isValidBody(body) {
  return body && Array.isArray(body.transcript) && body.transcript.length > 0;
}
function safeJsonParse(raw) {
  try {
    const cleaned = raw.replace(/```json|```/gi, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}

// ─── Route handler ─────────────────────────────────

router.post("/ai-feedback", async (req, res) => {
  // 1. Validate
  //console.log("req.body",req.body)
  if (!isValidBody(req.body)) {
    return res.status(400).json({
      feedback: "",
      error: "Invalid request body. `prompt` (string) is required.",
    });
  }

  const { prompt } = req.body;

  if (prompt.length > 200_000) {
    return res.status(413).json({
      feedback: "",
      error: "Prompt is too large. Please reduce the transcript length.",
    });
  }

  try {
    // 2. Call Grok Router (OpenAI-compatible endpoint)
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", // free, fast, great at JSON
          messages: [
            {
              role: "system",
              content:
                "You are a senior recruitment analyst. You MUST respond with ONLY a valid JSON object — no prose, no markdown, no code fences. Follow the schema in the user message exactly.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 1500,
          temperature: 0.3,
          stream: false,
        }),
      },
    );

    // 3. Always read as text first — prevents crash on unexpected HTML/plain-text errors
    const rawText = await response.text();

    if (!response.ok) {
      console.error("[ai-feedback] HF HTTP error:", response.status, rawText);
      return res.status(response.status).json({
        feedback: "",
        error: `Grok API error (${response.status})`,
        details: rawText,
      });
    }

    // 4. Parse the outer HF response envelope
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[ai-feedback] HF returned non-JSON:", rawText);
      return res.status(502).json({
        feedback: "",
        error: "Grok returned a non-JSON response.",
        details: rawText,
      });
    }

    // 5. Extract the model's message (OpenAI-compatible shape)
    const raw = data?.choices?.[0]?.message?.content ?? "";

    if (!raw) {
      console.error(
        "[ai-feedback] Empty content from model. Full response:",
        data,
      );
      return res.status(502).json({
        feedback: "",
        error: "Model returned an empty response.",
      });
    }

    // 6. Parse the feedback JSON the model generated
    const parsed = safeJsonParse(raw);

    if (!parsed) {
      console.warn("[ai-feedback] Could not parse model output as JSON:", raw);
    }

    // 7. Return — frontend reads either `feedback` or `content`
    return res.status(200).json({
      feedback: raw,
      content: raw,
      parsed,
    });
  } catch (err) {
    console.error("[ai-feedback] Unexpected error:", err);
    return res.status(500).json({
      feedback: "",
      error: "Internal server error while generating feedback.",
    });
  }
});
export default router;
