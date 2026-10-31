import express from "express";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import requireAuth from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/conversations — list only the authenticated user's conversations.
router.get("/", requireAuth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ user: req.user.id })
      .select("title createdAt updatedAt messages")
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    return res.json({
      conversations: conversations.map((item) => ({
        _id: item._id,
        title: item.title,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        messageCount: item.messages?.length || 0,
      })),
    });
  } catch (error) {
    console.error("Failed to load conversations:", error);
    return res.status(500).json({
      message: "Could not load conversation history.",
    });
  }
});

// GET /api/conversations/:id — only the owner may open a conversation.
router.get("/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid conversation ID." });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).lean();

    // Do not reveal whether another user's conversation exists.
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    return res.json({ conversation });
  } catch (error) {
    console.error("Failed to load conversation:", error);
    return res.status(500).json({
      message: "Could not load this conversation.",
    });
  }
});


// DELETE /api/conversations/:id — only the owner may delete a conversation.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid conversation ID." });
    }

    const deletedConversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    // Do not reveal whether another user's conversation exists.
    if (!deletedConversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }

    return res.json({
      message: "Conversation deleted successfully.",
      conversationId: deletedConversation._id,
    });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    return res.status(500).json({
      message: "Could not delete this conversation.",
    });
  }
});

export default router;
