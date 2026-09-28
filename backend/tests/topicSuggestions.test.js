const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const mongoose = require('mongoose');

test('topic suggestions review and generation on disposable MongoDB', { skip: process.env.RUN_TOPIC_SUGGESTION_TESTS !== 'true' }, async t => {
  process.env.JWT_SECRET = 'topic-suggestion-test-only-secret';
  const temp = await mkdtemp(path.join(os.tmpdir(), 'topic-suggestions-'));
  const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const mongo = spawn('mongod', ['--dbpath', temp, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'topicSuggestions', '--quiet'], { stdio: ['ignore','pipe','pipe'] });
  let server;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Mongo startup timeout')), 20000);
      mongo.once('error', e => { clearTimeout(timer); reject(e); });
      mongo.once('exit', code => { clearTimeout(timer); reject(new Error(`Mongo exited ${code}`)); });
      mongo.stdout.on('data', data => { if (data.toString().includes('Waiting for connections')) { clearTimeout(timer); resolve(); } });
    });
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
      await bootstrap.connect();
      await bootstrap.db().admin().command({ replSetInitiate: { _id: 'topicSuggestions', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      for (let i = 0; ; i++) {
        if ((await bootstrap.db().admin().command({hello:1})).isWritablePrimary) break;
        if (i > 100) throw new Error('No primary');
        await new Promise(r => setTimeout(r, 100));
      }
    } finally { await bootstrap.close(); }
    const uri = `mongodb://127.0.0.1:${port}/topic_api_test?replicaSet=topicSuggestions`;
    await mongoose.connect(uri);
    const Course = require('../models/Course'), User = require('../models/User'), Transcription = require('../models/TranscriptionJob'), Suggestion = require('../models/TopicSuggestion');
    await Promise.all([Course,User,Transcription,Suggestion].map(m => m.init()));
    const tutor = await User.create({ name:'Tutor',email:'topic-tutor@test.invalid',password:'unused',role:'tutor' });
    const other = await User.create({ name:'Other',email:'topic-other@test.invalid',password:'unused',role:'tutor' });
    const student = await User.create({ name:'Student',email:'topic-student@test.invalid',password:'unused',role:'student' });
    const source = { mediaVersion:'v1',storage:'course-videos',storedName:'fixture.mp4' };
    const course = await Course.create({ slug:'topic-suggestions',name:'Topics',description:'test',level:'Beginner',duration:'5:00',rating:0,tutor:tutor._id,
      lessons:[{ title:'Lesson',duration:'5:00',transcript:'Manual transcript',primaryMedia:{...source,mimeType:'video/mp4'},transcriptionSource:source,
        topics:[{title:'Manual topic',startTimeSeconds:0,endTimeSeconds:30}] }] });
    const lesson = course.lessons[0], originalTopic = lesson.topics[0].toObject();
    const tx = await Transcription.create({ course:course._id,lessonId:lesson._id,...source,status:'completed',resultToken:'r1',segmentCount:1 });
    const generated = [{title:'Sorting algorithms',startTimeSeconds:0,endTimeSeconds:300}];
    const createSuggestion = (token='r1') => Suggestion.create({course:course._id,lessonId:lesson._id,...source,transcriptionJobId:tx._id,transcriptResultToken:token,algorithmVersion:'semantic-windows-v1',modelRevision:'test',status:'completed',generatedTopics:generated,draftTopics:generated,reviewStatus:'pending',reviewRevision:0});
    let suggestion = await createSuggestion();
    // Deliberately includes an unmapped historic event: acceptance must not re-map it.
    const events = mongoose.connection.db.collection('confusionevents');
    await events.insertMany([{course:course._id,lessonId:lesson._id,topicId:originalTopic._id,videoTimestampSeconds:10}, {course:course._id,lessonId:lesson._id,topicId:null,videoTimestampSeconds:60}]);
    const beforeEvents = await events.find({}).toArray();
    const app = require('express')(); app.use(require('express').json()); app.use('/courses',require('../routes/topicSuggestionRoutes'));
    server = app.listen(0,'127.0.0.1'); await new Promise(r => server.once('listening',r));
    const base = `http://127.0.0.1:${server.address().port}/courses/${course.id}/lessons/${lesson.id}/topic-suggestions`;
    const jwt = require('jsonwebtoken');
    const request = async (method='GET',suffix='',body, user=tutor, version=null) => {
      const current = await Course.findById(course.id);
      const response = await fetch(base+suffix,{method,headers:{'Content-Type':'application/json','X-Course-Version':String(version ?? current.__v),...(user ? {Authorization:`Bearer ${jwt.sign({id:user.id},process.env.JWT_SECRET)}`} : {})},...(body ? {body:JSON.stringify(body)} : {})});
      return {status:response.status,body:await response.json()};
    };
    await t.test('authorization covers retrieval and review',async()=>{
      assert.equal((await request('GET','',undefined,null)).status,401);
      assert.equal((await request('GET','',undefined,student)).status,403);
      assert.equal((await request('GET','',undefined,other)).status,404);
      assert.equal((await request('POST',`/${suggestion.id}/accept`,{reviewRevision:0},other)).status,404);
      assert.equal((await request('POST',`/${suggestion.id}/accept`,{reviewRevision:0},student)).status,403);
      assert.equal((await request('PATCH',`/${suggestion.id}`,{reviewRevision:0,topics:[]},null)).status,401);
      const result = await request(); assert.equal(result.status,200); assert.equal(result.body.status,'completed');
      assert.equal(result.body.storedName,undefined); assert.equal(result.body.leaseToken,undefined);
    });
    await t.test('review validates drafts and never replaces existing topic IDs',async()=>{
      assert.equal((await request('POST',`/${suggestion.id}/accept`,{reviewRevision:0})).status,409);
      assert.equal((await request('PATCH',`/${suggestion.id}`,{reviewRevision:0,topics:[{title:'Invalid',startTimeSeconds:10,endTimeSeconds:5}]})).status,400);
      assert.equal((await request('PATCH',`/${suggestion.id}`,{reviewRevision:0,topics:[{title:'Too long',startTimeSeconds:30,endTimeSeconds:301}]})).status,400);
      const edit = await request('PATCH',`/${suggestion.id}`,{reviewRevision:0,topics:[{title:'Reviewed sorting',startTimeSeconds:30,endTimeSeconds:300}]});
      assert.equal(edit.status,200,JSON.stringify(edit.body)); assert.equal(edit.body.reviewRevision,1);
      assert.equal((await request('PATCH',`/${suggestion.id}`,{reviewRevision:0,topics:[]})).status,409);
      assert.equal((await request('POST',`/${suggestion.id}/accept`,{reviewRevision:1},tutor,0)).status,409);
      const version = (await Course.findById(course.id)).__v;
      const results = await Promise.all([request('POST',`/${suggestion.id}/accept`,{reviewRevision:1},tutor,version),request('POST',`/${suggestion.id}/accept`,{reviewRevision:1},tutor,version)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      const saved = (await Course.findById(course.id)).lessons[0];
      assert.deepEqual(saved.topics[0].toObject(),originalTopic);
      assert.equal(saved.topics.length,2); assert.equal(saved.transcript,'Manual transcript');
      assert.deepEqual(await events.find({}).toArray(),beforeEvents);
      assert.equal((await Suggestion.findById(suggestion.id)).generatedTopics[0].title,'Sorting algorithms');
    });
    await t.test('regenerated transcripts hide old suggestions and rejection changes no topics',async()=>{
      await Transcription.updateOne({_id:tx._id},{$set:{resultToken:'r2'}});
      assert.equal((await request()).body.status,'queued');
      assert.equal((await request('POST',`/${suggestion.id}/reject`,{reviewRevision:2})).status,409);
      suggestion = await createSuggestion('r2');
      const before = (await Course.findById(course.id)).lessons[0].topics.toObject();
      const rejected = await request('POST',`/${suggestion.id}/reject`,{reviewRevision:0});
      assert.equal(rejected.status,200,JSON.stringify(rejected.body)); assert.equal(rejected.body.reviewStatus,'rejected');
      assert.deepEqual((await Course.findById(course.id)).lessons[0].topics.toObject(),before);
    });
    await t.test('media replacement hides results and disallows acceptance',async()=>{
      await Course.updateOne({_id:course._id},{$set:{'lessons.0.transcriptionSource.mediaVersion':'v2'}});
      assert.equal((await request()).body.status,'awaiting_transcript');
      assert.equal((await request('POST',`/${suggestion.id}/accept`,{reviewRevision:1})).status,409);
      assert.deepEqual(await events.find({}).toArray(),beforeEvents);
    });
    await new Promise((resolve,reject)=>{
      const python = process.env.TOPIC_TEST_PYTHON || path.resolve(__dirname,'../../transcription-worker/.venv/bin/python');
      const child = spawn(python,['-B','-m','unittest','discover','-s','tests','-p','test_topics.py','-v'],{cwd:path.resolve(__dirname,'../../transcription-worker'),env:{...process.env,TOPIC_TEST_MONGO_URI:uri},stdio:'inherit'});
      child.once('error',reject); child.once('exit',code=>code===0?resolve():reject(new Error(`Topic Python tests failed: ${code}`)));
    });
  } finally {
    if(server) await new Promise(r=>server.close(r));
    await mongoose.disconnect();
    if(mongo.exitCode===null) { mongo.kill('SIGTERM'); await new Promise(r=>mongo.once('exit',r)); }
    await rm(temp,{recursive:true,force:true});
  }
});
