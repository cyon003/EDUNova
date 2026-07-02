import { Link } from "react-router-dom";
import "../styles/Home.css";

function Home() {
  return (
    <div className="home-page">
      <nav className="home-navbar">
        <h2>EDUNOVA</h2>

        <div className="home-nav-links">
          <a href="#">Courses</a>
          <a href="#">Features</a>
          <a href="#">About</a>
          <Link to="/auth" className="login-link">Login</Link>
          <Link to="/auth" className="signup-link">Sign Up</Link>
        </div>
      </nav>

      <section className="home-hero">
        <div className="home-content">
          <h1>
            Learn Smarter
            <br />
            With EDUNOVA
          </h1>

          <p>
            An AI-powered online learning platform that helps students learn,
            practice, and improve faster.
          </p>

          <div className="home-buttons">
            <Link to="/auth" className="primary-btn">
              Get Started
            </Link>

            <Link to="/auth" className="secondary-btn">
              Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;