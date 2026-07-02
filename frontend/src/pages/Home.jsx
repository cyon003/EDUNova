import "../styles/Home.css";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav-logo">
          <span className="edu">EDU</span>
          <span className="nova">NOVA</span>
        </div>

        <div className="home-nav-links">
          <a href="#explore">Explore</a>
          <a href="#how">How It Works</a>
        </div>

        <div className="home-nav-cta">
          <Link to="/auth" className="btn-ghost">Log In</Link>
          <Link to="/auth" className="btn-primary">Get Started</Link>
        </div>
      </nav>

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
            <Link to="/auth" className="btn-primary btn-large">
              Start Learning Free
            </Link>
            <a href="#explore" className="btn-ghost btn-large">
              Explore Platform
            </a>
          </div>
        </div>
      </section>

      <section className="bento" id="explore">
        <div className="bento-cell cell-tutor">
          <div className="cell-label">AI Tutor</div>
          <h3>Ask anything. Get answers that actually teach.</h3>
          <p>Real-time explanations tuned to your pace, not a script.</p>
        </div>

        <div className="bento-cell cell-progress">
          <div className="cell-label">Mastery</div>
          <h3>Track every step forward</h3>
        </div>

        <div className="bento-cell cell-courses">
          <div className="cell-label">Smart Paths</div>
          <h3>200+ courses, one path built for you</h3>
          <p>EDUNova maps your strengths and gaps, then adapts as you grow.</p>
        </div>
      </section>

      <section className="how" id="how">
        <div className="section-header">
          <div className="section-eyebrow">Get Started in Minutes</div>
          <h2 className="section-title">Three steps to smarter learning</h2>
        </div>
      </section>

      <section className="cta-banner">
        <h2 className="cta-title">Ready to start learning?</h2>
        <p className="cta-sub">Join learners already growing with EDUNova.</p>
        <Link to="/auth" className="btn-primary btn-large">
          Create Free Account
        </Link>
      </section>

      <footer className="home-footer">
        <div className="footer-logo">
          <span className="edu">EDU</span>
          <span className="nova">NOVA</span>
        </div>
        <p className="footer-copy">© 2026 EDUNova. Empowering every learner with AI.</p>
      </footer>
    </div>
  );
}

export default Home;