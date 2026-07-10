import HeroSection from "../components/HeroSection";
import AuthCard from "../components/AuthCard";
import "../styles/Auth.css";

function Auth() {
  return (
    <div className="signup-page">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />
      <div className="signup-inner">
        <HeroSection />
        <AuthCard />
      </div>
    </div>
  );
}

export default Auth;