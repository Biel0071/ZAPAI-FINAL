const fs = require('fs');
const path = require('path');
const repoDir = path.join(__dirname, 'backend', 'src', 'data', 'repositories');
const storeDir = path.join(__dirname, 'backend', 'src', 'data', 'store');

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(dir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      
      content = content.replace(/require\(['"]\.\.\/([^'"]+)['"]\)/g, (match, importedPath) => {
        // from backend/src/data/repositories or store
        if (importedPath.startsWith('store/')) return `require('../store/${importedPath.replace('store/', '')}')`;
        if (importedPath.startsWith('repositories/')) return `require('../repositories/${importedPath.replace('repositories/', '')}')`;
        if (importedPath.startsWith('config/')) return `require('../../infrastructure/config/${importedPath.replace('config/', '')}')`;
        if (importedPath.startsWith('events/')) return `require('../../infrastructure/events/${importedPath.replace('events/', '')}')`;
        if (importedPath.startsWith('core/')) return `require('../../core/${importedPath.replace('core/', '')}')`;
        if (importedPath.startsWith('modules/')) return `require('../../core/modules/${importedPath.replace('modules/', '')}')`;
        
        // Everything else that was in backend/ stays in backend/
        // since we are in backend/src/data/repositories, backend/ is ../../../
        return `require('../../../${importedPath}')`;
      });
      
      fs.writeFileSync(filePath, content);
    }
  });
}

processDir(repoDir);
processDir(storeDir);
console.log('Fixed imports in repositories and store!');
