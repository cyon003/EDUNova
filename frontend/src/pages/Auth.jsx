import HeroSection from "../components/HeroSection";
import AuthCard from "../components/AuthCard";
import "../styles/Auth.css";

function Auth() {
  return (
    <div className="signup-page">
      <HeroSection />
      <AuthCard />
    </div>
  );
}

export default Auth;