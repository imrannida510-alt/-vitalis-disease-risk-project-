/**
 * llmService.js
 *
 * Sends the ML model's output to Claude and asks it to write a plain-language
 * explanation for the end user. Requires ANTHROPIC_API_KEY to be set in .env
 * (get one at https://console.anthropic.com/settings/keys).
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5"; // swap for another model string if you prefer

function buildPrompt({ input, riskResult }) {
  const conditionLabel = riskResult.condition.replace("_", " ");

  return `You are a careful, calm medical-information assistant embedded in a
disease risk screening app called Vitalis. You are NOT diagnosing anyone —
you are explaining what an automated risk score means in plain, reassuring
language a non-medical person can understand.

Condition being screened: ${conditionLabel}
Model's risk score: ${riskResult.riskScore} out of 100
Risk level: ${riskResult.riskLevel}

User-reported details:
- Age: ${input.age}
- Gender: ${input.gender}
- BMI: ${riskResult.bmi ?? "not provided"}
- Symptoms: ${(input.symptoms || []).join(", ") || "none reported"}
- Smoking status: ${input.smoking}
- Physical activity level: ${input.activity}
- Family history notes: ${input.family_history || "none provided"}
- Additional notes from user: ${input.notes || "none"}

Top contributing factors identified by the model:
${riskResult.factors.map((f) => `- ${f.name}: ${f.note}`).join("\n")}

Write a short explanation (3-5 sentences) for the user that:
1. States the risk level plainly and what it means in everyday terms.
2. Briefly explains which factors likely pushed the score up or kept it down.
3. Gives one balanced, general next-step suggestion (e.g. "consider discussing this with a doctor" or "keep monitoring") WITHOUT prescribing medication, dosages, or a specific diagnosis.
4. Uses a warm, non-alarming tone — this is a screening estimate, not a diagnosis.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"explanation": "string"}`;
}

async function generateExplanation({ input, riskResult }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // No key configured — fall back to a template explanation so the app
    // still works end-to-end during local development.
    return fallbackExplanation(riskResult);
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: buildPrompt({ input, riskResult }) }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, await response.text());
      return fallbackExplanation(riskResult);
    }

    const data = await response.json();
    const text = data.content.map((block) => block.text || "").join("");
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.explanation;
  } catch (err) {
    console.error("LLM explanation failed, using fallback:", err.message);
    return fallbackExplanation(riskResult);
  }
}

function fallbackExplanation(riskResult) {
  const conditionLabel = riskResult.condition.replace("_", " ");
  return (
    `Based on what you shared, the model estimates a ${riskResult.riskLevel} risk ` +
    `for ${conditionLabel} (score: ${riskResult.riskScore}/100). ` +
    `The biggest contributors were ${riskResult.factors
      .slice(0, 2)
      .map((f) => f.name.toLowerCase())
      .join(" and ")}. ` +
    `This is only a screening estimate, not a diagnosis — consider discussing these ` +
    `results with a doctor, especially if your symptoms persist or worsen.`
  );
}

module.exports = { generateExplanation };
