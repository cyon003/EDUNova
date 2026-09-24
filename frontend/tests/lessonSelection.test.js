import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {transformWithOxc} from 'vite';
import {hasLessonEdits} from '../src/utils/lessonEditor.js';
const source=await readFile(new URL('../src/components/LessonManager.jsx',import.meta.url),'utf8');
const compiled=await transformWithOxc(source.replace(/^import[\s\S]*?;\n/gm,'').replace('export default ',''),'LessonManager.jsx',{jsx:{runtime:'classic'}});
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function harness(update){
 const values=[],refs=[];let cursor=0,ref=0;const scope={React,hasLessonEdits,useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]},useRef(initial){const i=ref++;return refs[i]||=( {current:initial})},useEffect(){},useId:()=>'',getLessonPrimaryMedia:()=>null,lessonReferences:()=>[]};
 for(const name of ['FaBookOpen','FaCloudUploadAlt','FaGraduationCap','FaPlus','FaTimes','FaTrash'])scope[name]=()=>null;
 const Component=new Function(...Object.keys(scope),`${compiled.code};return LessonManager`)(...Object.values(scope));
 const course={_id:'course',__v:3,lessons:['first','middle','final'].map(_id=>({_id,title:_id,topics:[],resources:[]}))};
 const props={course,form:{resources:[],topics:[]},update};
 const view=()=>{cursor=0;ref=0;return Component(props)};
 const find=predicate=>nodes(view()).find(predicate);
 return {props,find,fields:()=>find(n=>n.type?.name==='LessonFields'),select(id){find(n=>n.type==='button'&&n.key===id).props.onClick()},save:()=>find(n=>n.type==='form').props.onSubmit({preventDefault(){}})};
}
test('first/middle/final selection binds the matching draft and stable ID survives reordering',()=>{
 const h=harness();for(const id of ['middle','final','first']){h.select(id);assert.equal(h.fields().props.value.lessonId,id);assert.equal(h.fields().props.value.title,id)}
 h.select('middle');h.props.course={...h.props.course,lessons:h.props.course.lessons.slice(1)};assert.equal(h.fields().props.value.lessonId,'middle');
});
test('switching asks before discarding unsaved changes and cancel keeps the draft',()=>{
 const original=globalThis.window;let accept=false,calls=0;globalThis.window={confirm(){calls++;return accept}};
 try{const h=harness();const fields=h.fields();fields.props.setValue({...fields.props.value,title:'Unsaved'});h.select('middle');assert.equal(h.fields().props.value.title,'Unsaved');assert.equal(calls,1);accept=true;h.select('middle');assert.equal(h.fields().props.value.title,'middle')}finally{globalThis.window=original}
});
test('pending save blocks switching and duplicate submission; failed save retains draft',async()=>{
 let reject,calls=0;const h=harness(()=>{calls++;return new Promise((_,r)=>reject=r)});const f=h.fields();f.props.setValue({...f.props.value,title:'Keep draft'});
 const pending=h.save();await h.save();h.select('final');assert.equal(calls,1);assert.equal(h.fields().props.value.lessonId,'first');assert.equal(h.find(n=>n.type==='fieldset').props.disabled,true);
 reject(new Error('Database unavailable'));await pending;assert.equal(h.fields().props.value.title,'Keep draft');assert.ok(h.find(n=>n.props?.role==='alert'));
});
