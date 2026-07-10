import "../styles/Home.css";
import { Link } from "react-router-dom";
import { FaGraduationCap } from "react-icons/fa";
import { FaCalculator } from "react-icons/fa";
import {
  FaSearch,
  FaLaptopCode,
  FaPaintBrush,
  FaRobot,
  FaShieldAlt,
  FaChartLine,
  FaBolt,
  FaArrowRight,
  FaStar,
} from "react-icons/fa";

const courses = [
  {
    icon: <FaLaptopCode />,
    title: "Web Development",
    desc: "Build modern, responsive apps from scratch.",
    tag: "Bestseller",
  },
  {
    icon: <FaPaintBrush />,
    title: "UI / UX Design",
    desc: "Craft interfaces people actually love to use.",
  },
  {
    icon: <FaRobot />,
    title: "Artificial Intelligence",
    desc: "Train models and build intelligent systems.",
    tag: "Trending",
  },
  {
    icon: <FaShieldAlt />,
    title: "Cyber Security",
    desc: "Defend systems against real-world threats.",
  },
  {
    icon: <FaChartLine />,
    title: "Business",
    desc: "Strategy, growth and leadership essentials.",
  },
  {
    icon: <FaBolt />,
    title: "Data Science",
    desc: "Turn raw data into decisions that matter.",
  },
  {
    icon: <FaCalculator />,
    title: "Financial Management",
    desc: "Master budgeting, investing and analysis.",
  },
];

function Home() {
  return (
    <div className="home">
      <div className="home-glow home-glow-1" />
      <div className="home-glow home-glow-2" />

      <div className="home-content">
        <nav className="home-nav">
          <div className="logo">
            <div className="home-brand-icon">
              <FaGraduationCap />
            </div>
            <h2 className="home-brand">EDUNOVA</h2>
          </div>

          <div className="home-nav-center">
            <a href="#" className="active">
              Home
            </a>
            <a href="#">Courses</a>
            <a href="#">Categories</a>
            <a href="#">AI Chatbot</a>
            <a href="#">Ranking</a>
            <a href="#">About</a>
          </div>

          <div className="home-nav-links">
            <Link to="/auth" className="signup-link">
              Get Started
            </Link>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-badge">
            <FaStar />
            <span>Rated 4.9 by 12,000+ learners</span>
          </div>

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

          <div className="hero-tags">
            <span>Popular:</span>
            <a href="#">React</a>
            <a href="#">Python</a>
            <a href="#">AI Agents</a>
            <a href="#">UI/UX</a>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <h3>120K+</h3>
              <p>Active Students</p>
            </div>
            <div className="stat">
              <h3>340+</h3>
              <p>Expert Courses</p>
            </div>
            <div className="stat">
              <h3>98%</h3>
              <p>Success Rate</p>
            </div>
          </div>
        </section>

        <section className="courses">
          <div className="courses-head">
            <span className="eyebrow">Explore</span>
            <h2>Popular Courses</h2>
            <p>Hand-picked paths trusted by thousands of learners.</p>
          </div>

          <div className="course-grid">
            {courses.map((course, i) => (
              <div
                className="card"
                key={course.title}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {course.tag && <span className="card-tag">{course.tag}</span>}
                <div className="card-icon">{course.icon}</div>
                <h3>{course.title}</h3>
                <p>{course.desc}</p>
                <div className="card-link">
                  <span>Explore course</span>
                  <FaArrowRight />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;