// import { GoogleGenerativeAI } from "@google/generative-ai";
// const HF_URL = "https://api.together.xyz/v1/chat/completions";
// const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";  // works on Together free tier

// const genAI = new GoogleGenerativeAI("AIzaSyDDq4xW3YZoTBLCybwaNYbyRXPXBtj1-cg");
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// const cleanResponseText = (text) => {
//   return text.replace(/```json\n|```|\n/g, "").trim();
// };

// const callGeminiWithRetry = async (prompt, maxRetries = 4) => {
//   let attempt = 0;
//   let delay = 1000;

//   while (attempt < maxRetries) {
//     try {
//       const { response } = await model.generateContent(prompt);
//       return response.text();
//     } catch (err) {
//       const status = err.status ?? err.code ?? err.response?.status;
//       if (status !== 503) throw err; // not a 503 → fail fast
//       if (++attempt === maxRetries) throw err; // out of retries
//       console.warn(
//         `Gemini 503 – retrying in ${delay}ms (try ${attempt}/${maxRetries})`,
//       );
//       await new Promise((r) => setTimeout(r, delay));
//       delay *= 2;
//     }
//   }
// };
// export const generateQuestions = async (
//   jobDescription,
//   test_title,
//   difficulty,
//   Exam_Type,
//   no_of_questions,
// ) => {
//   let prompt;

//   if (Exam_Type === "Interview") {
//     prompt = `
//     Generate ${no_of_questions} Interview questions for a Job Description: ${jobDescription} level candidate
//     in ${test_title} with ${difficulty} difficulty.
//     Each question should be concise and relevant to the technology stack.
//     Return the questions as a raw JSON array of strings, without any Markdown formatting or code fences.
//     Example: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
//     `;
//   } else if (Exam_Type === "MCQ") {
//     prompt = `
//     Generate ${no_of_questions} multiple choice questions (MCQs)and level of the candidate
//     in ${test_title} with ${difficulty} difficulty.
//     Each question should have 4 options (A, B, C, D) and one correct answer.
//     Return the questions as a raw JSON array of objects, without any Markdown formatting or code fences.
//     Each object should have: question, options (array of 4 strings), and correctAnswer (string).
//     Example: [
//       {
//         "question": "What is the correct syntax for declaring a variable in JavaScript?",
//         "options": [
//           "var x = 5;",
//           "variable x = 5;",
//           "x := 5;",
//           "x = 5;"
//         ],
//         "correctAnswer": "var x = 5;"
//       }
//     ]
//     `;
//   } else {
//     throw new Error(
//       'Invalid exam type. Please choose either "Interview" or "MCQ"',
//     );
//   }

//   try {
//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const rawText = response.text();
//     //console.log("Raw response from Gemini:", rawText);
//     const cleanedText = cleanResponseText(rawText);
//     const questions = JSON.parse(cleanedText);

//     if (Exam_Type === "Interview") {
//       if (!Array.isArray(questions) || questions.length !== 5) {
//         throw new Error("Expected an array of 5 Interview questions");
//       }
//     } else if (Exam_Type === "MCQ") {
//       if (
//         !Array.isArray(questions) ||
//         questions.length !== no_of_questions ||
//         !questions.every(
//           (q) =>
//             q.question &&
//             Array.isArray(q.options) &&
//             q.options.length === 4 &&
//             q.correctAnswer,
//         )
//       ) {
//         throw new Error("Invalid MCQ format");
//       }
//     }
//     return questions;
//   } catch (error) {
//     console.error("Error in generateQuestions:", error);
//     throw new Error("Failed to generate questions");
//   }
// };

// export const evaluateAnswer = async (question, answer) => {
//   const prompt = `
//   Evaluate the following answer for the given question. Provide a score out of 10 and a brief feedback.
//   Question: ${question}
//   Answer: ${answer}
//   Return the result as a raw JSON object, without any Markdown formatting or code fences.
//   Example: {"score": 8, "feedback": "Good answer, but could include more details."}
//   `;

