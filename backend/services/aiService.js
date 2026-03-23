const BATCH_SIZE = 5;

const fetchBatch = async (prompt) => {
  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.5,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HuggingFace error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  let generatedText = data?.choices?.[0]?.message?.content || "";

  generatedText = generatedText
    .replace(/```json/gi, "")
    .replace(/```/gi, "")
    .trim();

  const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Invalid JSON returned by AI");

  return JSON.parse(jsonMatch[0]);
};

// ─────────────────────────────────────────────
// MAIN EXPORT: generateQuestions
// ─────────────────────────────────────────────
export const generateQuestions = async (
  jobDescription,
  test_title,
  difficulty,
  Exam_Type,
  no_of_questions
) => {
  if (!process.env.HF_API_TOKEN)
    throw new Error("HF_API_TOKEN is not set in .env");

  const count = parseInt(no_of_questions) || 5;
  const totalBatches = Math.ceil(count / BATCH_SIZE);
  let allQuestions = [];

  //console.log(`🤖 Generating ${count} ${Exam_Type} questions in ${totalBatches} batches...`);

  for (let i = 0; i < totalBatches; i++) {
    const remaining = count - allQuestions.length;
    const currentBatchSize = remaining >= BATCH_SIZE ? BATCH_SIZE : remaining;

    // Build prompt based on exam type
    const prompt =
      Exam_Type === "Interview"
        ? `Generate exactly ${currentBatchSize} ${difficulty} level technical interview questions for the role of ${test_title}.
${jobDescription ? `Context: ${jobDescription}` : ""}

Rules:
- Open-ended questions only
- No explanations
- Return ONLY valid JSON array of strings

Format exactly like this:
["Question 1?", "Question 2?", "Question 3?"]`

        : `Generate exactly ${currentBatchSize} ${difficulty} multiple choice questions about ${test_title}.
${jobDescription ? `Context: ${jobDescription}` : ""}

Rules:
- Each question must have exactly 4 options
- No explanations
- correctAnswer must match one option exactly
- Keep questions concise
- Return ONLY valid JSON array

Format exactly like this:
[
  {
    "question": "What is ...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A"
  }
]`;

    const batchQuestions = await fetchBatch(prompt);
    allQuestions = [...allQuestions, ...batchQuestions];

    //console.log(`✅ Batch ${i + 1}/${totalBatches} done — ${allQuestions.length}/${count} questions`);
  }

  //console.log(`✅ Done! Generated ${allQuestions.length} ${Exam_Type} questions`);
  return allQuestions.slice(0, count);
};
