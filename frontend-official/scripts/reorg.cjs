const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

const map = {
  'api': 'core/api',
  'config': 'core/config',
  'lib': 'core/lib',
  'services': 'core/services',
  'adapters': 'core/adapters',
  'runtime': 'core/runtime',
  'types': 'core/types',
  'stores': 'state/stores',
  'providers': 'state/providers',
  'hooks': 'state/hooks',
  'lovable': 'pages/lovable'
};

function ensureDirSync(dirpath) {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
}

// 1. Create target directories
['core', 'state', 'pages'].forEach(d => ensureDirSync(path.join(srcDir, d)));

// 2. Move folders (using cpSync + rmSync to bypass EPERM)
Object.entries(map).forEach(([oldName, newPath]) => {
  const oldDir = path.join(srcDir, oldName);
  const newDir = path.join(srcDir, newPath);
  if (fs.existsSync(oldDir)) {
    try {
      fs.cpSync(oldDir, newDir, { recursive: true });
      fs.rmSync(oldDir, { recursive: true, force: true });
      console.log(`Moved ${oldName} to ${newPath}`);
    } catch (e) {
      console.error(`Error moving ${oldName} to ${newPath}:`, e.message);
    }
  }
});

// 3. Update imports in all files
function getAllFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = getAllFiles(srcDir);
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  Object.entries(map).forEach(([oldName, newPath]) => {
    const regex = new RegExp(`@/${oldName}/`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `@/${newPath}/`);
      changed = true;
    }
  });

  const fileDir = path.dirname(f);
  content = content.replace(/from\s+['"]([^'"]+)['"]/g, (match, importPath) => {
    if (importPath.startsWith('.')) {
      const absoluteImportPath = path.resolve(fileDir, importPath);
      const relativeToSrc = path.relative(srcDir, absoluteImportPath).replace(/\\/g, '/');
      
      for (const [oldName, newPath] of Object.entries(map)) {
        if (relativeToSrc === oldName || relativeToSrc.startsWith(oldName + '/')) {
          const rest = relativeToSrc.substring(oldName.length);
          const newImport = `@/${newPath}${rest}`;
          changed = true;
          return `from "${newImport}"`;
        }
      }
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(f, content, 'utf8');
    console.log(`Updated imports in ${path.relative(srcDir, f)}`);
  }
});
console.log('Done!');
