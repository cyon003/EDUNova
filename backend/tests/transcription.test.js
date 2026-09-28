const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const mongoose = require('mongoose');
const { setTranscriptionSource, queueTranscription } = require('../services/transcriptionService');

test('source versions change only when explicitly assigned; links and audio are excluded', () => {
  const lesson = { primaryMedia: { storedName: 'a.mp4', storage: 'course-videos', mimeType: 'video/mp4' }, transcript: 'manual', topics: [{ title: 'manual' }] };
  setTranscriptionSource(lesson); const first = lesson.transcriptionSource.mediaVersion;
  setTranscriptionSource(lesson); assert.notEqual(lesson.transcriptionSource.mediaVersion, first);
  assert.equal(lesson.transcript, 'manual'); assert.equal(lesson.topics[0].title, 'manual');
  for (const item of [{videoUrl:'https://example.com/a.mp4'}, {primaryMedia:{storedName:'a.mp3',mimeType:'audio/mpeg'}}]) { setTranscriptionSource(item); assert.equal(item.transcriptionSource, undefined); }
});

test('transcription MongoDB and authenticated API integration', {skip: process.env.RUN_TRANSCRIPTION_MONGO_TESTS !== 'true'}, async () => {
  process.env.JWT_SECRET = 'transcription-test-only-secret';
  const temp = await mkdtemp(path.join(os.tmpdir(), 'transcription-test-'));
  process.env.UPLOAD_ROOT = path.join(temp, 'uploads');
  const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const mongo = spawn('mongod', ['--dbpath', temp, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet'], {stdio:['ignore','pipe','pipe']});
  let server;
  try {
    await new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(new Error('Mongo startup timeout')),20000);
      mongo.once('error', e=>{clearTimeout(timer);reject(e)});
      mongo.once('exit', code=>{clearTimeout(timer);reject(new Error(`Mongo exit ${code}`))});
      mongo.stdout.on('data', chunk=>{if(chunk.toString().includes('Waiting for connections')){clearTimeout(timer);resolve()}});
    });
    const uri=`mongodb://127.0.0.1:${port}/transcription_test`;
    await mongoose.connect(uri);
    const Course=require('../models/Course'), User=require('../models/User'), Job=require('../models/TranscriptionJob'), Segment=require('../models/TranscriptSegment');
    await Promise.all([Course,User,Job,Segment].map(m=>m.init()));
    const tutor=await User.create({name:'Tutor',email:'tutor@transcription.test',password:'unused',role:'tutor'});
    const other=await User.create({name:'Other',email:'other@transcription.test',password:'unused',role:'tutor'});
    const student=await User.create({name:'Student',email:'student@transcription.test',password:'unused',role:'student'});
    const course=new Course({slug:'transcription',name:'Test',description:'Test',level:'Beginner',duration:'1:00',rating:0,tutor:tutor._id,lessons:[{title:'Test',transcript:'manual',primaryMedia:{storedName:'test.mp4',storage:'course-videos',mimeType:'video/mp4'}}]});
    const lesson=course.lessons[0]; setTranscriptionSource(lesson); await course.save();
    await Promise.all(Array.from({length:8},()=>queueTranscription(course,lesson)));
    assert.equal(await Job.countDocuments(),1);
    const job=await Job.findOne(); await Job.updateOne({_id:job.id},{$set:{status:'completed',resultToken:'result',segmentCount:1}});
    await Segment.create({jobId:job._id,resultToken:'result',index:0,startTimeSeconds:0,endTimeSeconds:2,text:'hello'});
    const app=require('express')(); app.use(require('express').json()); app.use('/tutor', require('../routes/tutorRoutes')); app.use('/courses',require('../routes/transcriptionRoutes'));
    server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
    const jwt=require('jsonwebtoken');
    const request=async user=>fetch(`http://127.0.0.1:${server.address().port}/courses/${course.id}/lessons/${lesson.id}/transcription`,{headers:user?{Authorization:`Bearer ${jwt.sign({id:user.id},process.env.JWT_SECRET)}`}:{}});
    assert.equal((await request(null)).status,401);
    assert.equal((await request(student)).status,403);
    assert.equal((await request(other)).status,404);
    const response=await request(tutor); assert.equal(response.status,200); assert.equal((await response.json()).segments[0].text,'hello');
    setTranscriptionSource(lesson); await course.save();
    const replacement=await (await request(tutor)).json(); assert.equal(replacement.status,'queued'); assert.deepEqual(replacement.segments,[]);
    assert.equal((await Course.findById(course.id)).lessons[0].transcript,'manual');
    const upload = async (method, suffix, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/tutor/courses/${course.id}${suffix}`, {method, headers:{Authorization:`Bearer ${jwt.sign({id:tutor.id},process.env.JWT_SECRET)}`, ...(body instanceof FormData ? {} : {'Content-Type':'application/json'})}, body:body instanceof FormData ? body : JSON.stringify(body)});
      const data=await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
    };
    const videoForm = () => {const form=new FormData(); form.append('video',new Blob(['test fixture'],{type:'video/mp4'}),'fixture.mp4'); form.append('durationSeconds','60'); return form;};
    const create=videoForm(); create.append('title','Uploaded'); create.append('transcript','keep manual');
    let uploaded=await upload('POST','/lessons',create);
    const uploadedId=uploaded.lessons.at(-1)._id;
    assert.equal(uploaded.lessons.at(-1).transcriptionSource, undefined);
    let saved=await Course.findById(course.id);
    let version=saved.lessons.id(uploadedId).transcriptionSource.mediaVersion;
    assert.ok(await Job.exists({lessonId:uploadedId,mediaVersion:version}));
    await upload('POST',`/lessons/${uploadedId}/main-media`,videoForm());
    saved=await Course.findById(course.id);
    assert.notEqual(saved.lessons.id(uploadedId).transcriptionSource.mediaVersion,version);
    version=saved.lessons.id(uploadedId).transcriptionSource.mediaVersion;
    await upload('PATCH',`/lessons/${uploadedId}`,videoForm());
    saved=await Course.findById(course.id);
    assert.notEqual(saved.lessons.id(uploadedId).transcriptionSource.mediaVersion,version);
    const resourceForm=new FormData(); resourceForm.append('resources',new Blob(['resource fixture'],{type:'video/mp4'}),'resource.mp4');
    await upload('POST',`/lessons/${uploadedId}/resources`,resourceForm);
    saved=await Course.findById(course.id); const resource=saved.lessons.id(uploadedId).resources[0];
    await upload('PATCH',`/lessons/${uploadedId}/main-media`,{resourceId:resource.id});
    saved=await Course.findById(course.id); const promoted=saved.lessons.id(uploadedId);
    assert.equal(promoted.transcriptionSource.storage,'lesson-resources');
    assert.equal(promoted.transcript,'keep manual');
    assert.ok(await Job.exists({lessonId:uploadedId,mediaVersion:promoted.transcriptionSource.mediaVersion}));
    // Older saved lesson: a local video exists but no processing intent was created.
    const { mkdir, writeFile, readFile } = require('node:fs/promises');
    await mkdir(path.join(process.env.UPLOAD_ROOT, 'course-videos'), {recursive:true});
    const oldFile=path.join(process.env.UPLOAD_ROOT,'course-videos','old.mp4');
    await writeFile(oldFile,'immutable old video fixture');
    const old=await Course.create({slug:'old',name:'Old',description:'Test',level:'Beginner',duration:'1:00',rating:0,tutor:tutor._id,lessons:[{title:'Old',videoUrl:'/uploads/course-videos/old.mp4',transcript:'manual preserved',topics:[{title:'Manual',startTimeSeconds:0,endTimeSeconds:10}]}]});
    const before=old.lessons[0].toObject();
    const oldPath=`http://127.0.0.1:${server.address().port}/courses/${old.id}/lessons/${old.lessons[0].id}/transcription`;
    const generate=async (user,version=old.__v)=>fetch(oldPath,{method:'POST',headers:{...(user?{Authorization:`Bearer ${jwt.sign({id:user.id},process.env.JWT_SECRET)}`} : {}),...(version==null?{}:{'X-Course-Version':String(version)})}});
    assert.equal((await generate(null)).status,401);
    assert.equal((await generate(student)).status,403);
    assert.equal((await generate(other)).status,404);
    assert.equal((await generate(tutor,null)).status,428);
    const attempts=await Promise.all(Array.from({length:6},()=>generate(tutor)));
    assert.ok(attempts.some(r=>r.status===202)); assert.ok(attempts.every(r=>[202,409].includes(r.status)));
    let oldSaved=await Course.findById(old.id);
    assert.equal((await generate(tutor)).status,409);
    assert.equal((await generate(tutor,oldSaved.__v)).status,202);
    assert.equal(await Job.countDocuments({course:old.id}),1);
    assert.equal(oldSaved.lessons[0].transcript,before.transcript);
    assert.deepEqual(oldSaved.lessons[0].topics.toObject(),before.topics);
    assert.deepEqual(oldSaved.lessons[0].toObject().quiz,before.quiz);
    assert.equal(oldSaved.lessons[0].videoUrl,before.videoUrl);
    assert.equal(await readFile(oldFile,'utf8'),'immutable old video fixture');
    const oldJob=await Job.findOne({course:old.id});
    await Job.updateOne({_id:oldJob._id},{$set:{status:'completed',resultToken:'keep',segmentCount:0}});
    assert.equal((await (await generate(tutor,oldSaved.__v)).json()).status,'completed');
    assert.equal((await Job.findById(oldJob._id)).resultToken,'keep');
    oldSaved.lessons[0].primaryMedia.storedName='missing.mp4';setTranscriptionSource(oldSaved.lessons[0]);await oldSaved.save();
    assert.equal((await generate(tutor,oldSaved.__v-1)).status,409);
    const missing=await generate(tutor,oldSaved.__v);assert.equal(missing.status,422);assert.match((await missing.json()).message,/original video file is unavailable/);
    assert.equal(await Job.countDocuments({course:old.id}),1);
    oldSaved.lessons[0].primaryMediaRemoved=true;await oldSaved.save();
    assert.equal((await generate(tutor,oldSaved.__v)).status,422);
    const python=process.env.TRANSCRIPTION_TEST_PYTHON || path.resolve(__dirname,'../../confusion-service/venv/bin/python');
    await new Promise((resolve,reject)=>{
      const child=spawn(python,['-B','-m','unittest','discover','-s','tests','-v'],{cwd:path.resolve(__dirname,'../../transcription-worker'),env:{...process.env,TRANSCRIPTION_TEST_MONGO_URI:uri},stdio:'inherit'});
      child.once('error',reject); child.once('exit',code=>code===0?resolve():reject(new Error(`Worker tests failed: ${code}`)));
    });
  } finally {
    if(server) await new Promise(r=>server.close(r));
    await mongoose.disconnect();
    mongo.kill('SIGTERM'); await new Promise(r=>mongo.once('exit',r));
    await rm(temp,{recursive:true,force:true});
  }
});

test('generation resolves the same main video as playback for existing media shapes', () => {
  const { primaryMediaFor } = require('../utils/primaryMedia');
  const main={storedName:'main.mp4',storage:'course-videos',mimeType:'video/mp4'};
  assert.deepEqual(primaryMediaFor({primaryMedia:main}),main);
  const resource={_id:'resource',storedName:'resource.webm',originalName:'lecture.webm',mimeType:'video/webm'};
  assert.equal(primaryMediaFor({resources:[resource]}).storage,'lesson-resources');
  assert.equal(primaryMediaFor({resources:[resource],videoUrl:'/uploads/course-videos/old.mp4'}).storedName,'resource.webm');
  assert.equal(primaryMediaFor({videoUrl:'/uploads/course-videos/old.mp4'}).storedName,'old.mp4');
  assert.equal(primaryMediaFor({videoUrl:'https://example.com/lecture.mp4'}),null);
  assert.equal(primaryMediaFor({primaryMediaRemoved:true,videoUrl:'/uploads/course-videos/old.mp4'}),null);
});
