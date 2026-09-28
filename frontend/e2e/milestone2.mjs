// Opt-in real frontend/backend/model integration. Never loads application .env.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'backend/package.json'));
const mongoose = require('mongoose');
const temp = await mkdtemp(path.join(os.tmpdir(), 'edunova-e2e-'));
const existingVideo = process.env.E2E_EXISTING_VIDEO === 'true';
const artifacts = path.join(root, existingVideo ? '.cache/existing-video-e2e' : '.cache/milestone2-e2e'); await mkdir(artifacts, { recursive: true });
const children = []; let server, vite, browser;
process.once('SIGTERM', () => { for (const p of children) p.kill('SIGTERM'); process.exit(1); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { steps: [], browserErrors: [] };
const step = message => { report.steps.push(message); console.log(message); };
const video = path.join(root, 'backend/uploads/course-videos/e6af9f76-508d-4890-8a8b-87fb71981a9e.mp4');
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const originalHash = await hash(video);
async function waitUntil(check, timeout = 30000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await check()) return; await sleep(250); } throw new Error('Timed out waiting for integration state'); }
function child(command, args, env = {}) { const p = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(p); p.stdout.on('data', d => { report.processLog = ((report.processLog || '') + d.toString()).slice(-20000); }); p.stderr.on('data', d => { report.workerLog = (report.workerLog || '') + d.toString(); }); return p; }
try {
  await mkdir(path.join(temp, 'db'));
  // Kernel assigns the port; only this process's scratch replica set is accessed.
  const net = await import('node:net'); const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
  const mongo = child('mongod', ['--dbpath', path.join(temp, 'db'), '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'edunovaE2E', '--quiet']);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('mongod startup timeout')), 20000); mongo.once('error', reject); mongo.once('exit', code => reject(new Error(`mongod exited ${code}`))); mongo.stdout.on('data', data => { if (data.toString().includes('Waiting for connections')) { clearTimeout(timer); resolve(); } }); });
  const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 500 });
  await waitUntil(async () => { try { await bootstrap.connect(); await bootstrap.db().admin().command({ ping: 1 }); return true; } catch { return false; } });
  await bootstrap.db().admin().command({ replSetInitiate: { _id: 'edunovaE2E', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  await waitUntil(async () => (await bootstrap.db().admin().command({ hello: 1 })).isWritablePrimary); await bootstrap.close();
  const uri = `mongodb://127.0.0.1:${port}/milestone2_e2e?replicaSet=edunovaE2E`;
  Object.assign(process.env, { NODE_ENV: 'test', FRONTEND_URL: 'http://127.0.0.1:5179', MONGO_URI: uri, JWT_SECRET: 'disposable-e2e-secret-at-least-thirty-two-characters', UPLOAD_ROOT: path.join(temp, 'uploads'), GEMINI_API_KEY: '', PYTHON_CONFUSION_URL: 'http://127.0.0.1:1', CORS_ORIGINS: 'http://127.0.0.1:5179' });
  await mongoose.connect(uri); step('Disposable replica set ready');
  const User = require(path.join(root, 'backend/models/User')); const Course = require(path.join(root, 'backend/models/Course')); const Enrollment = require(path.join(root, 'backend/models/Enrollment'));
  const password = await require('bcryptjs').hash('LocalTest123!', 10);
  const tutor = await User.create({ name: 'E2E Tutor', email: 'tutor@e2e.invalid', password, role: 'tutor' });
  const students = await User.create(Array.from({ length: 5 }, (_, i) => ({ name: `E2E Student ${i}`, email: `student${i}@e2e.invalid`, password, role: 'student' })));
  const course = await Course.create({ name: 'Disposable Algorithms', slug: 'disposable-algorithms', tutor: tutor._id, description: 'Local test only', level: 'Beginner', duration: '10:37', rating: 0, lessons: [{ title: 'Algorithms lecture', duration: '10:37', transcript: 'Manual transcript retained', topics: [{ title: 'Manual introduction', startTimeSeconds: 0, endTimeSeconds: 10 }], quiz: { title: 'Original quiz', questions: [{ question: 'Is constant space O(1)?', type: 'true_false', options: [{ text: 'True' }, { text: 'False' }], correctOption: 0 }] } }] });
  const lesson = course.lessons[0]; const manual = lesson.topics[0].toObject(); const quiz = lesson.quiz.toObject();
  await Enrollment.create(students.map(s => ({ student: s._id, course: course._id })));
  const events = mongoose.connection.collection('confusionevents');
  await events.insertMany(students.flatMap(s => [{ student: s._id, course: course._id, lessonId: lesson._id, topicId: manual._id, topicTitle: manual.title, videoTimestampSeconds: 5, source: 'random_forest', prediction: 'confused', confusionProbability: .9, createdAt: new Date('2026-01-01') }, { student: s._id, course: course._id, lessonId: lesson._id, topicId: null, videoTimestampSeconds: 60, source: 'random_forest', prediction: 'confused', confusionProbability: .9, createdAt: new Date('2026-01-01') }]));
  const historical = await events.find({}).toArray();
  await mongoose.connection.collection('lessonvideoexposures').insertMany(students.map(s => ({ student: s._id, course: course._id, lessonId: lesson._id, watchedRanges: [{ startTimeSeconds: 0, endTimeSeconds: 637 }] })));
  if (existingVideo) {
    await mkdir(path.join(temp, 'uploads/course-videos'), { recursive: true });
    await copyFile(video, path.join(temp, 'uploads/course-videos/older-lecture.mp4'));
    lesson.videoUrl = '/uploads/course-videos/older-lecture.mp4';
    await course.save();
    assert.equal(lesson.transcriptionSource?.mediaVersion, undefined);
    step('Disposable older lesson has a copied local video and no transcription intent');
  }
  const progressBefore = await Enrollment.find({}).lean();
  const exposureBefore = await mongoose.connection.collection('lessonvideoexposures').find({}).toArray();
  const app = require(path.join(root, 'backend/app')); server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); const api = `http://127.0.0.1:${server.address().port}`;
  vite = await createServer({ root: path.join(root, 'frontend'), configFile: false, plugins: [(await import('@vitejs/plugin-react')).default()], server: { host: '127.0.0.1', port: 5179, strictPort: true, proxy: { '/api': api, '/uploads': api } } }); await vite.listen(); const origin = `http://127.0.0.1:${vite.httpServer.address().port}`; process.env.FRONTEND_URL = origin;
  step('Real backend and Vite frontend ready'); browser = await chromium.launch({ channel: 'chrome', headless: true }); const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => report.browserErrors.push(e.message));
  async function login(page, email) { await page.goto(`${origin}/auth`); await page.getByRole('button', { name: 'Log In', exact: true }).first().click(); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill('LocalTest123!'); await page.locator('button[type=submit]').click(); await expect(page).not.toHaveURL(/\/auth$/); }
  step('Chrome ready; logging in'); await login(page, tutor.email); step('Tutor login succeeded'); await page.goto(`${origin}/tutor-dashboard`); await page.getByRole('button', { name: 'My Courses', exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('button', { name: 'Manage lessons', exact: true }).click();
  if (existingVideo) {
    await expect(page.getByText('Transcription: Not requested', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Generate transcript and topics', exact: true }).click();
    await expect(page.getByText('Transcript and topic generation requested', { exact: true })).toBeVisible();
    await expect(page.getByText('Transcription: Queued', { exact: true })).toBeVisible();
    step('Browser requested generation for the older saved video without uploading or editing content');
  } else {
    await page.locator('.lesson-upload-card input[type=file]').first().setInputFiles(video);
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByText('Lesson saved', { exact: true })).toBeVisible();
  }
  const uploaded = await Course.findById(course._id); const uploadedLesson = uploaded.lessons[0]; const uploadFile = path.join(temp, 'uploads', uploadedLesson.primaryMedia.storage, uploadedLesson.primaryMedia.storedName);
  assert.equal(await hash(uploadFile), originalHash); assert.deepEqual(uploadedLesson.topics[0].toObject(), manual); assert.deepEqual(uploadedLesson.quiz.toObject(), quiz); step(existingVideo ? 'Existing saved copy remains byte-identical; manual topic and quiz unchanged' : 'Browser upload persisted a byte-identical copy; manual topic and quiz unchanged');
  const token = require('jsonwebtoken').sign({ id: tutor.id }, process.env.JWT_SECRET);
  async function analytics() { const r = await fetch(`${api}/api/tutor/analytics`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(r.status, 200); return (await r.json()).heatmapCourses[0].lessons[0]; }
  const beforeAnalytics = await analytics(); assert.equal(beforeAnalytics.topics[0].confusionRate, 100);
  const workerEnv = { MONGO_URI: uri, MONGO_DB_NAME: 'milestone2_e2e', UPLOAD_ROOT: path.join(temp, 'uploads'), TRANSCRIPTION_MODEL_PATH: path.join(root, 'transcription-worker/models/faster-whisper-small'), TRANSCRIPTION_MODEL_REVISION: '536b0662742c02347bc0e980a01041f333bce120', TOPIC_MODEL_PATH: path.join(root, 'transcription-worker/models/all-MiniLM-L6-v2'), TOPIC_MODEL_REVISION: '1110a243fdf4706b3f48f1d95db1a4f5529b4d41', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
  const profile = '(version 1) (allow default) (deny network-outbound) (allow network-outbound (remote ip "localhost:*"))';
  child('/usr/bin/sandbox-exec', ['-p', profile, path.join(root, 'transcription-worker/.venv/bin/python'), '-B', 'transcription-worker/worker.py'], workerEnv);
  child('/usr/bin/sandbox-exec', ['-p', profile, path.join(root, 'transcription-worker/.venv-topics/bin/python'), '-B', 'transcription-worker/topic_worker.py'], workerEnv);
  await expect(page.getByText('Topics: Completed', { exact: true })).toBeVisible({ timeout: 300000 });
  const tx = await mongoose.connection.collection('transcription_jobs').findOne({}); const suggestion = await mongoose.connection.collection('topic_suggestions').findOne({ status: 'completed' });
  assert.equal(tx.segmentCount, 107); assert.equal(suggestion.generatedTopics.length, 5); report.generatedTopics = suggestion.generatedTopics; step('Real OS-offline Whisper persisted 107 segments; MiniLM generated 5 topics; browser polling displayed completion');
  assert.deepEqual(await Enrollment.find({}).lean(), progressBefore);
  assert.deepEqual(await mongoose.connection.collection('lessonvideoexposures').find({}).toArray(), exposureBefore);
  assert.deepEqual(await events.find({}).toArray(), historical);
  assert.equal(await mongoose.connection.collection('transcription_jobs').countDocuments({}), 1);
  const generatedLesson = (await Course.findById(course._id)).lessons[0];
  assert.deepEqual(generatedLesson.topics[0].toObject(), manual); assert.equal(generatedLesson.topics.length, 1);
  assert.deepEqual(generatedLesson.quiz.toObject(), quiz); assert.equal(generatedLesson.transcript, 'Manual transcript retained');
  step('Generation preserved manual content, learning progress and historical confusion records');
  await expect(page.getByRole('button', { name: 'Accept suggestions', exact: true })).toBeDisabled();
  await page.getByLabel('Suggestion 1 start (MM:SS)').fill('00:10'); await page.getByLabel('Suggested title 1', { exact: true }).fill('Reviewed algorithm syntax');
  await page.getByRole('button', { name: 'Save suggestion edits', exact: true }).click(); await expect(page.getByText('Suggestion edits saved', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.lesson-preview video').evaluate(v => v.readyState), { timeout: 30000 }).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Preview at 00:10', exact: true }).click(); await expect(page.locator('.lesson-suggestions blockquote')).toContainText('swapping two numbers');
  assert.ok(await page.locator('.lesson-preview video').evaluate(v => Math.abs(v.currentTime - 10) < 1));
  await page.screenshot({ path: path.join(artifacts, 'tutor-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Accept suggestions', exact: true }).click(); await expect(page.getByText('Suggested topics added', { exact: true })).toBeVisible();
  const accepted = await Course.findById(course._id); assert.equal(accepted.lessons[0].topics.length, 6); assert.deepEqual(accepted.lessons[0].topics[0].toObject(), manual); assert.deepEqual(accepted.lessons[0].quiz.toObject(), quiz); assert.equal(accepted.lessons[0].transcript, 'Manual transcript retained'); assert.deepEqual(await events.find({}).toArray(), historical);
  const afterAnalytics = await analytics(); assert.deepEqual(afterAnalytics.topics[0], beforeAnalytics.topics[0]); assert.ok(afterAnalytics.topics.slice(1).every(t => t.confusedStudents === 0)); report.analytics = afterAnalytics; step('Browser review/preview/acceptance passed; manual topic, quiz, transcript, historical events and original topic analytics unchanged');
  // Publish only the disposable fixture so the enrolled student can exercise the player.
  await Course.updateOne({ _id: course._id }, { $set: { moderationStatus: 'published' } });
  const studentContext = await browser.newContext(); await studentContext.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()); const studentPage = await studentContext.newPage(); studentPage.setDefaultTimeout(20000); studentPage.on('pageerror', e => report.browserErrors.push(e.message));
  await login(studentPage, students[0].email); await studentPage.goto(`${origin}/courses/disposable-algorithms/learn/1`);
  await expect(studentPage.getByRole('button', { name: /Reviewed algorithm syntax/ })).toBeVisible();
  await expect.poll(() => studentPage.locator('video').evaluate(v => v.readyState), { timeout: 30000 }).toBeGreaterThan(1);
  await studentPage.getByRole('button', { name: /Reviewed algorithm syntax/ }).click();
  await studentPage.screenshot({ path: path.join(artifacts, 'student-topics.png'), fullPage: true });
  await expect.poll(() => studentPage.locator('video').evaluate(v => v.currentTime)).toBeLessThan(1);
  step('Student browser displays accepted topics; topic navigation preserves existing watch-before-skipping restriction');
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Analytics', exact: true }).click(); await expect(page.getByText('Manual introduction', { exact: true })).toBeVisible(); await expect(page.getByText('Reviewed algorithm syntax', { exact: true })).toBeVisible(); await page.screenshot({ path: path.join(artifacts, 'analytics.png'), fullPage: true }); step('Tutor analytics browser displays both preserved and accepted topics');
  assert.equal(await hash(video), originalHash); assert.equal(await hash(uploadFile), originalHash); assert.deepEqual(await events.find({}).toArray(), historical); assert.deepEqual((await Course.findById(course._id)).lessons[0].quiz.toObject(), quiz);
  const endpoint = `${api}/api/tutor/courses/${course.id}/lessons/${lesson.id}/topic-suggestions`;
  const studentToken = require('jsonwebtoken').sign({ id: students[0].id }, process.env.JWT_SECRET);
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { headers: { Authorization: `Bearer ${studentToken}` } })).status, 403);
  const duplicate = await fetch(`${endpoint}/${suggestion._id}/accept`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Course-Version': String(accepted.__v) }, body: JSON.stringify({ reviewRevision: 0 }) });
  assert.equal(duplicate.status, 409);
  step('Real API rejects anonymous/student review access and duplicate acceptance');
  assert.deepEqual(report.browserErrors, []);
  report.sourceHash = originalHash; report.passed = true; step('Final source/upload hashes, quiz and historical records verified unchanged');
} catch (error) { report.passed = false; report.error = error.stack; console.error(error); if (browser) { const pages = browser.contexts().flatMap(c => c.pages()); for (let i = 0; i < pages.length; i++) { await pages[i].screenshot({ path: path.join(artifacts, `failure-${i}.png`), fullPage: true }).catch(() => {}); await writeFile(path.join(artifacts, `failure-${i}.txt`), await pages[i].locator('body').innerText().catch(() => '')); } } process.exitCode = 1; }
finally {
  await browser?.close(); await vite?.close(); if (server) await new Promise(r => server.close(r)); await mongoose.disconnect();
  for (const p of children.reverse()) { if (p.exitCode === null) { p.kill('SIGTERM'); await Promise.race([new Promise(r => p.once('exit', r)), sleep(5000)]); if (p.exitCode === null) p.kill('SIGKILL'); } }
  await writeFile(path.join(artifacts, 'result.json'), JSON.stringify(report, null, 2)); await rm(temp, { recursive: true, force: true });
}
