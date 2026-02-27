// import MCQ_Interview from "../../models/MCQ_Interview.js";
// import Candidate from "../../models/Candidate.js";
// import Score from "../../models/Score.js";
// import AI_Interview from "../../models/AI_Interview.js";
// import { sendMCQInterviewLink } from "../../services/emailService.js";
// import mongoose from "mongoose";

// // export const GetAllMCQInterviews = async (req, res) => {
// //   try {
// //     const adminId = req.user.id;
// //     const { id } = req.query; // 👈 id from query

// //     /* ================= GET SINGLE ================= */

// //     if (id) {
// //       // Optional but recommended validation
// //       if (!mongoose.Types.ObjectId.isValid(id)) {
// //         return res.status(400).json({
// //           success: false,
// //           message: "Invalid interview ID",
// //         });
// //       }

// //       const interview = await MCQ_Interview.findOne({
// //         _id: id,
// //         createdBy: adminId, // 🔐 security
// //       }).populate("createdBy", "email");

// //       if (!interview) {
// //         return res.status(404).json({
// //           success: false,
// //           message: "Interview not found",
// //         });
// //       }

// //       return res.status(200).json({
// //         success: true,
// //         data: interview,
// //       });
// //     }

// //     /* ================= GET ALL ================= */

// //     const interviews = await MCQ_Interview.find({
// //       createdBy: adminId,
// //     })
// //       .sort({ createdAt: -1 })
// //       .populate("createdBy", "email")
// //       .populate("candidates.candidateId");
// //     // console.log("interviews", interviews);
// //     return res.status(200).json({
// //       success: true,
// //       count: interviews.length,
// //       data: interviews,
// //     });
// //   } catch (error) {
// //     console.error("Error fetching MCQ assessments:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: "Failed to fetch assessments",
// //       error: error.message,
// //     });
// //   }
// // };

// export const GetAllMCQInterviews = async (req, res) => {
//   try {
//     const adminId = req.user.id;
//     const { id } = req.query;

//     /* ================= GET SINGLE ================= */

//     if (id) {
//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid interview ID",
//         });
//       }

//       const interview = await MCQ_Interview.findOne({
//         _id: id,
//         createdBy: adminId,
//       })
//         .populate("createdBy", "email")
//         .populate("candidates.candidateId");

//       if (!interview) {
//         return res.status(404).json({
//           success: false,
//           message: "Interview not found",
//         });
//       }

//       // 🔥 Fetch scores for this interview
//       const scores = await Score.find({
//         interviewId: id,
//       });

//       // 🔥 Attach score to each candidate
//       const updatedCandidates = interview.candidates.map((candidate) => {
//         const candidateScore = scores.find(
//           (s) =>
//             s.candidateId.toString() ===
//             candidate.candidateId._id.toString()
//         );

//         return {
//           ...candidate.toObject(),
//           score: candidateScore ? candidateScore.score : 0,
//           percentage: candidateScore ? candidateScore.percentage : 0,
//         };
//       });

//       const responseData = {
//         ...interview.toObject(),
//         candidates: updatedCandidates,
//       };

//       return res.status(200).json({
//         success: true,
//         data: responseData,
//       });
//     }

//     /* ================= GET ALL ================= */

//     const interviews = await MCQ_Interview.find({
//       createdBy: adminId,
//     })
//       .sort({ createdAt: -1 })
//       .populate("createdBy", "email")
//       .populate("candidates.candidateId");

//     // 🔥 Get all scores of this admin interviews
//     const interviewIds = interviews.map((i) => i._id);

//     const scores = await Score.find({
//       interviewId: { $in: interviewIds },
//     });

//     // 🔥 Attach scores interview-wise
//     const updatedInterviews = interviews.map((interview) => {
//       const interviewScores = scores.filter(
//         (s) => s.interviewId.toString() === interview._id.toString()
//       );

//       const updatedCandidates = interview.candidates.map((candidate) => {
//         const candidateScore = interviewScores.find(
//           (s) =>
//             s.candidateId.toString() ===
//             candidate.candidateId._id.toString()
//         );

//         return {
//           ...candidate.toObject(),
//           score: candidateScore ? candidateScore.score : 0,
//           percentage: candidateScore ? candidateScore.percentage : 0,
//         };
//       });

//       return {
//         ...interview.toObject(),
//         candidates: updatedCandidates,
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       count: updatedInterviews.length,
//       data: updatedInterviews,
//     });
//   } catch (error) {
//     console.error("Error fetching MCQ assessments:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch assessments",
//       error: error.message,
//     });
//   }
// };

// export const CreateMCQTemplate = async (req, res) => {
//   try {
//     const {
//       test_title,
//       difficulty,
//       duration,
//       no_of_questions,
//       primary_skill,
//       secondary_skill,
//       passing_score,
//       jobDescriptionText,
//     } = req.body;

