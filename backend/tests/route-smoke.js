/* eslint-disable no-console */

async function run() {
  const base = process.env.ROUTE_SMOKE_BASE || 'http://127.0.0.1:8080';
  const routes = [
    '/',
    '/connections',
    '/inbox',
    '/settings',
    '/automation',
    '/analytics',
    '/contacts',
    '/campaigns',
    '/integrations',
    '/dev-tools',
    '/rota-inexistente',
  ];

  const out = [];

  for (const route of routes) {
    try {
      const response = await fetch(`${base}${route}`, {
        headers: {
          Accept: 'text/html',
        },
      });
      
      const html = await response.text();

      out.push({
        route,
        status: response.status,
        ok: response.ok,
        hasRoot: html.includes('id="root"'),
        hasAssets: html.includes('/assets/'),
      });
    } catch (error) {
      out.push({
        route,
        status: 0,
        ok: false,
        hasRoot: false,
        hasAssets: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify(out, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
