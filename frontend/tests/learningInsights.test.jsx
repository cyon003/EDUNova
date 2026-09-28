import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { register } from 'node:module';
register('./ignoreStyles.mjs', import.meta.url);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, screen, fireEvent } = await import('@testing-library/react');
const { default: LearningInsights } = await import('../src/components/LearningInsights.jsx');
const { establishSession, clearSession } = await import('../src/utils/authClient.js');
const topic = { topicId:'a', title:'N value — Square power',startTimeSeconds:.78,endTimeSeconds:94.3,observedStudents:5,confusionRate:80,sampleSufficient:true };
const course = () => ({courseId:'c',courseSlug:'algorithm',courseVersion:3,courseTitle:'Algorithm',lessonCatalog:[{lessonId:'l',lessonOrder:1,lessonTitle:'Compare Class of Functions',topics:[{...topic},{...topic,topicId:'b',title:'Power n — Bigger change in the value',startTimeSeconds:94.3,endTimeSeconds:310.28,confusionRate:100},{...topic,topicId:'low',title:'Introduction',startTimeSeconds:0,endTimeSeconds:.78,confusionRate:20},{...topic,topicId:'pending',title:'Pending',observedStudents:4,sampleSufficient:false,confusionRate:99}]},{lessonId:'empty',lessonOrder:2,lessonTitle:'New lesson',topics:[]}]});
let requests, response;
beforeEach(()=>{establishSession({id:'tutor',role:'tutor'},'test-token');requests=[];response={status:200,body:{url:'/api/authorized-video'}};globalThis.fetch=async(url,options)=>{requests.push({url,...options});return new Response(JSON.stringify(response.body),{status:response.status,headers:{'Content-Type':'application/json'}});};});
afterEach(()=>{cleanup();clearSession();});

test('report ranks measured topics, retains low topics and hides undersampled rates without altering inputs',()=>{
  const data=course(), before=JSON.stringify(data);
  render(<LearningInsights courses={[data]}/>);
  const rows=screen.getAllByRole('listitem');
  assert.match(rows[0].textContent,/Power n.*100%/);assert.match(rows[1].textContent,/N value.*80%/);assert.match(rows[2].textContent,/Introduction.*20%/);assert.match(rows[3].textContent,/Collecting learning data/);
  assert.equal(screen.queryByText('99%'),null);assert.equal(requests.length,0);assert.equal(JSON.stringify(data),before);
  assert.equal(document.querySelector('video'),null);assert.doesNotMatch(document.body.textContent,/pause|replay|coverage|prediction|playback seconds/i);
  assert.ok(screen.getByText(/not confirmed student understanding/));
});

test('View lesson requests authorized access only on demand, seeks automatically and closes access cleanly',async()=>{
  render(<LearningInsights courses={[course()]}/>);
  fireEvent.click(screen.getByRole('button',{name:'View lesson: Power n — Bigger change in the value'}));
  const video=await screen.findByLabelText('Video: Compare Class of Functions');
  assert.equal(new Headers(requests[0].headers).get('Authorization'),'Bearer test-token');assert.equal(new Headers(requests[0].headers).get('X-Course-Version'),'3');
  Object.defineProperty(video,'duration',{value:311});fireEvent.loadedMetadata(video);assert.equal(video.currentTime,94.3);
  fireEvent.click(screen.getByRole('button',{name:'Close preview'}));assert.equal(document.querySelector('video'),null);assert.ok(requests[0].signal.aborted);
});

test('navigation includes empty lessons and closes old preview',async()=>{
  render(<LearningInsights courses={[course(),{courseId:'new',courseTitle:'Empty course',lessons:[]}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'View lesson: N value — Square power'}));await screen.findByLabelText('Video: Compare Class of Functions');
  fireEvent.change(screen.getByLabelText('Lesson'),{target:{value:'empty'}});assert.ok(screen.getByText(/No topics available yet/));assert.ok(requests[0].signal.aborted);
  fireEvent.change(screen.getByLabelText('Course'),{target:{value:'new'}});assert.ok(screen.getByText('No lessons available yet.'));
});

test('unauthorized and stale access fail visibly; missing video identity cannot request a URL',async()=>{
  for(const status of [401,403,404,409]){
    response={status,body:{message:'Access denied'}};const view=render(<LearningInsights courses={[course()]}/>);
    fireEvent.click(screen.getByRole('button',{name:'View lesson: N value — Square power'}));await screen.findByRole('alert');assert.equal(document.querySelector('video'),null);view.unmount();
  }
  const data=course();delete data.courseSlug;render(<LearningInsights courses={[data]}/>);assert.ok(screen.getByRole('button',{name:'View lesson: N value — Square power'}).disabled);
});

test('expired stream retries fresh access and invalid metadata never seeks outside the video',async()=>{
  render(<LearningInsights courses={[course()]}/>);fireEvent.click(screen.getByRole('button',{name:'View lesson: N value — Square power'}));
  let video=await screen.findByLabelText('Video: Compare Class of Functions');fireEvent.error(video);assert.ok(screen.getByRole('alert'));
  fireEvent.click(screen.getByRole('button',{name:'Retry video access'}));video=await screen.findByLabelText('Video: Compare Class of Functions');assert.equal(requests.length,2);
  Object.defineProperty(video,'duration',{value:20});fireEvent.loadedMetadata(video);assert.ok(screen.getByRole('alert'));assert.equal(document.querySelector('video'),null);
});

test('empty report remains clear and existing ownership metadata fallback preserves actual lesson index',async()=>{
  const view=render(<LearningInsights/>);assert.ok(screen.getByText('No courses available yet.'));view.unmount();
  const data=course();delete data.courseSlug;
  render(<LearningInsights courses={[data]} ownedCourses={[{_id:'c',slug:'algorithm',__v:9,lessons:[{_id:'other',title:'Other'},{_id:'l',title:'Compare Class of Functions'}]}]}/>);
  fireEvent.change(screen.getByLabelText('Lesson'),{target:{value:'l'}});fireEvent.click(screen.getByRole('button',{name:'View lesson: N value — Square power'}));await screen.findByLabelText('Video: Compare Class of Functions');
  assert.ok(requests[0].url.endsWith('/lessons/1/media-access'));assert.equal(new Headers(requests[0].headers).get('X-Course-Version'),'9');
});

test('shared rate bands preserve boundary values and suppress incomplete samples', async () => {
  const { analyticsBand, topicHasSample } = await import('../src/utils/learningInsights.js');
  assert.deepEqual([0,39,40,69,70,100,null].map(analyticsBand), ['low','low','medium','medium','high','high','collecting']);
  assert.equal(topicHasSample(topic),true);
  for(const patch of [{observedStudents:4},{sampleSufficient:false},{confusionRate:null}]) assert.equal(topicHasSample({...topic,...patch}),false);
});