//     // Validate required fields
//     if (
//       !test_title ||
//       !difficulty ||
//       !duration ||
//       !no_of_questions ||
//       !primary_skill ||
//       !passing_score
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide all required fields",
//       });
//     }

//     // Get job description file path if uploaded
//     const jobDescription = req.file ? req.file.path.replace(/\\/g, "/") : "";
//     // console.log("Job description path:", jobDescription);

//     // // Generate questions using AI
//     // const questions = await generateQuestions(
//     //   jobDescription,
//     //   test_title,
//     //   difficulty,
//     //   "MCQ",
//     //   parseInt(no_of_questions),
//     // );
//     // console.log("Generated questions for template:", questions);

//     // Create interview template
//     const interview = await MCQ_Interview.create({
//       test_title,
//       difficulty,
//       duration,
//       no_of_questions: parseInt(no_of_questions),
//       primary_skill,
//       secondary_skill: secondary_skill || "",
//       passing_score,
//       jobDescription,
//       jobDescriptionText,
//       createdBy: req.user.id,
//       isTemplate: true, // Mark as template
//     });

//     // // Save questions
//     // const questionDocs = questions.map((q) => ({
//     //   interviewId: interview._id,
//     //   questionText: q.question,
//     //   options: q.options,
//     //   correctAnswer: q.correctAnswer,
//     // }));
//     // await Question.insertMany(questionDocs);

//     res.status(201).json({
//       success: true,
//       message: "Assessment template created successfully",
//       data: {
//         interview,
//         // questionCount: questions.length,
//       },
//     });
//   } catch (error) {
//     console.error("Error creating template:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create assessment template",
//       error: error.message,
//     });
//   }
// };

// export const AssessmentInvitation = async (req, res) => {
//   try {
//     const {
//       test_title,
//       difficulty,
//       duration,
//       no_of_questions,
//       primary_skill,
//       secondary_skill,
//       passing_score,
//       secondry_jobDescription,
//       start_date,
//       end_date,
//       candidates,
//     } = req.body;

//     // Validate required fields
//     if (
//       !test_title ||
//       !difficulty ||
//       !duration ||
//       !no_of_questions ||
//       !primary_skill ||
//       !passing_score ||
//       !start_date ||
//       !end_date ||
//       !candidates
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide all required fields including candidates",
//       });
//     }

//     // Parse candidates array
//     let candidateArray;
//     try {
//       candidateArray =
//         typeof candidates === "string" ? JSON.parse(candidates) : candidates;
//       if (!Array.isArray(candidateArray) || candidateArray.length === 0) {
//         throw new Error("Invalid candidates array");
//       }
//     } catch (err) {
//       return res.status(400).json({
//         success: false,
//         message: "Please select at least one candidate",
//       });
//     }

//     // Validate dates
//     const startDate = new Date(start_date);
//     const endDate = new Date(end_date);

//     if (endDate <= startDate) {
//       return res.status(400).json({
//         success: false,
//         message: "End date must be after start date",
//       });
//     }

//     // Get job description file path
//     const jobDescription = req.file ? req.file.path.replace(/\\/g, "/") : "";

//     // // Generate questions using AI
//     // const questions = await generateQuestions(
//     //   jobDescription,
//     //   test_title,
//     //   difficulty,
//     //   "MCQ",
//     //   parseInt(no_of_questions),
//     // );

//     // Create interview
//     const interview = await MCQ_Interview.create({
//       test_title,
//       difficulty,
//       duration,
//       no_of_questions: parseInt(no_of_questions),
//       primary_skill,
//       secondary_skill: secondary_skill || "",
//       passing_score,
//       secondry_jobDescription,
//       jobDescription,
//       createdBy: req.user.id,
//       isTemplate: false,
//     });

//     // Save questions
//     // const questionDocs = questions.map((q) => ({
//     //   interviewId: interview._id,
//     //   questionText: q.question,
//     //   options: q.options,
//     //   correctAnswer: q.correctAnswer,
//     // }));
//     // await Question.insertMany(questionDocs);

//     // Schedule candidates and send emails
//     const scheduledCandidates = [];
//     const emailResults = [];
//     const cooldownCandidates = [];