//   try {
//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const rawText = response.text();
//     //console.log("Raw response from Gemini (evaluateAnswer):", rawText); // Debugging
//     const cleanedText = cleanResponseText(rawText);
//     const evaluation = JSON.parse(cleanedText);
//     if (!evaluation.score || !evaluation.feedback) {
//       throw new Error("Invalid evaluation format");
//     }
//     return evaluation;
//   } catch (error) {
//     console.error("Error in evaluateAnswer:", error);
//     throw new Error("Failed to evaluate answer");
//   }
// };

// const callHuggingFace = async (prompt) => {
//   if (!process.env.HF_API_TOKEN) {
//     throw new Error("HF_API_TOKEN is not set in .env");
//   }
//   //console.log("HF_API_TOKEN",process.env.HF_API_TOKEN)
//   const response = await fetch(HF_URL, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       model: HF_MODEL,
//       messages: [{ role: "user", content: prompt }],
//       max_tokens: 1000,
//       temperature: 0.5,
//     }),
//   });

//   if (!response.ok) {
//     const errorText = await response.text();
//     throw new Error(`HuggingFace error ${response.status}: ${errorText}`);
//   }

//   const data = await response.json();

//   let text = data?.choices?.[0]?.message?.content || "";

//   // Clean markdown formatting
//   text = text
//     .replace(/```json/gi, "")
//     .replace(/```/gi, "")
//     .trim();

//   return text;
// };

// // export const generateSummary = async (scores) => {
// //   const prompt = `
// //   Given the following scores and feedback for ${scores.no_of_questions} questions, provide a summary of the candidate's performance.
// //   Input: ${JSON.stringify(scores.score)}
// //   Return a concise summary as a raw JSON string, without any Markdown formatting or code fences.
// //   Example: "The candidate performed well overall, with strong answers in technical questions."
// //   `;

// //   try {
// //     const result = await model.generateContent(prompt);
// //     const response = await result.response;
// //     const rawText = response.text();
// //     //console.log('Raw response from Gemini (generateSummary):', rawText); // Debugging
// //     const cleanedText = cleanResponseText(rawText);
// //     const summary = JSON.parse(cleanedText);
// //     if (typeof summary !== 'string') {
// //       throw new Error('Expected a string summary');
// //     }
// //     return summary;
// //   } catch (error) {
// //     console.error('Error in generateSummary:', error);
// //     throw new Error('Failed to generate summary');
// //   }
// // };

// export const generateSummary = async (scores) => {
//   //console.log("Generating summary with scores:", scores);

//   if (!Array.isArray(scores) || scores.length === 0) {
//     return "No performance data available.";
//   }

//   const totalScore = scores.reduce((sum, s) => sum + (s.score || 0), 0);
//   const maxScore = scores.length * 10;
//   const percentage = ((totalScore / maxScore) * 100).toFixed(2);

//   const prompt = `
// You are an AI interview evaluator.

// Candidate scored ${totalScore} out of ${maxScore}.
// Percentage: ${percentage}%.
// Number of questions: ${scores.length}.

// Write a concise professional performance summary in 3-4 lines.
// Do NOT use JSON.
// Do NOT use markdown.
// Return plain text only.
// `;

//   const rawText = await callHuggingFace(prompt);

//   if (!rawText || typeof rawText !== "string") {
//     return "The candidate completed the interview successfully.";
//   }

//   // Clean markdown safely
//   const cleaned = rawText
//     .replace(/```/g, "")
//     .replace(/^\s*Summary:\s*/i, "")
//     .trim();

//   return cleaned;
// };

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyDDq4xW3YZoTBLCybwaNYbyRXPXBtj1-cg");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const cleanResponseText = (text) => {
  return text.replace(/```json\n|```|\n/g, "").trim();
};

