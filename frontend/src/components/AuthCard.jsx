import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function AuthCard() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(false);

  return (
    <div className={`signup-card ${isLogin ? "login-mode" : "signup-mode"}`}>
      <div className="signup-header">
        <h2>{isLogin ? "Log In" : "Sign Up"}</h2>
      </div>

      <div className="signup-form">
        <form>
          <div className="form-content" key={isLogin ? "login" : "signup"}>
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter username"
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
                placeholder="email"
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
                  placeholder="password"
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

            <div className="signup-btn-container">
              <button type="submit">
                {isLogin ? "Log In" : "Sign Up"}
              </button>
            </div>

            <p className="signup-login-link">
              {isLogin ? "Don't have an account?" : "Already have an account?"}

              <span onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? "Sign Up" : "Login"}
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthCard;