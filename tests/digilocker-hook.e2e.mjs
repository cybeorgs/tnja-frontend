// End-to-end test of useAadhaarDigilocker in the real Player registration form.
//
//   npm run dev                      (in another terminal)
//   npm run test:digilocker
//
// Needs Google Chrome (set CHROME_PATH if it isn't in the default Windows location) and the
// dev server (BASE_URL, default http://localhost:3000). Nothing reaches the backend or Sandbox:
// /digilocker/start and /digilocker/check are answered inside the page, window.open is fake,
// and timers + Date.now run SPEED times faster so the real 3 min / 60 s / 10 min constants run.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SPEED = 30;
const PORT = 9300 + Math.floor(Math.random() * 600);

const profile = mkdtempSync(join(tmpdir(), "tnja-hook-test-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1400,1000", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(250); } }
if (!targets) throw new Error(`Chrome did not start (CHROME_PATH=${CHROME})`);
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result?.result?.value;
};

// Runs before the app on every page load.
await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.__calls = { start: 0, check: 0, checkTimes: [], inFlight: 0, maxInFlight: 0 };
  window.__checkMode = 'pending';   // what Sandbox answers: pending | verified | fail
  window.__checkDelay = 50;          // real ms a check takes
  window.__fast = false;
  const realNow = Date.now.bind(Date);
  let fastSince = 0;
  Date.now = () => window.__fast ? fastSince + (realNow() - fastSince) * ${SPEED} : realNow();
  window.__goFast = () => { fastSince = realNow(); window.__fast = true; };
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms = 0, ...a) => realSetTimeout(fn, window.__fast && ms >= 1000 ? ms / ${SPEED} : ms, ...a);
  const realFetch = window.fetch.bind(window);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init) => {
    const url = String((input && input.url) || input);
    if (url.includes('/aadhaar/digilocker/start')) {
      window.__calls.start++;
      return json(200, { authorizationUrl: 'https://digilocker.mock.invalid/auth', digilockerSessionToken: 'mock-session-token' });
    }
    if (url.includes('/aadhaar/digilocker/check')) {
      const c = window.__calls;
      c.check++; c.checkTimes.push(Date.now()); c.inFlight++; c.maxInFlight = Math.max(c.maxInFlight, c.inFlight);
      const mode = window.__checkMode;   // fixed when the request is made, like a real status lookup
      await new Promise((r) => realSetTimeout(r, window.__checkDelay));
      c.inFlight--;
      if (mode === 'verified') return json(200, { status: 'verified', aadhaarVerificationToken: 'mock-verified' });
      if (mode === 'fail') return json(400, { error: 'DigiLocker verification was cancelled or expired. Please click Verify again.' });
      return json(200, { status: 'pending' });
    }
    if (url.includes('/aadhaar/')) throw new Error('unexpected Aadhaar call ' + url);
    return realFetch(input, init);
  };
  window.open = () => ({ closed: false, close() { this.closed = true; }, location: {} });