//     // 7-day cooldown threshold
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     for (const candId of candidateArray) {
//       const candidate = await Candidate.findById(candId);
//       if (!candidate) {
//         console.warn(`Candidate ${candId} not found, skipping...`);
//         continue;
//       }

//       // 🔒 7-day cooldown check across MCQ and AI interviews
//       const mcqCooldown = await MCQ_Interview.findOne({
//         candidates: {
//           $elemMatch: {
//             candidateId: candId,
//             start_Date: { $gte: sevenDaysAgo },
//           },
//         },
//       });

//       const aiCooldown = await AI_Interview.findOne({
//         candidates: {
//           $elemMatch: {
//             candidateId: candId,
//             scheduledStartDate: { $gte: sevenDaysAgo },
//           },
//         },
//       });

//       if (mcqCooldown || aiCooldown) {
//         cooldownCandidates.push({
//           candidate: candidate.email,
//           reason: "Candidate was recently invited to an interview. Please wait 7 days.",
//         });
//         continue;
//       }

//       // Generate credentials
//       const username = `user_${Math.random().toString(36).substring(2, 10)}`;
//       const password = Math.random().toString(36).slice(-8);
//       const interviewLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/user/login/${interview._id}`;

//       const entry = {
//         candidateId: candidate._id,
//         interviewLink,
//         username,
//         password,
//         start_Date: startDate,
//         end_Date: endDate,
//       };

//       interview.candidates.push(entry);
//       scheduledCandidates.push({
//         ...entry,
//         name: candidate.name,
//         email: candidate.email,
//       });

//       // Send email
//       try {
//         await sendMCQInterviewLink(
//           candidate.email,
//           candidate.name,
//           interviewLink,
//           username,
//           password,
//           test_title,
//           difficulty,
//           duration,
//           no_of_questions,
//           passing_score,
//           primary_skill,
//           secondary_skill,
//           startDate,
//           endDate,
//         );
//         emailResults.push({ candidate: candidate.email, status: "sent" });
//       } catch (emailError) {
//         console.error(
//           `Failed to send email to ${candidate.email}:`,
//           emailError,
//         );
//         emailResults.push({
//           candidate: candidate.email,
//           status: "failed",
//           error: emailError.message,
//         });
//       }
//     }

//     await interview.save();

//     const successfulEmails = emailResults.filter(
//       (r) => r.status === "sent",
//     ).length;
//     const failedEmails = emailResults.filter(
//       (r) => r.status === "failed",
//     ).length;

//     res.status(201).json({
//       success: true,
//       message: `Assessment created and invitations sent to ${successfulEmails} candidate(s)`,
//       data: {
//         interview,
//         // questionCount: questions.length,
//         scheduledCandidates,
//         cooldownCandidates,
//         emailStats: {
//           total: emailResults.length,
//           successful: successfulEmails,
//           failed: failedEmails,
//         },
//         emailResults,
//       },
//     });
//   } catch (error) {
//     console.error("Error creating assessment and sending invites:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create assessment and send invites",
//       error: error.message,
//     });
//   }
// };

// export const AssessmentInvitationByID = async (req, res) => {
//   try {
//     const { assessmentId } = req.params;
//     const { candidateIds, start_date, end_date } = req.body;

//     if (!candidateIds || !start_date || !end_date) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide candidateIds, start_date, and end_date",
//       });
//     }

//     let candidateArray;
//     try {
//       candidateArray =
//         typeof candidateIds === "string"
//           ? JSON.parse(candidateIds)
//           : candidateIds;

//       if (!Array.isArray(candidateArray) || candidateArray.length === 0) {
//         throw new Error("Invalid array");
//       }
//     } catch (err) {
//       return res.status(400).json({
//         success: false,
//         message: "Please select at least one candidate",
//       });
//     }

//     const startDate = new Date(start_date);
//     const endDate = new Date(end_date);
//     if (!start_date || !end_date) {
//       return res.status(400).json({
//         success: false,
//         message: "Start date and end date are required",
//       });
//     }

//     if (endDate.getTime() <= startDate.getTime()) {
//       return res.status(400).json({
//         success: false,
//         message: "End date must be after start date",
//       });
//     }

//     const interview = await MCQ_Interview.findById(assessmentId);

//     if (!interview) {
//       return res.status(404).json({
//         success: false,
//         message: "Assessment not found",
//       });
//     }

//     const scheduledCandidates = [];
//     const skippedCandidates = [];
//     const cooldownCandidates = [];
//     const emailResults = [];

//     // 7-day cooldown threshold
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     for (const candId of candidateArray) {
//       const candidate = await Candidate.findById(candId);
//       if (!candidate) continue;

//       // 🔥 STRICT CHECK: already invited?
//       const alreadyInvited = interview.candidates.find(
//         (c) => c.candidateId.toString() === candId.toString(),
//       );

//       if (alreadyInvited) {
//         skippedCandidates.push({
//           candidate: candidate.email,
//           reason: "Already invited",
//         });
//         continue; // ❌ skip sending again
//       }

//       // 🔒 7-day cooldown check across MCQ and AI interviews
//       const mcqCooldown = await MCQ_Interview.findOne({
//         candidates: {
//           $elemMatch: {
//             candidateId: candId,
//             start_Date: { $gte: sevenDaysAgo },
//           },
//         },
//       });

//       const aiCooldown = await AI_Interview.findOne({
//         candidates: {
//           $elemMatch: {
//             candidateId: candId,
//             scheduledStartDate: { $gte: sevenDaysAgo },
//           },
//         },
//       });

//       if (mcqCooldown || aiCooldown) {
//         cooldownCandidates.push({
//           candidate: candidate.email,
//           reason: "Candidate was recently invited to an interview. Please wait 7 days.",
//         });
//         continue;
//       }

//       const username = `user_${Math.random().toString(36).substring(2, 10)}`;
//       const password = Math.random().toString(36).slice(-8);
//       const interviewLink = `${
//         process.env.FRONTEND_URL || "http://localhost:5173"
//       }/user/login/${interview._id}`;

//       const entry = {
//         candidateId: candidate._id,
//         interviewLink,
//         username,
//         password,
//         start_Date: startDate,
//         end_Date: endDate,
//         status: "scheduled",
//         assignedQuestions: [],
//       };

//       interview.candidates.push(entry);

//       scheduledCandidates.push({
//         ...entry,
//         name: candidate.name,
//         email: candidate.email,
//       });

//       try {
//         await sendMCQInterviewLink(
//           candidate.email,
//           candidate.name,
//           interviewLink,
//           username,
//           password,
//           interview.test_title,
//           interview.difficulty,
//           interview.duration,
//           interview.no_of_questions,
//           interview.passing_score,
//           interview.primary_skill,
//           interview.secondary_skill,
//           startDate,
//           endDate,
//         );

//         emailResults.push({ candidate: candidate.email, status: "sent" });
//       } catch (emailError) {
//         emailResults.push({
//           candidate: candidate.email,
//           status: "failed",
//           error: emailError.message,
//         });
//       }
//     }

//     await interview.save();

//     return res.status(200).json({
//       success: true,
//       message: "Invitation process completed",
//       data: {
//         scheduledCandidates,
//         skippedCandidates,
//         cooldownCandidates,
//         emailResults,
//       },
//     });
//   } catch (error) {
//     console.error("Error sending invites:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to send invites",
//       error: error.message,
//     });
//   }
// };

// export const GetCandidatesInInterview = async (req, res) => {
//   const { id } = req.params;

//   try {
//     // Find the interview and populate candidate details
//     const interview = await AI_Interview.findById(id).populate(
//       "candidates.candidateId",
//     );
//     if (!interview) {
//       return res.status(404).json({ message: "Interview not found" });
//     }

//     // Get all candidate IDs in this interview
//     const candidateIds = interview.candidates
//       .map((c) => c.candidateId && c.candidateId._id)
//       .filter(Boolean);

//     // Get all scores for this interview and these candidates
//     const scores = await Score.find({
//       interviewId: id,
//       candidateId: { $in: candidateIds },
//     });

//     // Map candidateId to score for quick lookup
//     const scoreMap = {};
//     scores.forEach((score) => {
//       scoreMap[score.candidateId.toString()] = score;
//     });

//     // Get Exam_Type for logic
//     const examType = interview.Exam_Type;

//     // Build response
//     let candidates = interview.candidates
//       .map((c) => {
//         const candidate = c.candidateId;
//         if (!candidate) return null;
//         const score = scoreMap[candidate._id.toString()];
//         let result = null;
//         let totalScore = null;

//         // Calculate result if score exists
//         if (score && examType === "MCQ") {
//           // MCQ: full mark is 10, passing is 60% (6/10)
//           const totalQuestions = score.scores ? score.scores.length : 0;
//           const correctAnswers = score.scores
//             ? score.scores.filter((q) => q.score === 1).length
//             : 0;
//           totalScore = correctAnswers;
//           result =
//             totalQuestions > 0 && correctAnswers / totalQuestions >= 0.6
//               ? "Pass"
//               : "Fail";
//         } else if (score && examType === "Interview") {
//           // Interview: no MCQ, so pass/fail logic can be based on totalScore >= 60%
//           // If totalScore is out of 10, use same logic, else just pass totalScore
//           if (typeof score.totalScore === "number") {
//             totalScore = score.totalScore;
//             result = score.totalScore >= 6 ? "Pass" : "Fail";
//           }
//         }

//         return {
//           _id: candidate._id,
//           name: candidate.name,
//           email: candidate.email,
//           mobile: candidate.mobile,
//           aadharFront: candidate.aadharFront,
//           aadharBack: candidate.aadharBack,
//           photo: candidate.photo,
//           scoreCard: score ? score.totalScore : null,
//           scores: score ? score.scores : null,
//           summary: score ? score.summary : null,
//           pdfPath: score ? score.pdfPath : null,
//           totalScore: totalScore,
//           scheduledDate: c.scheduledStartDate || null,
//           Exam_Type: examType,
//           result: score ? result : null,
//         };
//       })
//       .filter(Boolean);

//     // Sort candidates so the latest added is on top (descending by scheduledDate)
//     candidates.sort((a, b) => {
//       const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
//       const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
//       return bTime - aTime;
//     });

//     res.json({ candidates });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({error});
//   }
// };

// export const updateMCQInterview = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const interview = await MCQ_Interview.findById(id);
//     console.log("Found interview for update:", interview);
//     if (!interview) {
//       return res.status(404).json({ message: "Interview not found" });
//     }

//     /* ================= FILE UPDATE ================= */

//     if (req.file) {
//       if (
//         interview.jobDescription &&
//         fs.existsSync(path.resolve(interview.jobDescription))
//       ) {
//         fs.unlinkSync(path.resolve(interview.jobDescription));
//       }

//       interview.jobDescription = req.file.path.replace(/\\/g, "/");
//     }

//     /* ================= FIELD UPDATES ================= */

//     const allowedFields = [
//       "difficulty",
//       "duration",
//       "test_title",
//       "no_of_questions",
//       "jobDescriptionText",
//       "primary_skill",
//       "secondary_skill",
//       "passing_score",
//       "isTemplate",
//     ];

//     allowedFields.forEach((field) => {
//       if (req.body[field] !== undefined) {
//         interview[field] = req.body[field];
//       }
//     });

//     await interview.save();

//     res.json({
//       message: "Assessment updated successfully",
//       interview,
//     });
//   } catch (error) {
//     console.error("Update error:", error);
//     res.status(500).json({error});
//   }
// };
// export const getMCQInterviewById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     if (!userId) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const candidate = await Candidate.findById(userId);
//     if (!candidate) {
//       return res.status(404).json({ message: "Candidate not found" });
//     }

//     // 1️⃣ Try MCQ_Interview
//     let interview = await MCQ_Interview.findById(id)
//       .select("-candidates -__v")
//       .lean();

//     // 2️⃣ If not found → Try AI_Interview
//     if (!interview) {
//       interview = await AI_Interview.findById(id)
//         .select("-candidates -__v")
//         .lean();
//     }

//     // 3️⃣ If still not found
//     if (!interview) {
//       return res.status(404).json({ message: "Interview not found" });
//     }

//     res.json({ interview: interview, user: candidate._doc });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({error});
//   }
// };

// export const GetAllAssessmentSchedule = async (req, res) => {
//   try {
//     const [{ total } = { total: 0 }] = await MCQ_Interview.aggregate([
//       { $unwind: "$candidates" },
//       {
//         $match: {
//           "candidates.interviewLink": { $type: "string", $ne: null },
//           "candidates.password": { $type: "string", $ne: null },
//         },
//       },
//       { $count: "total" },
//     ]);

//     return res.json({ totalSchedules: total });
//   } catch (err) {
//     console.error("Error counting schedules:", err.message);
//     res.status(500).json({error});
//   }
// };
import MCQ_Interview from "../../models/MCQ_Interview.js";
import Candidate from "../../models/Candidate.js";
import Score from "../../models/Score.js";
import AI_Interview from "../../models/AI_Interview.js";
import { sendMCQInterviewLink } from "../../services/emailService.js";
import mongoose from "mongoose";

// export const GetAllMCQInterviews = async (req, res) => {
//   try {
//     const adminId = req.user.id;
//     const { id } = req.query;
//     /* ================= GET SINGLE ================= */

//     if (id) {
//       // Optional but recommended validation
//       if (!mongoose.Types.ObjectId.isValid(id)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid interview ID",
//         });
//       }

//       const interview = await MCQ_Interview.findOne({
//         _id: id,
//         createdBy: adminId, // 🔐 security
//       }).populate("createdBy", "email");

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

//     /* ================= GET ALL ================= */

//     const interviews = await MCQ_Interview.find({
//       createdBy: adminId,
//     })
//       .sort({ createdAt: -1 })
//       .populate("createdBy", "email")
//       .populate("candidates.candidateId");
//     // console.log("interviews", interviews);
//     return res.status(200).json({
//       success: true,
//       count: interviews.length,
//       data: interviews,
//     });
//   } catch (error) {
//     console.error("Error fetching MCQ assessments:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch assessments",
//       error: error.message,
//     });
//   }
// };

export const GetAllMCQInterviews = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { id } = req.query;

    /* ================= GET SINGLE ================= */

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid interview ID",
        });
      }

      const interview = await MCQ_Interview.findOne({
        _id: id,
        createdBy: adminId,
      })
        .populate("createdBy", "email")
        .populate("candidates.candidateId");

      if (!interview) {
        return res.status(404).json({
          success: false,
          message: "Interview not found",
        });
      }

      // 🔥 Fetch all scores for this interview
      const scores = await Score.find({
        interviewId: id,
      });

      const updatedCandidates = interview.candidates.map((candidate) => {
        const candidateScore = scores.find(
          (s) =>
            s.candidateId.toString() === candidate.candidateId._id.toString(),
        );

        return {
          ...candidate.toObject(),
          scoreDetails: candidateScore || null, // 👈 FULL SCORE OBJECT
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          ...interview.toObject(),
          candidates: updatedCandidates,
        },
      });
    }

    /* ================= GET ALL ================= */

    const interviews = await MCQ_Interview.find({
      createdBy: adminId,
    })
      .sort({ createdAt: -1 })
      .populate("createdBy", "email")
      .populate("candidates.candidateId");

    const interviewIds = interviews.map((i) => i._id);

    // 🔥 Fetch all related scores in one query
    const scores = await Score.find({
      interviewId: { $in: interviewIds },
    });

    const updatedInterviews = interviews.map((interview) => {
      const interviewScores = scores.filter(
        (s) => s.interviewId.toString() === interview._id.toString(),
      );

      const updatedCandidates = interview.candidates.map((candidate) => {
        const candidateScore = interviewScores.find(
          (s) =>
            s.candidateId.toString() === candidate.candidateId._id.toString(),
        );

        return {
          ...candidate.toObject(),
          scoreDetails: candidateScore || null, // 👈 FULL SCORE DOCUMENT
        };
      });

      return {
        ...interview.toObject(),
        candidates: updatedCandidates,
      };
    });

    return res.status(200).json({
      success: true,
      count: updatedInterviews.length,
      data: updatedInterviews,
    });
  } catch (error) {
    console.error("Error fetching MCQ assessments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assessments",
      error: error.message,
    });
  }
};

