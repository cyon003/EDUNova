import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { createExposureTracker } from '../src/utils/videoExposure.js';
import * as tracking from '../src/utils/learningSignalTracking.js';
import { videoTimestamp, canCheckVideo, isConfusedRecommendation } from '../src/utils/rollingConfusion.js';

const source = await readFile(new URL('../src/hooks/useLearningSignal.js', import.meta.url), 'utf8');
const utilities = await readFile(new URL('../src/utils/rollingConfusion.js', import.meta.url), 'utf8');
const drain = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const response = (body, ok = true) => ({ ok, json: async () => body });
function harness({ prediction = { prediction: 'confused', confusionProbability: 0.51 }, storage = new Map() } = {}) {
  let now = 100_000, cursor = 0, nextTimer = 0, props = { courseId: 'course-a', lessonId: 'lesson-a' }, validSession = true;
  const cells = [], effects = [], timers = new Map(), requests = [];
  const doc = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const media = { tagName: 'VIDEO', currentTime: 0, duration: 10000, paused: false, ended: false, seeking: false, pause() { throw new Error('Must never pause playback'); } };
  const date = class extends Date { static now() { return now; } };
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const i = cursor++; cells[i] ||= { value: initial }; return [cells[i].value, value => { cells[i].value = typeof value === 'function' ? value(cells[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ||= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!equal(cells[i]?.deps, deps)) cells[i] = { value: fn, deps }; return cells[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!equal(cells[i]?.deps, deps)) effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; }); },
  };
  const scope = { ...hooks, ...tracking, createExposureTracker: () => createExposureTracker(() => now), API_ROOT: '/api', Date: date, document: doc,
    window: { setInterval(fn, ms) { timers.set(++nextTimer, { fn, ms, due: now + ms }); return nextTimer; }, clearInterval(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {} },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    useAuth: () => ({ user: { id: 'student-a', role: 'student' }, version: 1 }), isCurrentSession: () => validSession,
    sessionFetch: async (url, options = {}) => {
      requests.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined });
      if (url.endsWith('/prediction')) return typeof prediction === 'function' ? prediction() : response(prediction);
      if (options.method === 'PATCH' && url.endsWith('/feedback')) return response({ confusionFeedback: JSON.parse(options.body).feedback });
      if (options.method === 'PATCH' && h.saveResponse) return h.saveResponse();
      if (options.method === 'PATCH' && h.failSave) return response({}, false);
      return response({ aiPrediction: { prediction: 'confused' } });
    },
  };
  const hook = new Function(...Object.keys(scope), `${utilities.replaceAll('export ', '')}\n${source.replace(/^import .*;\n/gm, '').replace('export function', 'function')}\nreturn useLearningSignal;`)(...Object.values(scope));
  const render = () => { cursor = 0; const result = hook(props); while (effects.length) effects.shift()(); return result; };
  const h = { media, doc, storage, requests, timers, view: render, failSave: false,
    predictions: () => requests.filter(r => r.url.endsWith('/prediction')),
    setPrediction(value) { prediction = value; },
    async advance(seconds, { moving = true } = {}) {
      for (let i = 0; i < seconds; i++) {
        now += 1000;
        if (moving && !media.paused) { media.currentTime += 1; render().mediaHandlers.onTimeUpdate({ currentTarget: media }); }
        for (const t of [...timers.values()]) if (t.due <= now) { t.due += t.ms; t.fn(); }
        await drain();
      }
    },
    async switchLesson(lessonId) { props = { ...props, lessonId }; render(); await drain(); render().mediaHandlers.onLoadedMetadata({ currentTarget: media }); },
    invalidate() { validSession = false; },
    async close() { for (const cell of cells) cell?.cleanup?.(); await drain(); },
  };
  render().mediaHandlers.onLoadedMetadata({ currentTarget: media });
  render().mediaHandlers.onPlay({ currentTarget: media });
  return h;
}

