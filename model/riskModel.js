/**
 * riskModel.js
 *
 * A lightweight, explainable risk-scoring model.
 *
 * NOTE ON REALISM:
 * This uses a hand-tuned weighted logistic function, not a model trained on
 * a real clinical dataset. It is meant to make the full stack (frontend ->
 * backend -> "ML" -> LLM) work end-to-end for a demo/college project.
 *
 * To make this production-grade later:
 *   1. Get a real dataset (e.g. Pima Indians Diabetes, UCI Heart Disease).
 *   2. Train a proper model in Python (scikit-learn: LogisticRegression,
 *      RandomForestClassifier, or XGBoost).
 *   3. Export it (joblib/pickle or ONNX) and either:
 *        a) serve it from a small Python microservice (Flask/FastAPI), or
 *        b) convert it to a format runnable in Node (onnxruntime-node).
 *   4. Replace the calculateRisk() body below with a call to that model.
 */

const CONDITION_WEIGHTS = {
  diabetes: {
    symptoms: {
      fatigue: 0.6,
      frequent_urination: 1.4,
      excessive_thirst: 1.4,
      blurred_vision: 1.0,
      headaches: 0.3,
      dizziness: 0.3,
      chest_pain: 0.1,
      shortness_of_breath: 0.1,
    },
    age: 0.03, // per year over 30
    bmiOverweight: 1.2, // BMI > 25
    bmiObese: 2.0, // BMI > 30
    smokingCurrent: 0.5,
    smokingFormer: 0.2,
    lowActivity: 0.6,
    familyHistory: 1.3,
    base: -4.5,
  },
  heart_disease: {
    symptoms: {
      chest_pain: 1.8,
      shortness_of_breath: 1.5,
      dizziness: 0.8,
      fatigue: 0.5,
      headaches: 0.2,
      frequent_urination: 0.1,
      excessive_thirst: 0.1,
      blurred_vision: 0.2,
    },
    age: 0.05,
    bmiOverweight: 0.8,
    bmiObese: 1.5,
    smokingCurrent: 1.4,
    smokingFormer: 0.6,
    lowActivity: 0.9,
    familyHistory: 1.5,
    base: -5.5,
  },
  hypertension: {
    symptoms: {
      headaches: 1.2,
      dizziness: 1.0,
      blurred_vision: 0.9,
      fatigue: 0.4,
      chest_pain: 0.6,
      shortness_of_breath: 0.5,
      frequent_urination: 0.2,
      excessive_thirst: 0.2,
    },
    age: 0.04,
    bmiOverweight: 1.0,
    bmiObese: 1.7,
    smokingCurrent: 0.9,
    smokingFormer: 0.4,
    lowActivity: 0.7,
    familyHistory: 1.1,
    base: -4.8,
  },
};

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * @param {object} input - sanitized form data from the frontend
 * @returns {{ riskScore: number, riskLevel: string, factors: Array<{name:string, note:string, weight:number}> }}
 */
function calculateRisk(input) {
  const condition = CONDITION_WEIGHTS[input.condition] ? input.condition : "diabetes";
  const weights = CONDITION_WEIGHTS[condition];

  let score = weights.base;
  const factors = [];

  // Age contribution
  const age = Number(input.age) || 0;
  const ageOver30 = Math.max(0, age - 30);
  const ageContribution = ageOver30 * weights.age;
  score += ageContribution;
  factors.push({
    name: "Age",
    weight: ageContribution,
    note: age >= 45 ? "Strong contributor" : age >= 30 ? "Moderate contributor" : "Minor contributor",
  });

  // BMI contribution
  const bmi = calculateBmi(Number(input.height), Number(input.weight));
  let bmiContribution = 0;
  let bmiNote = "Not provided";
  if (bmi) {
    if (bmi >= 30) {
      bmiContribution = weights.bmiObese;
      bmiNote = "Strong contributor";
    } else if (bmi >= 25) {
      bmiContribution = weights.bmiOverweight;
      bmiNote = "Moderate contributor";
    } else {
      bmiNote = "Minor contributor";
    }
    score += bmiContribution;
  }
  factors.push({ name: "Body mass index (BMI)", weight: bmiContribution, note: bmiNote });

  // Symptoms contribution
  const symptoms = Array.isArray(input.symptoms) ? input.symptoms : [];
  let symptomContribution = 0;
  symptoms.forEach((symptom) => {
    symptomContribution += weights.symptoms[symptom] || 0;
  });
  score += symptomContribution;
  factors.push({
    name: "Reported symptoms",
    weight: symptomContribution,
    note:
      symptoms.length === 0
        ? "None reported"
        : symptomContribution >= 2
        ? "Strong contributor"
        : "Moderate contributor",
  });

  // Smoking contribution
  let smokingContribution = 0;
  if (input.smoking === "current") smokingContribution = weights.smokingCurrent;
  else if (input.smoking === "former") smokingContribution = weights.smokingFormer;
  score += smokingContribution;
  factors.push({
    name: "Smoking status",
    weight: smokingContribution,
    note:
      input.smoking === "current"
        ? "Strong contributor"
        : input.smoking === "former"
        ? "Minor contributor"
        : "Not a contributor",
  });

  // Activity contribution
  let activityContribution = 0;
  if (input.activity === "low") activityContribution = weights.lowActivity;
  score += activityContribution;
  factors.push({
    name: "Physical activity",
    weight: activityContribution,
    note: input.activity === "low" ? "Moderate contributor" : "Minor contributor",
  });

  // Family history contribution (simple keyword presence check)
  const hasFamilyHistory = Boolean(input.family_history && input.family_history.trim().length > 3);
  const familyContribution = hasFamilyHistory ? weights.familyHistory : 0;
  score += familyContribution;
  factors.push({
    name: "Family history",
    weight: familyContribution,
    note: hasFamilyHistory ? "Strong contributor" : "Not provided",
  });

  // Convert to 0-100 probability-style score
  const probability = sigmoid(score);
  const riskScore = Math.round(probability * 100);

  let riskLevel = "low";
  if (riskScore >= 66) riskLevel = "high";
  else if (riskScore >= 33) riskLevel = "medium";

  // Sort factors by absolute contribution, strongest first, cap at top 4
  const topFactors = [...factors]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 4)
    .map(({ name, note }) => ({ name, note })); // drop internal weight before returning

  return {
    condition,
    riskScore,
    riskLevel,
    factors: topFactors,
    bmi: bmi ? Math.round(bmi * 10) / 10 : null,
  };
}

module.exports = { calculateRisk };