export const CreateMCQTemplate = async (req, res) => {
  try {
    const {
      test_title,
      difficulty,
      duration,
      no_of_questions,
      primary_skill,
      secondary_skill,
      passing_score,
      jobDescriptionText,
    } = req.body;

    // Validate required fields
    if (
      !test_title ||
      !difficulty ||
      !duration ||
      !no_of_questions ||
      !primary_skill ||
      !passing_score
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Get job description file path if uploaded
    const jobDescription = req.file ? req.file.path.replace(/\\/g, "/") : "";
    // console.log("Job description path:", jobDescription);

    // // Generate questions using AI
    // const questions = await generateQuestions(
    //   jobDescription,
    //   test_title,
    //   difficulty,
    //   "MCQ",
    //   parseInt(no_of_questions),
    // );
    // console.log("Generated questions for template:", questions);

    // Create interview template
    const interview = await MCQ_Interview.create({
      test_title,
      difficulty,
      duration,
      no_of_questions: parseInt(no_of_questions),
      primary_skill,
      secondary_skill: secondary_skill || "",
      passing_score,
      jobDescription,
      jobDescriptionText,
      createdBy: req.user.id,
      isTemplate: true, // Mark as template
    });

    // // Save questions
    // const questionDocs = questions.map((q) => ({
    //   interviewId: interview._id,
    //   questionText: q.question,
    //   options: q.options,
    //   correctAnswer: q.correctAnswer,
    // }));
    // await Question.insertMany(questionDocs);

    res.status(201).json({
      success: true,
      message: "Assessment template created successfully",
      data: {
        interview,
        // questionCount: questions.length,
      },
    });
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create assessment template",
      error: error.message,
    });
  }
};

