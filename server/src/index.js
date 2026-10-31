
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./db.js";
import uploadRouter from "./routes/upload.js";
import questionsRouter from "./routes/questions.js";
import conversationsRouter from "./routes/conversations.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "BrainBox AI API",
    message: "Backend is running!",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "brainbox-backend",
    timestamp: new Date().toISOString(),
  });
});

// Document upload and listing
app.use("/api/documents", uploadRouter);

// RAG questions and answers
app.use("/api/questions", questionsRouter);

// Saved conversation history
app.use("/api/conversations", conversationsRouter);

app.use("/api/auth", authRouter);

// Start the server after MongoDB connects
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Backend running at http://localhost:${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });
