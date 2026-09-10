// Reproducible, read-only browser baseline. Does not submit business forms.
const { chromium } = require('../../frontend-official/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'outros/reports/qa');
const base = 'http://209.50.241.22';
const results = [], inventory = [], events = [];
let scope = 'login';
const sanitize = value => String(value).replace(/Bearer\s+\S+/gi, '[TOKEN]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]').replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[NUMBER]');
const flush = () => { for (const [name, data] of Object.entries({results, inventory, events})) fs.writeFileSync(path.join(output, `baseline-${name}.json`), JSON.stringify(data, null, 2)); };
(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await context.newPage();
  page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(15000);
  page.on('console', m => { if (['warning','error'].includes(m.type())) events.push({scope, type:'console', level:m.type(), text:sanitize(m.text())}); });
  page.on('pageerror', e => events.push({scope, type:'pageerror', text:sanitize(e.message)}));
  page.on('response', r => events.push({scope,type:'response',url:sanitize(r.url()),status:r.status(),method:r.request().method(),at:new Date().toISOString()}));
  page.on('requestfailed', r => events.push({scope,type:'requestfailed',url:sanitize(r.url()),error:r.failure()?.errorText}));
  page.on('websocket', ws => {events.push({scope,type:'ws-open',url:sanitize(ws.url())});ws.on('close',()=>events.push({scope,type:'ws-close'}));ws.on('socketerror',error=>events.push({scope,type:'ws-error',error:sanitize(error)}));});
  const record = (feature, action, status, detail, evidence) => {results.push({id:`BASE-${results.length+1}`,module:scope.split('/')[0],screen:scope,route:page.url(),viewport:page.viewportSize(),feature,action,status,detail,evidence,at:new Date().toISOString()});flush();};
  const capture = async name => {
    // Mask textual content and input values to retain layout geometry without exporting client records.
    // Unmasked controls remain available in the redacted structured inventory.
    const file = `evidence/${name}.png`;
    await page.screenshot({path:path.join(output,file),fullPage:false,mask:[page.locator('input,textarea,tbody,img'),page.locator('main p,main h3,main h4')]});
    return file;
  };
  await page.goto(base);
  const old = fs.readFileSync(path.join(root,'frontend-official/tests/ui/visual-full-e2e.spec.ts'),'utf8');
  await page.getByPlaceholder('Digite o usuário').fill(old.match(/const USERNAME = "([^"]+)"/)[1]);
  await page.getByPlaceholder('Digite a senha').fill(old.match(/const PASSWORD = "([^"]+)"/)[1]);
  await page.getByRole('button',{name:'Entrar no Dashboard'}).click();
  await page.waitForURL('**/dashboard');
  record('Login','Autenticar pelo formulário','PASS','Rota /dashboard alcançada');
  const routes = ['/dashboard','/connections','/contacts','/campaigns','/operations','/ai','/flows','/memory','/settings','/inbox'];
  for (const route of routes) {
    scope=route.slice(1);
    try {
      await page.setViewportSize({width:1440,height:900});
      await page.goto(base+route,{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(2500);
      const controls=await page.locator('a,button,input,textarea,select,[role=tab]').evaluateAll(es=>es.map((e,i)=>({index:i,tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent?.trim()||'',href:e.getAttribute('href'),disabled:!!e.disabled,visible:!!e.getClientRects().length})));
      inventory.push({route,controls:controls.map(c=>({...c,label:sanitize(c.label)}))});
      record('Inventário','Enumerar controles renderizados','PASS',`${controls.length} controles; não implica aprovação funcional`);
      const tabs = await page.getByRole('tab').allTextContents();
      for (const label of tabs) {
        if (!label.trim()) continue;
        scope=route.slice(1)+'/'+label.trim();
        try {
          const before=await page.locator('main').first().innerText();
          const tab=page.getByRole('tab',{name:label.trim(),exact:true});
          if (!(await tab.isVisible())) {record('Aba','Clicar '+label,'BLOCKED','Aba oculta no viewport atual');continue;}
          await tab.click(); await page.waitForTimeout(400);
          const selected=await tab.getAttribute('aria-selected');
          const changed=before!==await page.locator('main').first().innerText();
          const status=selected==='true'&&changed?'PASS':selected==='true'?'NOT TESTED':'FAIL';
          record('Aba '+label,'Clicar e conferir seleção/conteúdo',status,`Selecionada=${selected}; conteúdo mudou=${changed}; aba inicial sem transição não é PASS`);
        } catch(e) {record('Aba '+label,'Clicar','BLOCKED',sanitize(e.message));}
      }
      scope=route.slice(1);
      for(const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1440,900],[844,390]]) {
        await page.setViewportSize({width,height});await page.waitForTimeout(250);
        const geometry=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,controls:[...document.querySelectorAll('button,input,select,textarea,[role=tab]')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.textContent?.trim()||'',x:r.x,y:r.y,width:r.width,height:r.height,clipped:r.right>innerWidth+1||r.left< -1};})}));
        const overflow=geometry.documentWidth>width+1;
        const clipped=geometry.controls.filter(c=>c.clipped);
        inventory.push({route,viewport:{width,height},geometry:{...geometry,controls:geometry.controls.map(c=>({...c,label:sanitize(c.label)}))}});
        record('Geometria responsiva','Medir documento e controles','NOT TESTED',`Triagem: overflow=${overflow}; controles fora da largura=${clipped.length}. Usabilidade requer exercício e inspeção visual.`,await capture(`${scope}-${width}x${height}`));
      }
      console.log(`${route}: ${results.length} resultados acumulados`);
    }catch(e){record('Acesso à tela','Navegar e inventariar','BLOCKED',sanitize(e.message));console.log(route,'BLOCKED',e.message.slice(0,100));}
  }
  flush();await browser.close();
})().catch(e=>{events.push({scope,type:'harness-error',text:sanitize(e.stack)});flush();console.error(e.message);process.exitCode=1;});
