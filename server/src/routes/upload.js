import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import Document from "../models/Document.js";
import requireAuth from "../middleware/authMiddleware.js";

const router = express.Router();
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error("Only PDF and TXT files are allowed."));
    }
    cb(null, true);
  },
});

function toPublicDocument(document) {
  return {
    _id: document._id,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    status: document.status,
    createdAt: document.createdAt,
  };
}

async function indexDocumentWithAI(document) {
  const response = await fetch(`${AI_SERVICE_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: document._id.toString(),
      filename: document.originalName,
      text: document.extractedText,
    }),
  });

  const responseText = await response.text();
  let result;

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = { detail: responseText };
  }

  if (!response.ok) {
    throw new Error(
      result.detail ||
        result.message ||
        `AI service returned HTTP ${response.status}`
    );
  }

  return result;
}

async function processDocument(file, userId) {
  let document;

  try {
    document = await Document.create({
      user: userId,
      originalName: path.basename(file.originalname),
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      status: "processing",
    });

    const buffer = await fs.promises.readFile(file.path);
    let extractedText = "";

    if (file.mimetype === "application/pdf") {
      const parsed = await pdfParse(buffer);
      extractedText = parsed.text || "";
    } else if (file.mimetype === "text/plain") {
      extractedText = buffer.toString("utf8");
    }

    if (!extractedText.trim()) {
      throw new Error(
        "No readable text found. The PDF may be scanned or empty."
      );
    }

    document.extractedText = extractedText;
    document.status = "processed";
    await document.save();

    try {
      const indexingResult = await indexDocumentWithAI(document);

      console.log(
        `RAG indexed: ${document.originalName}`,
        indexingResult.chunks_added
      );

      return { success: true, document, ragIndexed: true };
    } catch (aiError) {
      console.error(
        `RAG indexing failed for ${document.originalName}:`,
        aiError.message
      );

      return {
        success: true,
        document,
        ragIndexed: false,
        ragError: aiError.message,
      };
    }
  } catch (error) {
    console.error(
      `Failed to process ${file.originalname}:`,
      error.message
    );

    if (document) {
      document.status = "failed";
      await document.save().catch(console.error);
    }

    return {
      success: false,
      originalName: file.originalname,
      message: error.message || "Document processing failed.",
      documentId: document?._id,
    };
  } finally {
    await fs.promises.unlink(file.path).catch(() => {});
  }
}

// GET /api/documents — list only the logged-in user's documents.
router.get("/", requireAuth, async (req, res) => {
  try {
    const documents = await Document.find({
      user: req.user.id,
      status: "processed",
    })
      .select("_id originalName mimeType size status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ documents });
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return res.status(500).json({
      message: "Failed to fetch documents.",
    });
  }
});

// POST /api/documents — upload authenticated PDF/TXT files.
router.post("/", requireAuth, (req, res) => {
  upload.array("documents", 10)(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ message: uploadError.message });
    }

    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({
        message: "Please select at least one PDF or TXT file.",
      });
    }

    try {
      const results = await Promise.all(
        files.map((file) => processDocument(file, req.user.id))
      );

      const successful = results.filter((result) => result.success);
      const failed = results.filter((result) => !result.success);
      const indexed = successful.filter((result) => result.ragIndexed);

      const indexingWarnings = successful
        .filter((result) => !result.ragIndexed)
        .map((result) => ({
          documentId: result.document._id,
          originalName: result.document.originalName,
          message: result.ragError,
        }));

      const statusCode =
        successful.length === files.length
          ? 201
          : successful.length > 0
            ? 207
            : 422;

      return res.status(statusCode).json({
        message:
          failed.length === 0
            ? "All documents uploaded and processed successfully."
            : `${successful.length} document(s) processed; ${failed.length} failed.`,
        total: files.length,
        successful: successful.length,
        failed: failed.length,
        ragIndexed: indexed.length,
        ragIndexingFailed: indexingWarnings.length,
        indexingWarnings,
        documents: successful.map((result) =>
          toPublicDocument(result.document)
        ),
        errors: failed.map((result) => ({
          originalName: result.originalName,
          message: result.message,
          documentId: result.documentId,
        })),
      });
    } catch (error) {
      console.error("Upload request failed:", error);

      await Promise.all(
        files.map((file) =>
          fs.promises.unlink(file.path).catch(() => {})
        )
      );

      return res.status(500).json({
        message: "An unexpected error occurred while processing uploads.",
      });
    }
  });
});


// DELETE /api/documents/:id — delete only a document owned by the logged-in user.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid document ID." });
    }

    const document = await Document.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found." });
    }

    // Remove the document's chunks from the RAG index first.
    // If this fails, retain the MongoDB record and uploaded file.
    const aiResponse = await fetch(
      `${AI_SERVICE_URL}/documents/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    const aiText = await aiResponse.text();
    let aiResult = {};

    try {
      aiResult = aiText ? JSON.parse(aiText) : {};
    } catch {
      aiResult = { detail: aiText };
    }

    if (!aiResponse.ok) {
      return res.status(502).json({
        message:
          aiResult.detail ||
          aiResult.message ||
          "AI index could not be updated. The document was not deleted.",
      });
    }

    await Document.deleteOne({
      _id: id,
      user: req.user.id,
    });

    const storedPath = path.resolve(uploadDir, path.basename(document.storedName));
    const relativePath = path.relative(uploadDir, storedPath);

    // Ensure the resolved file remains inside the uploads directory.
    if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      await fs.promises.unlink(storedPath).catch((error) => {
        if (error.code !== "ENOENT") {
          console.error("Could not remove stored document file:", error);
        }
      });
    }

    return res.status(200).json({
      message: "Document deleted successfully.",
      documentId: id,
      removedChunks: aiResult.removed_chunks ?? 0,
    });
  } catch (error) {
    console.error("Document deletion failed:", error);
    return res.status(500).json({
      message: "An unexpected error occurred while deleting the document.",
    });
  }
});


export default router;
