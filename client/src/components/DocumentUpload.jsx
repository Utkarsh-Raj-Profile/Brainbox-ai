
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./DocumentUpload.css";
import { API_BASE_URL } from "../config";

const API = `${API_BASE_URL}/api`;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function isSupportedFile(file) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".txt")
  );
}

export default function DocumentUpload() {
  const inputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [deletingId, setDeletingId] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("brainbox_token");

    if (!token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  // Fetch only the current user's uploaded documents.
  const fetchDocuments = async () => {
    try {
      setFetching(true);

      const response = await axios.get(`${API}/documents`, {
        headers: getAuthHeaders(),
      });

      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Document fetch error:", error);

      showMessage(
        error.response?.data?.message ||
          error.message ||
          "Could not load your documents.",
        "error"
      );
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Validate and add multiple selected files.
  const addFiles = (fileList) => {
    const incomingFiles = Array.from(fileList || []);

    if (!incomingFiles.length) return;

    const validFiles = [];
    const errors = [];

    incomingFiles.forEach((file) => {
      if (!isSupportedFile(file)) {
        errors.push(`${file.name}: Only PDF and TXT files are allowed.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File exceeds the 10 MB limit.`);
        return;
      }

      validFiles.push(file);
    });

    setSelectedFiles((previous) => {
      const combined = [...previous];

      validFiles.forEach((file) => {
        const duplicate = combined.some(
          (item) => getFileKey(item) === getFileKey(file)
        );

        if (!duplicate && combined.length < MAX_FILES) {
          combined.push(file);
        }
      });

      return combined;
    });

    if (errors.length) {
      showMessage(errors.join(" "), "error");
    } else {
      showMessage("", "");
    }

    if (
      validFiles.length &&
      selectedFiles.length + validFiles.length > MAX_FILES
    ) {
      showMessage(`You can upload a maximum of ${MAX_FILES} files at once.`, "error");
    }
  };

  const handleFileChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const removeSelectedFile = (fileKey) => {
    setSelectedFiles((previous) =>
      previous.filter((file) => getFileKey(file) !== fileKey)
    );
  };

  const deleteDocument = async (document) => {
    const confirmed = window.confirm(
      `Delete "${document.originalName}"? This will remove it from your knowledge base and AI search.`
    );

    if (!confirmed || deletingId) return;

    try {
      setDeletingId(document._id);
      const response = await axios.delete(
        `${API}/documents/${document._id}`,
        { headers: getAuthHeaders() }
      );

      setDocuments((current) =>
        current.filter((item) => item._id !== document._id)
      );

      showMessage(
        response.data.message || "Document deleted successfully.",
        "success"
      );
    } catch (error) {
      console.error("Document deletion error:", error);
      showMessage(
        error.response?.data?.message ||
          "Could not delete this document. Please try again.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocuments = documents
    .filter((document) =>
      document.originalName
        ?.toLowerCase()
        .includes(searchTerm.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === "name-asc") {
        return (a.originalName || "").localeCompare(b.originalName || "");
      }
      if (sortOrder === "name-desc") {
        return (b.originalName || "").localeCompare(a.originalName || "");
      }
      if (sortOrder === "oldest") {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  const uploadDocuments = async () => {
    if (!selectedFiles.length) {
      showMessage("Please select at least one document.", "error");
      return;
    }

    let headers;

    try {
      headers = getAuthHeaders();
    } catch (error) {
      showMessage(error.message, "error");
      return;
    }

    const formData = new FormData();

    selectedFiles.forEach((file) => {
      formData.append("documents", file);
    });

    try {
      setLoading(true);
      setProgress(0);
      showMessage("", "");

      const response = await axios.post(
        `${API}/documents`,
        formData,
        {
          headers,
          onUploadProgress: (event) => {
            if (event.total) {
              setProgress(
                Math.round((event.loaded * 100) / event.total)
              );
            }
          },
        }
      );

      const result = response.data;

      setSelectedFiles([]);
      showMessage(result.message || "Upload completed successfully.");

      if (result.errors?.length) {
        showMessage(
          `${result.message} Failed: ${result.errors
            .map((item) => item.originalName)
            .join(", ")}`,
          "error"
        );
      } else if (result.indexingWarnings?.length) {
        showMessage(
          "Documents were saved, but some could not be indexed for AI search.",
          "error"
        );
      }

      await fetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);

      showMessage(
        error.response?.data?.message ||
          error.message ||
          "Document upload failed.",
        "error"
      );
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const totalSelectedSize = selectedFiles.reduce(
    (total, file) => total + file.size,
    0
  );

  return (
    <section className="document-upload-section">
      <div className="upload-heading">
        <div>
          <span className="section-eyebrow">YOUR KNOWLEDGE BASE</span>
          <h2>Upload Documents</h2>
          <p>
            Add your PDFs and text files to build your personal AI
            knowledge base.
          </p>
        </div>

        <div className="upload-heading-actions">
          <div className="upload-limit">
            <span>{documents.length}</span>
            <small>Uploaded documents</small>
          </div>

          <button
            type="button"
            className={`upload-toggle-button ${
              isExpanded ? "expanded" : "collapsed"
            }`}
            onClick={() => setIsExpanded((previous) => !previous)}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Collapse document upload"
                : "Expand document upload"
            }
            title={isExpanded ? "Collapse section" : "Expand section"}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="upload-collapsible-content">
          {/* File selection area */}
      <div
        className={`upload-dropzone ${dragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          multiple
          hidden
          onChange={handleFileChange}
        />

        <div className="upload-icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h3>Drop your documents here</h3>
        <p>
          or <span>browse files</span> from your computer
        </p>

        <div className="upload-supported">
          PDF and TXT files · Maximum 10 files · 10 MB per file
        </div>
      </div>

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="selected-files-panel">
          <div className="panel-heading">
            <div>
              <h3>Selected documents</h3>
              <p>
                {selectedFiles.length} of {MAX_FILES} files selected
              </p>
            </div>

            <button
              type="button"
              className="clear-files-button"
              onClick={() => setSelectedFiles([])}
              disabled={loading}
            >
              Clear all
            </button>
          </div>

          <div className="selected-files-list">
            {selectedFiles.map((file) => (
              <div className="document-file-card" key={getFileKey(file)}>
                <div className="file-type-icon">
                  {file.name.toLowerCase().endsWith(".pdf")
                    ? "PDF"
                    : "TXT"}
                </div>

                <div className="file-details">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatSize(file.size)}</span>
                </div>

                <button
                  type="button"
                  className="remove-file-button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeSelectedFile(getFileKey(file))}
                  disabled={loading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="upload-footer">
            <div className="upload-summary">
              <strong>{selectedFiles.length} files</strong>
              <span>{formatSize(totalSelectedSize)} total</span>
            </div>

            <button
              type="button"
              className="upload-submit-button"
              onClick={uploadDocuments}
              disabled={loading || selectedFiles.length === 0}
            >
              {loading ? "Uploading..." : "Upload all documents"}
              {!loading && <span>↑</span>}
            </button>
          </div>

          {loading && (
            <div className="upload-progress">
              <div className="progress-label">
                <span>Uploading documents...</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {message && (
        <div className={`upload-message ${messageType}`} role="status">
          <span>{messageType === "error" ? "!" : "✓"}</span>
          {message}
        </div>
      )}

      {/* Uploaded documents library */}
      <div className="uploaded-library">
        <div className="panel-heading">
          <div>
            <h3>Your uploaded documents</h3>
            <p>Documents available in your personal knowledge base</p>
          </div>

          <button
            type="button"
            className="refresh-documents-button"
            onClick={fetchDocuments}
            disabled={fetching}
          >
            {fetching ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        <div className="document-library-toolbar">
          <label className="document-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search documents by filename..."
              aria-label="Search uploaded documents"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear document search"
              >
                ×
              </button>
            )}
          </label>

          <label className="document-sort">
            <span>Sort by</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              aria-label="Sort uploaded documents"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </label>
        </div>

        {fetching ? (
          <div className="library-empty-state">
            Loading your documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="library-empty-state">
            <div className="empty-library-icon">▤</div>
            <strong>No documents uploaded yet</strong>
            <p>
              Select some PDF or TXT files above to get started.
            </p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="library-empty-state">
            <strong>
              {searchTerm ? "No matching documents" : "No documents uploaded yet"}
            </strong>
            <p>
              {searchTerm
                ? "Try another filename or clear your search."
                : "Select some PDF or TXT files above to get started."}
            </p>
          </div>
        ) : (
          <div className="uploaded-documents-list">
            {filteredDocuments.map((document) => (
              <div className="uploaded-document-card" key={document._id}>
                <div className="file-type-icon uploaded">
                  {document.originalName?.toLowerCase().endsWith(".pdf")
                    ? "PDF"
                    : "TXT"}
                </div>

                <div className="file-details">
                  <strong title={document.originalName}>
                    {document.originalName}
                  </strong>
                  <span>
                    {formatSize(document.size || 0)}
                    {document.createdAt
                      ? ` · ${formatDate(document.createdAt)}`
                      : ""}
                  </span>
                </div>

                <span className="document-status">
                  <span className="status-dot" />
                  Processed
                </span>

                <button
                  type="button"
                  className="delete-document-button"
                  onClick={() => deleteDocument(document)}
                  disabled={deletingId === document._id}
                  aria-label={`Delete ${document.originalName}`}
                  title="Delete document"
                >
                  {deletingId === document._id ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="library-count">
          {documents.length} {documents.length === 1 ? "document" : "documents"} in your knowledge base
        </div>
        </div>
        </div>
      )}
    </section>
  );
}
