import { FaGraduationCap, FaRobot, FaBookOpen, FaChartLine } from "react-icons/fa";
import { AiFillCloud } from "react-icons/ai";
import "../styles/HeroSection.css";

function HeroSection() {
  return (
    <section className="signup-hero" aria-labelledby="auth-introduction">
      <div className="signup-brand">
        <div className="signup-brand-icon" aria-hidden="true">
          <FaGraduationCap />
        </div>
        <h2>EDUNOVA</h2>
      </div>

      <h1 id="auth-introduction">
        Your <span>AI</span><br />
        Learning Companion
      </h1>

      <p>
        Enhance your learning experience with AI-powered assistance, interactive courses, quizzes, and intelligent learning insights.
      </p>

      <ul className="signup-features" aria-label="Learning features">
        <li className="signup-feature-card">
          <FaRobot aria-hidden="true" />
          <h3>AI Tutor</h3>
        </li>
        <li className="signup-feature-card">
          <FaBookOpen aria-hidden="true" />
          <h3>Interactive Courses</h3>
        </li>
        <li className="signup-feature-card">
          <FaChartLine aria-hidden="true" />
          <h3>Learning Insights</h3>
        </li>
      </ul>

      <div className="signup-hero-icon" aria-hidden="true">
        <AiFillCloud />
      </div>
    </section>
  );
}

export default HeroSection;