export const AssessmentInvitation = async (req, res) => {
  try {
    const {
      test_title,
      difficulty,
      duration,
      no_of_questions,
      primary_skill,
      secondary_skill,
      passing_score,
      secondry_jobDescription,
      start_date,
      end_date,
      candidates,
    } = req.body;

    // Validate required fields
    if (
      !test_title ||
      !difficulty ||
      !duration ||
      !no_of_questions ||
      !primary_skill ||
      !passing_score ||
      !start_date ||
      !end_date ||
      !candidates
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields including candidates",
      });
    }

    // Parse candidates array
    let candidateArray;
    try {
      candidateArray =
        typeof candidates === "string" ? JSON.parse(candidates) : candidates;
      if (!Array.isArray(candidateArray) || candidateArray.length === 0) {
        throw new Error("Invalid candidates array");
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one candidate",
      });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Get job description file path
    const jobDescription = req.file ? req.file.path.replace(/\\/g, "/") : "";

    // // Generate questions using AI
    // const questions = await generateQuestions(
    //   jobDescription,
    //   test_title,
    //   difficulty,
    //   "MCQ",
    //   parseInt(no_of_questions),
    // );

    // Create interview
    const interview = await MCQ_Interview.create({
      test_title,
      difficulty,
      duration,
      no_of_questions: parseInt(no_of_questions),
      primary_skill,
      secondary_skill: secondary_skill || "",
      passing_score,
      secondry_jobDescription,
      jobDescription,
      createdBy: req.user.id,
      isTemplate: false,
    });

    // Save questions
    // const questionDocs = questions.map((q) => ({
    //   interviewId: interview._id,
    //   questionText: q.question,
    //   options: q.options,
    //   correctAnswer: q.correctAnswer,
    // }));
    // await Question.insertMany(questionDocs);

    // Schedule candidates and send emails
    const scheduledCandidates = [];
    const emailResults = [];

    for (const candId of candidateArray) {
      const candidate = await Candidate.findById(candId);
      if (!candidate) {
        console.warn(`Candidate ${candId} not found, skipping...`);
        continue;
      }

      // Generate credentials
      const username = `user_${Math.random().toString(36).substring(2, 10)}`;
      const password = Math.random().toString(36).slice(-8);
      const interviewLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/user/login/${interview._id}`;

      const entry = {
        candidateId: candidate._id,
        interviewLink,
        username,
        password,
        start_Date: startDate,
        end_Date: endDate,
      };

      interview.candidates.push(entry);
      scheduledCandidates.push({
        ...entry,
        name: candidate.name,
        email: candidate.email,
      });

      // Send email
      try {
        await sendMCQInterviewLink(
          candidate.email,
          candidate.name,
          interviewLink,
          username,
          password,
          test_title,
          difficulty,
          duration,
          no_of_questions,
          passing_score,
          primary_skill,
          secondary_skill,
          startDate,
          endDate,
        );
        emailResults.push({ candidate: candidate.email, status: "sent" });
      } catch (emailError) {
        console.error(
          `Failed to send email to ${candidate.email}:`,
          emailError,
        );
        emailResults.push({
          candidate: candidate.email,
          status: "failed",
          error: emailError.message,
        });
      }
    }

    await interview.save();

    const successfulEmails = emailResults.filter(
      (r) => r.status === "sent",
    ).length;
    const failedEmails = emailResults.filter(
      (r) => r.status === "failed",
    ).length;

    res.status(201).json({
      success: true,
      message: `Assessment created and invitations sent to ${successfulEmails} candidate(s)`,
      data: {
        interview,
        // questionCount: questions.length,
        scheduledCandidates,
        emailStats: {
          total: emailResults.length,
          successful: successfulEmails,
          failed: failedEmails,
        },
        emailResults,
      },
    });
  } catch (error) {
    console.error("Error creating assessment and sending invites:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create assessment and send invites",
      error: error.message,
    });
  }
};

export const AssessmentInvitationByID = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { candidateIds, start_date, end_date } = req.body;

    if (!candidateIds || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Please provide candidateIds, start_date, and end_date",
      });
    }

    let candidateArray;
    try {
      candidateArray =
        typeof candidateIds === "string"
          ? JSON.parse(candidateIds)
          : candidateIds;

      if (!Array.isArray(candidateArray) || candidateArray.length === 0) {
        throw new Error("Invalid array");
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one candidate",
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    if (endDate.getTime() <= startDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    const interview = await MCQ_Interview.findById(assessmentId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    const scheduledCandidates = [];
    const skippedCandidates = [];
    const emailResults = [];

    for (const candId of candidateArray) {
      const candidate = await Candidate.findById(candId);
      if (!candidate) continue;

      // 🔥 STRICT CHECK: already invited?
      const alreadyInvited = interview.candidates.find(
        (c) => c.candidateId.toString() === candId.toString(),
      );

      if (alreadyInvited) {
        skippedCandidates.push({
          candidate: candidate.email,
          reason: "Already invited",
        });
        continue; // ❌ skip sending again
      }

      const username = `user_${Math.random().toString(36).substring(2, 10)}`;
      const password = Math.random().toString(36).slice(-8);
      const interviewLink = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/user/login/${interview._id}`;

      const entry = {
        candidateId: candidate._id,
        interviewLink,
        username,
        password,
        start_Date: startDate,
        end_Date: endDate,
        status: "scheduled",
        assignedQuestions: [],
      };

      interview.candidates.push(entry);

      scheduledCandidates.push({
        ...entry,
        name: candidate.name,
        email: candidate.email,
      });

      try {
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
          startDate,
          endDate,
        );

        emailResults.push({ candidate: candidate.email, status: "sent" });
      } catch (emailError) {
        emailResults.push({
          candidate: candidate.email,
          status: "failed",
          error: emailError.message,
        });
      }
    }

    await interview.save();

    return res.status(200).json({
      success: true,
      message: "Invitation process completed",
      data: {
        scheduledCandidates,
        skippedCandidates,
        emailResults,
      },
    });
  } catch (error) {
    console.error("Error sending invites:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send invites",
      error: error.message,
    });
  }
};

