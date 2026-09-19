import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import * as utils from '../src/utils/aiLearningContext.js';

const context = { courseId: '507f1f77bcf86cd799439012', lessonId: '507f1f77bcf86cd799439013', videoTimestampSeconds: 625 };
const metadata = { courseTitle: 'Introduction to Python', lessonTitle: 'Loops', topicTitle: 'For Loop', videoTimestampSeconds: 625 };
const page = await readFile(new URL('../src/pages/AiChatbot.jsx', import.meta.url), 'utf8');
const indicator = await readFile(new URL('../src/components/AiLearningContext.jsx', import.meta.url), 'utf8');
const compile = async source => (await transformWithOxc(source.replace(/^import .*;\n/gm, '').replace(/^export default AiChatbot;$/m, '').replace('export default function', 'function'), 'Component.jsx', { jsx: { runtime: 'classic' } })).code;
const pageCode = await compile(page), indicatorCode = await compile(indicator);
const ContextIndicator = new Function('React', 'videoPositionLabel', `${indicatorCode}; return AiLearningContext;`)(React, utils.videoPositionLabel);
const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const reply = (body, ok = true) => ({ ok, json: async () => body });
function harness(learningContext = null, customFetch) {
  const cells = [], effects = [], requests = [];
  let cursor = 0, currentSession = true;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const i = cursor++; cells[i] ||= { value: initial }; return [cells[i].value, value => { cells[i].value = typeof value === 'function' ? value(cells[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ||= { current: initial }; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; }); },
  };
  const plan = { subscription: { aiUsage: { exempt: false, remaining: 5 } }, setSubscription() {}, refresh() {} };
  const scope = { ...utils, ...hooks, React, API_ROOT: '/api', Link: 'a', AiLearningContext: ContextIndicator, SubscriptionSummary: () => null,
    FaArrowLeft: () => null, FaRedo: () => null, FaPaperPlane: () => null,
    useSubscription: () => plan, useAuth: () => ({ version: 1 }), useLocation: () => ({ state: learningContext ? { learningContext } : null }),
    isCurrentSession: () => currentSession, requestAnimationFrame: fn => fn(),
    sessionFetch: async (url, options = {}, version) => {
      const request = { url, ...options, body: options.body ? JSON.parse(options.body) : undefined, version }; requests.push(request);
      if (customFetch) return customFetch(request);
      return url.endsWith('/chat') ? reply({ mode: learningContext ? 'lesson' : 'general', responseType: 'generated', answer: 'An explanation.', conversationId: 'turn-1', ...(learningContext ? { context: metadata } : {}) })
        : reply({ mode: learningContext ? 'lesson' : 'general', items: [], ...(learningContext ? { context: metadata } : {}) });
    },
  };
  const { AiChatbot, AiChatbotSession } = new Function(...Object.keys(scope), `${pageCode};return { AiChatbot, AiChatbotSession };`)(...Object.values(scope));
  const view = () => { cursor = 0; const tree = AiChatbotSession({ learningContext, version: 1 }); while (effects.length) effects.shift()(); return tree; };
  const h = { requests, plan, view, wrapper: () => AiChatbot(), find: predicate => nodes(view()).find(predicate),
    async send(message) { h.find(node => node.type === 'textarea').props.onChange({ target: { value: message } }); h.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await drain(); },
    expire() { currentSession = false; },
    close() { for (const cell of cells) cell?.cleanup?.(); },
  };
  view(); return h;
}

test('navigation context is allowlisted and direct/invalid navigation falls back to general', () => {
  assert.deepEqual(utils.navigationLearningContext({ learningContext: { ...context, transcript: 'forged', topicTitle: 'fake', studentId: 'other' } }), context);
  for (const state of [null, {}, { learningContext: {} }, { learningContext: { ...context, videoTimestampSeconds: -1 } }, { learningContext: { ...context, videoTimestampSeconds: Infinity } }, { learningContext: { ...context, lessonId: 'invalid' } }]) assert.equal(utils.navigationLearningContext(state), null);
  assert.deepEqual(utils.aiChatPayload('Hello', null), { mode: 'general', message: 'Hello' });
  assert.deepEqual(utils.aiChatPayload('Hello', { ...context, topicId: 'forged', transcript: 'forged' }), { mode: 'lesson', message: 'Hello', ...context });
});

test('AiChatbot recognizes route state and remounts the chat for different context', () => {
  const lesson = harness(context).wrapper();
  assert.deepEqual(lesson.props.learningContext, context);
  const general = harness().wrapper(); assert.equal(general.props.learningContext, null);
  assert.notEqual(general.key, lesson.key);
  assert.notEqual(lesson.key, harness({ ...context, videoTimestampSeconds: 700 }).wrapper().key);
});

