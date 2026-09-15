// Run after audit-browser-session with QA_READ_ONLY=1 against the local frontend.
const {chromium}=require('../../frontend-official/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'outros/reports/qa/visual-polish-2026-09-15');
(async()=>{
 const browser=await chromium.connectOverCDP(fs.readFileSync(path.join(root,'outros/temp/qa-browser-endpoint.txt'),'utf8'));
 const context=browser.contexts()[0],page=context.pages()[0];
 const results=process.env.QA_CASE_FILTER&&fs.existsSync(path.join(out,'regression.json'))?JSON.parse(fs.readFileSync(path.join(out,'regression.json'),'utf8')):[];page.setDefaultTimeout(15000);
 const save=()=>fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(results,null,2));
 const capture=async name=>{
  const file=`evidence/${name}.png`;
  await page.screenshot({path:path.join(out,file),mask:[page.locator('header'),page.locator('.chat-bubble'),page.locator('.inbox-message'),page.locator('main p, main h3, main h4'),page.locator('tbody'),page.locator('img'),page.getByText(/@lid|@s\.whatsapp\.net|\+55\d+/)]});return file;
 };
 const test=async(name,fn)=>{
  if(process.env.QA_CASE_FILTER&&!new RegExp(process.env.QA_CASE_FILTER).test(name))return;
  const result={name,route:page.url(),viewport:page.viewportSize(),status:'PASS'};
  try{result.details=await fn();}catch(e){result.status='FAIL';result.error=e.message;}
  result.evidence=await capture(name.replace(/[^a-z0-9-]/gi,'_')).catch(e=>'Screenshot failed: '+e.message);
  const previous=results.findIndex(r=>r.name===name);if(previous>=0)results.splice(previous,1);results.push(result);save();console.log(result.status,name,result.error||JSON.stringify(result.details));
 };
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:8080/inbox');await page.locator('.inbox-message').first().waitFor();
 await test('right-panel-collapse-expand',async()=>{
  const panel=page.locator('[data-panel-id="inbox-context-panel"]');
  const expand=page.getByRole('button',{name:'Expandir painel',exact:true});if(await expand.isVisible())await expand.click();
  const initial=(await panel.boundingBox()).width;
  await page.getByTitle('Recolher painel (Alt+B)').click();await page.waitForTimeout(250);
  const collapsed=(await panel.boundingBox()).width;assert.ok(collapsed>=60&&collapsed<=66,`Rail ${collapsed}px`);
  for(const label of ['IA','Lead','Respostas Rápidas','Arquivos']){const b=await panel.getByRole('button',{name:label,exact:true}).boundingBox();assert.ok(b.width>=36&&b.height>=36,label+' target too small');}
  await expand.click();await page.waitForTimeout(250);const restored=(await panel.boundingBox()).width;assert.ok(Math.abs(restored-initial)<3,'Width not restored');return {initial,collapsed,restored};
 });
 await test('right-panel-resize-keyboard',async()=>{
  const panel=page.locator('[data-panel-id="inbox-context-panel"]'),before=(await panel.boundingBox()).width;
  const handle=page.getByRole('separator',{name:'Redimensionar painel de detalhes'});await handle.focus();await handle.press('ArrowLeft');
  const after=(await panel.boundingBox()).width;assert.ok(after>before,'Keyboard resize did not increase context panel');return {before,after};
 });
 await test('left-sidebar-icons',async()=>{
  const collapse=page.getByRole('button',{name:'Recolher menu',exact:true});if(await collapse.isVisible())await collapse.click();await page.waitForTimeout(250);
  for(const label of ['Dashboard','Inbox','Conexões','Contatos','Campanhas','Operações','IA & Automação','Configurações']){
   const link=page.getByRole('link',{name:label,exact:true});const box=await link.locator('svg').boundingBox();assert.ok(box&&box.width>=18,label+' missing icon');await link.click({trial:true});
  }
  await page.getByRole('button',{name:'Expandir menu',exact:true}).click();return {icons:8};
 });
 for(const [width,height]of [[360,800],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  await test(`emoji-${width}x${height}`,async()=>{
   const input=page.getByPlaceholder('Digite sua mensagem...');
   if(!(await input.isVisible()))await page.locator('.inbox-message').first().click();
   await input.fill('');await page.getByRole('button',{name:'Abrir emojis',exact:true}).click();
   const picker=page.locator('[data-emoji-picker]');await page.locator('em-emoji-picker').waitFor();
   const box=await picker.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,JSON.stringify(box));
   await page.locator('em-emoji-picker').getByRole('button',{name:'😀',exact:true}).first().click();assert.ok((await input.inputValue()).includes('😀'),'Emoji not inserted');
   await input.fill('');await page.getByRole('button',{name:'Abrir emojis',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await picker.count(),0,'Escape did not close picker');
   return {box,inserted:true,escape:true};
  });
 }
 for(const route of ['/dashboard','/contacts','/campaigns','/ai','/settings','/connections','/operations','/flows','/memory']){
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8080'+route);await page.waitForTimeout(1500);
   await test(`screen-${route.slice(1)}-${width}`,async()=>{
    await page.waitForFunction(()=>{const text=document.querySelector('main')?.innerText||'';return text.length>100&&!text.includes('Carregando Módulo')&&!document.querySelector('main .shimmer')},{},{timeout:30000});
    const text=await page.locator('main').first().innerText();assert.ok(text.length>100&&!text.includes('Carregando Módulo'),'Content not ready');
    const geometry=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(geometry.document<=width+1,'Page overflow');return {...geometry,note:'Layout geometry only; not business-flow approval'};
   });
  }
 }
 save();process.exit(results.some(r=>r.status==='FAIL')?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
