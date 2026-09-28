const test = require('node:test');
const assert = require('node:assert/strict');
const { latestStudentSignals, lessonBehavior } = require('../services/analyticsBehaviorService');
const { topicAnalytics } = require('../services/topicAnalyticsService');
const signals = () => Array.from({length:5}, (_,i) => ({ student:`s${i}`,course:'c',lessonId:'l',pauseCount:2,replayCount:1,visitCount:1,activeTimeSeconds:30,aiPrediction:{predictedAt:'2026-09-28'} }));
test('behavior totals require five recorded distinct students and do not treat missing counters as zero', () => {
  const rows=signals();
  const result=lessonBehavior([...rows, {...rows[0],pauseCount:90,aiPrediction:{predictedAt:'2020-01-01'}}]);
  assert.equal(result.cohortStudents,5); assert.deepEqual(result.metrics.pauseCount,{total:10,studentCount:5});
  delete rows[0].pauseCount;
  assert.deepEqual(lessonBehavior(rows).metrics.pauseCount,{total:null,studentCount:4});
  assert.equal(lessonBehavior([]).metrics.replayCount.total,null);
  assert.equal(latestStudentSignals([...rows, {...rows[0],course:'other'}]).length,6);
});
test('topic percentages keep exposure denominators without predictions, ignore insufficient coverage, and preserve unmapped history', () => {
  const courses=[{_id:'c',lessons:[{_id:'l',topics:[{_id:'t',title:'Topic',startTimeSeconds:0,endTimeSeconds:100}]}]}];
  const exposures=signals().map(s=>({...s,watchedRanges:[{startTimeSeconds:0,endTimeSeconds:50}]}));
  exposures.push({student:'short',course:'c',lessonId:'l',watchedRanges:[{startTimeSeconds:0,endTimeSeconds:49} ]});
  const event=student=>({_id:{student,course:'c',lessonId:'l',topicId:'t'}});
  const events=[...signals().slice(0,4).map(s=>event(s.student)),event('short'),event('s0'),{_id:{student:'s0',course:'c',lessonId:'l',topicId:null}},{_id:{student:'s1',course:'c',lessonId:'l',topicId:'deleted'}}];
  const before=JSON.stringify(events);
  const result=topicAnalytics(courses,signals().slice(0,2),events,exposures).get('c:l');
  assert.equal(result.topics[0].observedStudents,5); assert.equal(result.topics[0].confusedStudents,4); assert.equal(result.topics[0].confusionRate,80);
  assert.equal(result.unmappedConfusionStudents,1); assert.equal(result.historicalConfusionStudents,1); assert.equal(JSON.stringify(events),before);
  assert.equal(topicAnalytics(courses,[],events,exposures.slice(0,4)).get('c:l').topics[0].confusionRate,null);
});
