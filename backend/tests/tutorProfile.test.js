const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'tutor-profile-tests-secret-at-least-32-characters';
const User = require('../models/User');
const app = require('../app');
const tutorId = '507f1f77bcf86cd799439081';
const otherId = '507f1f77bcf86cd799439082';
let server, originals, user, updates, failUpdate;
const token = (id=tutorId) => jwt.sign({id,tokenVersion:0},process.env.JWT_SECRET);
const select = (record, fields) => Object.fromEntries(fields.split(' ').filter(key=>key in record).map(key=>[key,record[key]]));
function request(method, body, authorization=token()) {
 const payload=body && method !== 'GET' ? JSON.stringify(body) : '';
 return new Promise((resolve,reject)=>{
  const outgoing=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/tutor/profile',method,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),Connection:'close',...(authorization?{Authorization:`Bearer ${authorization}`}:{})}},response=>{
   let text='';response.on('data',chunk=>{text+=chunk});response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));
  });outgoing.on('error',reject);outgoing.end(payload);
 });
}
test.before(async()=>{
 originals={find:User.findById,update:User.findByIdAndUpdate};
 User.findById=id=>({select:async fields=>String(id)===tutorId?(fields==='-password'?user:select(user,fields)):null});
 User.findByIdAndUpdate=(id,update,options)=>({select:async fields=>{
  if(failUpdate)throw new Error('Database unavailable');
  updates.push({id,update,options});
  for(const [key,value] of Object.entries(update.$set)){
   if(key.startsWith('tutorProfile.'))user.tutorProfile[key.slice(13)]=value;else user[key]=value;
  }
  return select(user,fields);
 }});
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
});
test.after(async()=>{User.findById=originals.find;User.findByIdAndUpdate=originals.update;await new Promise(resolve=>server.close(resolve));});
test.beforeEach(()=>{updates=[];failUpdate=false;user={_id:tutorId,name:'Maya Chen',email:'maya@example.edu',role:'tutor',accountStatus:'approved',tokenVersion:0,password:'never-return',createdBy:otherId,tutorProfile:{bio:'Existing biography',photoUrl:'/portrait.jpg',education:'MSc'}};});

test('authenticated tutor receives existing profile and safe role/status fields',async()=>{
 const result=await request('GET');assert.equal(result.status,200);assert.equal(result.body.name,'Maya Chen');assert.equal(result.body.role,'tutor');assert.equal(result.body.accountStatus,'approved');assert.equal(result.body.tutorProfile.bio,'Existing biography');
 for(const field of ['password','createdBy','tokenVersion'])assert.equal(field in result.body,false);
});
test('profile cannot be read or updated without an authenticated approved tutor',async()=>{
 for(const method of ['GET','PATCH']){
  assert.equal((await request(method,{name:'Changed'},null)).status,401);
  assert.equal((await request(method,{name:'Changed'},token(otherId))).status,401);
 }
 user.role='student';assert.equal((await request('GET')).status,403);assert.equal((await request('PATCH',{name:'Changed'})).status,403);
 user.role='tutor';user.accountStatus='suspended';assert.equal((await request('PATCH',{name:'Changed'})).status,403);assert.equal(updates.length,0);
});
test('valid updates target authenticated tutor and preserve omitted fields and upload',async()=>{
 const result=await request('PATCH',{name:' Maya Chen ',bio:' New biography ',phoneNumber:'+66 81 234 5678',userId:otherId,role:'admin',email:'attacker@example.edu',photoUrl:'/untrusted.jpg'});
 assert.equal(result.status,200);assert.equal(result.body.tutorProfile.bio,'New biography');assert.equal(result.body.tutorProfile.education,'MSc');assert.equal(result.body.tutorProfile.photoUrl,'/portrait.jpg');assert.equal(result.body.email,'maya@example.edu');assert.equal(result.body.role,'tutor');
 assert.equal(updates[0].id,tutorId);assert.deepEqual(Object.keys(updates[0].update.$set).sort(),['name','tutorProfile.bio','tutorProfile.phoneNumber']);assert.equal(updates[0].options.runValidators,true);
});
test('invalid names, phones, types and excessive lengths return 400 without changes',async()=>{
 for(const body of [{name:' '},{name:'x'.repeat(121)},{phoneNumber:'abcdefghi'},{phoneNumber:'123'},{phoneNumber:'1234567890123456'},{bio:'x'.repeat(3001)},{education:'x'.repeat(2001)},{teachingExperience:'x'.repeat(2001)},{expertise:'x'.repeat(501)},{bio:{unexpected:true}}])assert.equal((await request('PATCH',body)).status,400,JSON.stringify(body).slice(0,60));
 assert.equal(updates.length,0);assert.equal(user.tutorProfile.bio,'Existing biography');
});
test('optional fields can be cleared and database errors allow retry',async()=>{
 failUpdate=true;assert.equal((await request('PATCH',{bio:'New'})).status,500);
 failUpdate=false;const result=await request('PATCH',{bio:'',phoneNumber:''});assert.equal(result.status,200);assert.equal(result.body.tutorProfile.bio,'');assert.equal(result.body.tutorProfile.phoneNumber,'');
});
