import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema(
  {
    document_id: { type: String, default: "" },
    filename: { type: String, default: "Unknown document" },
    chunk_index: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: {
      type: [sourceSchema],
      default: [],
    },
    model: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New conversation",
      maxlength: 120,
    },
    selectedDocumentIds: {
      type: [String],
      default: [],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, updatedAt: -1 });

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema
);

export default Conversation;
