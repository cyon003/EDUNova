import "../styles/Signup.css";
// import Lottie from "lottie-react";
// import educationAnimation from "../assets/education.json";

// <Lottie
//     animationData={educationAnimation}
//     loop={true}
// />
function Signup() {
  return (
    <div className="signup-page">
      <div className="signup-background">
        <div className="signup-page-logo">
          <span className="edu">EDU</span>
          <span className="nova">NOVA</span>
        </div>

        <div className="signup-page-title">
          <span>Empowering Every Learner with AI</span>
        </div>

        {/* <div className="signup-page-description">
          <span className="span-1">Experience a smarter way to learn
            through personalized recommendations,
            real-time AI assistance, gamified challenges,
            and interactive courses designed for your success
          </span>
        </div> */}
      </div>
      <div className="signup-card">
        <div className="signup-header">
          <h2>Sign Up</h2>
        </div>
        <div className="signup-form">
          <form action="">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" name="username" placeholder="Enter username" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" placeholder="email" required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" name="password" placeholder="password" required />
            </div>
            <div className="signup-btn-container">
              <button type="submit">Sign Up</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Signup;