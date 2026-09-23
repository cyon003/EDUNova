import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers';
import { Buffer } from 'node:buffer';

const source = (await readFile(new URL('../src/utils/authClient.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace(/^export \{.*\};\n/gm, '').replace(/\bexport /g, '');
const build = new Function('globalThis', 'window', 'localStorage', 'sessionStorage', 'CustomEvent', 'API_ROOT', 'document', 'Date', `${source}; return {establishSession,refreshSession,restoreSession,getAuthSnapshot,installAuthFetch,classifyRefreshResponse,RefreshError,socketAuthentication,installSessionResume};`);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function locks() {
  let queue = Promise.resolve();
  return { request(_name, { signal }, work) {
    const result = queue.then(() => { signal.throwIfAborted(); return work(); });
    queue = result.catch(() => {}); return result;
  } };
}
const storage = () => { const values = new Map(); return { setItem: (k,v) => values.set(k,v), getItem: k => values.get(k), removeItem: k => values.delete(k) }; };
const user = { id: 'test-student', role: 'student' };
const json = (status, body = {}) => new Response(JSON.stringify(body), { status });
function tab(fetch, coordinator = locks(), sharedStorage = storage(), clock = Date) {
  const globals = { fetch, navigator: coordinator ? { locks: coordinator } : {} };
  const listeners = new Map();
  const document = { visibilityState: 'visible', addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  const window = { location: { origin: 'http://localhost' }, dispatchEvent() {}, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  const auth = build(globals, window, sharedStorage, storage(), class { constructor(type, options) { this.type=type;this.detail=options.detail; } }, 'http://localhost/api', document, clock);
  auth.installAuthFetch();
  return { auth, globals, sharedStorage, document, fire: type => listeners.get(type)?.() };
}

for (const failure of ['network', 500, 503, 429]) {
  test(`refresh ${failure} preserves identity and blocks API until recovery`, async () => {
    let recover = false, apiCalls = 0;
    const t = tab(async url => {
      if (url.endsWith('/refresh')) {
        if (recover) return json(200, { user, token: 'replacement' });
        if (failure === 'network') throw new TypeError('offline');
        return json(failure);
      }
      apiCalls++; return json(200);
    });
    t.auth.establishSession(user, 'original');
    await assert.rejects(t.auth.refreshSession(), error => error instanceof t.auth.RefreshError && !error.definitive);
    assert.equal(t.auth.getAuthSnapshot().user.id, user.id);
    assert.ok(t.sharedStorage.getItem('user'));
    await assert.rejects(t.globals.fetch('http://localhost/api/profile'));
    assert.equal(apiCalls, 0);
    recover = true;
    assert.equal((await t.globals.fetch('http://localhost/api/profile')).status, 200);
    assert.equal(apiCalls, 1);
  });
}

test('definitive refresh 401 clears identity and storage', async () => {
  const t = tab(async () => json(401, { code: 'SESSION_REJECTED' }));
  t.auth.establishSession(user, 'original');
  await assert.rejects(t.auth.refreshSession(), error => error.definitive && error.status === 401);
  assert.equal(t.auth.getAuthSnapshot().user, null);
  assert.equal(t.sharedStorage.getItem('user'), undefined);
  assert.equal(t.auth.classifyRefreshResponse(429), 'recoverable');
});

test('overlapping same-tab 401 requests share one rotation', async () => {
  let rotations = 0;
  const gate = deferred();
  const t = tab(async (url, options) => {
    if (url.endsWith('/refresh')) { rotations++; await gate.promise; return json(200, { user, token: 'replacement' }); }
    return json(options.headers.get('Authorization') === 'Bearer replacement' ? 200 : 401);
  });
  t.auth.establishSession(user, 'original');
  const calls = Array.from({length: 10}, () => t.globals.fetch('http://localhost/api/profile'));
  await new Promise(resolve => setImmediate(resolve)); gate.resolve();
  assert.ok((await Promise.all(calls)).every(response => response.status === 200));
  assert.equal(rotations, 1);
});

test('delayed old-token 401 retries with newer token without second rotation', async () => {
  let rotations = 0;
  const delayed = deferred();
  const t = tab(async (url, options) => {
    if (url.endsWith('/refresh')) { rotations++; return json(200, { user, token: 'replacement' }); }
    if (options.headers.get('Authorization') === 'Bearer replacement') return json(200);
    if (url.endsWith('/slow')) await delayed.promise;
    return json(401);
  });
  t.auth.establishSession(user, 'original');
  const slow = t.globals.fetch('http://localhost/api/slow');
  assert.equal((await t.globals.fetch('http://localhost/api/fast')).status, 200);
  delayed.resolve(); assert.equal((await slow).status, 200); assert.equal(rotations, 1);
});

test('tabs serialize rotations using the latest shared cookie without sharing access tokens', async () => {
  const coordinator = locks(), sharedStorage = storage();
  let cookieRevision = 0, active = 0, maxActive = 0, replays = 0;
  const fetch = async () => {
    const sentRevision = cookieRevision;
    maxActive = Math.max(maxActive, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (sentRevision !== cookieRevision) { replays++; return json(401); }
    cookieRevision++;
    return json(200, { user, token: `replacement-${cookieRevision}` });
  };
  const a=tab(fetch,coordinator,sharedStorage), b=tab(fetch,coordinator,sharedStorage);
  a.auth.establishSession(user,'original');b.auth.establishSession(user,'original');
  await Promise.all([a.auth.refreshSession(),b.auth.refreshSession()]);
  assert.equal(maxActive,1);assert.equal(replays,0);assert.equal(cookieRevision,2);
  assert.equal(a.auth.getAuthSnapshot().user.id,user.id);assert.equal(b.auth.getAuthSnapshot().user.id,user.id);
});

test('failed lock owner releases coordination and another tab can recover', async () => {
  const coordinator = locks();let calls=0;
  const fetch = async () => ++calls === 1 ? json(503) : json(200,{user,token:'replacement'});
  const a=tab(fetch,coordinator),b=tab(fetch,coordinator);
  a.auth.establishSession(user,'original');b.auth.establishSession(user,'original');
  const results=await Promise.allSettled([a.auth.refreshSession(),b.auth.refreshSession()]);
  assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');
  assert.ok(a.auth.getAuthSnapshot().user);assert.ok(b.auth.getAuthSnapshot().user);
  await a.auth.refreshSession();
});

test('unsupported coordination fails recoverably without sending an unsafe refresh', async () => {
  let calls=0;const t=tab(async()=>{calls++;return json(200)},null);
  t.auth.establishSession(user,'original');await assert.rejects(t.auth.refreshSession());
  assert.equal(calls,0);assert.ok(t.auth.getAuthSnapshot().user);
});

test('a busy cross-tab lock times out recoverably without bypassing coordination', async () => {
  let calls=0;
  const t=tab(async()=>{calls++;return json(200)}, {request:async()=>{throw new DOMException('Timed out waiting','TimeoutError')}});
  t.auth.establishSession(user,'original');
  await assert.rejects(t.auth.refreshSession(), error => !error.definitive);
  assert.equal(calls,0);assert.ok(t.auth.getAuthSnapshot().user);
});

test('stale 401 uses the refresh generation even if a same-second JWT is identical', async () => {
  let rotations=0,slowCalls=0;const delayed=deferred();
  const t=tab(async url=>{
    if(url.endsWith('/refresh')){rotations++;return json(200,{user,token:'same-token'})}
    if(++slowCalls===1){await delayed.promise;return json(401)}
    return json(200);
  });
  t.auth.establishSession(user,'same-token');
  const slow=t.globals.fetch('http://localhost/api/slow');
  await t.auth.refreshSession();delayed.resolve();
  assert.equal((await slow).status,200);assert.equal(rotations,1);
});

test('startup restoration can retry temporary failures without erasing stored identity', async () => {
  let calls=0;const t=tab(async()=>++calls===1?json(503):json(200,{user,token:'replacement'}));
  t.sharedStorage.setItem('user',JSON.stringify(user));
  await assert.rejects(t.auth.restoreSession());assert.ok(t.sharedStorage.getItem('user'));
  await t.auth.restoreSession();assert.equal(t.auth.getAuthSnapshot().user.id,user.id);
});

test('a refresh cannot silently replace the signed-in account', async () => {
  const t=tab(async()=>json(200,{user:{id:'different-user'},token:'replacement'}));
  t.auth.establishSession(user,'original');await assert.rejects(t.auth.refreshSession(),{name:'AbortError'});
  assert.equal(t.auth.getAuthSnapshot().user.id,user.id);
});

test('Socket.IO authentication can recover after a transient refresh failure', async () => {
  const token = expires => `header.${Buffer.from(JSON.stringify({exp:expires})).toString('base64url')}.test-signature`;
  let recover=false;
  const t=tab(async()=>recover?json(200,{user,token:token(Date.now()/1000+900)}):json(503));
  t.auth.establishSession(user,token(Date.now()/1000-10));
  await assert.rejects(t.auth.socketAuthentication());assert.ok(t.auth.getAuthSnapshot().user);
  recover=true;assert.ok((await t.auth.socketAuthentication()).token);
});

const jwtAt = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
test('return after 16 inactive minutes refreshes once for visibility, focus and concurrent requests', async () => {
  let now = 100000000, rotations = 0;
  const clock = { now: () => now }, gate = deferred();
  const t = tab(async (url, options) => {
    if (url.endsWith('/refresh')) { rotations++; await gate.promise; return json(200, { user, token: jwtAt(now / 1000 + 900) }); }
    const token = options.headers.get('Authorization').slice(7);
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    assert.ok(claims.exp * 1000 > now, 'expired access token must not be sent on resume');
    return json(200);
  }, locks(), storage(), clock);
  t.auth.establishSession(user, jwtAt(now / 1000 + 900));
  const cleanup = t.auth.installSessionResume();
  t.document.visibilityState = 'hidden'; now += 16 * 60000;
  t.fire('visibilitychange'); assert.equal(rotations, 0);
  t.document.visibilityState = 'visible'; t.fire('visibilitychange'); t.fire('focus');
  const requests = Array.from({ length: 6 }, () => t.globals.fetch('http://localhost/api/profile'));
  await new Promise(resolve => setImmediate(resolve)); gate.resolve();
  assert.ok((await Promise.all(requests)).every(response => response.status === 200));
  assert.equal(rotations, 1); assert.equal(t.auth.getAuthSnapshot().user.id, user.id);
  t.fire('focus'); assert.equal(rotations, 1);
  cleanup();
});
for (const status of [429, 503, 500, 401]) {
  test(`inactive-tab resume handles refresh ${status} without treating temporary failure as logout`, async () => {
    let now = 100000000;
    const errors = [];
    const t = tab(async () => json(status), locks(), storage(), { now: () => now });
    t.auth.establishSession(user, jwtAt(now / 1000 + 900));
    const cleanup = t.auth.installSessionResume(error => errors.push(error));
    now += 16 * 60000; t.fire('focus');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(Boolean(t.auth.getAuthSnapshot().user), status !== 401);
    assert.equal(errors.length, status === 401 ? 0 : 1);
    cleanup();
  });
}
test('ordinary API 429 and 5xx never rotate or clear identity', async () => {
  for (const status of [429, 500, 503]) {
    let rotations = 0;
    const t = tab(async url => { if (url.endsWith('/refresh')) rotations++; return json(status); });
    t.auth.establishSession(user, jwtAt(Date.now() / 1000 + 900));
    assert.equal((await t.globals.fetch('http://localhost/api/profile')).status, status);
    assert.equal(rotations, 0); assert.ok(t.auth.getAuthSnapshot().user);
  }
});

test('two inactive tabs resume using the latest cookie without rotation reuse', async () => {
  let now = 100000000, cookie = 0, active = 0, maxActive = 0;
  const coordinator = locks(), shared = storage();
  const fetch = async (url) => {
    if (!url.endsWith('/refresh')) return json(200);
    const sent = cookie; maxActive = Math.max(maxActive, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--; assert.equal(sent, cookie, 'must not replay another tab\'s consumed cookie'); cookie++;
    return json(200, { user, token: jwtAt(now / 1000 + 900) });
  };
  const tabs = [tab(fetch, coordinator, shared, { now: () => now }), tab(fetch, coordinator, shared, { now: () => now })];
  const cleanup = tabs.map(t => { t.auth.establishSession(user, jwtAt(now / 1000 + 900)); return t.auth.installSessionResume(); });
  now += 16 * 60000;
  for (const t of tabs) { t.fire('focus'); t.fire('visibilitychange'); }
  await Promise.all(tabs.map(t => t.globals.fetch('http://localhost/api/profile')));
  assert.equal(maxActive, 1); assert.equal(cookie, 2);
  assert.ok(tabs.every(t => t.auth.getAuthSnapshot().user)); cleanup.forEach(fn => fn());
});

test('Profile does not turn an endpoint 401 into a local logout after successful refresh', async () => {
  const profile = await readFile(new URL('../src/pages/Profile.jsx', import.meta.url), 'utf8');
  const helper = profile.slice(profile.indexOf('async function authenticatedRequest'), profile.indexOf('function initials'));
  let cleared = false, redirected = false;
  const request = new Function('fetch', 'localStorage', 'API_ROOT', 'clearSession', 'window', `${helper}; return authenticatedRequest;`)(
    async () => json(401, { message: 'Endpoint rejected request' }), { getItem: () => 'managed-in-memory' }, '/api',
    () => { cleared = true; }, { location: { replace() { redirected = true; } } }
  );
  await assert.rejects(request('/profile'));
  assert.equal(cleared, false); assert.equal(redirected, false);
});
