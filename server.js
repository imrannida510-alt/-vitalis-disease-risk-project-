require("dotenv").config();
const express = require("express");
const cors = require("cors");
const predictRoute = require("./routes/predict");

const app = express();
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "vitalis-backend" });
});

app.use("/api", predictRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Vitalis backend running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "⚠️  ANTHROPIC_API_KEY not set — explanations will use a fallback template. See .env.example."
    );
  }
});
