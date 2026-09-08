import { useEffect, useRef } from "react";
import { FaBookOpen, FaCheckCircle, FaHome, FaTrophy } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/OrderSuccess.css";

export default function OrderSuccess() {
  const location = useLocation();
  const navigate  = useNavigate();
  const order     = location.state?.order;
  const confettiRef = useRef(null);

  // Redirect if landed here without order data
  useEffect(() => {
    if (!order) { navigate("/home", { replace: true }); }
  }, [order, navigate]);

  // Simple confetti burst on mount
  useEffect(() => {
    if (!confettiRef.current) return;
    const canvas  = confettiRef.current;
    const ctx     = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS  = ["#f0a400", "#f5b913", "#34D399", "#60a5fa", "#f87171", "#a78bfa"];
    const pieces  = Array.from({ length: 120 }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * -canvas.height,
      w:   Math.random() * 10 + 6,
      h:   Math.random() * 6  + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy:  Math.random() * 3  + 2,
      vx:  (Math.random() - 0.5) * 2,
      rot: Math.random() * 360,
      vr:  (Math.random() - 0.5) * 6,
    }));

    let frame;
    let elapsed = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 180);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.vr;
      });
      elapsed++;
      if (elapsed < 200) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!order) return null;

  const courseCount = order.items?.length ?? 0;
  const total       = order.totalAmount ?? 0;

  return (
    <main className="success-page">
      {/* Confetti canvas */}
      <canvas ref={confettiRef} className="success-confetti" aria-hidden="true" />

      <div className="success-card">

        {/* Icon */}
        <div className="success-icon-wrap">
          <FaCheckCircle className="success-icon" />
        </div>

        {/* Heading */}
        <div className="success-trophy"><FaTrophy /> Payment Successful!</div>
        <h1 className="success-title">You're all enrolled!</h1>
        <p className="success-sub">
          You have successfully purchased{" "}
          <strong>{courseCount} course{courseCount !== 1 ? "s" : ""}</strong>.
          Start learning right away.
        </p>

        {/* Order reference */}
        <div className="success-ref">
          Order ref: <code>{order._id}</code>
        </div>

        {/* Courses list */}
        <div className="success-courses">
          {order.items?.map((item) => (
            <Link
              key={item.course._id || item.course}
              to={`/courses/${item.course.slug || ""}`}
              className="success-course-row"
            >
              <div className="success-course-thumb">
                {item.course.thumbnail
                  ? <img
                      src={`${import.meta.env.VITE_API_ORIGIN || "http://localhost:5050"}${item.course.thumbnail}`}
                      alt={item.course.name}
                    />
                  : <FaBookOpen />
                }
              </div>
              <div className="success-course-info">
                <span className="success-course-name">{item.course.name}</span>
                <span className="success-course-price">
                  {item.price > 0 ? `$${item.price.toFixed(2)}` : "Free"}
                </span>
              </div>
              <span className="success-course-arrow">→</span>
            </Link>
          ))}
        </div>

        {/* Total */}
        <div className="success-total">
          Total paid: <strong>${total.toFixed(2)}</strong>
        </div>

        {/* Actions */}
        <div className="success-actions">
          <Link to="/my-courses" className="success-btn-primary">
            <FaBookOpen /> Go to My Courses
          </Link>
          <Link to="/home" className="success-btn-ghost">
            <FaHome /> Back to Home
          </Link>
        </div>

      </div>
    </main>
  );
}
