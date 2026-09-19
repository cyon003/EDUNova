const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeRanges, uniqueSeconds, sufficientlyExposed, validateRanges, SUFFICIENT_EXPOSURE_RATIO } = require("../utils/videoExposure");
const { topicAnalytics } = require("../services/topicAnalyticsService");
const ranges = pairs => pairs.map(([startTimeSeconds,endTimeSeconds]) => ({startTimeSeconds,endTimeSeconds}));
test("merging is deterministic, adjacent, overlapping and duplicate ranges count once",()=>{
 assert.deepEqual(mergeRanges(ranges([[10,20],[15,30],[30,40],[10,20],[50,60]])),ranges([[10,40],[50,60]]));
 assert.deepEqual(mergeRanges(ranges([[50,60],[10,20]])),ranges([[10,20],[50,60]]));
 assert.equal(uniqueSeconds(ranges([[100,130],[110,140]])),40);
 assert.equal(uniqueSeconds(ranges([[100,110],[300,310]])),20);
 assert.deepEqual(mergeRanges(mergeRanges(ranges([[0,1.001]]))),ranges([[0,1.001]]));
});
test("range validation rejects malformed, forged, nonfinite, oversized and out-of-bounds batches",()=>{
 for(const pairs of [[[-1,10]],[[10,10]],[[20,10]],[[0,31]],[[NaN,10]],[[0,Infinity]],[[0,86401]]]) assert.ok(validateRanges({watchedRanges:ranges(pairs)}));
 for(const extra of ['studentId','topicId','sufficientlyExposed','totalUniqueWatchedSeconds','exposurePercentage']) assert.ok(validateRanges({watchedRanges:ranges([[0,10]]),[extra]:1}));
 assert.ok(validateRanges({watchedRanges:Array.from({length:33},()=>ranges([[0,1]])[0])}));
 assert.ok(validateRanges({watchedRanges:Array.from({length:5},()=>ranges([[0,30]])[0])}));
 assert.ok(validateRanges({watchedRanges:ranges([[90,110]])},100));
 assert.equal(validateRanges({watchedRanges:ranges([[0,30],[40,60]])},100),null);
});
test("coverage intersects current topic boundaries and 50 percent is inclusive",()=>{
 const topic={startTimeSeconds:100,endTimeSeconds:200};
 assert.equal(SUFFICIENT_EXPOSURE_RATIO,0.5);
 assert.equal(sufficientlyExposed(ranges([[80,130],[160,180]]),topic),true);
 assert.equal(sufficientlyExposed(ranges([[80,130],[160,179.9]]),topic),false);
 assert.equal(sufficientlyExposed(ranges([[100,130],[110,140]]),topic),false);
 assert.equal(sufficientlyExposed(ranges([[100,150]]),topic),true);
 assert.equal(sufficientlyExposed(ranges([[100,149.9999]]),topic),false);
 assert.equal(sufficientlyExposed(ranges([[100,150]]),{startTimeSeconds:150,endTimeSeconds:250}),false);
});
test("analytics uses per-topic exposed cohorts, excludes unexposed events and never invents legacy exposure",()=>{
 const courses=[{_id:'c',lessons:[{_id:'l',topics:[{_id:'t',title:'Topic',startTimeSeconds:0,endTimeSeconds:100},{_id:'new',title:'New topic',startTimeSeconds:100,endTimeSeconds:200}]}]}];
 const signals=Array.from({length:10},(_,i)=>({course:'c',lessonId:'l',student:String(i)}));
 const events=[...Array.from({length:8},(_,i)=>({_id:{course:'c',lessonId:'l',topicId:'t',student:String(i)}})),{_id:{course:'c',lessonId:'l',topicId:'deleted',student:'0'}}];
 const legacy=topicAnalytics(courses,signals,events).get('c:l');assert.equal(legacy.topics[0].observedStudents,0);assert.equal(legacy.topics[0].confusedStudents,0);assert.equal(legacy.topics[0].confusionRate,null);
 const exposures=signals.map((s,i)=>({...s,watchedRanges:ranges([[0,i<5?50:49.9]])}));
 const current=topicAnalytics(courses,signals,events,exposures).get('c:l');
 assert.equal(current.topics[0].observedStudents,5);assert.equal(current.topics[0].confusedStudents,5);assert.equal(current.topics[0].confusionRate,100);
 assert.equal(topicAnalytics(courses,[],events,exposures).get('c:l').topics[0].confusedStudents,5);
 assert.equal(current.topics[1].observedStudents,0);assert.equal(current.topics[1].confusedStudents,0);
 assert.equal(current.historicalConfusionStudents,1);
 assert.equal(topicAnalytics(courses,signals,events,exposures.slice(0,4)).get('c:l').topics[0].sampleSufficient,false);
 courses[0].lessons[0].topics[0].startTimeSeconds=50;courses[0].lessons[0].topics[0].endTimeSeconds=150;
 assert.equal(topicAnalytics(courses,signals,events,exposures).get('c:l').topics[0].observedStudents,0);
});
