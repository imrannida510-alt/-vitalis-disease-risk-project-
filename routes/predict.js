const express = require("express");
const { calculateRisk } = require("../model/riskModel");
const { generateExplanation } = require("../services/llmService");

const router = express.Router();

const VALID_CONDITIONS = ["diabetes", "heart_disease", "hypertension"];

function validateInput(body) {
  const errors = [];

  if (!body.age || isNaN(Number(body.age)) || Number(body.age) <= 0) {
    errors.push("A valid age is required.");
  }
  if (!body.gender) {
    errors.push("Gender is required.");
  }
  if (!body.condition || !VALID_CONDITIONS.includes(body.condition)) {
    errors.push(`Condition must be one of: ${VALID_CONDITIONS.join(", ")}`);
  }
  if (body.symptoms && !Array.isArray(body.symptoms)) {
    errors.push("Symptoms must be an array.");
  }

  return errors;
}

router.post("/predict", async (req, res) => {
  const errors = validateInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    // Step 1: run the (simplified) ML model
    const riskResult = calculateRisk(req.body);

    // Step 2: ask the LLM to explain the result in plain language
    const explanation = await generateExplanation({ input: req.body, riskResult });

    // Step 3: return everything the frontend needs
    return res.json({
      condition: riskResult.condition,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      explanation,
      factors: riskResult.factors,
    });
  } catch (err) {
    console.error("Prediction error:", err);
    return res.status(500).json({ error: "Something went wrong while generating your result." });
  }
});

module.exports = router;
