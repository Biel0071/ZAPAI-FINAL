const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../../../frontend-official/src/test');

const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

const findings = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('dispatchEvent') || line.includes('.click(')) {
      // Check next 5 lines
      const context = lines.slice(idx, idx + 6).join('\n');
      findings.push({
        file,
        line: idx + 1,
        code: line.trim(),
        context
      });
    }
  });
}

console.log(`Total dispatchEvent/click occurrences in src/test: ${findings.length}`);

// Group by file
const byFile = {};
findings.forEach(f => {
  byFile[f.file] = byFile[f.file] || [];
  byFile[f.file].push(f);
});

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\nFile: ${file} (${items.length} occurrences)`);
  items.slice(0, 5).forEach(it => console.log(`  L${it.line}: ${it.code}`));
  if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
}
