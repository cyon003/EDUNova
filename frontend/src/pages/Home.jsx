import "../styles/Home.css";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="home">

      {/* ── Navbar ── */}
      <nav className="home-nav">
        <div className="home-nav-logo">
          <span className="edu">EDU</span><span className="nova">NOVA</span>
        </div>
        <div className="home-nav-links">
          <a href="#explore">Explore</a>
          <a href="#how">How It Works</a>
        </div>
        <div className="home-nav-cta">
          <Link to="/login" className="btn-ghost">Log In</Link>
          <Link to="/signup" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="dot" />
            AI-Powered Learning Platform
          </div>
          <h1 className="hero-title">
            Empower Every <span className="hero-gradient">Learner</span> with AI
          </h1>
          <p className="hero-sub">
            One platform for personalized courses, real-time AI help, and
            gamified challenges — built around how you actually learn.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn-primary btn-large">Start Learning Free</Link>
            <a href="#explore" className="btn-ghost btn-large">Explore Platform</a>
          </div>
        </div>
      </section>

      {/* ── Bento Grid ── */}
      <section className="bento" id="explore">

        <div className="bento-cell cell-tutor">
          <div className="cell-label">AI Tutor</div>
          <h3>Ask anything. Get answers that actually teach.</h3>
          <p>Real-time explanations tuned to your pace, not a script.</p>
          <div className="tutor-chat">
            <div className="chat-row chat-user">How does photosynthesis work?</div>
            <div className="chat-row chat-ai">Plants convert light into energy using chlorophyll — let's break it down step by step →</div>
          </div>
        </div>

        <div className="bento-cell cell-progress">
          <div className="cell-label">Mastery</div>
          <h3>Track every step forward</h3>
          <div className="ring-wrap">
            <svg viewBox="0 0 100 100" className="ring">
              <circle cx="50" cy="50" r="42" className="ring-track" />
              <circle cx="50" cy="50" r="42" className="ring-fill" />
            </svg>
            <div className="ring-center">
              <span className="ring-pct">74%</span>
              <span className="ring-name">Python Basics</span>
            </div>
          </div>
        </div>

        <div className="bento-cell cell-courses">
          <div className="cell-label">Smart Paths</div>
          <h3>200+ courses, one path built for you</h3>
          <p>EDUNova maps your strengths and gaps, then adapts as you grow.</p>
          <div className="course-pills">
            <span className="pill">Data Science</span>
            <span className="pill">Web Dev</span>
            <span className="pill">UI/UX</span>
            <span className="pill">AI &amp; ML</span>
          </div>
        </div>

        <div className="bento-cell cell-streak">
          <div className="cell-label">Streak</div>
          <div className="streak-number">18</div>
          <p>days in a row</p>
        </div>

        <div className="bento-cell cell-stat">
          <div className="cell-label">Learners</div>
          <div className="stat-number">50K+</div>
          <p>growing every day</p>
        </div>

        <div className="bento-cell cell-quiz">
          <div className="cell-label">Challenges</div>
          <h3>Learn through play</h3>
          <p>Gamified quizzes and leaderboards make studying something you look forward to.</p>
          <div className="quiz-bar">
            <div className="quiz-bar-fill" style={{ width: "60%" }} />
          </div>
          <span className="quiz-bar-label">Quiz streak: 6/10 correct</span>
        </div>

      </section>

      {/* ── How It Works ── */}
      <section className="how" id="how">
        <div className="section-header">
          <div className="section-eyebrow">Get Started in Minutes</div>
          <h2 className="section-title">Three steps to smarter learning</h2>
        </div>

        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <h3>Create your profile</h3>
            <p>Tell EDUNova your goals and current level — the AI builds a picture of you in seconds.</p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h3>Pick your path</h3>
            <p>Browse 200+ courses or let the AI recommend the perfect starting point.</p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h3>Learn and level up</h3>
            <p>Study with AI support, track your mastery, and celebrate every milestone.</p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="cta-banner">
        <h2 className="cta-title">Ready to start learning?</h2>
        <p className="cta-sub">Join 50,000+ learners already growing with EDUNova.</p>
        <Link to="/signup" className="btn-primary btn-large">Create Free Account</Link>
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer">
        <div className="footer-logo">
          <span className="edu">EDU</span><span className="nova">NOVA</span>
        </div>
        <p className="footer-copy">© 2025 EDUNova. Empowering every learner with AI.</p>
      </footer>

    </div>
  );
}

export default Home;