export const GetCandidatesInInterview = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the interview and populate candidate details
    const interview = await AI_Interview.findById(id).populate(
      "candidates.candidateId",
    );
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Get all candidate IDs in this interview
    const candidateIds = interview.candidates
      .map((c) => c.candidateId && c.candidateId._id)
      .filter(Boolean);

    // Get all scores for this interview and these candidates
    const scores = await Score.find({
      interviewId: id,
      candidateId: { $in: candidateIds },
    });

    // Map candidateId to score for quick lookup
    const scoreMap = {};
    scores.forEach((score) => {
      scoreMap[score.candidateId.toString()] = score;
    });

    // Get Exam_Type for logic
    const examType = interview.Exam_Type;

    // Build response
    let candidates = interview.candidates
      .map((c) => {
        const candidate = c.candidateId;
        if (!candidate) return null;
        const score = scoreMap[candidate._id.toString()];
        let result = null;
        let totalScore = null;

        // Calculate result if score exists
        if (score && examType === "MCQ") {
          // MCQ: full mark is 10, passing is 60% (6/10)
          const totalQuestions = score.scores ? score.scores.length : 0;
          const correctAnswers = score.scores
            ? score.scores.filter((q) => q.score === 1).length
            : 0;
          totalScore = correctAnswers;
          result =
            totalQuestions > 0 && correctAnswers / totalQuestions >= 0.6
              ? "Pass"
              : "Fail";
        } else if (score && examType === "Interview") {
          // Interview: no MCQ, so pass/fail logic can be based on totalScore >= 60%
          // If totalScore is out of 10, use same logic, else just pass totalScore
          if (typeof score.totalScore === "number") {
            totalScore = score.totalScore;
            result = score.totalScore >= 6 ? "Pass" : "Fail";
          }
        }

        return {
          _id: candidate._id,
          name: candidate.name,
          email: candidate.email,
          mobile: candidate.mobile,
          aadharFront: candidate.aadharFront,
          aadharBack: candidate.aadharBack,
          photo: candidate.photo,
          scoreCard: score ? score.totalScore : null,
          scores: score ? score.scores : null,
          summary: score ? score.summary : null,
          pdfPath: score ? score.pdfPath : null,
          totalScore: totalScore,
          scheduledDate: c.scheduledDate || null,
          Exam_Type: examType,
          result: score ? result : null,
        };
      })
      .filter(Boolean);

    // Sort candidates so the latest added is on top (descending by scheduledDate)
    candidates.sort((a, b) => {
      const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      return bTime - aTime;
    });

    res.json({ candidates });
  } catch (error) {
    console.log(error);
    res.status(500).json({error});
  }
};

