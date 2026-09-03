import { useEffect, useState } from "react";
import {
  FaArrowLeft,
  FaCartPlus,
  FaCheck,
  FaLock,
  FaShoppingBag,
  FaTrash,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { API_ROOT, apiAssetUrl, formatCoursePrice } from "../utils/courseApi";
import "../styles/CartPage.css";

function getToken() {
  return localStorage.getItem("token");
}

export default function CartPage() {
  const navigate = useNavigate();
  const [cart,     setCart]     = useState({ items: [], total: 0 });
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState(null);
  const [message,  setMessage]  = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }
    fetch(`${API_ROOT}/cart`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load cart.");
        return data;
      })
      .then((data) => setCart({ items: data.items || [], total: data.total || 0 }))
      .catch(() => setMessage("Unable to load cart."))
      .finally(() => setLoading(false));
  }, [navigate]);

  const removeItem = async (courseId) => {
    setRemoving(courseId);
    setMessage("");
    try {
      const res = await fetch(`${API_ROOT}/cart/${courseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCart({ items: data.items || [], total: data.total || 0 });
    } catch (error) {
      setMessage(error.message || "Unable to remove item.");
    } finally {
      setRemoving(null);
    }
  };

  // ── Navigate to checkout page instead of calling API directly ──
  const goToCheckout = () => navigate("/checkout");

  return (
    <main className="cart-page">
      <div className="cart-header">
        <button type="button" className="cart-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back
        </button>
        <div className="cart-heading">
          <span><FaShoppingBag /></span>
          <div>
            <h1>Your Cart</h1>
            <p>{loading ? "Loading your courses..." : `${cart.items.length} course${cart.items.length === 1 ? "" : "s"} selected`}</p>
          </div>
        </div>
      </div>

      {message && <p className="cart-message">{message}</p>}

      {loading ? (
        <p className="cart-loading">Loading your cart...</p>
      ) : cart.items.length === 0 ? (
        <div className="cart-empty">
          <FaCartPlus />
          <h2>Your cart is empty</h2>
          <p>Browse courses and add them to your cart.</p>
          <Link to="/home" className="cart-btn-primary">Browse Courses</Link>
        </div>
      ) : (
        <div className="cart-layout">

          <section className="cart-items">
            {cart.items.map((item) => {
              const course = item.course;
              if (!course) return null;
              return (
                <article key={course._id} className="cart-item">
                  <div className="cart-item-thumb">
                    {course.thumbnail ? (
                      <img src={apiAssetUrl(course.thumbnail)} alt={course.name} />
                    ) : (
                      <div className="cart-item-thumb-placeholder"><FaShoppingBag /></div>
                    )}
                  </div>
                  <div className="cart-item-info">
                    <h3>
                      <Link to={`/courses/${course.slug}`}>{course.name}</Link>
                    </h3>
                    <span className="cart-item-meta">{course.level} · {course.category}</span>
                    <span className="cart-item-price">
                      {course.price > 0
                        ? formatCoursePrice(course.price)
                        : <span className="cart-free-badge">Free</span>
                      }
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cart-remove-btn"
                    onClick={() => removeItem(course._id)}
                    disabled={removing === course._id}
                    aria-label={`Remove ${course.name} from cart`}
                  >
                    {removing === course._id ? "..." : <FaTrash />}
                  </button>
                </article>
              );
            })}
          </section>

          <aside className="cart-summary">
            <h2>Order Summary</h2>
            <div className="cart-summary-rows">
              {cart.items.map((item) => item.course && (
                <div key={item.course._id} className="cart-summary-row">
                  <span>{item.course.name}</span>
                  <span>{formatCoursePrice(item.course.price)}</span>
                </div>
              ))}
            </div>
            <div className="cart-summary-total">
              <span>Total</span>
              <strong>{formatCoursePrice(cart.total)}</strong>
            </div>
            <button
              type="button"
              className="cart-btn-primary"
              onClick={goToCheckout}
            >
              <FaLock /> {cart.total === 0 ? "Enroll Free" : `Checkout — ${formatCoursePrice(cart.total)}`}
            </button>
            <p className="cart-secure-note"><FaCheck /> Secure checkout · Lifetime access</p>
          </aside>

        </div>
      )}
    </main>
  );
}
