const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");

const { topicAtTimestamp, topicFields } = require("../utils/lessonTopics");
const Course = require("../models/Course");
const topics = [
  { title: " Variables ", startTimeSeconds: 0, endTimeSeconds: 270 },
  { title: "Loops", startTimeSeconds: 270, endTimeSeconds: 480 },
];
test("topic validation accepts legacy omission, trims titles and rejects invalid ranges/IDs", async () => {
  assert.deepEqual(topicFields({}).values, {});
  assert.equal(topicFields({ topics }).values.topics[0].title, "Variables");
  assert.equal(topicFields({ topics: JSON.stringify(topics) }).values.topics.length, 2);
  for (const invalid of [null, {}, "bad", [{...topics[0], title:" "}], [{...topics[0], startTimeSeconds:-1}], [{...topics[0], endTimeSeconds:0}], [{...topics[0], endTimeSeconds:Infinity}], [{...topics[0], startTimeSeconds:"0"}], [topics[1],topics[0]], [topics[0], {...topics[1], startTimeSeconds:269}]]) assert.ok(topicFields({topics:invalid}).error);
  assert.ok(topicFields({topics}, [], 400).error);
  assert.ok(topicFields({topics:[{...topics[0],_id:"507f1f77bcf86cd799439011"}]}).error);
  assert.ok(topicFields({topics:[{...topics[0],title:"x".repeat(201)}]}).error);
  assert.ok(topicFields({topics:[{...topics[0],extra:true}]}).error);
  assert.ok(topicFields({topics:Array.from({length:201},(_,index)=>({title:"Topic",startTimeSeconds:index,endTimeSeconds:index+1}))}).error);
  const id="507f1f77bcf86cd799439011";
  assert.ok(topicFields({topics:topics.map(topic=>({...topic,_id:id}))},[{_id:id}]).error);
  assert.deepEqual(topicFields({topics:[]}).values,{topics:[]});
  const base={slug:"topics",name:"Topics",description:"Test",level:"Beginner",duration:"10:00",rating:0};
  await new Course({...base,lessons:[{title:"Legacy",transcript:"kept"}]}).validate();
  await new Course({...base,lessons:[{title:"Topics",topics}]}).validate();
  await assert.rejects(new Course({...base,lessons:[{title:"Invalid",topics:[topics[1],topics[0]]}]}).validate());
});
test("ConfusionEvent validates snapshots and probability and has query indexes", async () => {
  const ConfusionEvent=require("../models/ConfusionEvent");
  const id="507f1f77bcf86cd799439011";
  const base={student:id,course:id,lessonId:id,videoTimestampSeconds:0,confusionProbability:0.8,prediction:"confused",modelVersion:"3b-v1",source:"random_forest",deduplicationKey:"timestamp:0",signalsSnapshot:{maximumVideoProgressPercent:20,activeTimeSeconds:10,pauseCount:1,replayCount:0,visitCount:1,lessonCompleted:false}};
  await new ConfusionEvent(base).validate();
  for(const patch of [{videoTimestampSeconds:-1},{confusionProbability:1.1},{modelVersion:""},{source:"client"},{signalsSnapshot:{...base.signalsSnapshot,pauseCount:1.5}}]) await assert.rejects(new ConfusionEvent({...base,...patch}).validate());
  assert.ok(ConfusionEvent.schema.indexes().some(([fields])=>fields.course===1&&fields.lessonId===1&&fields.topicId===1&&fields.createdAt===-1));
  assert.equal(ConfusionEvent.schema.path("transcript"),undefined);
});
test("topic mapping uses half-open ranges, includes final endpoint and handles gaps", () => {
  const lesson={topics};
  assert.equal(topicAtTimestamp(lesson,0),topics[0]);
  assert.equal(topicAtTimestamp(lesson,270),topics[1]);
  assert.equal(topicAtTimestamp(lesson,480),topics[1]);
  for(const time of [-1,481,NaN,Infinity,"2"]) assert.equal(topicAtTimestamp(lesson,time),null);
  assert.equal(topicAtTimestamp({},10),null);
  assert.equal(topicAtTimestamp({topics:[topics[0],{...topics[1],startTimeSeconds:300}]},280),null);
});