test('stored prediction does not suppress new minute checks; exact payload contains only current timestamp', async () => {
  const h = harness(); await drain();
  assert.equal(h.view().signal.aiPrediction.prediction, 'confused');
  assert.ok([...h.timers.values()].some(t => t.ms === 60_000));
  await h.advance(59); assert.equal(h.predictions().length, 0);
  await h.advance(1); assert.equal(h.predictions().length, 1);
  assert.deepEqual(h.predictions()[0].body, { videoTimestampSeconds: 60 });
  await h.advance(60); assert.equal(h.predictions().length, 2);
});

test('hidden, paused, audio, stalled and unchanged playback suppress rolling predictions', async () => {
  for (const kind of ['hidden', 'paused', 'audio', 'stalled', 'unchanged']) {
    const h = harness();
    if (kind === 'hidden') h.doc.visibilityState = 'hidden';
    if (kind === 'paused') h.media.paused = true;
    if (kind === 'audio') h.media.tagName = 'AUDIO';
    await h.advance(120, { moving: !['stalled', 'unchanged'].includes(kind) });
    assert.equal(h.predictions().length, 0, kind);
  }
});

test('in-flight prediction prevents scheduled and explicit duplicates', async () => {
  let resolve;
  const h = harness({ prediction: () => new Promise(r => { resolve = r; }) });
  await h.advance(60);
  await h.view().requestPrediction(); await h.advance(60);
  assert.equal(h.predictions().length, 1);
  resolve(response({ prediction: 'confused' })); await drain();
  assert.ok(h.view().recommendation);
});

test('backend classification alone determines recommendation; no frontend threshold', async () => {
  assert.equal(isConfusedRecommendation({ prediction: 'confused', confusionProbability: 0.51 }), true);
  for (const prediction of [{ prediction: 'clear' }, {}, { prediction: 'invalid' }]) {
    const h = harness({ prediction }); await h.advance(60); assert.equal(h.view().recommendation, null);
  }
  const h = harness(); await h.advance(60); assert.ok(h.view().recommendation);
});

test('Dismiss hides prompt; cooldown persists for lesson and only a new prediction can reopen it', async () => {
  const h = harness(); await h.advance(60); assert.ok(h.view().recommendation);
  h.view().dismissRecommendation(); assert.equal(h.view().recommendation, null);
  for (let i = 0; i < 5; i++) assert.equal(h.view().recommendation, null);
  await h.advance(240); assert.equal(h.view().recommendation, null);
  h.media.paused = true; await h.advance(60); assert.equal(h.view().recommendation, null);
  h.media.paused = false; await h.advance(60); assert.ok(h.view().recommendation);
  assert.equal(h.storage.size, 1);
});

test('Ask AI captures click-time IDs and position and starts the same five-minute cooldown', async () => {
  const h = harness(); await h.advance(60); h.media.currentTime = 83.25;
  assert.deepEqual(h.view().takeRecommendationContext(), { courseId: 'course-a', lessonId: 'lesson-a', videoTimestampSeconds: 83.25 });
  assert.equal(h.view().recommendation, null);
  await h.advance(240); assert.equal(h.view().recommendation, null);
  await h.advance(60); assert.ok(h.view().recommendation);
});

test('cooldown survives remount through sessionStorage and is independent for each lesson', async () => {
  const h = harness(); await h.advance(60); h.view().dismissRecommendation();
  const remount = harness({ storage: h.storage }); await remount.advance(60); assert.equal(remount.view().recommendation, null);
  await h.switchLesson('lesson-b'); await h.advance(60); assert.ok(h.view().recommendation);
  await h.switchLesson('lesson-a'); await h.advance(60); assert.equal(h.view().recommendation, null);
});

test('new results do not replace an already open prompt or reopen it on rerender', async () => {
  const h = harness(); await h.advance(60); const original = h.view().recommendation;
  await h.advance(360); assert.equal(h.view().recommendation, original);
  h.view().dismissRecommendation(); assert.equal(h.view().recommendation, null);
});

test('explicit Clear/confused feedback and video end still predict without automatic prompt', async () => {
  const h = harness(); await drain();
  await h.view().saveFeedback('clear'); assert.equal(h.view().signal.confusionFeedback, 'clear');
  assert.equal(h.predictions().length, 1); assert.equal(h.view().recommendation, null);
  await h.view().saveFeedback('confused'); assert.equal(h.view().signal.confusionFeedback, 'confused');
  assert.equal(h.predictions().length, 2);
  h.media.ended = true; h.view().mediaHandlers.onEnded(); await h.view().requestPrediction();
  assert.equal(h.predictions().length, 3);
  assert.ok(h.requests.some(r => r.method === 'PATCH' && r.body?.maximumVideoProgressPercent === 100));
});

