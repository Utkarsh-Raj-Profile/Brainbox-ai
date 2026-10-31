import express from "express";
import mongoose from "mongoose";
import Document from "../models/Document.js";
import Conversation from "../models/Conversation.js";
import requireAuth from "../middleware/authMiddleware.js";

const router = express.Router();

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      question,
      document_ids,
      conversationId,
      top_k = 4,
    } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        message: "Please provide a question.",
      });
    }

    const cleanQuestion = question.trim();

    if (cleanQuestion.length > 5000) {
      return res.status(400).json({
        message: "Question must be 5000 characters or fewer.",
      });
    }

    const parsedTopK = Number(top_k);

    if (
      !Number.isInteger(parsedTopK) ||
      parsedTopK < 1 ||
      parsedTopK > 10
    ) {
      return res.status(400).json({
        message: "top_k must be between 1 and 10.",
      });
    }

    // Validate selected document IDs.
    let selectedIds;

    if (document_ids !== undefined) {
      if (
        !Array.isArray(document_ids) ||
        !document_ids.every(
          (id) =>
            typeof id === "string" &&
            mongoose.isValidObjectId(id)
        )
      ) {
        return res.status(400).json({
          message: "document_ids must contain valid document IDs.",
        });
      }

      selectedIds = [...new Set(document_ids)];

      if (selectedIds.length === 0) {
        return res.status(400).json({
          message:
            "Select at least one document, or choose all documents.",
        });
      }

      const ownedDocuments = await Document.find({
        _id: { $in: selectedIds },
        user: req.user.id,
        status: "processed",
      })
        .select("_id")
        .lean();

      if (ownedDocuments.length !== selectedIds.length) {
        return res.status(400).json({
          message: "One or more selected documents are unavailable.",
        });
      }
    }

    // Verify that an existing conversation belongs to this user.
    let conversation = null;

    if (conversationId !== undefined && conversationId !== null) {
      if (
        typeof conversationId !== "string" ||
        !mongoose.isValidObjectId(conversationId)
      ) {
        return res.status(400).json({
          message: "Invalid conversation ID.",
        });
      }

      conversation = await Conversation.findOne({
        _id: conversationId,
        user: req.user.id,
      });

      if (!conversation) {
        return res.status(404).json({
          message: "Conversation not found.",
        });
      }
    }

    // Search only documents owned by the authenticated user.
    const userDocuments = await Document.find({
      user: req.user.id,
      status: "processed",
      ...(selectedIds ? { _id: { $in: selectedIds } } : {}),
    })
      .select("_id")
      .lean();

    const allowedDocumentIds = userDocuments.map((doc) =>
      doc._id.toString()
    );
    
// Never query the shared AI index when this user has no documents.
if (allowedDocumentIds.length === 0) {
  return res.json({
    answer:
      "You haven't uploaded any documents yet. Upload a PDF or TXT file to start asking questions about your knowledge base.",
    sources: [],
    model: "",
    conversationId: null,
  });
}

    const aiResponse = await fetch(`${AI_SERVICE_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: cleanQuestion,
        document_ids: allowedDocumentIds,
        top_k: parsedTopK,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const responseText = await aiResponse.text();

    let data;

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { detail: responseText };
    }

    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json({
        message:
          data.detail ||
          data.message ||
          "The AI service could not answer your question.",
      });
    }

    const answer =
      typeof data.answer === "string" ? data.answer : "";

    if (!answer) {
      return res.status(502).json({
        message: "The AI service returned an empty answer.",
      });
    }

    const sources = Array.isArray(data.sources)
      ? data.sources.map((source) => ({
          document_id: String(source.document_id || ""),
          filename: String(source.filename || "Unknown document"),
          chunk_index: Number(source.chunk_index || 0),
          score: Number(source.score || 0),
          text: String(source.text || ""),
        }))
      : [];

    // Create the conversation with its authenticated owner.
    if (!conversation) {
      conversation = new Conversation({
        user: req.user.id,
        title:
          cleanQuestion.length > 80
            ? `${cleanQuestion.slice(0, 77)}...`
            : cleanQuestion,
        selectedDocumentIds: selectedIds || [],
        messages: [],
      });
    } else {
      conversation.selectedDocumentIds = selectedIds || [];
    }

    conversation.messages.push(
      {
        role: "user",
        content: cleanQuestion,
      },
      {
        role: "assistant",
        content: answer,
        sources,
        model: data.model || "",
      }
    );

    await conversation.save();

    return res.json({
      conversationId: conversation._id.toString(),
      answer,
      sources,
      model: data.model || "",
    });
  } catch (error) {
    console.error("Question endpoint failed:", error);

    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return res.status(504).json({
        message: "The AI service took too long to respond.",
      });
    }

    return res.status(500).json({
      message: "Could not process the question.",
    });
  }
});

export default router;
