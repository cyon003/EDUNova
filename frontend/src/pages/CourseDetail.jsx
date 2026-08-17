import { useEffect, useState } from "react";
import { FaBookOpen, FaBrain, FaCartPlus, FaCheck, FaChevronLeft, FaClock, FaLightbulb, FaLock, FaPlay, FaSave, FaShoppingBag, FaSignal, FaStar, FaTimes, FaTrophy } from "react-icons/fa";
import { Link, useLocation, useParams } from "react-router-dom";
import mathematicsImage from "../assets/images/mathematic.jpeg";
import availableCourses from "../data/courses";
import confusionTraining from "../data/confusionTraining";
import "../styles/CourseDetail.css";

function UnderstandingCheck({ course, lesson }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const training = confusionTraining[course.slug]?.[lesson.title];

  if (!training) return null;

  const checkUnderstanding = (event) => {
    event.preventDefault();
    const normalizedAnswer = answer.trim().toLowerCase();
    if (!normalizedAnswer) return;
    const misconception = training.misconceptions.find((item) => item.patterns.some((pattern) => normalizedAnswer.includes(pattern)));
    const understoodConcepts = training.concepts.filter((concept) => normalizedAnswer.includes(concept));
    const missingConcepts = training.concepts.filter((concept) => !understoodConcepts.includes(concept));
    setFeedback({
      misconception: misconception?.feedback,
      understood: understoodConcepts,
      missing: missingConcepts,
      question: training.question,
    });
  };

  return <section className="understanding-check" aria-label={`Check understanding for ${lesson.title}`}>
    <header><span><FaBrain /></span><div><small>AI UNDERSTANDING CHECK</small><h4>Explain what you learned</h4></div></header>
    <p>Write two or three sentences. Your response will be checked for important ideas and common misunderstandings.</p>
    <form onSubmit={checkUnderstanding}>
      <textarea value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} placeholder={`What did you understand about ${lesson.title}?`} rows="4" />
      <button type="submit" disabled={!answer.trim()}><FaBrain /> Check my understanding</button>
    </form>
    {feedback && <div className="understanding-feedback" aria-live="polite">
      {feedback.misconception ? <article className="needs-review"><strong>Possible confusion</strong><p>{feedback.misconception}</p></article> : <article><strong>{feedback.understood.length ? "Good understanding" : "Add more detail"}</strong><p>{feedback.understood.length ? `You connected: ${feedback.understood.join(", ")}.` : "Your explanation does not yet mention the lesson’s main concepts."}</p></article>}
      {feedback.missing.length > 0 && <article><strong>Ideas to include</strong><p>{feedback.missing.join(" · ")}</p></article>}
      <article><strong>Try this next</strong><p>{feedback.question}</p></article>
    </div>}
  </section>;
}