test('network/server errors recover on a later qualifying minute without retry loops', async () => {
  for (const failure of [() => { throw new Error('Offline'); }, () => response({}, false)]) {
    const h = harness({ prediction: failure }); await h.advance(60);
    assert.equal(h.predictions().length, 1); assert.equal(h.view().recommendation, null);
    await drain(); await h.advance(59); assert.equal(h.predictions().length, 1);
    h.setPrediction({ prediction: 'confused' }); await h.advance(1);
    assert.equal(h.predictions().length, 2); assert.ok(h.view().recommendation);
  }
});

test('failed signal flush prevents stale prediction, and can recover later', async () => {
  const h = harness(); h.failSave = true; await h.advance(60); assert.equal(h.predictions().length, 0);
  h.failSave = false; await h.advance(60); assert.equal(h.predictions().length, 1);
});

test('late old-lesson prediction cannot populate new lesson; exit writes retain original IDs', async () => {
  let resolve;
  const h = harness({ prediction: () => new Promise(r => { resolve = r; }) });
  await h.advance(60); await h.switchLesson('lesson-b');
  resolve(response({ prediction: 'confused' })); await drain();
  assert.equal(h.view().recommendation, null);
  assert.equal(h.predictions().length, 1);
  assert.match(h.predictions()[0].url, /lesson-a\/prediction$/);
});

test('ended/hidden playback and changed authentication suppress late recommendation', async () => {
  for (const kind of ['hidden', 'ended', 'auth']) {
    let resolve; const h = harness({ prediction: () => new Promise(r => { resolve = r; }) });
    await h.advance(60);
    if (kind === 'hidden') h.doc.visibilityState = 'hidden';
    if (kind === 'ended') h.media.ended = true;
    if (kind === 'auth') h.invalidate();
    resolve(response({ prediction: 'confused' })); await drain();
    assert.equal(h.view().recommendation, null);
  }
});

test('timestamps are finite, nonnegative and bounded only by reliable duration', () => {
  const media = { tagName: 'VIDEO', currentTime: -4, duration: 100 };
  assert.equal(videoTimestamp(media), 0);
  assert.equal(videoTimestamp({ ...media, currentTime: 120 }), 100);
  assert.equal(videoTimestamp({ ...media, currentTime: 120, duration: NaN }), 120);
  assert.equal(videoTimestamp({ ...media, currentTime: Infinity }), null);
  assert.equal(videoTimestamp({ ...media, currentTime: NaN }), null);
  assert.equal(videoTimestamp({ ...media, tagName: 'AUDIO' }), null);
  assert.equal(canCheckVideo({ media, visibility: 'visible', lastMovementAt: 0, now: 60000, changed: true, lastAttemptAt: 0 }), false);
});

