import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBookOpen, FaHeart, FaSave, FaUser } from "react-icons/fa";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import { API_ROOT, courseThumbnail } from "../utils/courseApi";
import "../styles/Profile.css";

async function authenticatedRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Please log in again");

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.replace("/auth");
    throw new Error("Your session expired");
  }
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function initials(name) {
  return String(name || "Student")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", bio: "", photoUrl: "", phoneNumber: "" });
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([authenticatedRequest("/profile"), authenticatedRequest("/favorites")])
      .then(([profileData, favoriteData]) => {
        if (!active) return;
        const user = profileData.user;
        setProfile(user);
        setForm({
          name: user.name || "",
          username: user.studentProfile?.username || "",
          bio: user.studentProfile?.bio || "",
          photoUrl: user.studentProfile?.photoUrl || "",
          phoneNumber: user.studentProfile?.phoneNumber || "",
        });
        setFavorites(favoriteData.favorites || []);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const data = await authenticatedRequest("/profile", { method: "PATCH", body: JSON.stringify(form) });
      setProfile(data.user);
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...storedUser, name: data.user.name }));
      setMessage("Your profile was saved successfully.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const removeFavorite = async (courseId) => {
    setMessage("");
    setError("");
    try {
      await authenticatedRequest(`/favorites/${courseId}`, { method: "DELETE" });
      setFavorites((current) => current.filter((course) => course._id !== courseId));
      setMessage("Course removed from your saved courses.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) return <main className="student-profile-state">Loading your profile…</main>;
  if (!profile) return <main className="student-profile-state"><p>{error || "Unable to load profile"}</p><button type="button" onClick={() => navigate("/home")}>Return home</button></main>;

  return (
    <main className="student-profile-page">
      <div className="student-profile-container">
        <Link to="/home" className="student-profile-back"><FaArrowLeft /> Back to home</Link>

        <header className="student-profile-header">
          <div className="student-profile-avatar">
            {form.photoUrl ? <img src={form.photoUrl} alt={`${form.name} profile`} /> : <span>{initials(form.name)}</span>}
          </div>
          <div><span className="student-profile-eyebrow">STUDENT PROFILE</span><h1>{profile.name}</h1><p>{profile.email}{joined ? ` · Joined ${joined}` : ""}</p></div>
        </header>

        {(message || error) && <p className={`student-profile-message ${error ? "error" : "success"}`} role="status">{error || message}</p>}

        <div className="student-profile-grid">
          <section className="student-profile-panel">
            <div className="student-profile-panel-title"><FaUser /><div><h2>Personal information</h2><p>Update information displayed on your student account.</p></div></div>
            <form className="student-profile-form" onSubmit={saveProfile}>
              <label><span>Full name</span><input name="name" value={form.name} onChange={updateField} required maxLength="100" /></label>
              <label><span>Username</span><input name="username" value={form.username} onChange={updateField} maxLength="40" placeholder="Choose a display name" /></label>
              <label><span>Email</span><input value={profile.email} readOnly /></label>
              <label><span>Phone number</span><input name="phoneNumber" value={form.phoneNumber} onChange={updateField} maxLength="30" placeholder="Optional" /></label>
              <label className="wide"><span>Profile photo URL</span><input name="photoUrl" type="url" value={form.photoUrl} onChange={updateField} placeholder="https://example.com/photo.jpg" /></label>
              <label className="wide"><span>Bio</span><textarea name="bio" value={form.bio} onChange={updateField} maxLength="500" rows="5" placeholder="Tell others about your learning goals" /><small>{form.bio.length}/500</small></label>
              <button type="submit" disabled={saving}><FaSave /> {saving ? "Saving…" : "Save profile"}</button>
            </form>
          </section>

          <section className="student-profile-panel">
            <div className="student-profile-panel-title"><FaHeart /><div><h2>Saved courses</h2><p>Your favorites are stored securely in your account.</p></div></div>
            {favorites.length === 0 ? (
              <div className="student-profile-empty"><FaBookOpen /><h3>No saved courses</h3><p>Use the heart button in the course catalog to save a course.</p><Link to="/courses">Explore courses</Link></div>
            ) : (
              <div className="student-favorite-list">
                {favorites.map((course) => (
                  <article key={course._id} className="student-favorite-card">
                    <img src={courseThumbnail(course, mathematicsImage)} alt="" />
                    <div><small>{course.category}</small><h3>{course.name}</h3><p>{course.level} · {course.duration}</p><div><Link to={`/courses/${course.slug}`}>View course</Link><button type="button" onClick={() => removeFavorite(course._id)}><FaHeart /> Remove</button></div></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
