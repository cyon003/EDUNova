import test from 'node:test';
import assert from 'node:assert/strict';
import { createExposureTracker, mergeWatchedRanges } from '../src/utils/videoExposure.js';
const media = () => ({tagName:'VIDEO',currentTime:100,duration:1000,paused:false,ended:false,seeking:false,playbackRate:1});
const total = ranges => ranges.reduce((sum,r)=>sum+r.endTimeSeconds-r.startTimeSeconds,0);
test('normal visible playback accumulates media seconds and batches compactly',()=>{
 const tracker=createExposureTracker(),video=media();tracker.sample(video,true,0);
 for(let i=1;i<=25;i++){video.currentTime++;tracker.sample(video,true,i*1000)}
 assert.deepEqual(tracker.takeBatch(),[{startTimeSeconds:100,endTimeSeconds:125}]);assert.deepEqual(tracker.takeBatch(),[]);
});
test('paused, hidden, seeking, audio, metadata-only and long-inactive samples cannot add coverage',()=>{
 for(const kind of ['paused','hidden','seeking','audio','metadata','inactive']){
  const tracker=createExposureTracker(),video=media();tracker.sample(video,true,0);
  video.currentTime=101;
  if(kind==='paused')video.paused=true;if(kind==='seeking')video.seeking=true;if(kind==='audio')video.tagName='AUDIO';if(kind==='metadata')tracker.reset();
  tracker.sample(video,kind!=='hidden',kind==='inactive'?5000:1000);
  assert.deepEqual(tracker.takeBatch(),[],kind);
 }
});
test('forward seeking never fills the skipped gap; post-seek playback starts a fresh interval',()=>{
 const tracker=createExposureTracker(),video=media();tracker.sample(video,true,0);video.currentTime=101;tracker.sample(video,true,1000);
 tracker.reset();video.currentTime=300;tracker.sample(video,true,1100);video.currentTime=301;tracker.sample(video,true,2100);
 assert.deepEqual(tracker.takeBatch(),[{startTimeSeconds:100,endTimeSeconds:101},{startTimeSeconds:300,endTimeSeconds:301}]);
 // Even a jump without an observed seeking event is discarded.
 video.currentTime=600;tracker.sample(video,true,2200);assert.deepEqual(tracker.takeBatch(),[]);
});
test('rewatching overlapping coverage merges instead of double counting',()=>{
 const tracker=createExposureTracker(),video=media();let now=0;tracker.sample(video,true,now);
 for(let i=0;i<30;i++){video.currentTime++;tracker.sample(video,true,now+=1000)}
 tracker.reset();video.currentTime=110;tracker.sample(video,true,now);
 for(let i=0;i<30;i++){video.currentTime++;tracker.sample(video,true,now+=1000)}
 assert.equal(total(tracker.takeBatch()),40);
});
test('2x and 0.5x playback count actual media seconds and rate changes reset continuity',()=>{
 for(const rate of [0.5,2,4]){
  const tracker=createExposureTracker(),video=media();video.playbackRate=rate;tracker.sample(video,true,0);video.currentTime+=rate;tracker.sample(video,true,1000);
  assert.equal(total(tracker.takeBatch()),rate);
  video.playbackRate=1;video.currentTime++;tracker.sample(video,true,2000);assert.deepEqual(tracker.takeBatch(),[]);
 }
});
test('failed batches can be restored idempotently and size limits bound long offline queues',()=>{
 const tracker=createExposureTracker();tracker.restore([{startTimeSeconds:0,endTimeSeconds:200}]);
 const batch=tracker.takeBatch();assert.equal(total(batch),120);assert.ok(batch.every(r=>r.endTimeSeconds-r.startTimeSeconds<=30));
 tracker.restore(batch);tracker.restore(batch);assert.equal(total(tracker.takeBatch()),120);assert.equal(total(tracker.takeBatch()),80);
 assert.deepEqual(mergeWatchedRanges([{startTimeSeconds:0,endTimeSeconds:10},{startTimeSeconds:10,endTimeSeconds:20}]),[{startTimeSeconds:0,endTimeSeconds:20}]);
});
