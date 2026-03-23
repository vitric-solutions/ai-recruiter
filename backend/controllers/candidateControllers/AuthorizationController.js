import Candidate from "../../models/Candidate.js";
import csv from "csv-parser";
import fs from "fs";
import { getIO } from "../../socket.js";
import AI_Interview from "../../models/AI_Interview.js";
import MCQ_Interview from "../../models/MCQ_Interview.js";
import Score from "../../models/Score.js";
import { Readable } from "stream";

export const CreateCandidate = async (req, res) => {
  const {
    id,
    email,
    name,
    mobile,
    role,
    key_Skills,
    description,
    year_of_experience,
  } = req.body;

  if (!email || !name) {
  return res.status(400).json({
    message: "Name and Email are required.",
  });
}
  if (
    !email ||
    !name ||
    !mobile ||
    !role ||
    !key_Skills ||
    !description ||
    !year_of_experience
  ) {
    return res.status(400).json({
      message: "all fields are required.",
    });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Mobile validation
  const mobileRegex = /^[0-9]{10,15}$/;
  if (!mobileRegex.test(mobile)) {
    return res.status(400).json({ message: "Invalid mobile number." });
  }

  try {
    if (id) {
      const updatedCandidate = await Candidate.findByIdAndUpdate(
        id,
        {
          email,
          name,
          mobile,
          role,
          key_Skills,
          description,
          year_of_experience,
        },
        { new: true, runValidators: true },
      );

      if (!updatedCandidate) {
        return res.status(404).json({ message: "Candidate not found." });
      }

      let io = getIO();
      io.to("admins").emit("candidate-updated", updatedCandidate);
      io.to(updatedCandidate._id.toString()).emit(
        "candidate-updated",
        updatedCandidate,
      );
      return res.status(200).json({
        message: "Candidate updated successfully.",
        newCandidate: updatedCandidate,
      });
    }

    //  CREATE FLOW
    const existingCandidate = await Candidate.findOne({ email });

    if (existingCandidate) {
      return res.status(409).json({ message: "Candidate already added." });
    }

    const candidate = await Candidate.create({
      email,
      name,
      mobile,
      role,
      key_Skills,
      description,
      year_of_experience,
    });

    let io = getIO();
    io.to("admins").emit("candidate-added", candidate);
    io.to(candidate._id.toString()).emit("candidate-added", candidate);
    res.status(201).json({
      message: "Candidate added",
      newCandidate: candidate,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
export const GetFilteredCandidates = async (req, res) => {
  try {
    const page   = Math.max(parseInt(req.query.page)  || 1,  1);
    const limit  = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip   = (page - 1) * limit;

    const status     = (req.query.status     || "all").toLowerCase();
    const search     = (req.query.search     || "").trim();
    const role       = (req.query.role       || "").trim();
    const experience = (req.query.experience || "").trim();
    const skillsRaw  = (req.query.skills     || "").trim();

    // ── Build Query ─────────────────────────────────────────
    let query = {};

    // 1. Status filter
    if (status !== "all" && ["active", "inactive"].includes(status)) {
      query.candidate_status = status;
    }

    // 2. Full-text search on name / email / mobile
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { name:   regex },
        { email:  regex },
        { mobile: regex },
      ];
    }

    // 3. Role filter (partial, case-insensitive)
    if (role) {
      query.role = new RegExp(role, "i");
    }

    // 4. Experience filter
    //    Stored as strings like "1-2", "3-5", "5-10", "10+"
    if (experience) {
      query.year_of_experience = new RegExp(experience, "i");
    }

    // 5. Skills filter (comma-separated → each must appear in key_Skills)
    if (skillsRaw) {
      const skillList = skillsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (skillList.length > 0) {
        // AND logic: every requested skill must appear somewhere in key_Skills
        query.$and = skillList.map((skill) => ({
          key_Skills: new RegExp(skill, "i"),
        }));
      }
    }

    // ── Execute ──────────────────────────────────────────────
    const [totalRecords, candidates] = await Promise.all([
      Candidate.countDocuments(query),
      Candidate.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    // ── Derive distinct roles & experience values for dropdowns
    // (Only fetched when no role/exp filter is applied — lightweight helper)
    let meta = {};
    if (!role && !experience) {
      const [roles, experiences] = await Promise.all([
        Candidate.distinct("role"),
        Candidate.distinct("year_of_experience"),
      ]);
      meta = { roles, experiences };
    }

    return res.status(200).json({
      success:     true,
      data:        candidates,
      totalPages:  Math.ceil(totalRecords / limit),
      totalRecords,
      currentPage: page,
      meta,        // roles + experience options for filter dropdowns
    });

  } catch (error) {
    console.error("Error fetching filtered candidates:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch candidates",
    });
  }
};


export const GetCandidate = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const status = (req.query.status || "all").toLowerCase();

    const skip = (page - 1) * limit;

    // 🔥 Filter Logic
    let query = {};

    if (status !== "all" && ["active", "inactive"].includes(status)) {
      query.candidate_status = status;
    }

    const totalRecords = await Candidate.countDocuments(query);

    const candidates = await Candidate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: candidates,
      totalPages: Math.ceil(totalRecords / limit),
      totalRecords,
      currentPage: page,
    });

  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch candidates",
    });
  }
};
export const getCandidateProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const mcqInterviews = await MCQ_Interview.find({
      "candidates.candidateId": id,
    }).lean();

    const aiInterviews = await AI_Interview.find({
      "candidates.candidateId": id,
    }).lean();

    const scores = await Score.find({ candidateId: id }).lean();

    const allInterviews = [];

    // ------------------ MCQ ------------------
    mcqInterviews.forEach((interview) => {
      const candidateData = interview.candidates.find(
        (c) => c.candidateId.toString() === id
      );

      const scoreData = scores.find(
        (s) =>
          s.interviewId.toString() === interview._id.toString()
      );

      allInterviews.push({
        interviewId: interview._id,
        title: interview.test_title,
        examType: "MCQ",
        difficulty: interview.difficulty,
        status: candidateData?.status || "pending",

        score: scoreData?.totalScore ?? candidateData?.score ?? 0,
        passingScore: Number(interview.passing_score),

        submittedAt: candidateData?.submittedAt || null,

        summary: scoreData?.summary || null,
        pdfPath: scoreData?.pdfPath || null,
        maxScore: scoreData?.maxScore || null,

        questionBreakdown: scoreData?.scores || [],
      });
    });

    // ------------------ AI ------------------
    aiInterviews.forEach((interview) => {
      const candidateData = interview.candidates.find(
        (c) => c.candidateId.toString() === id
      );

      const scoreData = scores.find(
        (s) =>
          s.interviewId.toString() === interview._id.toString()
      );

      
      allInterviews.push({
        interviewId: interview._id,
        title: interview.position,
        examType: "AI",
        difficulty: interview.difficulty,
        status: "completed",

        score: scoreData?.totalScore ?? 0,
        passingScore: interview.passingScore,

        submittedAt: candidateData?.submittedAt || null,

        summary: scoreData?.summary || null,
        pdfPath: scoreData?.pdfPath || null,
        maxScore: scoreData?.maxScore || null,

        questionBreakdown: scoreData?.scores || [],
      });
    });

    // -------- Summary Stats --------
    const totalInterviews = allInterviews.length;

    const completed = allInterviews.filter(
      (i) => i.status === "completed"
    ).length;

    const passed = allInterviews.filter(
      (i) => i.score >= i.passingScore
    ).length;

    res.json({
      candidate,
      summary: {
        totalInterviews,
        completed,
        passed,
      },
      interviews: allInterviews,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({error});
  }
};

