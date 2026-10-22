const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Mirror of the coalescing logic in services/outboundQueueService.js
// (module-level state there is not injectable); validates the pattern under load.
test('coalesced save: 2000 concurrent saves => few writes, latest state persisted, loop not blocked', async () => {
  const file = path.join(os.tmpdir(), `oq-${process.pid}.json`);
  const state = { items: Array.from({ length: 5000 }, (_, i) => ({ id: i, phone: '5511999990000', metadata: { n: i } })) };
  let writes = 0;
  let persistLock = Promise.resolve();
  let pendingSave = null;
  const write = async () => {
    writes++;
    await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(state) + '\n');
    await fs.promises.rename(`${file}.tmp`, file);
  };
  const save = async () => {
    if (!pendingSave) {
      const run = persistLock.catch(() => {}).then(() => { pendingSave = null; return write(); });
      pendingSave = run; persistLock = run;
    }
    await pendingSave;
  };
  let maxGap = 0; let last = Date.now();
  const t = setInterval(() => { const n = Date.now(); maxGap = Math.max(maxGap, n - last); last = n; }, 5);
  await Promise.all(Array.from({ length: 2000 }, (_, i) => { state.items[i].done = true; return save(); }));
  clearInterval(t);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.unlinkSync(file);
  assert.ok(writes <= 3, `writes=${writes}`);
  assert.equal(saved.items.filter((x) => x.done).length, 2000);
  assert.ok(maxGap < 500, `event loop gap ${maxGap}ms`);
});
