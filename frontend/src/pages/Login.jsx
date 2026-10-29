import { useState } from "react";
import api from "../api/api";
import "../styles/login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("auth/login/", { username, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user_id", res.data.user_id);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("user_type", res.data.user_type || "");
      localStorage.setItem(
        "must_change_password",
        res.data.must_change_password
      );

      window.location.reload();
    } catch {
      setError("Invalid username or password.");
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand-mark" aria-hidden="true">
          <span className="login-brand-mark__inner" />
        </div>
        <p className="login-eyebrow">D2 PRINT · WORKFLOW SYSTEM</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="login-subtitle">
          Sign in to continue to your workspace.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />

          <button type="submit">Sign in</button>
        </form>

        <p className="login-footer">Printing workflow management</p>
      </section>
    </main>
  );
}

export default Login;
