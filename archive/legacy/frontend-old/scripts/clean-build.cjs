const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const targets = [
  path.join(ROOT, 'dist'),
  path.join(ROOT, 'node_modules', '.vite'),
  path.join(ROOT, '.vite'),
];

for (const target of targets) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[clean-build] removed: ${path.relative(ROOT, target)}`);
    } else {
      console.log(`[clean-build] skip (not found): ${path.relative(ROOT, target)}`);
    }
  } catch (error) {
    console.error(`[clean-build] failed removing ${target}:`, error);
    process.exitCode = 1;
  }
}
