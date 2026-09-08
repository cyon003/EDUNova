import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import * as profileUtils from '../src/utils/tutorProfile.js';

const source = await readFile(new URL('../src/components/TutorProfile.jsx', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../src/pages/TutorDashboard.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/TutorProfile.css', import.meta.url), 'utf8');
const clean = source.replace(/^import .*;\n/gm, '').replace(/export default /g, '').replace(/export /g, '');
const compiled = await transformWithOxc(clean, 'TutorProfile.jsx', { jsx: { runtime: 'classic' } });
function components(hooks = React) {
  const scope = {React, useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect, apiAssetUrl: x => x, ...profileUtils};
  for (const name of ['FaCamera','FaCheck','FaEdit','FaEnvelope','FaGraduationCap','FaPhone','FaShieldAlt']) scope[name] = () => React.createElement('svg');
  return new Function(...Object.keys(scope), `${compiled.code}; return {TutorProfile,TutorProfileEditor,TutorAvatar};`)(...Object.values(scope));
}
const {TutorProfile, TutorProfileEditor, TutorAvatar} = components();
const data = {name:'Maya Chen',email:'maya@example.edu',role:'tutor',accountStatus:'approved',tutorProfile:{photoUrl:'/portrait.jpg',phoneNumber:'+66 81 234 5678',expertise:'Mathematics, Statistics',education:'MSc in Mathematics',teachingExperience:'University lecturer since 2018',bio:'I make mathematics approachable.'}};
const render = (Component,props) => renderToStaticMarkup(React.createElement(Component,props));
const nodes = (tree) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function harness(name, props) {
  const values = [], refs = []; let cursor=0, refCursor=0;
  const hooks={useState(initial){const index=cursor++;if(!(index in values)) values[index]=typeof initial==='function'?initial():initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value}];},useRef(initial){const index=refCursor++;return refs[index] ||= {current:initial};},useEffect(){}};
  const Component=components(hooks)[name];
  const view=()=>{cursor=0;refCursor=0;return Component(props)};
  return {view,find(predicate){return nodes(view()).find(predicate)},change(name,value){this.find(node=>node.props?.name===name).props.onChange({target:{value}})}};
}

