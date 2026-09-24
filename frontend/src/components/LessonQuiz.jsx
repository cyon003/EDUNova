import { useEffect, useState } from "react";
import { FaArrowLeft, FaCheck, FaRedo, FaTimes } from "react-icons/fa";
import { API_ROOT } from "../utils/courseApi";
import { studentQuizMediaUrl } from "../utils/quizMedia";
import AuthedMedia from "./AuthedMedia";
import "../styles/LessonQuiz.css";

const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
const formatDate = (value) => (value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "");

// The quiz prop comes from the lesson and never contains the answer key.
// Grading and storing results happen on the server; this component only sends
// the option numbers the student picked.
export default function LessonQuiz({ courseSlug, lessonIndex, courseVersion, quiz, onBack }) {
  const questions = quiz?.questions || [];
  const [answers, setAnswers] = useState(() => questions.map(() => null));
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const attemptsUrl = `${API_ROOT}/quizzes/${encodeURIComponent(courseSlug)}/lessons/${lessonIndex}/attempts`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(attemptsUrl, { headers: authHeaders(), signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setHistory(data); })
      .catch((loadError) => { if (loadError.name !== "AbortError") setHistory(null); });
    return () => controller.abort();
  }, [attemptsUrl, historyVersion]);

  const answered = answers.filter((answer) => answer !== null).length;
  const complete = questions.length > 0 && answered === questions.length;

  const choose = (questionIndex, optionIndex) => {
    setAnswers((current) => current.map((value, index) => (index === questionIndex ? optionIndex : value)));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(attemptsUrl, { method: "POST", headers: { ...authHeaders(), "X-Course-Version": String(courseVersion) }, body: JSON.stringify({ answers }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to submit the quiz");
      setResult(data.attempt);
      setHistoryVersion((version) => version + 1);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers(questions.map(() => null));
    setResult(null);
    setError("");
  };

  if (!questions.length) return null;

  if (result) {
    return (
      <section className="lesson-quiz" aria-live="polite">
        <div className="lesson-quiz-result">
          <span className="lesson-quiz-result-kicker">Quiz Completed!</span>
          <h3>Your Score</h3>
          <div className="lesson-quiz-score"><strong>{result.score}</strong><span>/ {result.totalQuestions}</span></div>
          <p className="lesson-quiz-percent">{result.percentage}%</p>
          <div className="lesson-quiz-stats">
            <div className="correct"><strong>{result.correctCount}</strong><span>Correct answers</span></div>
            <div className="wrong"><strong>{result.wrongCount}</strong><span>Wrong answers</span></div>
            <div><strong>{result.attemptNumber}</strong><span>Attempt</span></div>
          </div>
          <ol className="lesson-quiz-review" aria-label="Result for each question">
            {result.questionResults.map((isCorrect, index) => (
              <li className={isCorrect ? "correct" : "wrong"} key={index}>
                {isCorrect ? <FaCheck aria-hidden="true" /> : <FaTimes aria-hidden="true" />}
                <span>Question {index + 1}</span>
                <b>{isCorrect ? "Correct" : "Wrong"}</b>
              </li>
            ))}
          </ol>
          <div className="lesson-quiz-actions">
            <button type="button" className="secondary" onClick={onBack}><FaArrowLeft /> Back to Lesson</button>
            <button type="button" className="primary" onClick={retry}><FaRedo /> Try again</button>
          </div>
        </div>
        <QuizHistory history={history} />
      </section>
    );
  }

  return (
    <section className="lesson-quiz">
      <div className="lesson-quiz-heading">
        <div>
          <small>LESSON QUIZ</small>
          <h3>{quiz.title || "Lesson Quiz"}</h3>
          <p>{questions.length} question{questions.length === 1 ? "" : "s"} · choose one answer for each</p>
        </div>
        {history?.attemptCount > 0 && (
          <div className="lesson-quiz-best" title="Your previous results">
            <span>Best score</span>
            <strong>{history.best.percentage}%</strong>
            <small>{history.attemptCount} attempt{history.attemptCount === 1 ? "" : "s"}</small>
          </div>
        )}
      </div>

      <form onSubmit={submit}>
        {questions.map((question, questionIndex) => (
          <fieldset className="lesson-quiz-question" key={question._id || questionIndex}>
            <legend><span>{questionIndex + 1}</span>{question.question}</legend>
            {question.media && (
              <div className="lesson-quiz-media">
                <AuthedMedia url={studentQuizMediaUrl(courseSlug, lessonIndex, question._id)} kind={question.media.kind} name={question.media.originalName} />
              </div>
            )}
            <div className="lesson-quiz-choices">
              {question.options.map((option, optionIndex) => (
                <label className={answers[questionIndex] === optionIndex ? "selected" : ""} key={option._id || optionIndex}>
                  <input type="radio" name={`quiz-question-${questionIndex}`} checked={answers[questionIndex] === optionIndex} onChange={() => choose(questionIndex, optionIndex)} />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {error && <p className="lesson-quiz-error" role="alert">{error}</p>}
        <div className="lesson-quiz-submit">
          <span>{answered} of {questions.length} answered</span>
          <button type="submit" className="primary" disabled={!complete || submitting}>{submitting ? "Submitting..." : "Submit Quiz"}</button>
        </div>
      </form>
    </section>
  );
}

function QuizHistory({ history }) {
  if (!history || history.attemptCount < 2) return null;
  return (
    <div className="lesson-quiz-history">
      <h4>Your attempts</h4>
      <ul>
        {history.attempts.map((attempt) => (
          <li className={history.best?._id === attempt._id ? "best" : ""} key={attempt._id}>
            <span>Attempt {attempt.attemptNumber}</span>
            <strong>{attempt.score} / {attempt.totalQuestions} · {attempt.percentage}%</strong>
            <small>{formatDate(attempt.submittedAt)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