export const updateMCQInterview = async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await MCQ_Interview.findById(id);
    console.log("Found interview for update:", interview);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    /* ================= FILE UPDATE ================= */

    if (req.file) {
      if (
        interview.jobDescription &&
        fs.existsSync(path.resolve(interview.jobDescription))
      ) {
        fs.unlinkSync(path.resolve(interview.jobDescription));
      }

      interview.jobDescription = req.file.path.replace(/\\/g, "/");
    }

    /* ================= FIELD UPDATES ================= */

    const allowedFields = [
      "difficulty",
      "duration",
      "test_title",
      "no_of_questions",
      "jobDescriptionText",
      "primary_skill",
      "secondary_skill",
      "passing_score",
      "isTemplate",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        interview[field] = req.body[field];
      }
    });

    await interview.save();

    res.json({
      message: "Assessment updated successfully",
      interview,
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({error});
  }
};
export const getMCQInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const candidate = await Candidate.findById(userId);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // 1️⃣ Try MCQ_Interview
    let interview = await MCQ_Interview.findById(id)
      .select("-candidates -__v")
      .lean();

    // 2️⃣ If not found → Try AI_Interview
    if (!interview) {
      interview = await AI_Interview.findById(id)
        .select("-candidates -__v")
        .lean();
    }

    // 3️⃣ If still not found
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    res.json({ interview: interview, user: candidate._doc });
  } catch (error) {
    console.log(error);
    res.status(500).json({error});
  }
};

export const GetAllAssessmentSchedule = async (req, res) => {
  try {
    const [{ total } = { total: 0 }] = await MCQ_Interview.aggregate([
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
    res.status(500).json({error});
  }
};