test("topic management and confusion events on disposable MongoDB", { skip: process.env.RUN_TOPIC_MONGO_TESTS !== "true" }, async (t) => {
  process.env.NODE_ENV="test";
  process.env.JWT_SECRET="topic-test-only-secret-at-least-32-characters";
  const mongoose=require("mongoose");
  const jwt=require("jsonwebtoken");
  const User=require("../models/User");
  const Enrollment=require("../models/Enrollment");
  const LearningSignal=require("../models/LearningSignal");
  const ConfusionEvent=require("../models/ConfusionEvent");
  const {recordConfusionEvent}=require("../services/confusionEventService");
  const originalFetch=global.fetch;
  const temp = await mkdtemp(path.join(os.tmpdir(), "edunova-topics-test-"));
  process.env.UPLOAD_ROOT = path.join(temp, "uploads");
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const mongo = spawn("mongod", ["--dbpath", temp, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "topicTest", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  let server;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test MongoDB startup timed out")), 20000);
      mongo.once("error", error => { clearTimeout(timer); reject(error); });
      mongo.once("exit", code => { clearTimeout(timer); reject(new Error(`Test MongoDB exited ${code}`)); });
      mongo.stdout.on("data", chunk => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    });
    // Bootstrap before connecting Mongoose: automatic model creation must wait
    // until this disposable replica set has elected a writable primary.
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
      await bootstrap.connect();
      await bootstrap.db().admin().command({ replSetInitiate: { _id: "topicTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      for (let i = 0; ; i++) {
        if ((await bootstrap.db().admin().command({ hello: 1 })).isWritablePrimary) break;
        if (i > 100) throw new Error("Replica set did not elect a primary");
        await delay(100);
      }
    } finally {
      await bootstrap.close();
    }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/topic_test?replicaSet=topicTest`);
    await Promise.all([User,Course,Enrollment,LearningSignal,ConfusionEvent].map(model=>model.init()));
    const tutor=await User.create({name:"Tutor",email:"tutor@topics.test",password:"unused",role:"tutor"});
    const stranger=await User.create({name:"Other tutor",email:"other@topics.test",password:"unused",role:"tutor"});
    const student=await User.create({name:"Student",email:"student@topics.test",password:"unused"});
    const outsider=await User.create({name:"Outsider",email:"outsider@topics.test",password:"unused"});
    const course=await Course.create({slug:"topic-test",name:"Topics",description:"Test",level:"Beginner",duration:"16:00",rating:0,tutor:tutor._id,lessons:[{title:"Legacy",transcript:"preserved"}]});
    await Enrollment.create({student:student._id,course:course._id});
    const lessonId=course.lessons[0].id;
    server=require("../app").listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
    const request=async(method,route,body,user=student)=>{
      const response=await originalFetch(`http://127.0.0.1:${server.address().port}/api${route}`,{method,headers:{"Content-Type":"application/json",...(user?{Authorization:`Bearer ${jwt.sign({id:user.id},process.env.JWT_SECRET)}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:response.status,body:await response.json()};
    };
    const route=`/learning-signals/${course.id}/${lessonId}/prediction`;
    const edit=`/tutor/courses/${course.id}/lessons/${lessonId}`;
    let resultLabel="confused", payload;
    global.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({prediction:resultLabel,confusionProbability:0.8,clearProbability:0.2,modelVersion:"3b-v1"})}};
    await t.test("owning tutor edits topics while transcript and legacy lessons survive",async()=>{
      assert.equal((await request("PATCH",edit,{topics},tutor)).status,200);
      const stored=(await Course.findById(course.id)).lessons.id(lessonId);
      assert.equal(stored.topics[0].title,"Variables");assert.equal(stored.transcript,"preserved");
      assert.equal((await request("PATCH",edit,{topics:stored.topics.map(item=>item.toObject())},tutor)).status,200);
      assert.equal((await request("PATCH",edit,{summary:"updated"},tutor)).status,200);
      assert.equal((await Course.findById(course.id)).lessons.id(lessonId).topics.length,2);
      assert.equal((await request("PATCH",edit,{topics:[]},stranger)).status,404);
      assert.equal((await request("PATCH",edit,{topics:[]},student)).status,403);
      assert.equal((await request("PATCH",edit,{topics:[]},null)).status,401);
      for(const invalid of [[{...topics[0],startTimeSeconds:-1}],[{...topics[0],endTimeSeconds:0}],[topics[0],{...topics[1],startTimeSeconds:200}]]) assert.equal((await request("PATCH",edit,{topics:invalid},tutor)).status,400);
    });
    await t.test("lesson creation accepts JSON-encoded topics, rejects duration overflow, remains optional",async()=>{
      const base={title:"Created",references:[{url:"https://example.com/material"}],durationSeconds:480,transcript:"text"};
      assert.equal((await request("POST",`/tutor/courses/${course.id}/lessons`,{...base,topics:JSON.stringify(topics)},tutor)).status,201);
      assert.equal((await request("POST",`/tutor/courses/${course.id}/lessons`,{...base,topics,durationSeconds:300},tutor)).status,400);
      assert.equal((await request("POST",`/tutor/courses/${course.id}/lessons`,base,tutor)).status,201);
    });
    await t.test("only enrolled authenticated students with a matching lesson can predict",async()=>{
      assert.equal((await request("POST",route,{videoTimestampSeconds:10},null)).status,401);
      assert.equal((await request("POST",route,{videoTimestampSeconds:10},tutor)).status,403);
      assert.equal((await request("POST",route,{videoTimestampSeconds:10},outsider)).status,403);
      assert.equal((await request("POST",`/learning-signals/${course.id}/${new mongoose.Types.ObjectId()}/prediction`,{videoTimestampSeconds:10})).status,404);
    });
    await t.test("forged fields and invalid timestamps never reach prediction/event storage",async()=>{
      for(const field of ["studentId","student","topicId","topicTitle","confusionProbability","prediction","modelVersion","maximumVideoProgressPercent","activeTimeSeconds","pauseCount","replayCount","visitCount","lessonCompleted","signalsSnapshot"]){
        assert.equal((await request("POST",route,{videoTimestampSeconds:10,[field]:"forged"})).status,400);
      }
      for(const value of [-1,null,"10",{},true]) assert.equal((await request("POST",route,{videoTimestampSeconds:value})).status,400);
      assert.equal(await ConfusionEvent.countDocuments({}),0);
    });
    await t.test("confused prediction captures server features and mapped topic without changing RF payload",async()=>{
      await request("PATCH",`/learning-signals/${course.id}/${lessonId}`,{activeTimeSecondsDelta:50,pauseCountDelta:2,visitCountDelta:1});
      const result=await request("POST",route,{videoTimestampSeconds:270});assert.equal(result.status,200);
      assert.deepEqual(Object.keys(payload).sort(),["maximumVideoProgressPercent","activeTimeSeconds","pauseCount","replayCount","visitCount","lessonCompleted"].sort());
      const event=await ConfusionEvent.findOne({});assert.equal(event.topicTitle,"Loops");assert.equal(event.videoTimestampSeconds,270);
      assert.equal(String(event.student),student.id);assert.equal(event.signalsSnapshot.activeTimeSeconds,50);assert.equal(event.signalsSnapshot.pauseCount,2);
      assert.equal(event.modelVersion,"3b-v1");assert.equal(event.confusionProbability,0.8);
      assert.equal((await LearningSignal.findOne({student:student._id})).aiPrediction.prediction,"confused");
    });
    await t.test("clear prediction and old timestamp-free requests create no events",async()=>{
      const before=await ConfusionEvent.countDocuments({});resultLabel="clear";
      assert.equal((await request("POST",route,{videoTimestampSeconds:10})).status,200);
      resultLabel="confused";assert.equal((await request("POST",route,{})).status,200);
      assert.equal((await request("POST",route)).status,200);
      assert.equal(await ConfusionEvent.countDocuments({}),before);
    });
    await t.test("concurrent same-topic events are suppressed; later events and other topics survive",async()=>{
      await ConfusionEvent.deleteMany({});
      const results=await Promise.all(Array.from({length:5},()=>request("POST",route,{videoTimestampSeconds:10})));
      assert.ok(results.every(item=>item.status===200));assert.equal(await ConfusionEvent.countDocuments({}),1);
      assert.equal((await request("POST",route,{videoTimestampSeconds:100})).status,200);assert.equal(await ConfusionEvent.countDocuments({}),1);
      await request("POST",route,{videoTimestampSeconds:300});assert.equal(await ConfusionEvent.countDocuments({}),2);
      const lesson=(await Course.findById(course.id)).lessons.id(lessonId);
      const previous=await ConfusionEvent.findOne({topicTitle:"Variables"});
      const signal=await LearningSignal.findOne({student:student._id});
      const features=Object.fromEntries(Object.keys(payload).map(key=>[key,signal[key]]));
      const args={student:student._id,course:course._id,lesson,timestamp:10,prediction:signal.aiPrediction,features};
      assert.equal(await recordConfusionEvent(args,new Date(previous.createdAt.getTime()+119999)),null);
      assert.ok(await recordConfusionEvent(args,new Date(previous.createdAt.getTime()+120000)));
    });
    await t.test("unmapped timestamps use null topic and 30-second context bins",async()=>{
      await ConfusionEvent.deleteMany({});
      for(const timestamp of [600,610,650]) assert.equal((await request("POST",route,{videoTimestampSeconds:timestamp})).status,200);
      assert.equal(await ConfusionEvent.countDocuments({topicId:null}),2);
      assert.equal((await ConfusionEvent.findOne({})).topicTitle,null);
      assert.equal((await request("PATCH",edit,{topics:[]},tutor)).status,200);
      assert.equal((await request("POST",route,{videoTimestampSeconds:0})).status,200);
      assert.equal(await ConfusionEvent.countDocuments({topicId:null}),3);
    });
    await t.test("cooldown does not suppress a different enrolled student's event",async()=>{
      await Enrollment.create({student:outsider._id,course:course._id});
      assert.equal((await request("POST",route,{videoTimestampSeconds:0},outsider)).status,200);
      assert.equal(await ConfusionEvent.countDocuments({student:outsider._id,topicId:null}),1);
    });
    await t.test("topic analytics aggregates real events without duplicate inflation, remapping or privacy leaks",async()=>{
      assert.equal((await request("PATCH",edit,{topics},tutor)).status,200);
      const currentLesson=(await Course.findById(course.id)).lessons.id(lessonId);
      const currentTopic=currentLesson.topics[0];
      const otherStudents=Array.from({length:3},()=>new mongoose.Types.ObjectId());
      for(const id of otherStudents)await LearningSignal.create({student:id,course:course._id,lessonId,aiPrediction:{prediction:"clear",confusionProbability:0.2,clearProbability:0.8,modelVersion:"test",predictedAt:new Date()}});
      const Exposure=require("../models/LessonVideoExposure");
      await Exposure.init();
      await Exposure.create([student._id,outsider._id,...otherStudents].map(id=>({student:id,course:course._id,lessonId,watchedRanges:[{startTimeSeconds:0,endTimeSeconds:480}],totalUniqueWatchedSeconds:480})));
      const template=(await ConfusionEvent.findOne({student:student._id}).select("+deduplicationKey")).toObject();
      delete template._id; delete template.__v;
      const event=(overrides={})=>({...template,topicId:currentTopic._id,topicTitle:currentTopic.title,videoTimestampSeconds:10,createdAt:new Date("2026-09-18T00:00:00Z"),...overrides});
      await ConfusionEvent.create([
        event(),event({createdAt:new Date("2026-09-18T00:03:00Z")}),event({student:outsider._id}),
        event({student:otherStudents[0],prediction:"clear"}),
        event({topicId:new mongoose.Types.ObjectId(),topicTitle:"Deleted topic"}),
        event({course:new mongoose.Types.ObjectId(),student:otherStudents[1]}),
      ]);
      const result=await request("GET","/tutor/analytics",undefined,tutor);
      assert.equal(result.status,200);
      const row=result.body.heatmapCourses.find(item=>item.courseId===course.id).lessons.find(item=>item.lessonId===lessonId);
      assert.equal(row.observedStudents,5);assert.equal(row.topics[0].confusedStudents,2);assert.equal(row.topics[0].confusionRate,40);
      assert.equal(row.topics[0].sampleSufficient,true);assert.equal(row.topics[0].latestConfusionAt,"2026-09-18T00:03:00.000Z");
      assert.equal(row.topics[1].confusedStudents,0);assert.equal(row.topics[1].confusionRate,0);
      assert.equal(row.unmappedConfusionStudents,2);assert.equal(row.historicalConfusionStudents,1);
      assert.equal(row.predictionCount,5);assert.equal(row.predictedConfused,2);assert.equal(row.confusionRate,40);
      const encoded=JSON.stringify(result.body);
      for(const id of [student.id,outsider.id,...otherStudents.map(String)])assert.equal(encoded.includes(id),false);
      assert.equal(encoded.includes("signalsSnapshot"),false);
      assert.deepEqual((await request("GET","/tutor/analytics",undefined,stranger)).body.heatmapCourses,[]);
    });
    await t.test("exposure endpoint validates access and merges concurrent playback batches without lost coverage",async()=>{
      const watcher=await User.create({name:"Watcher",email:"watcher@topics.test",password:"unused"});
      const exposureRoute=`/learning-signals/${course.id}/${lessonId}/exposure`;
      const range=(start,end)=>({watchedRanges:[{startTimeSeconds:start,endTimeSeconds:end}]});
      assert.equal((await request("PATCH",exposureRoute,range(10,20),null)).status,401);
      assert.equal((await request("PATCH",exposureRoute,range(10,20),watcher)).status,403);
      assert.equal((await request("PATCH",exposureRoute,range(10,20),tutor)).status,403);
      await Enrollment.create({student:watcher._id,course:course._id});
      assert.equal((await request("PATCH",`/learning-signals/${course.id}/${new mongoose.Types.ObjectId()}/exposure`,range(10,20),watcher)).status,404);
      for(const field of ["studentId","topicId","totalUniqueWatchedSeconds","sufficientlyExposed"])assert.equal((await request("PATCH",exposureRoute,{...range(10,20),[field]:"forged"},watcher)).status,400);
      assert.equal((await request("PATCH",exposureRoute,range(0,1000),watcher)).status,400);
      assert.equal((await request("PATCH",exposureRoute,range(10,20),watcher)).body.totalUniqueWatchedSeconds,10);
      const results=await Promise.all([request("PATCH",exposureRoute,range(15,30),watcher),request("PATCH",exposureRoute,range(30,40),watcher)]);
      assert.ok(results.every(r=>r.status===200));
      assert.equal((await request("PATCH",exposureRoute,range(10,20),watcher)).body.totalUniqueWatchedSeconds,30);
      const saved=await require("../models/LessonVideoExposure").findOne({student:watcher._id,course:course._id,lessonId});
      assert.equal(saved.watchedRanges.length,1);assert.equal(saved.watchedRanges[0].startTimeSeconds,10);assert.equal(saved.watchedRanges[0].endTimeSeconds,40);
    });
  } finally {
    global.fetch=originalFetch;
    if(server)await new Promise(resolve=>server.close(resolve));
    await mongoose.disconnect();
    if(mongo.exitCode===null){mongo.kill("SIGTERM");await new Promise(resolve=>mongo.once("exit",resolve));}
    await rm(temp,{recursive:true,force:true});
  }
});
