const test=require('node:test');const assert=require('node:assert/strict');const jwt=require('jsonwebtoken');
const {GoogleGenAI}=require('@google/genai');const {generateQuiz,validateQuiz}=require('../services/quizGenerationService');
const Course=require('../models/Course'),User=require('../models/User');
const models=Object.getPrototypeOf(new GoogleGenAI({apiKey:'test'}).models);
const original=models.generateContentInternal,env={...process.env};
const draft=()=>({title:'Lesson Quiz',questions:Array.from({length:2},(_,i)=>({question:`Question ${i}?`,type:'multiple_choice',options:['One','Two','Three','Four'],correctOption:1}))});
let output,call,user,server,saved,oldFind,oldUser;
const tutor='507f1f77bcf86cd799439041',courseId='507f1f77bcf86cd799439042',lessonId='507f1f77bcf86cd799439043';
test.before(async()=>{
 process.env.JWT_SECRET='quiz-test-secret-at-least-thirty-two-characters';process.env.NODE_ENV='test';
 oldFind=Course.findOne;oldUser=User.findById;
 Course.findOne=async filter=>filter.tutor===tutor?saved:null;User.findById=()=>({select:async()=>user});
 const app=require('../app');server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
});
test.after(async()=>{Course.findOne=oldFind;User.findById=oldUser;models.generateContentInternal=original;process.env={...env};await new Promise(r=>server.close(r));});
test.beforeEach(()=>{process.env.GEMINI_API_KEY='test';process.env.GEMINI_MODEL='configured-model';output=draft();call=null;
 models.generateContentInternal=async value=>{call=value;return {text:JSON.stringify(output),candidates:[{finishReason:'STOP'}]};};
 user={_id:tutor,role:'tutor',tokenVersion:0,accountStatus:'approved'};
 const lesson={_id:lessonId,title:'Saved lesson',summary:'Arrays hold ordered values.',quiz:{title:'Original'}};
 saved={_id:courseId,lessons:{id:id=>id===lessonId?lesson:null},save:()=>{throw Error('must not save');}};
});
const request=(body={questionCount:2},auth=true,id=lessonId)=>fetch(`http://127.0.0.1:${server.address().port}/api/tutor/courses/${courseId}/lessons/${id}/generate-quiz`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${jwt.sign({id:user._id},process.env.JWT_SECRET)}`}:{})},body:JSON.stringify(body)});
test('route enforces authentication, tutor ownership and saved lesson identity',async()=>{
 assert.equal((await request(undefined,false)).status,401);user.role='student';assert.equal((await request()).status,403);
 user.role='tutor';user._id='507f1f77bcf86cd799439099';assert.equal((await request()).status,404);user._id=tutor;
 assert.equal((await request(undefined,true,'missing')).status,404);assert.equal(call,null);
});
test('route rejects invalid counts, client context and empty material',async()=>{
 for(const questionCount of [1,21,2.5,'5',null])assert.equal((await request({questionCount})).status,400);
 assert.equal((await request({questionCount:2,transcript:'client injection'})).status,400);
 saved.lessons.id(lessonId).summary='   ';assert.equal((await request()).status,400);assert.equal(call,null);
});
test('generation uses saved material, structured schema and configured model; draft never persists',async()=>{
 const lesson=saved.lessons.id(lessonId),before=JSON.stringify(lesson);const result=await request();assert.equal(result.status,200);const data=await result.json();
 assert.equal(data.saved,false);assert.equal(data.generated,true);assert.equal(data.quiz.questions.length,2);assert.equal(data.quiz.questions[0].media,null);assert.equal(JSON.stringify(lesson),before);
 assert.equal(call.model,'configured-model');assert.equal(JSON.parse(call.contents).referenceMaterial.summary,lesson.summary);assert.match(call.config.systemInstruction,/untrusted data/);assert.equal(call.config.responseJsonSchema.properties.questions.minItems,2);
});
test('malformed provider output is rejected at endpoint without leaking data',async()=>{output={title:'secret source',questions:[]};const response=await request();assert.equal(response.status,502);assert.doesNotMatch(JSON.stringify(await response.json()),/secret source/);});
test('strict output validation rejects count, field lengths, choices, types, answers and attachments',()=>{
 const bad=[q=>q.questions.pop(),q=>q.title='x'.repeat(201),q=>q.questions[0].question='',q=>q.questions[0].question='x'.repeat(1001),q=>q.questions[0].type='true_false',q=>q.questions[0].correctOption='1',q=>q.questions[0].correctOption=4,q=>q.questions[0].correctOption=1.5,q=>q.questions[0].options.pop(),q=>q.questions[0].options[0]=' ',q=>q.questions[0].options[0]=' two ',q=>q.questions[0].options[0]='x'.repeat(501),q=>q.questions[0].media={storedName:'x'}];
 for(const change of bad){const quiz=draft();change(quiz);assert.throws(()=>validateQuiz(quiz,2),/invalid quiz/);}
});
test('safe provider errors, invalid JSON, missing key and deadline',async()=>{
 for(const status of [429,503]) {models.generateContentInternal=async()=>{throw Object.assign(new Error('secret prompt'),{status});};await assert.rejects(generateQuiz({summary:'Saved material'},2),e=>e.status===(status===429?429:502)&&!e.message.includes('secret'));}
 models.generateContentInternal=async()=>({text:'not json'});await assert.rejects(generateQuiz({summary:'Saved material'},2),e=>e.status===502);
 process.env.GEMINI_API_KEY='';await assert.rejects(generateQuiz({summary:'Saved material'},2),e=>e.status===503);
 process.env.GEMINI_API_KEY='test';process.env.GEMINI_TIMEOUT_SECONDS='1';models.generateContentInternal=()=>new Promise(()=>{});await assert.rejects(generateQuiz({summary:'Saved material'},2),e=>e.status===504);delete process.env.GEMINI_TIMEOUT_SECONDS;
});
