// import { Link } from "react-router-dom";
// import {
//   FaArrowRight,
//   FaBolt,
//   FaCalculator,
//   FaChartLine,
//   FaGraduationCap,
//   FaLaptopCode,
//   FaPaintBrush,
//   FaRobot,
//   FaSearch,
//   FaShieldAlt,
//   FaStar,
// } from "react-icons/fa";
// import "../styles/Home.css";

// const courses = [
//   { icon: <FaLaptopCode />, title: "Web Development", desc: "Build modern, responsive apps from scratch.", tag: "Bestseller" },
//   { icon: <FaPaintBrush />, title: "UI / UX Design", desc: "Craft interfaces people actually love to use." },
//   { icon: <FaRobot />, title: "Artificial Intelligence", desc: "Train models and build intelligent systems.", tag: "Trending" },
//   { icon: <FaShieldAlt />, title: "Cyber Security", desc: "Defend systems against real-world threats." },
//   { icon: <FaChartLine />, title: "Business", desc: "Strategy, growth and leadership essentials." },
//   { icon: <FaBolt />, title: "Data Science", desc: "Turn raw data into decisions that matter." },
//   { icon: <FaCalculator />, title: "Financial Management", desc: "Master budgeting, investing and analysis." },
// ];

// function Home() {
//   return (
//     <div className="home">
//       <div className="home-glow home-glow-1" />
//       <div className="home-glow home-glow-2" />

//       <div className="home-content">
//         <nav className="home-nav">
//           <Link to="/" className="logo" aria-label="EDUNOVA home">
//             <div className="home-brand-icon"><FaGraduationCap /></div>
//             <h2 className="home-brand">EDUNOVA</h2>
//           </Link>

//           <div className="home-nav-center">
//             <Link to="/" className="active">Home</Link>
//             <Link to="/courses">Courses</Link>
//             <a href="#courses">Categories</a>
//             <a href="#courses">AI Chatbot</a>
//             <a href="#courses">Ranking</a>
//             <a href="#courses">About</a>
//           </div>

//           <div className="home-nav-links">
//             <Link to="/auth" className="signup-link">Get Started</Link>
//           </div>
//         </nav>

//         <section className="hero">
//           <div className="hero-badge"><FaStar /><span>Rated 4.9 by 12,000+ learners</span></div>
//           <h1>Learn Without <span>Limits.</span></h1>
//           <p>One platform for personalized courses, real-time AI help, and gamified challenges — built around how you actually learn.</p>

//           <div className="search-box">
//             <input type="search" aria-label="Search courses" placeholder="Search for courses..." />
//             <button type="button" aria-label="Search"><FaSearch /></button>
//           </div>

//           <div className="hero-tags">
//             <span>Popular:</span><a href="#courses">React</a><a href="#courses">Python</a><a href="#courses">AI Agents</a><a href="#courses">UI/UX</a>
//           </div>

//           <div className="hero-stats">
//             <div className="stat"><h3>120K+</h3><p>Active Students</p></div>
//             <div className="stat"><h3>340+</h3><p>Expert Courses</p></div>
//             <div className="stat"><h3>98%</h3><p>Success Rate</p></div>
//           </div>
//         </section>

//         <section className="courses" id="courses">
//           <div className="courses-head">
//             <span className="eyebrow">Explore</span>
//             <h2>Popular Courses</h2>
//             <p>Hand-picked paths trusted by thousands of learners.</p>
//           </div>

//           <div className="course-grid">
//             {courses.map((course, index) => (
//               <Link to="/courses" className="card" key={course.title} style={{ animationDelay: `${index * 0.08}s` }}>
//                 {course.tag && <span className="card-tag">{course.tag}</span>}
//                 <div className="card-icon">{course.icon}</div>
//                 <h3>{course.title}</h3>
//                 <p>{course.desc}</p>
//                 <div className="card-link"><span>Explore course</span><FaArrowRight /></div>
//               </Link>
//             ))}
//           </div>
//         </section>
//       </div>
//     </div>
//   );
// }

// export default Home;

// frontend/src/pages/Home.jsx

import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaBolt,
  FaCalculator,
  FaChartLine,
  FaGraduationCap,
  FaLaptopCode,
  FaPaintBrush,
  FaRobot,
  FaSearch,
  FaShieldAlt,
  FaStar,
} from "react-icons/fa";
import "../styles/Home.css";

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
          <Link to="/" className="logo" aria-label="EDUNOVA home">
            <div className="home-brand-icon">
              <FaGraduationCap />
            </div>
            <h2 className="home-brand">EDUNOVA</h2>
          </Link>

          <div className="home-nav-center">
            <Link to="/" className="active">
              Home
            </Link>
            <Link to="/courses">Courses</Link>
            <a href="#courses">Categories</a>
            <a href="#courses">AI Chatbot</a>
            <a href="#courses">Ranking</a>
            <a href="#courses">About</a>
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
            One platform for personalized courses, real-time AI help, and
            gamified challenges — built around how you actually learn.
          </p>

          <div className="search-box">
            <input
              type="search"
              aria-label="Search courses"
              placeholder="Search for courses..."
            />
            <button type="button" aria-label="Search">
              <FaSearch />
            </button>
          </div>

          <div className="hero-tags">
            <span>Popular:</span>
            <a href="#courses">React</a>
            <a href="#courses">Python</a>
            <a href="#courses">AI Agents</a>
            <a href="#courses">UI/UX</a>
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

        <section className="courses" id="courses">
          <div className="courses-head">
            <span className="eyebrow">Explore</span>
            <h2>Popular Courses</h2>
            <p>Hand-picked paths trusted by thousands of learners.</p>
          </div>

          <div className="course-grid">
            {courses.map((course, index) => (
              <Link
                to="/courses"
                className="card"
                key={course.title}
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {course.tag && (
                  <span className="card-tag">{course.tag}</span>
                )}

                <div className="card-icon">{course.icon}</div>
                <h3>{course.title}</h3>
                <p>{course.desc}</p>

                <div className="card-link">
                  <span>Explore course</span>
                  <FaArrowRight />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;
