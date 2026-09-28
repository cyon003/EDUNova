import { useEffect, useRef, useState } from 'react';
import { API_ROOT, apiAssetUrl } from '../utils/courseApi';
import { getAuthSnapshot, sessionFetch } from '../utils/authClient';
import { analyticsBand, learningInsightCourses, topicHasSample } from '../utils/learningInsights';
import { formatTopicTime } from '../utils/topicTime';
import '../styles/LearningInsights.css';

export default function LearningInsights({ courses = [], ownedCourses = [] }) {
  const catalog = learningInsightCourses(courses, ownedCourses);
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const course = catalog.find(item => String(item.courseId) === courseId) || catalog[0];
  const lessons = course?.lessonCatalog || course?.lessons || [];
  const lesson = lessons.find(item => String(item.lessonId) === lessonId) || lessons[0];
  return <section className="learning-insights" aria-label="Learning Insights report">
    <p className="li-intro">Find parts of your lessons where students may need more support. Percentages indicate potential confusion, not confirmed student understanding.</p>
    {!course ? <p>No courses available yet.</p> : <>
      <div className="li-navigation"><label>Course<select value={course.courseId} onChange={event => { setCourseId(event.target.value); setLessonId(''); }}>{catalog.map(item => <option key={item.courseId} value={item.courseId}>{item.courseTitle}</option>)}</select></label>
      <label>Lesson<select value={lesson?.lessonId || ''} disabled={!lessons.length} onChange={event => setLessonId(event.target.value)}>{lessons.map(item => <option key={item.lessonId} value={item.lessonId}>{item.lessonOrder} — {item.lessonTitle}</option>)}</select></label></div>
      {lesson ? <LessonReport key={`${course.courseId}:${course.courseVersion}:${lesson.lessonId}`} course={course} lesson={lesson}/> : <p>No lessons available yet.</p>}
    </>}
  </section>;
}

function LessonReport({ course, lesson }) {
  const [viewing, setViewing] = useState(null);
  const topics = [...(lesson.topics || [])].sort((a, b) => Number(topicHasSample(b)) - Number(topicHasSample(a)) || (topicHasSample(a) ? b.confusionRate - a.confusionRate : 0) || a.startTimeSeconds - b.startTimeSeconds);
  return <>
    <div className="li-heading"><h2>Lesson {lesson.lessonOrder} — {lesson.lessonTitle}</h2><p>Highest measured confusion first</p></div>
    {!topics.length ? <p className="li-empty">No topics available yet. Review topic suggestions or add topics in the lesson editor.</p> : <ul className="li-topics">{topics.map(topic => {
      const enough = topicHasSample(topic);
      const level = enough ? analyticsBand(topic.confusionRate) : 'collecting';
      return <li key={topic.topicId} className={`li-topic ${level}`}>
        <div className="li-topic-title"><h3>{topic.title}</h3><span>{formatTopicTime(topic.startTimeSeconds)}–{formatTopicTime(topic.endTimeSeconds)}</span></div>
        <div className="li-measure">{enough ? <><strong>{topic.confusionRate}%</strong><span className={`li-band ${level}`}>{level[0].toUpperCase() + level.slice(1)} confusion</span><small>{topic.observedStudents} qualifying students</small></> : <><strong className="li-collecting">Collecting learning data</strong><small>Available after 5 qualifying students</small></>}</div>
        <button type="button" className="li-view" aria-label={`View lesson: ${topic.title}`} disabled={!course.courseSlug} onClick={() => setViewing(topic)}>View lesson</button>
      </li>;
    })}</ul>}
    {viewing && <TopicPreview key={String(viewing.topicId)} course={course} lesson={lesson} topic={viewing} close={() => setViewing(null)}/>}
  </>;
}

function TopicPreview({ course, lesson, topic, close }) {
  const [sessionVersion] = useState(() => getAuthSnapshot().version);
  const [media, setMedia] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const panel = useRef(null);
  const closeButton = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    closeButton.current?.focus();
    panel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    return () => previousFocus.current?.focus?.();
  }, []);
  const slug = course.courseSlug, version = course.courseVersion, index = lesson.lessonOrder - 1;
  useEffect(() => {
    const controller = new AbortController();
    sessionFetch(`${API_ROOT}/courses/${encodeURIComponent(slug)}/lessons/${index}/media-access`, { signal: controller.signal, headers: { 'X-Course-Version': String(version) } }, sessionVersion)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(response.status === 409 ? 'This lesson changed. Refresh insights and try again.' : body.message || 'Unable to open this lesson.');
        if (!body.url) throw new Error('No video is available for this lesson.');
        if (!controller.signal.aborted) setMedia({ url: apiAssetUrl(body.url), attempt });
      }).catch(error => { if (!controller.signal.aborted) setMedia({ error: error.message, attempt }); });
    return () => controller.abort();
  }, [slug, version, index, attempt, sessionVersion]);
  const current = media?.attempt === attempt ? media : null;
  return <section ref={panel} className="li-preview" aria-label={`Lesson preview: ${topic.title}`} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
    <header><h3>{topic.title}</h3><button ref={closeButton} type="button" onClick={close}>Close preview</button></header>
    {current?.error ? <div role="alert"><p>{current.error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry video access</button></div> : current?.url ? <video controls preload="metadata" src={current.url} aria-label={`Video: ${lesson.lessonTitle}`} onLoadedMetadata={event => {
      const video = event.currentTarget;
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !Number.isFinite(topic.startTimeSeconds) || topic.startTimeSeconds < 0 || !Number.isFinite(topic.endTimeSeconds) || topic.endTimeSeconds > video.duration || topic.endTimeSeconds <= topic.startTimeSeconds) { setMedia({ error: 'This topic’s range is unavailable in the saved video. Review it in the lesson editor.', attempt }); return; }
      video.currentTime = topic.startTimeSeconds;
    }} onError={() => setMedia({ error: 'Video access may have expired or the file is unavailable. Try again to get a fresh link.', attempt })}/> : <p role="status">Opening lesson…</p>}
  </section>;
}
