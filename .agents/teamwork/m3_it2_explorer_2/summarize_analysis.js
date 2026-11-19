const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'test_files_analysis.json'), 'utf8'));

console.log('=== SUMMARY OF 49 TEST FILES ===');

const filesWithSetTimeout = data.filter(d => d.hasSetTimeout);
console.log(`\nFiles with setTimeout (${filesWithSetTimeout.length}):`);
filesWithSetTimeout.forEach(f => {
  console.log(` - ${f.file}`);
  f.suspiciousPatterns.filter(p => p.text.includes('setTimeout')).forEach(p => {
    console.log(`    L${p.line}: ${p.text}`);
  });
});

const filesWithSetInterval = data.filter(d => d.hasSetInterval);
console.log(`\nFiles with setInterval (${filesWithSetInterval.length}):`);
filesWithSetInterval.forEach(f => {
  console.log(` - ${f.file}`);
  f.suspiciousPatterns.filter(p => p.text.includes('setInterval')).forEach(p => {
    console.log(`    L${p.line}: ${p.text}`);
  });
});

const filesWithFakeTimers = data.filter(d => d.hasFakeTimers);
console.log(`\nFiles using FakeTimers (${filesWithFakeTimers.length}):`);
filesWithFakeTimers.forEach(f => console.log(` - ${f.file}`));

const tsxFiles = data.filter(d => d.file.endsWith('.tsx'));
console.log(`\nTotal TSX (UI component) test files: ${tsxFiles.length}`);

const tsxWithoutAfterEach = tsxFiles.filter(d => !d.hasAfterEach);
console.log(`TSX files without afterEach (${tsxWithoutAfterEach.length}):`);
tsxWithoutAfterEach.forEach(f => console.log(` - ${f.file}`));

const tsxWithoutUnmount = tsxFiles.filter(d => !d.hasRootUnmount);
console.log(`TSX files without unmount (${tsxWithoutUnmount.length}):`);
tsxWithoutUnmount.forEach(f => console.log(` - ${f.file}`));
