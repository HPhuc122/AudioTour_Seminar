const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const values = new Map();
const secureStore = {
  getItemAsync: async key => values.get(key) ?? null,
  setItemAsync: async (key, value) => { values.set(key, value); },
  deleteItemAsync: async key => { values.delete(key); },
};
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/native', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireLocal = id => id === 'expo-secure-store' ? secureStore : load(id.replace('./', ''));
  vm.runInNewContext(code, { module, exports: module.exports, require: requireLocal, Date, Number });
  modules.set(name, module.exports); return module.exports;
}
async function main() {
  const { parseApiUtc, remainingAccessSeconds, deadlineFromRemaining } = load('accessTime');
  const utc = Date.parse('2026-11-04T12:00:00Z');
  for (const zone of ['Asia/Ho_Chi_Minh', 'UTC', 'America/New_York']) {
    process.env.TZ = zone;
    assert.equal(parseApiUtc('2026-11-04T12:00:00'), utc, 'Legacy timestamps are UTC in every device timezone');
    assert.equal(parseApiUtc('2026-11-04T19:00:00+07:00'), utc);
    assert.equal(parseApiUtc('2026-11-04T12:00:00Z'), utc);
  }
  assert.ok(Number.isNaN(parseApiUtc('not-a-date')));
  const deadline = deadlineFromRemaining(60, 10000);
  assert.equal(remainingAccessSeconds(deadline, 10000), 60);
  assert.equal(remainingAccessSeconds(deadline, 65000), 5, 'Elapsed wall time includes background suspension');
  assert.equal(remainingAccessSeconds(deadline, 75000), 0);
  assert.equal(remainingAccessSeconds(null), null);
  assert.equal(remainingAccessSeconds(NaN), 0);
  assert.equal(deadlineFromRemaining(-10, 5000), 5000);
  const store = load('paidAccessStore');
  await store.savePaidAccessSession({ accessToken: 'guest', expiresAt: '2026-11-04T12:00:00' });
  const saved = await store.loadPaidAccessSession();
  assert.equal(saved.accessToken, 'guest'); assert.equal(saved.expiresAt, '2026-11-04T12:00:00.000Z');
  for (const malformed of ['null', '{', '{"accessToken":12,"expiresAt":"2026-11-04T12:00:00"}', '{"accessToken":"guest","expiresAt":"invalid"}']) {
    values.set('audiotour.paid-access', malformed);
    assert.equal(await store.loadPaidAccessSession(), null);
    assert.equal(values.size, 0);
  }
  console.log('Access session: UTC/offsets/device timezones, background elapsed time, expiry and malformed SecureStore data PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
