import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonSaveRequest, topicPayload, hasLessonEdits } from '../src/utils/lessonEditor.js';
import { parseTopicTime, formatTopicTime } from '../src/utils/topicTime.js';
const values = () => ({ lessonId: 'middle', courseVersion: 7, title: 'Keep title', duration: '02:00', mainVideo: null, documents: [], referenceLinks: '', topics: [{ _id: 'topic', title: 'Intro', startTimeSeconds: 0, endTimeSeconds: 60.125 }], quiz: {title:'Quiz', questions:[{_editorKey:'local', question:'Keep?',options:['yes','no'],correctOption:0}]}});
test('topic timestamps retain seconds, precision and IDs and reject invalid ranges', () => {
  assert.equal(formatTopicTime(60.125), '01:00.125'); assert.equal(parseTopicTime('61:02.125'), 3662.125); assert.equal(parseTopicTime('01:60'), null);
  assert.deepEqual(topicPayload(values().topics,120), values().topics);
  for (const end of ['01:60', 'bad', '00:00', Infinity, -1, 121]) assert.throws(()=>topicPayload([{title:'Intro',startTimeSeconds:0,endTimeSeconds:end}],120));
  assert.throws(()=>topicPayload([...values().topics,{title:'Overlap',startTimeSeconds:30,endTimeSeconds:70}],120),/overlaps/);
});
test('stable selection rejects mismatched drafts and preserves first/middle/final content', () => {
  assert.throws(()=>lessonSaveRequest('first',values(),()=>[]),/selection changed/);
  for(const id of ['first','middle','final']) {
    const draft={...values(),lessonId:id}; const request=lessonSaveRequest(id,draft,()=>[]); const body=JSON.parse(request.body);
    assert.equal(request.method,'PATCH'); assert.equal(request.headers['X-Course-Version'],'7'); assert.deepEqual(body.topics,draft.topics);assert.equal(body.quiz.questions[0].question,'Keep?');
    assert.equal(body.quiz.questions[0]._editorKey,undefined);assert.equal(draft.quiz.questions[0]._editorKey,'local');
  }
});
test('multipart saves content and uploads together and rejects invalid replacement durations', () => {
  const draft={...values(),mainVideo:new Blob(['video']),documents:[new Blob(['document'])],durationSeconds:90}; const request=lessonSaveRequest('middle',draft,()=>[]);
  assert.ok(request.body instanceof FormData);assert.equal(request.body.get('durationSeconds'),'90'); assert.equal(request.body.has('duration'),false);
  assert.equal(JSON.parse(request.body.get('topics'))[0]._id,'topic'); assert.equal(request.body.getAll('resources').length,1);
  for(const durationSeconds of [0,NaN,Infinity,-1,30]) assert.throws(()=>lessonSaveRequest('middle',{...draft,durationSeconds},()=>[]));
});
test('older metadata remains editable and unsaved content is detected', () => {
  for(const duration of [undefined,'','Provider managed']) assert.doesNotThrow(()=>lessonSaveRequest('middle',{...values(),duration},()=>[]));
  const baseline=values();assert.equal(hasLessonEdits(baseline,baseline),false);assert.equal(hasLessonEdits({...baseline,title:'Changed'},baseline),true);assert.equal(hasLessonEdits({...baseline,documents:[new Blob(['x'])]},baseline),true);
});