export const UpdateCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;


    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Candidate ID is required.",
      });
    }

    const candidate = await Candidate.findById(id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found.",
      });
    }

    // update candidate fields
    Object.assign(candidate, updateData);

    await candidate.save();

    const io = getIO();
    io.to("admins").emit("candidate-updated", candidate);

    return res.status(200).json({
      success: true,
      message: "Candidate updated successfully.",
      data: candidate,
    });

  } catch (error) {
    console.error("UpdateCandidate Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

export const BulkAddCandidates = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "CSV file is required",
    });
  }

  try {
    const results = [];

    // Convert buffer to stream
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        const addedCandidates = [];

        for (const row of results) {
          const {
            name,
            email,
            mobile,
            role,
            year_of_experience,
            key_Skills,
          } = row;

          if (
            !name ||
            !email ||
            !mobile ||
            !role ||
            !year_of_experience ||
            !key_Skills
          )
            continue;

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const mobileRegex = /^[0-9]{10,15}$/;

          if (!emailRegex.test(email) || !mobileRegex.test(mobile))
            continue;

          let candidate = await Candidate.findOne({ email });

          if (!candidate) {
            candidate = await Candidate.create({
              name,
              email,
              mobile,
              role,
              year_of_experience,
              key_Skills,
            });
          }

          addedCandidates.push(candidate);
        }

        return res.status(201).json({
          success: true,
          message: "Bulk candidates added successfully",
          totalProcessed: results.length,
          added: addedCandidates.length,
        });
      });
  } catch (error) {
    console.error("Bulk Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during bulk upload",
    });
  }
};

