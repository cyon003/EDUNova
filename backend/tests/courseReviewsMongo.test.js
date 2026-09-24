const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");

test("course reviews enforce HTTP access and maintain concurrent averages on disposable MongoDB", { skip: process.env.RUN_REVIEW_MONGO_TESTS !== "true" }, async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "course-review-test-secret-at-least-32-characters";
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const Course = require("../models/Course");
  const User = require("../models/User");
  const Enrollment = require("../models/Enrollment");
  const temp = await mkdtemp(path.join(os.tmpdir(), "edunova-reviews-"));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const mongo = spawn("mongod", ["--dbpath", temp, "--port", String(port), "--bind_ip", "127.0.0.1", "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  let server;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Mongo startup timeout")), 20000);
      mongo.once("error", error => { clearTimeout(timer); reject(error); });
      mongo.once("exit", code => { clearTimeout(timer); reject(new Error(`Mongo exited ${code}`)); });
      mongo.stdout.on("data", chunk => { if (chunk.toString().includes("Waiting for connections")) { clearTimeout(timer); resolve(); } });
    });
    await mongoose.connect(`mongodb://127.0.0.1:${port}/reviews_test`);
    const students = await User.create(["one", "two", "outsider"].map(name => ({ name, email: `${name}@reviews.test`, password: "unused" })));
    const tutor = await User.create({name:"Tutor", email:"tutor@reviews.test",password:"unused",role:"tutor"});
    const course = await Course.create({slug:"science",name:"Science",description:"Science",level:"Beginner",duration:"1 min",rating:4.9,moderationStatus:"published",lessons:[{title:"Gravity"}]});
    await Enrollment.create(students.slice(0,2).map(student => ({student:student._id,course:course._id})));
    server = require("../app").listen(0,"127.0.0.1");
    await new Promise(resolve => server.once("listening",resolve));
    const request = async (method, suffix, user, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/courses/science${suffix}`, {method,headers:{"Content-Type":"application/json",...(user?{Authorization:`Bearer ${jwt.sign({id:user.id},process.env.JWT_SECRET)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    };
    assert.equal((await request("PUT","/reviews/me",null,{rating:5})).status,401);
    assert.equal((await request("PUT","/reviews/me",tutor,{rating:5})).status,403);
    assert.equal((await request("PUT","/reviews/me",students[2],{rating:5})).status,403);
    assert.equal((await request("GET","",null)).body.rating,0);
    await Promise.all(Array.from({length:5},()=>request("PUT","/reviews/me",students[0],{rating:5,comment:"$not an expression"})));
    await request("PUT","/reviews/me",students[1],{rating:3});
    let data=(await request("GET","/reviews",null)).body;
    assert.equal(data.reviewCount,2); assert.equal(data.rating,4); assert.equal(data.reviews.length,2);
    assert.equal(data.reviews.find(item=>item.student===students[0].id).comment,"$not an expression");
    await request("PUT","/reviews/me",students[0],{rating:1});
    data=(await request("GET","",null)).body;
    assert.equal(data.rating,2); assert.equal(data.reviewCount,2); assert.equal(data.courseReviews,undefined);
    await request("DELETE","/reviews/me",students[2]);
    assert.equal((await request("GET","/reviews",null)).body.reviewCount,2);
    await request("DELETE","/reviews/me",students[0]);
    data=(await request("GET","/reviews",null)).body;
    assert.equal(data.rating,3); assert.equal(data.reviews[0].student,students[1].id);
    await request("DELETE","/reviews/me",students[1]);
    assert.equal((await request("GET","/reviews",null)).body.rating,0);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await mongoose.disconnect();
    if(mongo.exitCode===null) { const exited=new Promise(resolve=>mongo.once("exit",resolve)); mongo.kill("SIGTERM"); await exited; }
    await rm(temp,{recursive:true,force:true});
  }
});
