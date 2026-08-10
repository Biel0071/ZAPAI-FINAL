const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..');

const moveMap = {
  'ai-agents': 'src/ai/agents',
  'ai-prompts': 'src/ai/prompts',
  'ai': 'src/ai/core',
  'config': 'src/infrastructure/config',
  'controllers': 'src/api/controllers',
  'conversations': 'src/messaging/conversations',
  'core': 'src/core/common',
  'events': 'src/infrastructure/events',
  'inbox-core': 'src/messaging/inbox',
  'microtasks': 'src/infrastructure/microtasks',
  'middleware': 'src/api/middleware',
  'modules': 'src/core/modules',
  'realtime': 'src/infrastructure/realtime',
  'repositories': 'src/data/repositories',
  'routes': 'src/api/routes',
  'sessions': 'src/messaging/sessions',
  'store': 'src/data/store',
  'workers': 'src/infrastructure/workers',
};

// Sort by length to match deeper paths first
const sortedMoves = Object.entries(moveMap).sort((a, b) => b[0].length - a[0].length);

function computeFuturePath(oldAbsPath) {
  const relativeToBackend = path.relative(BACKEND_DIR, oldAbsPath).replace(/\\/g, '/');
  
  for (const [oldDir, newDir] of sortedMoves) {
    if (relativeToBackend === oldDir || relativeToBackend.startsWith(oldDir + '/')) {
      const remainder = relativeToBackend.slice(oldDir.length);
      return path.resolve(BACKEND_DIR, newDir + remainder);
    }
  }
  
  return oldAbsPath; // unchanged
}

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'storage' || file === 'uploads') continue;
    const absPath = path.join(dir, file);
    if (fs.statSync(absPath).isDirectory()) {
      getAllJsFiles(absPath, fileList);
    } else if (absPath.endsWith('.js') || absPath.endsWith('.ts') || absPath.endsWith('.md') || absPath.endsWith('.json')) {
      fileList.push(absPath);
    }
  }
  return fileList;
}

function processFiles() {
  const allFiles = getAllJsFiles(BACKEND_DIR);
  console.log(`Found ${allFiles.length} files to check.`);
  
  const filesToProcess = [];

  for (const oldAbsPath of allFiles) {
    const newAbsPath = computeFuturePath(oldAbsPath);
    let content = fs.readFileSync(oldAbsPath, 'utf8');
    
    let modified = false;
    let newContent = content;

    // Only rewrite requires in JS/TS
    if (oldAbsPath.endsWith('.js') || oldAbsPath.endsWith('.ts')) {
      const regex = /(?:require\(\s*|from\s+)['"](\.[^'"]+)['"]/g;
      
      newContent = content.replace(regex, (match, reqPath) => {
        const oldTargetAbs = path.resolve(path.dirname(oldAbsPath), reqPath);
        const newTargetAbs = computeFuturePath(oldTargetAbs);
        
        let newReqPath = path.relative(path.dirname(newAbsPath), newTargetAbs);
        newReqPath = newReqPath.replace(/\\/g, '/');
        if (!newReqPath.startsWith('.')) {
          newReqPath = './' + newReqPath;
        }
        
        if (reqPath !== newReqPath) {
          modified = true;
          return match.replace(reqPath, newReqPath);
        }
        return match;
      });
    }

    if (modified || oldAbsPath !== newAbsPath) {
      filesToProcess.push({
        oldPath: oldAbsPath,
        newPath: newAbsPath,
        content: newContent
      });
    }
  }

  console.log(`Need to update/move ${filesToProcess.length} files.`);

  // Write new files FIRST
  for (const file of filesToProcess) {
    if (file.oldPath !== file.newPath) {
      const targetDir = path.dirname(file.newPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(file.newPath, file.content);
    } else {
      fs.writeFileSync(file.newPath, file.content);
    }
  }

  console.log('Finished writing files.');

  // Delete old files carefully
  for (const file of filesToProcess) {
    if (file.oldPath !== file.newPath && fs.existsSync(file.oldPath)) {
      fs.unlinkSync(file.oldPath);
    }
  }
  
  console.log('Migration complete!');
}

processFiles();
