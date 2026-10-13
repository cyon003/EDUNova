import HeroSection from "../components/HeroSection";
import AuthCard from "../components/AuthCard";
import "../styles/Auth.css";

function Auth() {
  return (
    <main className="signup-page">
      <div className="auth-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-glow auth-glow-2" aria-hidden="true" />
      <div className="signup-inner">
        <HeroSection />
        <AuthCard />
      </div>
    </main>
  );
}

export default Auth;