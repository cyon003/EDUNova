import { FaGraduationCap } from "react-icons/fa";
import "../styles/HeroSection.css";
function HeroSection() {
  return (
    <div className="signup-hero">
      <div className="signup-brand">
        <div className="signup-brand-icon">
          <FaGraduationCap />
        </div>
        <h2>EDUNOVA</h2>
      </div>

      <h1>
        Your AI
        <br />
        Learning
        <br />
        Companion
      </h1>

      <p>
        Learn smarter with personalized AI guidance, interactive courses,
        quizzes, and real-time feedback.
      </p>

      <div className="signup-stats">
        <div className="signup-stat-card">
          <h3>15K+</h3>
          <span>Learners</span>
        </div>

        <div className="signup-stat-card">
          <h3>600+</h3>
          <span>Courses</span>
        </div>

        <div className="signup-stat-card">
          <h3>95%</h3>
          <span>Success Rate</span>
        </div>
      </div>
    </div>
  );
}

export default HeroSection;