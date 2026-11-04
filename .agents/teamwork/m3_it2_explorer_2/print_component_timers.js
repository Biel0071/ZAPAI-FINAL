const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'rendered_components_timers.json'), 'utf8'));

console.log('=== TESTS IMPORTING COMPONENTS WITH TIMERS ===');

for (const t of data) {
  const compsWithTimers = t.importedComponents.filter(c => c.timers.length > 0);
  if (compsWithTimers.length > 0) {
    console.log(`\nTest: ${t.testFile}`);
    for (const c of compsWithTimers) {
      console.log(`  Component: ${c.resolvedPath} (${c.timers.length} timers)`);
      c.timers.forEach(tm => console.log(`     L${tm.line}: ${tm.text}`));
    }
  }
}
