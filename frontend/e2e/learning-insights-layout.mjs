// Isolated presentation regression: fixed test fixtures only; no MongoDB or RF calls.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, '.cache/learning-insights-layout'); await mkdir(artifacts, { recursive: true });
const course = { courseId:'fixture', courseSlug:'fixture', courseVersion:0, courseTitle:'Algorithm · UI test fixture', lessonCatalog:[{lessonId:'lecture',lessonOrder:1,lessonTitle:'Algorithm lecture · UI test fixture',durationSeconds:636.523,predictionCount:5,confusionRate:100,topics:[{topicId:'syntax',title:'Algorithm syntax',startTimeSeconds:0,endTimeSeconds:210,observedStudents:5,confusedStudents:4,confusionRate:80,sampleSufficient:true},{topicId:'complexity',title:'Time and space complexity',startTimeSeconds:210,endTimeSeconds:480,observedStudents:5,confusedStudents:5,confusionRate:100,sampleSufficient:true},{topicId:'analysis',title:'Comparing algorithms',startTimeSeconds:480,endTimeSeconds:636,observedStudents:3,confusedStudents:2,confusionRate:null,sampleSufficient:false}],behavior:{metrics:{pauseCount:{total:18,studentCount:5},replayCount:{total:8,studentCount:5},activeTimeSeconds:{total:2400,studentCount:5},visitCount:{total:7,studentCount:5}}}}]};
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0b0815;color:#f7f4fc;font-family:Arial,sans-serif}main{max-width:1180px;margin:auto;padding:12px}</style></head><body><main><p>Isolated UI regression fixture — not live student analytics</p><div id="root"></div></main><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import Component from '/src/components/LearningInsights.jsx';import {establishSession} from '/src/utils/authClient.js';establishSession({id:'fixture',role:'tutor'},'fixture-only');createRoot(document.getElementById('root')).render(React.createElement(Component,{courses:${JSON.stringify([course])}}));</script></body></html>`;
let vite, browser;
try {
  vite = await createServer({ root:path.join(root,'frontend'), configFile:false, plugins:[react(),{name:'isolated-analytics-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/__analytics-check')return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__analytics-check',html));});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[root]}} });
  await vite.listen(); const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true}); const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/courses/fixture/lessons/0/media-access', route=>route.fulfill({json:{url:`/@fs/${root}/backend/uploads/course-videos/e6af9f76-508d-4890-8a8b-87fb71981a9e.mp4`}}));
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});await page.goto(`${origin}/__analytics-check`);
    await expect(page.getByRole('listitem').first()).toContainText('Time and space complexity');
    assert.equal(await page.locator('video').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(artifacts,`${width}-report.png`),fullPage:true});
    await page.getByRole('button',{name:'View lesson: Time and space complexity'}).click();
    const video=page.getByLabel('Video: Algorithm lecture · UI test fixture');
    await expect.poll(()=>video.evaluate(element=>element.readyState)).toBeGreaterThan(1);
    await expect.poll(()=>video.evaluate(element=>element.currentTime)).toBeGreaterThan(209);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(artifacts,`${width}-preview.png`),fullPage:true});
    await page.getByRole('button',{name:'Close preview'}).click();
    assert.equal(await page.locator('video').count(),0);
    console.log(`PASS ${width}px: descending topic rates, no horizontal overflow, on-demand video seeks to 210s and closes`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser?.close();await vite?.close();}
