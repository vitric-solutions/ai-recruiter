import mongoose from "mongoose";

// ─── Sub Schema ─────────────────────────────
const InsightSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ["good", "warning", "bad"], required: true },
});

// ─── Main Schema ────────────────────────────
const InterviewFeedbackSchema = new mongoose.Schema(
  {
    interview_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AI_Interview",
      index: true,
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
        required: true,
      },
    pdfPath: String,
    userName: String,
    userEmail: String,
    completedAt: { type: Date, default: Date.now },

    score: { type: Number, min: 0, max: 100 },
    examType: {
      type: String,
      enum: ["AI"],
      default: "AI",
      required: true,
    },

    feedback: {
      candidateName: String,
      role: String,
      technicalScore: {type:Number, min: 0, max: 100},
      relevanceScore: { type: Number, min: 0, max: 100 },
      confidenceScore: { type: Number, min: 0, max: 100 },
      confidenceLabel: {
        type: String,
        enum: ["High", "Moderate", "Low"],
      },

      behavioralInsights: [InsightSchema],
      technicalCompetency: [InsightSchema],

      speechPatterns: {
        clarityScore: { type: Number, min: 0, max: 100 },
        avgResponseTime: String,
        confidenceLevel: { type: Number, min: 0, max: 100 },
        complexityScore: { type: Number, min: 1, max: 5 },
      },

      recommendations: [String],
      overallVerdict: { type: String, enum: ["hire", "consider", "rejected"] },
      verdictReason: String,
    },

    transcript: [
      {
        role: { type: String, enum: ["Interviewer", "Candidate"] },
        text: String,
      },
    ],

    behaviorReport: {
      totalEvents: Number,
      noFaceCount: Number,
      multipleFacesCount: Number,
      events: [
        {
          type: String,
          timestamp: Number,
        },
      ],
    },
  },
  { timestamps: true },
);

export default mongoose.model("InterviewFeedback", InterviewFeedbackSchema);
