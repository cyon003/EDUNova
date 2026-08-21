import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function saveLogin(user, token) {
  if (!user || !token) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return false;
  }

  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("token", token);

  return true;
}

function AuthCard() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const API_URL = "http://localhost:5050/api/auth";

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const changeMode = (loginMode) => {
    setIsLogin(loginMode);
    setMessage("");
    setShowPassword(false);

    setFormData({
      name: "",
      email: "",
      password: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    const url = isLogin
      ? `${API_URL}/login`
      : `${API_URL}/signup`;

    const bodyData = isLogin
      ? {
          email: formData.email,
          password: formData.password,
        }
      : {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        };

    try {
      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Something went wrong");
        setLoading(false);
        return;
      }

      if (!isLogin) {
        setMessage(data.message);
        setLoading(false);

        setFormData({
          name: "",
          email: "",
          password: "",
        });

        return;
      }

      const saved = saveLogin(data.user, data.token);

      if (!saved) {
        setMessage(
          "Login succeeded, but user information was not returned."
        );

        setLoading(false);
        return;
      }

      setMessage(data.message);

      const nextPath = new URLSearchParams(window.location.search).get("next");
      const roleLanding = data.user.role === "admin"
        ? "/admin-dashboard"
        : data.user.role === "tutor"
          ? "/tutor-dashboard"
          : "/home";
      window.location.href = nextPath?.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : roleLanding;
    } catch (error) {
      console.error(error);
      setMessage("Backend server is not running");
      setLoading(false);
    }
  };

  return (
    <div
      className={`signup-card ${
        isLogin ? "login-mode" : "signup-mode"
      }`}
    >
      <div className="signup-tabs">
        <button
          type="button"
          className={!isLogin ? "tab active" : "tab"}
          onClick={() => changeMode(false)}
        >
          Sign Up
        </button>

        <button
          type="button"
          className={isLogin ? "tab active" : "tab"}
          onClick={() => changeMode(true)}
        >
          Log In
        </button>

        <span
          className={`tab-indicator ${
            isLogin ? "right" : "left"
          }`}
        />
      </div>

      <div className="signup-header">
        <h2>
          {isLogin
            ? "Welcome back"
            : "Create your account"}
        </h2>
      </div>

      <div className="signup-form">
        <form onSubmit={handleSubmit}>
          <div
            className="form-content"
            key={isLogin ? "login" : "signup"}
          >
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="name">Username</label>

                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Enter username"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>

              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleChange}
                  minLength="6"
                  required
                />

                <span
                  className="eye-icon"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  role="button"
                  tabIndex="0"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <FaEyeSlash />
                  ) : (
                    <FaEye />
                  )}
                </span>
              </div>
            </div>

            {message && (
              <p className="auth-message">{message}</p>
            )}

            <div className="signup-btn-container">
              <button type="submit" disabled={loading}>
                {loading ? (
                  <span className="btn-spinner" />
                ) : isLogin ? (
                  "Log In"
                ) : (
                  "Sign Up"
                )}
              </button>
            </div>

            <p className="signup-login-link">
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}

              <span onClick={() => changeMode(!isLogin)}>
                {isLogin ? " Sign Up" : " Login"}
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthCard;