test('profile uses authenticated data, real statistics and useful content grouping',()=>{
 const html=render(TutorProfile,{data,courses:[{moderationStatus:'published'},{moderationStatus:'unpublished'}],overview:{totals:{students:23}}});
 for (const value of ['Maya Chen','maya@example.edu','Mathematics','Statistics','MSc in Mathematics','University lecturer since 2018','I make mathematics approachable.','Contact &amp; account','Courses created','Published courses','23','100%','Edit profile']) assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/Years of teaching/);
 assert.deepEqual(profileUtils.profileSummary(undefined,undefined),[]);
});
test('avatars have a crop frame and missing or failed images use initials',()=>{
 assert.match(render(TutorAvatar,{name:'Maya Chen'}),/>MC</);
 assert.match(render(TutorAvatar,{name:'Maya Chen',src:'/portrait.jpg'}),/src="\/portrait.jpg"/);
 const avatar=harness('TutorAvatar',{name:'Maya Chen',src:'/broken.jpg'});
 avatar.find(node=>node.type==='img').props.onError();
 assert.equal(avatar.find(node=>node.type==='img'),undefined);
 assert.equal(avatar.find(node=>node.props?.role==='img').props.children,'MC');
 assert.match(css,/\.tp-avatar img\s*\{[^}]*object-fit: cover/);
 assert.match(css,/\.tp-avatar\s*\{[^}]*width: 112px; height: 112px/);
});
test('empty fields offer small relevant edits and unavailable stats are omitted',()=>{
 const html=render(TutorProfile,{data:{name:'Maya Chen',email:'maya@example.edu'}});
 for (const prompt of ['Add a short introduction for your students.','Add your education background.','Describe your teaching experience.','Add a contact number']) assert.ok(html.includes(prompt));
 assert.doesNotMatch(html,/Not added|Courses created/);
});
test('editor prefills saved values and validates names, phones, lengths and photos',()=>{
 const html=render(TutorProfileEditor,{data});
 assert.match(html,/value="Maya Chen"/);assert.match(html,/MSc in Mathematics/);assert.match(html,/University lecturer since 2018/);
 assert.match(html,/Basic information|Professional information|Biography|Profile image/);
 const draft=profileUtils.profileDraft(data);assert.deepEqual(profileUtils.validateProfile(draft),{});
 draft.name=' ';draft.tutorProfile.phoneNumber='abc';draft.tutorProfile.bio='x'.repeat(3001);
 assert.deepEqual(Object.keys(profileUtils.validateProfile(draft)).sort(),['bio','name','phoneNumber']);
 assert.match(profileUtils.validateProfilePhoto({type:'image/gif',size:10}),/JPEG/);
 assert.match(profileUtils.validateProfilePhoto({type:'image/jpeg',size:6*1024*1024}),/5 MB/);
 assert.equal(profileUtils.validateProfilePhoto({type:'image/webp',size:100}), '');
});
test('cancel discards edits without mutating the saved profile',()=>{
 let cancelled=false;const original=structuredClone(data);
 const editor=harness('TutorProfileEditor',{data,cancel:()=>{cancelled=true}});
 editor.change('name','Unsaved name');editor.change('bio','Unsaved biography');
 editor.find(node=>node.type==='button'&&node.props.children==='Cancel').props.onClick();
 assert.equal(cancelled,true);assert.deepEqual(data,original);
 assert.equal(harness('TutorProfileEditor',{data}).find(node=>node.props?.name==='name').props.value,'Maya Chen');
});
test('invalid input prevents save and renders field errors',async()=>{
 let calls=0;const editor=harness('TutorProfileEditor',{data,save:async()=>{calls++}});
 editor.change('phoneNumber','invalid');await editor.view().props.onSubmit({preventDefault(){}});
 assert.equal(calls,0);assert.equal(editor.find(node=>node.props?.name==='phoneNumber').props['aria-invalid'],true);
 assert.ok(editor.find(node=>node.props?.role==='alert'));
});
test('save deduplicates, disables controls, keeps edits on API error and succeeds on retry',async()=>{
 let resolve,reject,calls=0,saved=false;
 const editor=harness('TutorProfileEditor',{data,save:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b})},saved:()=>{saved=true}});
 editor.change('bio','Updated biography');
 const first=editor.view().props.onSubmit({preventDefault(){}});await editor.view().props.onSubmit({preventDefault(){}});
 assert.equal(calls,1);assert.equal(editor.view().props['aria-busy'],true);
 assert.ok(editor.find(node=>node.type==='fieldset').props.disabled);
 reject(new Error('Offline'));await first;
 assert.equal(editor.view().props['aria-busy'],false);assert.equal(saved,false);assert.ok(editor.find(node=>node.props?.role==='alert'));
 assert.equal(editor.find(node=>node.props?.name==='bio').props.value,'Updated biography');
 const retry=editor.view().props.onSubmit({preventDefault(){}});resolve();await retry;assert.equal(saved,true);
});
test('profile upload payload is allowlisted and dashboard updates local data through managed authentication',()=>{
 const body=profileUtils.profileFormData({...profileUtils.profileDraft(data),password:'secret',role:'admin'});
 assert.equal(body.get('name'),'Maya Chen');assert.equal(body.has('email'),false);assert.equal(body.has('password'),false);assert.equal(body.has('role'),false);
 assert.match(dashboard,/sessionFetch\(API\+path/);assert.doesNotMatch(dashboard,/localStorage\.getItem\("token"\)|location\.reload/);
 assert.match(dashboard,/setData\(current=>\(\{\.\.\.current,profile\}\)\)/);
});
test('responsive layout keeps profile content and editor controls present',()=>{
 assert.match(css,/@media \(max-width: 900px\)[\s\S]*\.tp-columns \{ grid-template-columns: 1fr/);
 assert.match(css,/@media \(max-width: 580px\)[\s\S]*\.tp-side-column, \.tp-form-grid \{ grid-template-columns: 1fr/);
 assert.doesNotMatch(css,/\.tp-(main-column|side-column|identity|editor)[^{]*\{[^}]*display:\s*none/);
});

test('selected image is previewed before upload and passed to save only on submit',async()=>{
 let uploaded=null;
 const editor=harness('TutorProfileEditor',{data,save:async(form,photo)=>{uploaded=photo;assert.equal(form.name,data.name)},saved(){}});
 const photo=new File(['preview bytes'],'portrait.png',{type:'image/png'});
 editor.find(node=>node.props?.name==='photo').props.onChange({target:{files:[photo],value:''}});
 const avatar=editor.find(node=>typeof node.type==='function'&&node.type.name==='TutorAvatar');
 assert.match(avatar.props.src,/^blob:/);assert.equal(uploaded,null);
 await editor.view().props.onSubmit({preventDefault(){}});assert.equal(uploaded,photo);
 URL.revokeObjectURL(avatar.props.src);
});
test('successful profile API response replaces local profile while retaining dashboard data',async()=>{
 let state={profile:data,courses:['retained'],analytics:{retained:true}};
 const canonical={...data,name:'Updated name'};
 const body=dashboard.match(/const saveProfile=(async\(profileData,photoFile\)=>\{.*?\});/)[1];
 const save=new Function('api','profileFormData','setData',`return ${body}`)(async(path,options)=>{assert.equal(path,'/profile');assert.equal(options.method,'PATCH');assert.ok(options.body instanceof FormData);return canonical},profileUtils.profileFormData,update=>{state=update(state)});
 assert.equal(await save(profileUtils.profileDraft(data)),canonical);
 assert.equal(state.profile,canonical);assert.deepEqual(state.courses,['retained']);assert.deepEqual(state.analytics,{retained:true});
});
