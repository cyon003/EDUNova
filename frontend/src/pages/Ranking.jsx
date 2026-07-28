import { Link } from "react-router-dom";
import "../styles/PlaceholderPage.css";

function Ranking() {
  return (
    <main className="placeholder-page">
      <Link to="/" className="placeholder-back">
        ← Back to Home
      </Link>
      <h1>Ranking</h1>
      <p>This page is ready for your future student rankings.</p>
    </main>
  );
}

export default Ranking;
