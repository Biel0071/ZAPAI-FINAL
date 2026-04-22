const fs = require('fs/promises');
const path = require('path');
const { isDeniedText } = require('./safeCodeRules');

function toPascalCase(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : '';
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureFile(filePath, content) {
  if (await exists(filePath)) {
    return { created: false, filePath };
  }

  if (isDeniedText(content)) {
    throw new Error('Generated template violated safe-code rules.');
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  return { created: true, filePath };
}

async function upsertInFile(filePath, insertion, marker) {
  const content = await fs.readFile(filePath, 'utf8');
  if (content.includes(insertion.trim())) {
    return false;
  }

  if (!content.includes(marker)) {
    return false;
  }

  const updated = content.replace(marker, `${insertion}\n${marker}`);
  await fs.writeFile(filePath, updated, 'utf8');
  return true;
}

function frontendServiceTemplate(pascalName, resourceName, camelName) {
  return `export type ${pascalName} = {
  id: number;
  name: string;
  createdAt: string;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '') ||
  'http://localhost:4000';

async function request<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(API_BASE_URL + endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error('${pascalName} API request failed: ' + response.status);
  }

  return response.json() as Promise<T>;
}

export const ${camelName}Service = {
  list: () => request<${pascalName}[]>('/api/${resourceName}'),
  create: (payload: { name: string }) => request<${pascalName}>('/api/${resourceName}', 'POST', payload),
  update: (id: number, payload: { name: string }) => request<${pascalName}>('/api/${resourceName}/' + id, 'PUT', payload),
  remove: (id: number) => request<{ success: boolean }>('/api/${resourceName}/' + id, 'DELETE'),
};
`;
}

function frontendPageTemplate(pascalName, camelName) {
  return `import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { DSButton, DSCard, DSInput, DSTable } from '@/design-system';
import { ${camelName}Service, type ${pascalName} } from '@/services/${camelName}Service';

type Row = {
  id: number;
  name: string;
  createdAt: string;
};

export default function ${pascalName}Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await ${camelName}Service.list();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const createRow = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await ${camelName}Service.create({ name: trimmed });
    setName('');
    await loadRows();
  };

  const deleteRow = async (id: number) => {
    await ${camelName}Service.remove(id);
    await loadRows();
  };

  return (
    <div className="min-h-screen">
      <Header title="${pascalName}" subtitle="AI generated module" />
      <div className="p-6 space-y-4">
        <DSCard title="${pascalName} Manager" subtitle="Create and manage records">
          <div className="flex gap-2">
            <DSInput value={name} onChange={(event) => setName(event.target.value)} placeholder="${pascalName} name" />
            <DSButton onClick={() => void createRow()} disabled={loading}>Create</DSButton>
          </div>
        </DSCard>

        <DSCard>
          <DSTable
            headers={['ID', 'Name', 'Created At', 'Actions']}
            rows={rows.map((row) => [
              row.id,
              row.name,
              new Date(row.createdAt).toLocaleString(),
              <DSButton key={'delete-' + row.id} variant="outline" onClick={() => void deleteRow(row.id)}>Delete</DSButton>,
            ])}
            emptyText="No rows found."
          />
        </DSCard>
      </div>
    </div>
  );
}
`;
}

function backendServiceTemplate(pascalName) {
  return `const records = [];
let nextId = 1;

function list${pascalName}() {
  return records;
}

function get${pascalName}ById(id) {
  return records.find((item) => item.id === Number(id)) || null;
}

function create${pascalName}(payload = {}) {
  const entity = {
    id: nextId++,
    name: String(payload.name || '').trim() || '${pascalName} #' + nextId,
    createdAt: new Date().toISOString(),
  };

  records.push(entity);
  return entity;
}

function update${pascalName}(id, payload = {}) {
  const target = get${pascalName}ById(id);
  if (!target) return null;

  target.name = String(payload.name || target.name).trim() || target.name;
  return target;
}

function remove${pascalName}(id) {
  const index = records.findIndex((item) => item.id === Number(id));
  if (index < 0) return false;

  records.splice(index, 1);
  return true;
}

module.exports = {
  create${pascalName},
  get${pascalName}ById,
  list${pascalName},
  remove${pascalName},
  update${pascalName},
};
`;
}

function backendControllerTemplate(pascalName, camelName) {
  return `const ${camelName}Service = require('../services/${camelName}Service');

function list(req, res) {
  return res.status(200).json(${camelName}Service.list${pascalName}());
}

function getById(req, res) {
  const item = ${camelName}Service.get${pascalName}ById(req.params.id);
  if (!item) return res.status(404).json({ error: '${pascalName} not found.' });
  return res.status(200).json(item);
}

function create(req, res) {
  const created = ${camelName}Service.create${pascalName}(req.body || {});
  return res.status(201).json(created);
}

function update(req, res) {
  const updated = ${camelName}Service.update${pascalName}(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: '${pascalName} not found.' });
  return res.status(200).json(updated);
}

function remove(req, res) {
  const removed = ${camelName}Service.remove${pascalName}(req.params.id);
  if (!removed) return res.status(404).json({ error: '${pascalName} not found.' });
  return res.status(200).json({ success: true });
}

module.exports = {
  create,
  getById,
  list,
  remove,
  update,
};
`;
}

function backendRouteTemplate(resourceName, camelName) {
  return `const express = require('express');
const router = express.Router();
const ${camelName}Controller = require('../controllers/${camelName}Controller');

router.get('/api/${resourceName}', ${camelName}Controller.list);
router.get('/api/${resourceName}/:id', ${camelName}Controller.getById);
router.post('/api/${resourceName}', ${camelName}Controller.create);
router.put('/api/${resourceName}/:id', ${camelName}Controller.update);
router.delete('/api/${resourceName}/:id', ${camelName}Controller.remove);

module.exports = router;
`;
}

async function registerBackendRoute(backendRoot, resourceName, camelName) {
  const serverFile = path.join(backendRoot, 'server.js');
  const requireLine = `const ${camelName}Router = require('./routes/${resourceName}');`;
  const useLine = `app.use('/', ${camelName}Router);`;

  await upsertInFile(
    serverFile,
    requireLine,
    "const messagesController = require('./controllers/messagesController');"
  );

  await upsertInFile(
    serverFile,
    useLine,
    "app.get('/health', (_req, res) => {"
  );
}

async function registerFrontendRouteAndNav(frontendRoot, pascalName, resourceName) {
  const appFile = path.join(frontendRoot, 'src', 'App.tsx');
  const sidebarFile = path.join(frontendRoot, 'src', 'components', 'layout', 'Sidebar.tsx');

  const lazyLine = `const ${pascalName}Page = lazy(() => import(\"./pages/${pascalName}Page\"));`;
  const routeLine = `                    <Route path=\"/${resourceName}\" element={<${pascalName}Page />} />`;
  const navLine = `  { icon: List, label: \"${pascalName}\", path: \"/${resourceName}\" },`;

  await upsertInFile(
    appFile,
    lazyLine,
    'const NotFound = lazy(() => import("./pages/NotFound"));'
  );

  await upsertInFile(
    appFile,
    routeLine,
    '                    <Route path="/settings" element={<Settings />} />'
  );

  await upsertInFile(
    sidebarFile,
    navLine,
    '  { icon: ChartLineUp, label: "Analytics", path: "/analytics" },'
  );
}

async function generateModule(moduleName) {
  const pascalName = toPascalCase(moduleName);
  const resourceName = toKebabCase(moduleName);
  const camelName = toCamelCase(moduleName);

  if (!pascalName || !resourceName || !camelName) {
    throw new Error('moduleName is required.');
  }

  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendRoot = path.join(projectRoot, 'frontend');

  const targets = {
    frontendPage: path.join(frontendRoot, 'src', 'pages', `${pascalName}Page.tsx`),
    frontendService: path.join(frontendRoot, 'src', 'services', `${camelName}Service.ts`),
    backendRoute: path.join(backendRoot, 'routes', `${resourceName}.js`),
    backendController: path.join(backendRoot, 'controllers', `${camelName}Controller.js`),
    backendService: path.join(backendRoot, 'services', `${camelName}Service.js`),
  };

  const created = [];

  const results = await Promise.all([
    ensureFile(targets.frontendPage, frontendPageTemplate(pascalName, camelName)),
    ensureFile(targets.frontendService, frontendServiceTemplate(pascalName, resourceName, camelName)),
    ensureFile(targets.backendRoute, backendRouteTemplate(resourceName, camelName)),
    ensureFile(targets.backendController, backendControllerTemplate(pascalName, camelName)),
    ensureFile(targets.backendService, backendServiceTemplate(pascalName)),
  ]);

  results.forEach((item) => {
    if (item.created) {
      created.push(item.filePath);
    }
  });

  await registerBackendRoute(backendRoot, resourceName, camelName);
  await registerFrontendRouteAndNav(frontendRoot, pascalName, resourceName);

  return {
    module: pascalName,
    routePath: `/${resourceName}`,
    apiBasePath: `/api/${resourceName}`,
    generated: {
      frontend: [targets.frontendPage, targets.frontendService],
      backend: [targets.backendRoute, targets.backendController, targets.backendService],
    },
    created,
  };
}

module.exports = {
  generateModule,
};
