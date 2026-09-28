// Isolated quiz layout regression: no database, Gemini, or live user data.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = path.join(root, '.cache/quiz-design'); await mkdir(artifacts, { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0b0815;font-family:Arial,sans-serif}main{width:100%;max-width:1040px;margin:40px auto;padding:16px;box-sizing:border-box}</style></head><body><div class="tutor-dashboard"><main><div id="root"></div></main></div><script type="module">import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/styles/TutorDashboard.css';import {QuizEditor} from '/src/components/LessonManager.jsx';function Fixture(){const [quiz,setQuiz]=useState(null);return React.createElement(QuizEditor,{courseId:'fixture',lessonId:'lesson',quiz,setQuiz});}createRoot(document.getElementById('root')).render(React.createElement(Fixture));</script></body></html>`;
let vite, browser;
try {
  vite = await createServer({ root:path.join(root,'frontend'), configFile:false, plugins:[react(),{name:'isolated-analytics-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/__analytics-check')return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__analytics-check',html));});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[root]}} });
  await vite.listen(); const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true}); const page=await browser.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});await page.goto(`${origin}/__analytics-check`);
    await expect(page.getByRole('button',{name:'Generate with AI'})).toBeVisible();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(artifacts,`${width}-empty.png`),fullPage:true});
    await page.getByRole('button',{name:'Create Quiz'}).click();
    await expect(page.getByLabel('Quiz title')).toBeVisible();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(artifacts,`${width}-editor.png`),fullPage:true});
    console.log(`PASS ${width}px: empty and manual editor layouts, no horizontal overflow`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser?.close();await vite?.close();}
