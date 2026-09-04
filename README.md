# Vitalis Backend

Express server that powers the Disease Risk Prediction frontend. It does two things:

1. **"ML" scoring** (`model/riskModel.js`) — a weighted, explainable scoring function
   that turns form answers into a 0–100 risk score. See the note at the top of that
   file for how to swap in a real scikit-learn model later.
2. **LLM explanation** (`services/llmService.js`) — sends the score + inputs to Claude
   and asks it to write a plain-language explanation for the user.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and paste your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
```

Get a key at https://console.anthropic.com/settings/keys — you'll need a funded
Anthropic account. **If you leave this blank, the app still works** — it just uses a
simple template sentence instead of an LLM-written explanation.

## Run

```bash
npm start
```

Server runs at `http://localhost:5000`. Check it's alive:

```bash
curl http://localhost:5000/api/health
```

## Endpoints

### `POST /api/predict`

Request body (all from the frontend form):

```json
{
  "age": 52,
  "gender": "male",
  "height": 175,
  "weight": 95,
  "condition": "diabetes",
  "symptoms": ["frequent_urination", "excessive_thirst"],
  "smoking": "current",
  "activity": "low",
  "family_history": "Father has type 2 diabetes",
  "notes": "Feeling tired a lot lately"
}
```

`condition` must be one of: `diabetes`, `heart_disease`, `hypertension`.

Response:

```json
{
  "condition": "diabetes",
  "riskScore": 98,
  "riskLevel": "high",
  "explanation": "Plain-language paragraph from the LLM...",
  "factors": [
    { "name": "Reported symptoms", "note": "Strong contributor" },
    { "name": "Body mass index (BMI)", "note": "Strong contributor" }
  ]
}
```

## Connecting the frontend

In `js/api.js` (frontend folder), `API_BASE_URL` already points to
`http://localhost:5000/api` for local development. When you deploy the backend
(Render, Railway, etc.), update that URL to your live backend address, and set
`ALLOWED_ORIGIN` in `.env` to your deployed frontend's URL so CORS allows it.

## Next steps for a real ML model

1. Get a dataset (Kaggle: Pima Indians Diabetes, UCI Heart Disease).
2. Train a model in Python with scikit-learn.
3. Either run a small Flask/FastAPI microservice and call it from `riskModel.js`,
   or export to ONNX and run it in Node with `onnxruntime-node`.
