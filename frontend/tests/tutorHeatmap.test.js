import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../src/pages/TutorDashboard.jsx', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function confusionLevel'), source.indexOf('\nfunction ', source.indexOf('function CourseHeatmapSection') + 1));
const compiled = await transformWithOxc(code, 'heatmap.jsx', { jsx: { runtime: 'classic' } });
const { Analytics, CourseHeatmapSection, confusionLevel } = new Function('React', 'useState', 'apiAssetUrl', 'FaBookOpen', 'when', 'Header', `${compiled.code}; return {Analytics, CourseHeatmapSection, confusionLevel};`)(React, React.useState, x=>x, ()=>null, x=>x, ({title})=>React.createElement('h1',null,title));
const lesson = (count, rate=0) => ({lessonId:`internal-${count}`,lessonOrder:count,lessonTitle:`Topic ${count}`,predictionCount:count,confusionRate:rate});
const course = {courseId:'internal-course',courseTitle:'Applied mathematics',category:'Science',totalStudentsAnalyzed:8,predictionLessonCount:3,overallConfusionRate:40,lessons:[lesson(0),lesson(3),lesson(5,40),lesson(8,75)]};
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component,props));

test('renders course and lesson names, hides zero predictions and internal IDs',()=>{
 const html=render(CourseHeatmapSection,{course});
 assert.match(html,/Applied mathematics/);assert.match(html,/Topic 5/);assert.doesNotMatch(html,/Topic 0|internal-/);
 assert.match(html,/Collecting data · 3 of 5/);assert.match(html,/Medium confusion/);assert.match(html,/High confusion/);
 assert.match(html,/aria-expanded="true"/);
});
test('threshold boundaries remain low, medium and high',()=>{
 for(const [rate,expected] of [[0,'low'],[39,'low'],[40,'medium'],[69,'medium'],[70,'high'],[100,'high']]) assert.equal(confusionLevel(rate),expected);
 assert.match(render(CourseHeatmapSection,{course:{...course,lessons:[lesson(5,39)]}}),/Low confusion/);
});
test('empty and collecting courses have one clear state',()=>{
 const html=render(CourseHeatmapSection,{course:{...course,overallConfusionRate:null,lessons:[lesson(0)]}});
 assert.equal((html.match(/No confusion insights yet/g)||[]).length,1);assert.doesNotMatch(html,/tutor-lesson-insight/);
 assert.match(render(CourseHeatmapSection,{course:{...course,overallConfusionRate:null,lessons:[lesson(3)]}}),/Collecting course data/);
});
test('loading and initial errors render retry without accessing missing data',()=>{
 assert.match(render(Analytics,{data:null,loading:true}),/Loading insights|Refreshing/);
 assert.match(render(Analytics,{data:null,error:'Request failed'}),/role="alert"/);
 assert.match(render(Analytics,{data:null,error:'Request failed'}),/Try again/);
});
test('refresh is local, preserves other data and locks concurrent requests',()=>{
 assert.doesNotMatch(source,/location\.reload/);
 assert.match(source,/if\(analyticsRequest.current\)return;analyticsRequest.current=true/);
 assert.match(source,/setData\(current=>\(\{\.\.\.current,analytics\}\)\)/);
 assert.match(source,/finally\{analyticsRequest.current=false/);
});

test('refresh updates once, preserves selection data and recovers after rejection',async()=>{
 const body=source.match(/const refreshAnalytics=useCallback\((async\(\)=>\{.*?\}),\[\]\);/)[1];
 let calls=0, finish, data={analytics:{old:true},courses:['kept'],tab:'analytics'}, error='', loading=false;
 const request=()=>{calls++;return new Promise((resolve,reject)=>{finish={resolve,reject}})};
 const refresh=new Function('api','analyticsRequest','setAnalyticsLoading','setAnalyticsError','setData',`return ${body}`)(request,{current:false},v=>{loading=v},v=>{error=v},fn=>{data=fn(data)});
 const first=refresh();await refresh();assert.equal(calls,1);assert.equal(loading,true);
 finish.resolve({updated:true});await first;assert.deepEqual(data,{analytics:{updated:true},courses:['kept'],tab:'analytics'});assert.equal(loading,false);
 const failed=refresh();finish.reject(new Error('Offline'));await failed;assert.equal(error,'Offline');assert.deepEqual(data.analytics,{updated:true});
 const retry=refresh();finish.resolve({recovered:true});await retry;assert.equal(error,'');assert.deepEqual(data.analytics,{recovered:true});
});

test('analytics keeps courses separate and shows stale insights alongside refresh errors',()=>{
 const data={courses:[],heatmapCourses:[course,{...course,courseId:'second',courseTitle:'World history',lessons:[{...lesson(5,20),lessonTitle:'Ancient civilizations'}]}],totalStudentsAnalyzed:9};
 const html=render(Analytics,{data,error:'Offline',loading:false});
 const sections=html.split('<section class="tutor-course-heatmap">');
 assert.match(sections[1],/Applied mathematics/);assert.doesNotMatch(sections[1],/Ancient civilizations/);
 assert.match(sections[2],/World history/);assert.match(sections[2],/Ancient civilizations/);assert.doesNotMatch(sections[2],/Topic 5/);
 assert.match(html,/role="alert"/);assert.match(html,/Try again/);
 assert.match(render(Analytics,{data:{...data,heatmapCourses:[]}}),/No confusion insights yet/);
});