test('opening lesson AI only loads authorized history/metadata; student must submit a question', async () => {
  const h = harness(context);
  assert.equal(h.find(node => node.type === ContextIndicator).props.context, null);
  await drain();
  assert.equal(h.requests.length, 1); assert.match(h.requests[0].url, /history\?mode=lesson/);
  const query = new URL(h.requests[0].url, 'http://test').searchParams;
  assert.equal(query.get('courseId'), context.courseId); assert.equal(query.get('videoTimestampSeconds'), '625');
  assert.deepEqual(h.find(node => node.type === ContextIndicator).props.context, metadata);
  assert.equal(h.find(node => node.type === 'textarea').props.value, '');
  await h.send('Can you explain this more simply?');
  assert.deepEqual(h.requests[1].body, { mode: 'lesson', message: 'Can you explain this more simply?', ...context });
  assert.equal(h.requests[1].version, 1);
  assert.ok(h.find(node => node.type === 'p' && node.props.children === 'An explanation.'));
});

test('direct general UI still loads general history and submits general-only payload', async () => {
  const h = harness(); await drain();
  assert.equal(h.find(node => node.type === ContextIndicator), undefined);
  assert.match(h.requests[0].url, /mode=general/);
  await h.send('What is iteration?');
  assert.deepEqual(h.requests[1].body, { mode: 'general', message: 'What is iteration?' });
});

test('trusted indicator renders topic and timestamp, omits missing topic and never renders a transcript', () => {
  const html = renderToStaticMarkup(React.createElement(ContextIndicator, { context: metadata }));
  for (const value of ['Learning context', 'Introduction to Python', 'Lesson: ', 'Loops', 'Topic: ', 'For Loop', 'Around ', '10:25']) assert.ok(html.includes(value), value);
  const withoutTopic = renderToStaticMarkup(React.createElement(ContextIndicator, { context: { ...metadata, topicTitle: null } }));
  assert.doesNotMatch(withoutTopic, /Topic:/);
  assert.match(renderToStaticMarkup(React.createElement(ContextIndicator)), /Lesson context attached/);
  assert.deepEqual(utils.contextDisplayMetadata({ ...metadata, transcript: 'private' }), metadata);
});

test('lesson retry retains identifiers without adding duplicate question; clear uses the same scoped query', async () => {
  let failed = false;
  const h = harness(context, request => {
    if (request.url.endsWith('/chat') && !failed) { failed = true; return reply({ message: 'Temporarily unavailable' }, false); }
    return request.url.endsWith('/chat') ? reply({ mode: 'lesson', responseType: 'generated', answer: 'Recovered.', conversationId: 'one', context: metadata }) : reply({ mode: 'lesson', items: [], context: metadata });
  });
  await drain(); await h.send('Explain');
  const retry = h.find(node => node.type === 'button' && nodes(node).some(child => child.props?.children?.includes?.(' Retry')));
  assert.ok(retry); retry.props.onClick(); await drain();
  assert.deepEqual(h.requests[1].body, h.requests[2].body);
  assert.equal(nodes(h.view()).filter(node => node.type === 'p' && node.props.children === 'Explain').length, 1);
  h.find(node => node.props?.['aria-label'] === 'Clear AskAI history').props.onClick(); await drain();
  assert.equal(h.requests.at(-1).method, 'DELETE');
  assert.match(h.requests.at(-1).url, /mode=lesson&courseId=.*&lessonId=.*&videoTimestampSeconds=625/);
});

test('late chat responses cannot populate unmounted or changed-auth sessions', async () => {
  for (const reason of ['unmount', 'auth']) {
    let finish;
    const h = harness(context, request => request.url.endsWith('/chat') ? new Promise(resolve => { finish = resolve; }) : reply({ mode: 'lesson', items: [], context: metadata }));
    await drain(); await h.send('Hello');
    if (reason === 'unmount') h.close(); else h.expire();
    finish(reply({ mode: 'lesson', responseType: 'generated', answer: 'Stale secret answer.', conversationId: 'old', context: metadata })); await drain();
    assert.equal(h.find(node => node.type === 'p' && node.props.children === 'Stale secret answer.'), undefined);
  }
});

test('quota remains enforced in the contextual UI and unauthorized history exposes no material', async () => {
  const h = harness(context, () => reply({ message: 'Enroll in this course before using lesson AI' }, false));
  await drain();
  assert.equal(h.find(node => node.type === ContextIndicator).props.context, null);
  assert.ok(h.find(node => node.props?.role === 'alert'));
  h.plan.subscription.aiUsage.remaining = 0;
  await h.send('Explain'); assert.equal(h.requests.length, 1);
  assert.equal(h.find(node => node.type === 'textarea').props.disabled, true);
});

test('no course-content persistence or automatic question generation is added', () => {
  assert.doesNotMatch(page, /localStorage|sessionStorage|JSON\.stringify\(.*transcript/);
  assert.match(page, /sessionFetch/);
});
