
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./QuestionAnswer.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = `${
  import.meta.env.VITE_API_URL || "http://localhost:5000"
}/api`;

// Add the login JWT to every protected Express API request.
function authConfig(extra = {}) {
  const token = localStorage.getItem("brainbox_token");
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

function cleanInlineSources(content = "") {
  // Sources are shown in the structured Sources panel below each answer.
  // Remove inline markers like [Source: notes.pdf, Chunk: 0] from the prose.
  return content
    .replace(/\\s*\\[Source:\\s*[^\\]]+\\]/gi, "")
    .replace(/[ \\t]{2,}/g, " ")
    .replace(/ +([,.;])/g, "$1")
    .trim();
}

function groupSources(sources = []) {
  const documents = new Map();

  for (const source of sources) {
    const filename = source.filename || "Unknown document";
    // Include document_id so separate uploads with the same filename stay separate.
    const documentId = source.document_id || filename;
    const documentKey = `${documentId}::${filename}`;

    if (!documents.has(documentKey)) {
      documents.set(documentKey, {
        documentId,
        filename,
        chunks: new Map(),
      });
    }

    const group = documents.get(documentKey);
    const chunkKey = `${source.chunk_index ?? "unknown"}`;

    // Keep one copy of each chunk, preferring the highest relevance score.
    const existing = group.chunks.get(chunkKey);
    if (!existing || Number(source.score || 0) > Number(existing.score || 0)) {
      group.chunks.set(chunkKey, source);
    }
  }

  return Array.from(documents.values())
    .map(({ documentId, filename, chunks }) => ({
      documentId,
      filename,
      chunks: Array.from(chunks.values()).sort(
        (a, b) => Number(b.score || 0) - Number(a.score || 0)
      ),
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export default function QuestionAnswer() {
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [allDocuments, setAllDocuments] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/documents`, authConfig());
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error("Could not load documents:", err);
      setError("Could not load your document list. Check the Express server.");
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/conversations`, authConfig());
      setConversations(response.data.conversations || []);
    } catch (err) {
      console.error("Could not load conversation history:", err);
      setError("Could not load conversation history.");
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadConversations();
  }, [loadDocuments, loadConversations]);

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setAllDocuments(true);
    setSelectedIds([]);
    setError("");
  }

  async function openConversation(id) {
    setLoadingHistory(true);
    setError("");

    try {
      const response = await axios.get(`${API}/conversations/${id}`, authConfig());
      const conversation = response.data.conversation;

      setConversationId(conversation._id);
      setMessages(conversation.messages || []);
      setQuestion("");

      const savedIds = conversation.selectedDocumentIds || [];
      setAllDocuments(savedIds.length === 0);
      setSelectedIds(savedIds);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not open this conversation."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function deleteConversation(id, title) {
    const confirmed = window.confirm(
      `Delete "${title || "this conversation"}"? This action cannot be undone.`
    );
    if (!confirmed || deletingConversationId) return;

    setDeletingConversationId(id);
    setError("");

    try {
      await axios.delete(`${API}/conversations/${id}`, authConfig());
      setConversations((current) => current.filter((item) => item._id !== id));

      // If the deleted conversation is open, return to a clean new chat.
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
        setQuestion("");
        setAllDocuments(true);
        setSelectedIds([]);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not delete this conversation."
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

  function toggleDocument(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function handleAsk(event) {
    event.preventDefault();

    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    if (!allDocuments && selectedIds.length === 0) {
      setError("Select at least one document or choose all documents.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        question: cleanQuestion,
        top_k: 4,
        ...(conversationId ? { conversationId } : {}),
        ...(!allDocuments ? { document_ids: selectedIds } : {}),
      };

      const response = await axios.post(`${API}/questions`, payload, authConfig({ timeout: 125000 }));

      const data = response.data;

      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        { role: "user", content: cleanQuestion },
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
          model: data.model || "",
        },
      ]);
      setQuestion("");

      await loadConversations();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "Unable to get an answer. Check that Express and FastAPI are running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="brainbox-chat">
      <header className="chat-header">
        <div>
          <span className="overline">YOUR PERSONAL KNOWLEDGE ASSISTANT</span>
          <h2>Chat with your documents</h2>
          <p>Ask questions and get answers grounded in your files.</p>
        </div>
        <button className="chat-secondary-button" onClick={startNewChat}>
          + New chat
        </button>
      </header>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="sidebar-title">
            <h3>Recent conversations</h3>
            <button
              type="button"
              className="text-button"
              onClick={loadConversations}
            >
              Refresh
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="chat-muted">Your saved chats will appear here.</p>
          ) : (
            <div className="conversation-list">
              {conversations.map((item) => (
                <div
                  key={item._id}
                  className={`conversation-item conversation-item-with-delete ${
                    conversationId === item._id ? "active" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="conversation-open-button"
                    onClick={() => openConversation(item._id)}
                    disabled={loading || loadingHistory || Boolean(deletingConversationId)}
                  >
                    <span>{item.title}</span>
                    <small>{item.messageCount} messages</small>
                  </button>
                  <button
                    type="button"
                    className="conversation-delete-icon"
                    onClick={() => deleteConversation(item._id, item.title)}
                    disabled={Boolean(deletingConversationId)}
                    aria-label={`Delete conversation ${item.title}`}
                    title={deletingConversationId === item._id ? "Deleting conversation" : "Delete conversation"}
                  >
                    {deletingConversationId === item._id ? (
                      <span className="delete-spinner" aria-hidden="true" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="m19 6-1 14H6L5 6" />
                        <path d="M10 11v5M14 11v5" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="chat-main">
          <details className="document-picker" open>
            <summary>
              Choose documents
              <span>
                {allDocuments
                  ? "All processed documents"
                  : `${selectedIds.length} selected`}
              </span>
            </summary>

            <label className="document-option">
              <input
                type="checkbox"
                checked={allDocuments}
                onChange={(event) => {
                  setAllDocuments(event.target.checked);
                  setError("");
                }}
              />
              <span>
                <strong>Search all documents</strong>
                <small>Include every processed document in your knowledge base</small>
              </span>
            </label>

            {!allDocuments && (
              <div className="document-options">
                {documents.length === 0 ? (
                  <p className="chat-muted">No processed documents found.</p>
                ) : (
                  documents.map((doc) => (
                    <label className="document-option" key={doc._id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc._id)}
                        onChange={() => toggleDocument(doc._id)}
                      />
                      <span>
                        <strong>{doc.originalName}</strong>
                        <small>
                          {doc.mimeType} · {Math.max(1, Math.round(doc.size / 1024))} KB
                        </small>
                      </span>
                    </label>
                  ))
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={loadDocuments}
                >
                  Refresh document list
                </button>
              </div>
            )}

            {allDocuments && (
              <button
                type="button"
                className="text-button"
                onClick={loadDocuments}
              >
                Refresh document list
              </button>
            )}

            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAllDocuments(false);
                setSelectedIds(documents.map((doc) => doc._id));
              }}
              disabled={documents.length === 0}
            >
              Select all listed documents
            </button>
          </details>

          <div className="chat-transcript" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-empty">
                <div className="chat-empty-icon">✳</div>
                <h3>What would you like to know?</h3>
                <p>
                  Ask a question about your uploaded notes, PDFs, or text files.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <article
                key={`${conversationId || "new"}-${index}`}
                className={`chat-message ${message.role}`}
              >
                <div className="message-avatar">
                  {message.role === "user" ? "You" : "AI"}
                </div>

                <div className="message-content">
                  <div className="message-label">
                    {message.role === "user" ? "You" : "BrainBox AI"}
                  </div>
                  <div className="message-text markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.role === "assistant"
                        ? cleanInlineSources(message.content)
                        : message.content}
                    </ReactMarkdown>
                  </div>

                  {message.role === "assistant" &&
                    message.sources?.length > 0 && (
                      <div className="source-panel">
                        <h4>
                          Sources
                          <span>
                            {groupSources(message.sources).length}{" "}
                            {groupSources(message.sources).length === 1
                              ? "document"
                              : "documents"}
                          </span>
                        </h4>

                        {groupSources(message.sources).map((group) => (
                          <section
                            className="source-document"
                            key={`${group.documentId}::${group.filename}`}
                          >
                            <div className="source-document-title">
                              <span className="source-file-icon">PDF</span>
                              <strong>{group.filename}</strong>
                              <span className="source-count">
                                {group.chunks.length}{" "}
                                {group.chunks.length === 1 ? "passage" : "passages"}
                              </span>
                            </div>

                            {group.chunks.map((source, sourceIndex) => (
                              <details
                                className="source-passage"
                                key={`${source.document_id}-${source.chunk_index}-${sourceIndex}`}
                              >
                                <summary>
                                  <span>Chunk {source.chunk_index}</span>
                                  <span>
                                    Relevance{" "}
                                    {Number(source.score || 0).toFixed(3)}
                                  </span>
                                </summary>
                                <p>{source.text}</p>
                              </details>
                            ))}
                          </section>
                        ))}
                      </div>
                    )}
                </div>
              </article>
            ))}

            {loading && (
              <div className="chat-loading" role="status">
                <span className="loading-dot" />
                Searching your documents and generating an answer…
              </div>
            )}
          </div>

          {error && <p className="chat-error" role="alert">{error}</p>}

          <form className="chat-composer" onSubmit={handleAsk}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question about your documents…"
              rows={3}
              maxLength={5000}
              disabled={loading || loadingHistory}
            />
            <div className="composer-footer">
              <span>Answers are based on retrieved document passages.</span>
              <button
                type="submit"
                disabled={loading || loadingHistory || !question.trim()}
              >
                {loading ? "Thinking…" : "Ask BrainBox"}
                <span aria-hidden="true"> ↗</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
