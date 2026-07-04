import "../styles/Home.css";
import { Link } from "react-router-dom";
import { FaGraduationCap } from "react-icons/fa";
import {
  FaSearch,
  FaLaptopCode,
  FaPaintBrush,
  FaRobot,
  FaShieldAlt,
  FaChartLine,
  FaBolt,
} from "react-icons/fa";

function Home() {
  return (
    <div className="home">
      <div className="home-content">
        <nav className="home-nav">
          <div className="logo">
            <div className="home-brand-icon">
              <FaGraduationCap />
            </div>
            <h2 className="home-brand">EDUNOVA</h2>
          </div>

          <div className="home-nav-center">
            <a href="#">Home</a>
            <a href="#">Courses</a>
            <a href="#">Features</a>
            <a href="#">Battle</a>
            <a href="#">About</a>
          </div>

          <div className="home-nav-links">
            <Link to="/auth" className="signup-link">
              Sign Up
            </Link>
          </div>
        </nav>

        <section className="hero">
          <h1>
            Learn Without <span>Limits.</span>
          </h1>

          <p>
            Interactive online learning platform with AI assistance,
            real-world projects and exciting Knowledge Battles.
          </p>

          <div className="search-box">
            <input type="text" placeholder="Search for courses..." />
            <button>
              <FaSearch />
            </button>
          </div>
        </section>

        <section className="courses">
          <h2>Popular Courses</h2>

          <div className="course-grid">
            <div className="card">
              <FaLaptopCode />
              <h3>Web Development</h3>
            </div>

            <div className="card">
              <FaPaintBrush />
              <h3>UI / UX Design</h3>
            </div>

            <div className="card">
              <FaRobot />
              <h3>Artificial Intelligence</h3>
            </div>

            <div className="card">
              <FaShieldAlt />
              <h3>Cyber Security</h3>
            </div>

            <div className="card">
              <FaChartLine />
              <h3>Business</h3>
            </div>

            <div className="card">
              <FaBolt />
              <h3>Data Science</h3>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;