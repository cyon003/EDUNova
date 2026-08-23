import { useEffect, useState } from "react";
import { FaArrowLeft, FaCartPlus, FaCheck, FaShoppingBag, FaTrash } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { API_ROOT } from "../utils/courseApi";
import "../styles/CartPage.css";

const API = API_ROOT;

function getToken() {
  return localStorage.getItem("token");
}

export default function CartPage() {
  const navigate = useNavigate();
  const [cart,        setCart]        = useState({ items: [], total: 0 });
  const [loading,     setLoading]     = useState(true);
  const [removing,    setRemoving]    = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message,     setMessage]     = useState("");
  const [orderDone,   setOrderDone]   = useState(null);

  // Load cart
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }
    fetch(`${API}/cart`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setCart({ items: data.items || [], total: data.total || 0 }))
      .catch(() => setMessage("Unable to load cart."))
      .finally(() => setLoading(false));
  }, [navigate]);

  const removeItem = async (courseId) => {
    setRemoving(courseId);
    setMessage("");
    try {
      const res = await fetch(`${API}/cart/${courseId}`, {
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

  const checkout = async () => {
    setCheckingOut(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/orders/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Update local enrolled courses cache
      const enrolled = data.enrolledCourses || [];
      if (enrolled.length) {
        const existing = JSON.parse(localStorage.getItem("edunova-enrolled-courses") || "[]");
        const merged = [...new Set([...existing, ...enrolled])];
        localStorage.setItem("edunova-enrolled-courses", JSON.stringify(merged));
      }

      setOrderDone(data.order);
      setCart({ items: [], total: 0 });
    } catch (error) {
      setMessage(error.message || "Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  // ── Order success screen ──
  if (orderDone) {
    return (
      <main className="cart-page">
        <div className="cart-success">
          <div className="cart-success-icon"><FaCheck /></div>
          <h1>Purchase Successful!</h1>
          <p>You are now enrolled in {orderDone.items.length} course{orderDone.items.length !== 1 ? "s" : ""}.</p>
          <div className="cart-success-courses">
            {orderDone.items.map((item) => (
              <Link
                key={item.course._id}
                to={`/courses/${item.course.slug}`}
                className="cart-success-course"
              >
                {item.course.name}
                {item.price === 0 && <span className="cart-free-badge">Free</span>}
              </Link>
            ))}
          </div>
          <div className="cart-success-total">
            Total paid: <strong>${orderDone.totalAmount.toFixed(2)}</strong>
          </div>
          <Link to="/my-courses" className="cart-btn-primary">Go to My Courses</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <div className="cart-header">
        <button type="button" className="cart-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back
        </button>
        <h1><FaShoppingBag /> Your Cart</h1>
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

          {/* Cart items */}
          <section className="cart-items">
            {cart.items.map((item) => {
              const course = item.course;
              if (!course) return null;
              return (
                <article key={course._id} className="cart-item">
                  <div className="cart-item-thumb">
                    {course.thumbnail
                      ? <img src={course.thumbnail} alt={course.name} />
                      : <div className="cart-item-thumb-placeholder"><FaShoppingBag /></div>
                    }
                  </div>
                  <div className="cart-item-info">
                    <h3>
                      <Link to={`/courses/${course.slug}`}>{course.name}</Link>
                    </h3>
                    <span className="cart-item-meta">{course.level} · {course.category}</span>
                    <span className="cart-item-price">
                      {course.price > 0 ? `$${course.price.toFixed(2)}` : <span className="cart-free-badge">Free</span>}
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

          {/* Order summary */}
          <aside className="cart-summary">
            <h2>Order Summary</h2>
            <div className="cart-summary-rows">
              {cart.items.map((item) => item.course && (
                <div key={item.course._id} className="cart-summary-row">
                  <span>{item.course.name}</span>
                  <span>{item.course.price > 0 ? `$${item.course.price.toFixed(2)}` : "Free"}</span>
                </div>
              ))}
            </div>
            <div className="cart-summary-total">
              <span>Total</span>
              <strong>${cart.total.toFixed(2)}</strong>
            </div>
            <button
              type="button"
              className="cart-btn-primary"
              onClick={checkout}
              disabled={checkingOut}
            >
              {checkingOut ? "Processing..." : cart.total === 0 ? "Enroll Free" : `Pay $${cart.total.toFixed(2)}`}
            </button>
            <p className="cart-secure-note"><FaCheck /> Secure checkout · Lifetime access</p>
          </aside>

        </div>
      )}
    </main>
  );
}