function CourseLessons({ course, enrolled, completedLessons, onToggleLesson }) {
  const lessons = course.lessons ?? [];

  return (
    <section className="course-lessons" aria-labelledby="course-lessons-title">
      <header className="course-lessons-heading">
        <div><span>Course content</span><strong>{lessons.length} lessons</strong></div>
        <h2 id="course-lessons-title">Learn one step at a time</h2>
        <p>Watch every lesson at your own pace and return whenever you need a refresher.</p>
      </header>

      {lessons.length === 0 ? (
        <div className="course-lessons-empty">
          <h3>Lessons are coming soon</h3>
          <p>The instructor has not uploaded video lessons for this course yet.</p>
        </div>
      ) : (
        <ol className="course-lesson-list">
          {lessons.map((lesson, index) => (
            <li
              className="course-lesson"
              id={`lesson-${index + 1}`}
              key={`${course.slug}-${lesson.title}`}
            >
              <span className="course-lesson-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="course-lesson-video">
                <video controls preload="metadata">
                  <source src={lesson.videoUrl} type="video/mp4" />
                  Your browser does not support HTML video.
                </video>
              </div>

              <div className="course-lesson-info">
                <span><FaPlay /> Lesson {index + 1}</span>
                <h3>{lesson.title}</h3>
                <p>{lesson.description}</p>
                <small><FaClock /> {lesson.duration}</small>
                {enrolled && <Link className="lesson-player-link" to={`/courses/${course.slug}/learn/${index + 1}`}><FaPlay /> Open lesson</Link>}
                {enrolled && <UnderstandingCheck course={course} lesson={lesson} />}
                {enrolled && <button type="button" className={completedLessons.includes(index) ? "lesson-complete-button completed" : "lesson-complete-button"} onClick={() => onToggleLesson(index)}><FaCheck /> {completedLessons.includes(index) ? "Completed" : "Mark complete"}</button>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function getCourseMissions(course) {
  const missionSets = {
    mathematics: [
      ["Foundation", "Plan a School Fundraiser", "Use variables and equations to calculate a realistic fundraising target."],
      ["Applied", "Price a Delivery Service", "Combine equations and graphs to create a fair delivery-pricing model."],
      ["Capstone", "Forecast a Pop-Up Store", "Apply the complete course to model costs, revenue, and profit."],
    ],
    science: [
      ["Foundation", "Investigate a Plant Problem", "Use scientific observation to identify why a plant is not growing well."],
      ["Applied", "Improve a Classroom Experiment", "Combine scientific methods to create a reliable testing plan."],
      ["Capstone", "Advise a Sustainable Community", "Use the complete course to investigate and explain an environmental problem."],
    ],
    english: [
      ["Foundation", "Rewrite a Customer Message", "Apply grammar and tone to make an unclear message professional."],
      ["Applied", "Create a Product Story", "Combine audience, structure, and persuasive writing skills."],
      ["Capstone", "Lead a Communication Campaign", "Plan, write, revise, and defend a complete campaign."],
    ],
  };
  const fallback = [
    ["Foundation", `Apply ${course.name} Foundations`, "Use the first part of the course to solve a guided real-world problem."],
    ["Applied", `Use ${course.name} in Practice`, "Combine knowledge from the first two parts of the course in a realistic situation."],
    ["Capstone", `${course.name} Final Challenge`, "Apply the complete course to a complex portfolio-ready problem."],
  ];
  const selected = missionSets[course.slug] || fallback;
  return selected.map(([stage, title, description], index) => ({
    id: `${course.slug}-${stage.toLowerCase()}`,
    stage,
    title,
    description,
    fraction: index + 1,
    duration: ["20 min", "40 min", "90 min"][index],
    difficulty: ["Guided", "Intermediate", "Advanced"][index],
    scenario: `${course.name} knowledge is needed to help a realistic client make a better decision. Ask for the important information, explain your reasoning, and provide a practical final recommendation.`,
  }));
}

function CourseMissions({ course, completedLessonCount, completedMissions, onCompleteMission }) {
  const lessonsCount = course.lessons?.length || 1;
  const missions = getCourseMissions(course);
  const [selectedMission, setSelectedMission] = useState(null);
  const [solution, setSolution] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openMission = (mission) => {
    setSelectedMission(mission);
    setSolution("");
    setHintVisible(false);
    setSubmitted(completedMissions.includes(mission.id));
  };

  return <section className="course-missions" aria-labelledby="course-missions-title">
    <header className="course-missions-heading"><div><span>AI MISSION CHECKPOINTS</span><strong>{completedLessonCount}/{lessonsCount} lessons complete</strong></div><h2 id="course-missions-title">Apply what you have learned</h2><p>New missions unlock after one-third, two-thirds, and full course completion.</p></header>
    <div className="course-mission-progress"><span style={{ width: `${Math.min(completedLessonCount / lessonsCount * 100, 100)}%` }} /></div>
    <div className="course-mission-grid">{missions.map((mission) => {
      const requiredLessons = Math.ceil(lessonsCount * mission.fraction / 3);
      const unlocked = completedLessonCount >= requiredLessons;
      const complete = completedMissions.includes(mission.id);
      return <article className={`${unlocked ? "unlocked" : "locked"} ${complete ? "complete" : ""}`} key={mission.id}>
        <div className="course-mission-icon">{complete ? <FaCheck /> : unlocked ? <FaBrain /> : <FaLock />}</div>
        <small>{mission.stage} Mission</small><h3>{mission.title}</h3><p>{mission.description}</p>
        <div><span><FaClock /> {mission.duration}</span><span><FaStar /> {mission.difficulty}</span></div>
        <strong>{complete ? "Mission completed" : unlocked ? "Mission unlocked" : `Complete ${requiredLessons} lessons to unlock`}</strong>
        <button type="button" disabled={!unlocked} onClick={() => openMission(mission)}>{complete ? "Review Mission" : unlocked ? "Start Mission" : "Locked"}</button>
      </article>;
    })}</div>

    {selectedMission && <div className="course-mission-overlay"><section className="course-mission-modal" role="dialog" aria-modal="true" aria-labelledby="active-mission-title"><header><div><small>{selectedMission.stage} Mission</small><strong id="active-mission-title">{selectedMission.title}</strong></div><button type="button" onClick={() => setSelectedMission(null)} aria-label="Close mission"><FaTimes /></button></header>{submitted ? <div className="course-mission-result"><span><FaTrophy /></span><small>MISSION REPORT</small><h2>Mission completed</h2><p>You connected course knowledge to the scenario and explained a practical solution. Full AI scoring and personalized feedback will be connected later.</p><div><strong>Skills demonstrated</strong><span>Reasoning · Application · Communication</span></div><button type="button" onClick={() => setSelectedMission(null)}>Return to Course</button></div> : <div className="course-mission-workspace"><div><span>YOUR SCENARIO</span><h2>{selectedMission.title}</h2><p>{selectedMission.scenario}</p><section><FaBrain /><div><small>AI CHARACTER</small><strong>Mission Client</strong><p>“Explain what information you need from me before you begin.”</p></div></section></div><form onSubmit={(event) => { event.preventDefault(); if (!solution.trim()) return; onCompleteMission(selectedMission.id); setSubmitted(true); }}><header><div><span>YOUR SOLUTION</span><h3>Explain your recommendation</h3></div><button type="button" onClick={() => setHintVisible((current) => !current)}><FaLightbulb /> Hint</button></header>{hintVisible && <p className="course-mission-hint">Identify what the client needs, connect it to the course concepts, and explain every important assumption.</p>}<textarea value={solution} onChange={(event) => setSolution(event.target.value)} placeholder="Write your reasoning and final solution..." required /><button type="submit"><FaSave /> Submit Mission</button></form></div>}</section></div>}
  </section>;
}

function CourseDetail() {
  const location = useLocation();
  const { courseSlug } = useParams();
  const course = availableCourses.find((item) => item.slug === courseSlug);
  const [cartCourses, setCartCourses] = useState(() => {
    try {
      const storedCourses = JSON.parse(localStorage.getItem("edunova-cart"));
      return Array.isArray(storedCourses) ? storedCourses : [];
    } catch { return []; }
  });
  const [enrolledCourses, setEnrolledCourses] = useState(() => {
    try {
      const storedCourses = JSON.parse(localStorage.getItem("edunova-enrolled-courses"));
      return Array.isArray(storedCourses) ? storedCourses : [];
    } catch { return []; }
  });
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState("");
  const lessonProgressKey = `edunova-lesson-progress-${courseSlug}`;
  const missionProgressKey = `edunova-mission-progress-${courseSlug}`;
  const [completedLessons, setCompletedLessons] = useState(() => {
    try {
      const storedLessons = JSON.parse(localStorage.getItem(lessonProgressKey));
      return Array.isArray(storedLessons) ? storedLessons : [];
    } catch { return []; }
  });
  const [completedMissions, setCompletedMissions] = useState(() => {
    try {
      const storedMissions = JSON.parse(localStorage.getItem(missionProgressKey));
      return Array.isArray(storedMissions) ? storedMissions : [];
    } catch { return []; }
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    const controller = new AbortController();
    const loadEnrollment = async () => {
      try {
        const response = await fetch("http://localhost:5050/api/enrollments/me", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok) return;
        const enrollments = await response.json();
        let enrollment = enrollments.find((item) => item.course?.slug === courseSlug);
        if (!enrollment && enrolledCourses.includes(courseSlug)) {
          const syncResponse = await fetch(`http://localhost:5050/api/enrollments/${courseSlug}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (syncResponse.ok) {
            enrollment = await syncResponse.json();
            const storedLessons = JSON.parse(localStorage.getItem(lessonProgressKey));
            const storedMissions = JSON.parse(localStorage.getItem(missionProgressKey));
            const localLessons = Array.isArray(storedLessons) ? storedLessons : [];
            const localMissions = Array.isArray(storedMissions) ? storedMissions : [];
            if (localLessons.length || localMissions.length) {
              const progressResponse = await fetch(`http://localhost:5050/api/enrollments/${courseSlug}/progress`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ completedLessons: localLessons, completedMissions: localMissions }),
                signal: controller.signal,
              });
              if (progressResponse.ok) enrollment = await progressResponse.json();
            }
          }
        }
        if (!enrollment) return;
        setEnrolledCourses((current) => current.includes(courseSlug) ? current : [...current, courseSlug]);
        setCompletedLessons(enrollment.completedLessons || []);
        setCompletedMissions(enrollment.completedMissions || []);
      } catch (error) {
        if (error.name !== "AbortError") console.error("Load enrollment error:", error);
      }
    };
    loadEnrollment();
    return () => controller.abort();
  }, [courseSlug, enrolledCourses, lessonProgressKey, missionProgressKey]);

  if (!course) {
    return (
      <main className="course-detail-page">
        <h1>Course not found</h1>
        <Link to="/courses">← Back to Courses</Link>
      </main>
    );
  }

  const inCart = cartCourses.includes(course.slug);
  const enrolled = enrolledCourses.includes(course.slug);
  const toggleCart = () => {
    setCartCourses((current) => {
      const updated = current.includes(course.slug) ? current.filter((slug) => slug !== course.slug) : [...current, course.slug];
      localStorage.setItem("edunova-cart", JSON.stringify(updated));
      return updated;
    });
  };
  const enrollCourse = async () => {
    if (enrolled) return;
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const updated = [...enrolledCourses, course.slug];
    setEnrolledCourses(updated);
    localStorage.setItem("edunova-enrolled-courses", JSON.stringify(updated));
    setEnrolling(true);
    setEnrollmentMessage("");
    try {
      const response = await fetch(`http://localhost:5050/api/enrollments/${course.slug}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to enroll");
      setEnrollmentMessage("Enrollment saved to your account.");
    } catch (error) {
      console.error("Enrollment error:", error);
      setEnrollmentMessage("Enrolled on this device. Database sync will retry when the backend is available.");
    } finally {
      setEnrolling(false);
    }
  };
  const saveProgress = async (lessonItems, missionItems) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const options = { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ completedLessons: lessonItems, completedMissions: missionItems }) };
      let response = await fetch(`http://localhost:5050/api/enrollments/${course.slug}/progress`, options);
      if (response.status === 404 && enrolled) {
        const enrollmentResponse = await fetch(`http://localhost:5050/api/enrollments/${course.slug}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        if (enrollmentResponse.ok) response = await fetch(`http://localhost:5050/api/enrollments/${course.slug}/progress`, options);
      }
      if (!response.ok) throw new Error("Unable to synchronize course progress");
    } catch (error) {
      console.error("Save course progress error:", error);
    }
  };
  const toggleLesson = (index) => {
    const updated = completedLessons.includes(index) ? completedLessons.filter((item) => item !== index) : [...completedLessons, index];
    setCompletedLessons(updated);
    localStorage.setItem(lessonProgressKey, JSON.stringify(updated));
    saveProgress(updated, completedMissions);
  };
  const completeMission = (missionId) => {
    if (completedMissions.includes(missionId)) return;
    const updated = [...completedMissions, missionId];
    setCompletedMissions(updated);
    localStorage.setItem(missionProgressKey, JSON.stringify(updated));
    saveProgress(completedLessons, updated);
  };

  return (
    <main className="course-detail-page">
      <Link to={location.state?.from || "/courses"} className="course-detail-back" aria-label={location.state?.from === "/my-courses" ? "Back to my courses" : "Back to courses"}>
        <FaChevronLeft />
      </Link>

      <div className="course-detail-layout">
        <article className="course-detail-card">
          <div className="course-detail-image">
            <img src={mathematicsImage} alt={`${course.name} course`} />
            <span><FaPlay /> Preview course</span>
          </div>

          <div className="course-detail-copy">
            <span className="course-detail-category">{course.category ?? "General Education"}</span>
            <h1>{course.name}</h1>
            <p>{course.description}</p>

            <div className="course-detail-highlights">
              <span><FaStar /><strong>{course.rating}</strong> rating</span>
              <span><FaSignal /><strong>{course.level}</strong></span>
              <span><FaClock /><strong>{course.duration}</strong></span>
              <span><FaBookOpen /><strong>{course.lessons?.length ?? 0}</strong> lessons</span>
            </div>

            <div className="course-detail-price"><span>Course price</span><strong>${course.price}</strong></div>
            <div className="course-detail-purchase">
              <button type="button" className={`course-cart-button ${inCart ? "in-cart" : ""}`} onClick={toggleCart}><FaCartPlus /> {inCart ? "Added to Cart" : "Add to Cart"}</button>
              <button type="button" className="course-buy-button" onClick={enrollCourse} disabled={enrolling || enrolled}><FaShoppingBag /> {enrolling ? "Enrolling..." : enrolled ? "Enrolled" : "Buy Now"}</button>
            </div>

            <div className="course-enrollment-note"><FaCheck /> Learn at your own pace with lifetime access</div>
            {enrollmentMessage && <p className="course-enrollment-status">{enrollmentMessage}</p>}
          </div>
        </article>

        <CourseLessons course={course} enrolled={enrolled} completedLessons={completedLessons} onToggleLesson={toggleLesson} />
        {enrolled && <CourseMissions course={course} completedLessonCount={completedLessons.length} completedMissions={completedMissions} onCompleteMission={completeMission} />}
      </div>
    </main>
  );
}

export default CourseDetail;