const callGeminiWithRetry = async (prompt, maxRetries = 4) => {
  let attempt = 0;
  let delay = 1000;

  while (attempt < maxRetries) {
    try {
      const { response } = await model.generateContent(prompt);
      return response.text();
    } catch (err) {
      const status = err.status ?? err.code ?? err.response?.status;
      if (status !== 503) throw err;
      if (++attempt === maxRetries) throw err;
      console.warn(
        `Gemini 503 – retrying in ${delay}ms (try ${attempt}/${maxRetries})`,
      );
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

export const generateQuestions = async (
  jobDescription,
  test_title,
  difficulty,
  Exam_Type,
  no_of_questions,
) => {
  let prompt;

  if (Exam_Type === "Interview") {
    prompt = `
    Generate ${no_of_questions} Interview questions for a Job Description: ${jobDescription} level candidate
    in ${test_title} with ${difficulty} difficulty.
    Each question should be concise and relevant to the technology stack.
    Return the questions as a raw JSON array of strings, without any Markdown formatting or code fences.
    Example: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    `;
  } else if (Exam_Type === "MCQ") {
    prompt = `
    Generate ${no_of_questions} multiple choice questions (MCQs) and level of the candidate
    in ${test_title} with ${difficulty} difficulty.
    Each question should have 4 options (A, B, C, D) and one correct answer.
    Return the questions as a raw JSON array of objects, without any Markdown formatting or code fences.
    Each object should have: question, options (array of 4 strings), and correctAnswer (string).
    Example: [
      {
        "question": "What is the correct syntax for declaring a variable in JavaScript?",
        "options": ["var x = 5;", "variable x = 5;", "x := 5;", "x = 5;"],
        "correctAnswer": "var x = 5;"
      }
    ]
    `;
  } else {
    throw new Error(
      'Invalid exam type. Please choose either "Interview" or "MCQ"',
    );
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    //console.log("Raw response from Gemini:", rawText);
    const cleanedText = cleanResponseText(rawText);
    const questions = JSON.parse(cleanedText);

    if (Exam_Type === "Interview") {
      if (!Array.isArray(questions) || questions.length !== 5) {
        throw new Error("Expected an array of 5 Interview questions");
      }
    } else if (Exam_Type === "MCQ") {
      if (
        !Array.isArray(questions) ||
        questions.length !== no_of_questions ||
        !questions.every(
          (q) =>
            q.question &&
            Array.isArray(q.options) &&
            q.options.length === 4 &&
            q.correctAnswer,
        )
      ) {
        throw new Error("Invalid MCQ format");
      }
    }
    return questions;
  } catch (error) {
    console.error("Error in generateQuestions:", error);
    throw new Error("Failed to generate questions");
  }
};

export const evaluateAnswer = async (question, answer) => {
  const prompt = `
  Evaluate the following answer for the given question. Provide a score out of 10 and a brief feedback.
  Question: ${question}
  Answer: ${answer}
  Return the result as a raw JSON object, without any Markdown formatting or code fences.
  Example: {"score": 8, "feedback": "Good answer, but could include more details."}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    //console.log("Raw response from Gemini (evaluateAnswer):", rawText);
    const cleanedText = cleanResponseText(rawText);
    const evaluation = JSON.parse(cleanedText);
    if (!evaluation.score || !evaluation.feedback) {
      throw new Error("Invalid evaluation format");
    }
    return evaluation;
  } catch (error) {
    console.error("Error in evaluateAnswer:", error);
    throw new Error("Failed to evaluate answer");
  }
};

// ✅ FIXED: Now uses Gemini instead of HuggingFace/Together.ai
export const generateSummary = async (scores) => {
  //console.log("Generating summary with scores:", scores);

  if (!Array.isArray(scores) || scores.length === 0) {
    return "No performance data available.";
  }

  const totalScore = scores.reduce((sum, s) => sum + (s.score || 0), 0);
  const maxScore = scores.length * 10;
  const percentage = ((totalScore / maxScore) * 100).toFixed(2);

  const prompt = `
You are an AI interview evaluator.

Candidate scored ${totalScore} out of ${maxScore}.
Percentage: ${percentage}%.
Number of questions: ${scores.length}.

Write a concise professional performance summary in 3-4 lines.
Do NOT use JSON.
Do NOT use markdown.
Return plain text only.
`;

  try {
    const rawText = await callGeminiWithRetry(prompt);

    if (!rawText || typeof rawText !== "string") {
      return "The candidate completed the interview successfully.";
    }

    const cleaned = rawText
      .replace(/```/g, "")
      .replace(/^\s*Summary:\s*/i, "")
      .trim();

    return cleaned;
  } catch (error) {
    console.error("Error in generateSummary:", error);
    return "The candidate completed the interview. Summary generation failed.";
  }
};
