import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function AuthCard() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [message, setMessage] = useState("");

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

  const changeMode = () => {
    setIsLogin(!isLogin);
    setMessage("");
    setFormData({
      name: "",
      email: "",
      password: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

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
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage(data.message);

      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setMessage("Backend server is not running");
    }
  };

  return (
    <div className={`signup-card ${isLogin ? "login-mode" : "signup-mode"}`}>
      <div className="signup-header">
        <h2>{isLogin ? "Log In" : "Sign Up"}</h2>
      </div>

      <div className="signup-form">
        <form onSubmit={handleSubmit}>
          <div className="form-content">
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
                  required
                />

                <span
                  className="eye-icon"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            {message && <p className="auth-message">{message}</p>}

            <div className="signup-btn-container">
              <button type="submit">
                {isLogin ? "Log In" : "Sign Up"}
              </button>
            </div>

            <p className="signup-login-link">
              {isLogin ? "Don't have an account?" : "Already have an account?"}

              <span onClick={changeMode}>
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