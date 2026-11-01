import { useEffect, useState } from "react";
import "./App.css";
import DocumentUpload from "./components/DocumentUpload";
import QuestionAnswer from "./components/QuestionAnswer";
import Auth from "./components/Auth.jsx";
import LandingPage from "./components/LandingPage.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [aiStatus, setAiStatus] = useState("Not checked");
  const [checking, setChecking] = useState(false);

  const [token, setToken] = useState(
    () => localStorage.getItem("brainbox_token") || ""
  );
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem("brainbox_token");
          if (!cancelled) {
            setToken("");
            setUser(null);
          }
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data.user || null);
        }
      } catch (error) {
        console.error("Session verification failed:", error);
        // Keep the token so a temporary network failure doesn't log the user out.
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    setAuthLoading(true);
    verifySession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleAuthenticated(authenticatedUser, jwtToken) {
    localStorage.setItem("brainbox_token", jwtToken);
    setUser(authenticatedUser);
    setToken(jwtToken);
    setAuthLoading(false);
  }

  function handleLogout() {
  localStorage.removeItem("brainbox_token");
  setToken("");
  setUser(null);
  setShowAuth(false); // Return to landing page
  setAuthLoading(false);
}

  async function checkHealth() {
    setChecking(true);

    const checks = [
      {
        url: `${API_BASE_URL}/health`,
        update: setBackendStatus,
      },
      {
  url: "https://brainbox-ai-service.onrender.com/health",
  update: setAiStatus,
},
    ];

    try {
      await Promise.all(
        checks.map(async ({ url, update }) => {
          try {
            const response = await fetch(url);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const isOnline = ["ok", "online", "healthy"].includes(
              String(data.status).toLowerCase()
            );

            update(isOnline ? "Online" : "Unavailable");
          } catch (error) {
            console.error(`Health check failed for ${url}:`, error);
            update("Offline");
          }
        })
      );
    } finally {
      setChecking(false);
    }
  }

  if (authLoading) {
    return (
      <main className="auth-page">
        <div className="auth-loading">
          <span className="auth-brand-icon">B</span>
          <p>Loading your BrainBox AI workspace...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return showAuth ? (
      <Auth onAuthenticated={handleAuthenticated} />
    ) : (
      <LandingPage onGetStarted={() => setShowAuth(true)} />
    );
  }

  return (
    <main className="app">
      <nav className="navbar">
        <a href="/" className="brand">
          <span className="brand-icon">B</span>
          BrainBox<span className="brand-ai">AI</span>
        </a>

        <div className="navbar-user">
          <span className="navbar-greeting">Hi, {user.name}</span>
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="pulse" />
          YOUR PERSONAL KNOWLEDGE ASSISTANT
        </div>

        <h1>
          Your knowledge,
          <br />
          <span>one question away.</span>
        </h1>

        <p>
          Upload documents, ask questions, and discover insights
          with an AI assistant grounded in your own knowledge.
        </p>

        <button className="primary-button" onClick={checkHealth}>
          {checking ? "Checking services..." : "Check system health"}
          <span>↗</span>
        </button>
      </section>

      <section className="services">
        <div className="section-heading">
          <div>
            <span className="overline">DEVELOPMENT ENVIRONMENT</span>
            <h2>System status</h2>
          </div>
          <span className="local-badge">Local setup</span>
        </div>

        <div className="service-grid">
          <ServiceCard
            icon="◈"
            title="React Frontend"
            description="User interface and dashboard"
            address="localhost:5173"
            status="Online"
          />

          <ServiceCard
            icon="⌘"
            title="Express Backend"
            description="REST API and application logic"
            address="localhost:5000"
            status={backendStatus}
          />

          <ServiceCard
            icon="✳"
            title="Python AI Service"
            description="Foundation for RAG and AI"
            address="localhost:8000"
            status={aiStatus}
          />
        </div>
      </section>

      <section className="documents-section">
        <div className="section-heading">
          <div>
            <span className="overline">YOUR KNOWLEDGE BASE</span>
            <h2>Upload Documents</h2>
            <p>
              Upload your files to build your personal AI knowledge base.
            </p>
          </div>
        </div>

        <DocumentUpload />
      </section>

      <QuestionAnswer />

      <footer>
        <span>BrainBox AI · Built for your knowledge</span>
        <span>React · Express · FastAPI</span>
      </footer>
    </main>
  );
}

function ServiceCard({ icon, title, description, address, status }) {
  const online = status === "Online";

  return (
    <article className="service-card">
      <div className="card-top">
        <span className="service-icon">{icon}</span>
        <span className={`service-status ${online ? "online" : ""}`}>
          <span className="status-dot" />
          {status}
        </span>
      </div>

      <h3>{title}</h3>
      <p>{description}</p>
      <div className="service-address">{address}</div>
    </article>
  );
}

export default App;
