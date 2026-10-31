import { useEffect, useState } from "react";
import "./Auth.css";

const API_URL = "http://localhost:5000/api/auth";

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "signup" && name.trim().length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/${mode === "signup" ? "signup" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(mode === "signup" ? { name: name.trim() } : {}),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (!data.token || !data.user) {
        throw new Error("The server did not return a token and user.");
      }

      localStorage.setItem("brainbox_token", data.token);
      onAuthenticated(data.user, data.token);
    } catch (err) {
      setError(
        err.message || "Unable to connect to BrainBox AI. Check your server."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a href="/" className="auth-brand">
          <span className="auth-brand-icon">B</span>
          BrainBox<span>AI</span>
        </a>

        <div className="auth-heading">
          <div className="auth-eyebrow">
            YOUR PERSONAL KNOWLEDGE ASSISTANT
          </div>

          <h1>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p>
            {mode === "login"
              ? "Sign in to continue learning with your documents."
              : "Create an account to start building your knowledge base."}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>

          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => switchMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <label>
              Full name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
                minLength={2}
                maxLength={80}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>

          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === "signup"
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                minLength={mode === "signup" ? 8 : undefined}
                maxLength={72}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log in to BrainBox"
                : "Create account"}
            {!loading && <span>↗</span>}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login"
            ? "New to BrainBox AI?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() =>
              switchMode(mode === "login" ? "signup" : "login")
            }
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>

        <p className="auth-security">
          Your knowledge workspace starts here.
        </p>
      </section>
    </main>
  );
}
