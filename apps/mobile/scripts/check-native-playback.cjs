const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/native', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require, Set, Promise });
  return module.exports;
}

async function main() {
  const { ProximityMonitor, nearestPoiWithinRadius, canTriggerNearby } = load('proximity');
  const poi = { id: 1, code: 'TEST', name: 'Test', latitude: 10, longitude: 106, radiusMeters: 50, minDwellSeconds: 5, cooldownSeconds: 20 };
  const point = { latitude: 10, longitude: 106, accuracy: 10 };
  const monitor = new ProximityMonitor();
  assert.equal(monitor.update([poi], point, 1000), null);
  assert.equal(monitor.update([poi], point, 5999), null);
  assert.equal(monitor.update([poi], point, 6000).id, 1);
  assert.equal(monitor.update([poi], { ...point, accuracy: 60 }, 7000), null);
  assert.equal(monitor.update([poi], point, 8000), null, 'Poor accuracy breaks dwell');
  assert.equal(monitor.update([poi], point, 13000).id, 1);
  assert.equal(monitor.update([poi], point, 50000, 10000), null, 'Stale fix is rejected');
  assert.equal(monitor.update([poi], point, 51000), null);
  assert.equal(monitor.update([poi], point, 90000), null, 'Long GPS gap resets dwell');
  monitor.reset();
  assert.equal(monitor.update([poi], point, 91000), null, 'Background/toggle reset');
  for (const invalid of [{ ...point, latitude: 91 }, { ...point, accuracy: -1 }, { ...point, accuracy: Infinity }])
    assert.equal(nearestPoiWithinRadius([poi], invalid), null);
  assert.equal(nearestPoiWithinRadius([poi], { ...point, latitude: 11 }), null);
  assert.equal(canTriggerNearby(1000, 20999, poi.cooldownSeconds), false);
  assert.equal(canTriggerNearby(1000, 21000, poi.cooldownSeconds), true);
  assert.equal(canTriggerNearby(undefined, 0), true);
  console.log('GPS: radius, bounds, accuracy, dwell, stale fixes, gaps, reset and per-POI cooldown PASS');

  const { ListeningClock, PlaybackReporter, retryFailedPlayReports } = load('listening');
  const clock = new ListeningClock();
  const state = { position: 0, playing: true, loaded: true, buffering: false, seeking: false, active: true };
  const sample = (position, at, extra = {}) => clock.sample({ ...state, position, ...extra }, at);
  sample(0, 0); sample(1, 1000); sample(2, 2000);
  assert.equal(clock.totalSeconds, 2);
  sample(25, 2250, { seeking: true }); sample(25, 2500); sample(26, 3500);
  assert.equal(clock.totalSeconds, 3, 'Seek jump is not listening');
  sample(26, 4000, { playing: false }); sample(26, 10000, { playing: false });
  sample(26, 10500); sample(27, 11500); sample(27, 12000, { buffering: true });
  sample(27, 16000); sample(28, 17000); sample(28, 17500, { active: false });
  sample(50, 60000, { active: false }); sample(50, 61000); sample(51, 62000);
  assert.equal(clock.totalSeconds, 6, 'Pause, buffering and background add no time');
  sample(100, 62250); sample(101, 63250);
  assert.equal(clock.totalSeconds, 7, 'Unannounced position jump is not credited');

  const calls = [];
  let release;
  const reporter = new PlaybackReporter(clock, seconds => { calls.push(seconds); return new Promise(resolve => { release = resolve; }); });
  const first = reporter.flush();
  assert.equal(reporter.flush(), first, 'Completion/unmount share one in-flight report');
  release(); await first; await reporter.flush();
  assert.deepEqual(calls, [7], 'Acknowledged time is not submitted twice');
  sample(102, 64250);
  const second = reporter.flush(); release(); await second;
  assert.deepEqual(calls, [7, 1]);
  let attempts = 0;
  const retry = new PlaybackReporter(clock, async seconds => { assert.equal(seconds, 8); if (++attempts === 1) throw Error('offline'); });
  await assert.rejects(retry.flush(), /offline/);
  assert.equal(attempts, 1, 'No automatic POST retry');
  await retryFailedPlayReports();
  assert.equal(attempts, 2); await retry.flush(); assert.equal(attempts, 2);
  console.log('Listening: elapsed playback, seeking, pause/buffering/background, delta flush, concurrency and explicit retry PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
