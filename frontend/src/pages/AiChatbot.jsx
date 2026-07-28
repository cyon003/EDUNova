import { Link } from "react-router-dom";
import "../styles/PlaceholderPage.css";

function AiChatbot() {
  return (
    <main className="placeholder-page">
      <Link to="/" className="placeholder-back">
        ← Back to Home
      </Link>
      <h1>AI Chatbot</h1>
      <p>This page is ready for your future AI chatbot.</p>
    </main>
  );
}

export default AiChatbot;