test('recommendation is inline, accessible, manually navigates to canonical AI route without pausing', async () => {
  const componentSource = await readFile(new URL('../src/components/ConfusionRecommendation.jsx', import.meta.url), 'utf8');
  const compiled = await transformWithOxc(componentSource.replace('export default ', ''), 'ConfusionRecommendation.jsx', { jsx: { runtime: 'classic' } });
  const Component = new Function('React', `${compiled.code};return ConfusionRecommendation;`)(React);
  let dismissed = 0, asked = 0;
  const element = Component({ onDismiss: () => dismissed++, onAskAI: () => asked++ });
  const html = renderToStaticMarkup(element);
  assert.match(html, /Having trouble with this part\?/); assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /dialog|autofocus|aria-modal/i);
  const buttons = element.props.children[1].props.children;
  buttons[0].props.onClick(); buttons[1].props.onClick(); assert.equal(dismissed, 1); assert.equal(asked, 1);
  const player = await readFile(new URL('../src/pages/LessonPlayer.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(player, /takeRecommendationContext\(\)[^]*navigate\("\/ai-tutor", \{ state: \{ learningContext \} \}\)/);
  assert.match(app, /path="\/ai-tutor"[^]*<AiChatbot/);
  assert.doesNotMatch(source + componentSource, /\.pause\(|\.focus\(|clearSession\(/);
});

test('rolling rechecks playback after a slow save and samples the position at submission', async () => {
  for (const hidden of [false, true]) {
    const h = harness();
    await h.advance(59);
    let finish;
    h.saveResponse = () => new Promise(resolve => { finish = resolve; });
    await h.advance(1);
    assert.equal(h.predictions().length, 0);
    h.media.currentTime = 64;
    if (hidden) h.doc.visibilityState = 'hidden';
    finish(response({})); await drain();
    assert.equal(h.predictions().length, hidden ? 0 : 1);
    if (!hidden) assert.deepEqual(h.predictions()[0].body, { videoTimestampSeconds: 64 });
  }
});

test('leaving and returning to a lesson cannot resurrect its previous recommendation', async () => {
  const h = harness(); await h.advance(60); assert.ok(h.view().recommendation);
  await h.switchLesson('lesson-b'); assert.equal(h.view().recommendation, null);
  await h.switchLesson('lesson-a'); assert.equal(h.view().recommendation, null);
});

test('exposure uses the normal batching lifecycle, retains failures and never alters prediction features', async () => {
 const h=harness();await h.advance(24);assert.equal(h.requests.filter(r=>r.url.endsWith('/exposure')).length,0);
 await h.advance(1);const saved=h.requests.filter(r=>r.url.endsWith('/exposure'));assert.equal(saved.length,1);
 assert.deepEqual(Object.keys(saved[0].body),['watchedRanges']);assert.deepEqual(saved[0].body.watchedRanges,[{startTimeSeconds:0,endTimeSeconds:25}]);
 await h.advance(35);assert.equal(h.predictions().length,1);
 await h.advance(1);
 const before=h.requests.filter(r=>r.url.endsWith('/exposure')).length;
 h.view().mediaHandlers.onEnded();await drain();assert.equal(h.requests.filter(r=>r.url.endsWith('/exposure')).length,before+1);
 await h.advance(2);await h.switchLesson('next');assert.ok(h.requests.some(r=>r.url.includes('/lesson-a/exposure')&&r.keepalive));
});

test('exposure failures wait for the next normal batch and do not stop rolling prediction',async()=>{
 const h=harness();h.failSave=true;await h.advance(25);const count=()=>h.requests.filter(r=>r.url.endsWith('/exposure')).length;
 assert.equal(count(),1);await h.view().flush();await drain();assert.equal(count(),1);
 h.failSave=false;await h.advance(25);assert.equal(count(),2);
 assert.equal(h.requests.filter(r=>r.url.endsWith('/exposure'))[1].body.watchedRanges[0].startTimeSeconds,0);
 await h.advance(10);assert.equal(h.predictions().length,1);
});

test('merged watch lifecycle counts active time only while playing and resets exposure across stalls',async()=>{
 const h=harness();await h.advance(3);h.view().mediaHandlers.onWaiting();await h.advance(4,{moving:false});
 h.view().mediaHandlers.onPlaying({currentTarget:h.media});await h.advance(2);
 h.media.paused=true;h.view().mediaHandlers.onPause({currentTarget:h.media});await drain();
 const patches=h.requests.filter(r=>r.method==='PATCH'&&!r.url.endsWith('/exposure'));
 assert.equal(patches.reduce((sum,r)=>sum+(r.body.activeTimeSecondsDelta||0),0),5);
 await h.advance(3,{moving:false});await h.view().flush();
 assert.equal(h.requests.filter(r=>r.method==='PATCH'&&!r.url.endsWith('/exposure')).reduce((sum,r)=>sum+(r.body.activeTimeSecondsDelta||0),0),5);
});

test('an old video-ended callback cannot predict the new lesson after navigation',async()=>{
 const h=harness();await h.advance(2);const old=h.view().requestPrediction;
 await h.switchLesson('next');const before=h.predictions().length;
 assert.equal(await old(),false);assert.equal(h.predictions().length,before);
});