`});

const UI = `(() => {
  const input = document.querySelector('input[name=aadhaarNumber]');
  let box = input; while (box && !box.querySelector('button')) box = box.parentElement;
  const scope = box.parentElement;
  const btn = (re) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
  return { verify: btn(/^(Verify|Starting\\.\\.\\.|Waiting\\.\\.\\.)$/), checkNow: btn(/check now/i), cancel: btn(/^Cancel$/), scope };
})()`;
const state = () => ev(`(() => { const u = ${UI}; const c = window.__calls; return {
  start: c.start, check: c.check, maxInFlight: c.maxInFlight, verified: /Verified/.test(u.scope.textContent), waiting: !!u.checkNow,
  error: [...u.scope.querySelectorAll('p.text-red-500')].map((p) => p.textContent)[0] || null }; })()`);
const click = (name, times = 1) => ev(`(() => { const u = ${UI}; for (let i = 0; i < ${times}; i++) u.${name}.click(); })()`);
const callback = () => ev(`(() => { const c = new BroadcastChannel('tnja-digilocker'); c.postMessage('done'); c.close(); })()`);
const simWait = (simSeconds) => sleep((simSeconds * 1000) / SPEED);   // simulated seconds -> real ms
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

async function freshPage() {
  await send("Page.navigate", { url: `${BASE_URL}/register/player` });
  for (let i = 0; i < 120; i++) { await sleep(500); if (await ev(`!!document.querySelector('input[name=aadhaarNumber]') && document.readyState === 'complete'`)) break; }
  await sleep(1500);
  await ev(`(() => { const el = document.querySelector('input[name=aadhaarNumber]'); el.scrollIntoView(); el.focus(); })()`);
  await send("Input.insertText", { text: "234567890123" });
  await sleep(300);
  await ev(`window.__goFast()`);
}
async function startVerification() {
  await click("verify"); await sleep(100);
  return ev(`Date.now()`);
}

const results = [];
async function scenario(name, fn) {
  try { await freshPage(); results.push({ name, ok: true, detail: await fn() }); }
  catch (e) { results.push({ name, ok: false, detail: e.message }); }
}

await scenario("double-click Verify -> exactly one session start", async () => {
  await click("verify", 2); await sleep(200);
  await click("verify", 3); await sleep(200);
  const s = await state();
  expect(s.start === 1, `start calls = ${s.start}`);
  expect(s.waiting, "should be waiting");
  return s;
});

await scenario("F1: normal sign-in (callback at 2 min) -> no backup check, exactly one status check", async () => {
  await startVerification();
  await simWait(120);
  expect((await state()).check === 0, "backup timer fired during sign-in");
  await ev(`window.__checkMode = 'verified'`);
  await callback(); await sleep(300);
  let s = await state();
  expect(s.check === 1 && s.verified, `after callback: ${JSON.stringify(s)}`);
  await simWait(5 * 60);
  s = await state();
  expect(s.check === 1, `checks after verified = ${s.check}`);
  return s;
});

await scenario("F1: abandoned -> first backup check at ~3 min, then every ~60 s, stops at 10 min", async () => {
  const t0 = await startVerification();
  await simWait(170);
  expect((await state()).check === 0, "checked before 3 minutes");
  await simWait(11 * 60 - 170);
  const s = await state();
  const times = await ev(`window.__calls.checkTimes`);
  const firstAt = Math.round((times[0] - t0) / 1000);
  const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) / 1000));
  expect(firstAt >= 175 && firstAt <= 195, `first backup check at ${firstAt}s`);
  expect(gaps.every((g) => g >= 58 && g <= 70), `gaps ${gaps}`);
  expect(s.check <= 8, `checks = ${s.check}`);
  expect(!s.waiting && /timed out/i.test(s.error || ""), `should time out: ${JSON.stringify(s)}`);
  await simWait(120);
  expect((await state()).check === s.check, "checks after timeout");
  return { checks: s.check, firstCheckAtSimS: firstAt, gapsSimS: gaps, error: s.error };
});

await scenario("duplicate callbacks -> one check", async () => {
  await startVerification();
  await ev(`window.__checkMode = 'verified'; window.__checkDelay = 300`);
  await simWait(30);
  await callback(); await callback(); await sleep(800);
  const s = await state();
  expect(s.check === 1 && s.verified, JSON.stringify(s));
  return s;
});

await scenario("F5: callback during an in-flight check -> exactly one follow-up ~5 s later, never concurrent", async () => {
  await startVerification();
  await ev(`window.__checkDelay = 600`);
  await click("checkNow"); await sleep(50);                   // slow check in flight, answers 'pending'
  await ev(`window.__checkMode = 'verified'`);
  const callbackAt = await ev(`Date.now()`);
  await callback();
  await simWait(75);
  const s = await state();
  const times = await ev(`window.__calls.checkTimes`);
  expect(s.check === 2, `checks = ${s.check}`);
  expect(s.verified, "follow-up should have verified");
  expect(s.maxInFlight === 1, `concurrent checks: ${s.maxInFlight}`);
  const followUpAfterCallback = Math.round((times[1] - callbackAt) / 1000);
  expect(followUpAfterCallback < 45, `follow-up only after ${followUpAfterCallback}s`);
  return { ...s, followUpSimSecondsAfterCallback: followUpAfterCallback };
});

await scenario("F5: several callbacks during one in-flight check -> still exactly one follow-up", async () => {
  await startVerification();
  await ev(`window.__checkDelay = 600`);
  await click("checkNow"); await sleep(50);
  await ev(`window.__checkMode = 'verified'`);
  await callback(); await callback(); await callback();
  await simWait(75);
  const s = await state();
  expect(s.check === 2 && s.verified && s.maxInFlight === 1, JSON.stringify(s));
  return s;
});

await scenario("F5: callback during an in-flight check that already returns verified -> no follow-up", async () => {
  await startVerification();
  await ev(`window.__checkMode = 'verified'; window.__checkDelay = 600`);
  await click("checkNow"); await sleep(50);
  await callback();
  await simWait(60);
  const s = await state();
  expect(s.check === 1 && s.verified, JSON.stringify(s));
  return s;
});

await scenario("'check now' x5 -> one check; within 10 s -> none; after 10 s -> one more", async () => {
  await startVerification();
  await click("checkNow", 5); await sleep(40);
  expect((await state()).check === 1, "after 5 fast clicks");
  await simWait(3); await click("checkNow", 3); await sleep(30);
  expect((await state()).check === 1, "inside the 10 s gap");
  await simWait(10); await click("checkNow", 3); await sleep(100);
  const s = await state();
  expect(s.check === 2, `after the gap: ${s.check}`);
  return s;
});

await scenario("Cancel -> timers cleared, no checks", async () => {
  await startVerification();
  await click("cancel"); await sleep(100);
  await simWait(11 * 60);
  const s = await state();
  expect(s.check === 0 && !s.waiting, JSON.stringify(s));
  return s;
});

await scenario("leaving the page while waiting (unmount) -> no checks", async () => {
  await startVerification();
  await ev(`window.next.router.push('/login')`);
  for (let i = 0; i < 40 && await ev(`!!document.querySelector('input[name=aadhaarNumber]')`); i++) await sleep(250);
  expect(!(await ev(`!!document.querySelector('input[name=aadhaarNumber]')`)), "form still mounted");
  await simWait(11 * 60);
  const checks = await ev(`window.__calls.check`);
  expect(checks === 0, `checks after unmount = ${checks}`);
  return { path: await ev(`location.pathname`), checks };
});

await scenario("failed/expired session -> one check, error shown, polling stops", async () => {
  await startVerification();
  await ev(`window.__checkMode = 'fail'`);
  await callback(); await sleep(300);
  await simWait(11 * 60);
  const s = await state();
  expect(s.check === 1 && /cancelled or expired/.test(s.error || "") && !s.waiting, JSON.stringify(s));
  return s;
});

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n      ${JSON.stringify(r.detail)}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
ws.close(); chrome.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file */ }
process.exit(results.every((r) => r.ok) ? 0 : 1);
