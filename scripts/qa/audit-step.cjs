const {chromium}=require('../../frontend-official/node_modules/playwright');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outros/reports/qa');
(async()=>{
 const browser=await chromium.connectOverCDP(fs.readFileSync(path.join(root,'outros/temp/qa-browser-endpoint.txt'),'utf8'));
 const ctx=browser.contexts()[0],page=ctx.pages()[0];
 page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);
 const record=(id,feature,action,status,detail,evidence)=>{
  const file=path.join(out,'functional-results.json');const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
  data.push({id,module:new URL(page.url()).pathname,route:page.url(),viewport:page.viewportSize(),feature,action,status,detail,evidence,at:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(data,null,2));
 };
 const snap=async name=>{const file=`evidence/${name}.png`;await page.screenshot({path:path.join(out,file),mask:[page.locator('input,textarea,tbody,img,main p,main h3,main h4')]});return file;};
 const code=fs.readFileSync(0,'utf8');
 await new (Object.getPrototypeOf(async function(){}).constructor)('page','ctx','browser','fs','out','record','snap',code)(page,ctx,browser,fs,out,record,snap);
 process.exit(0);
})().catch(e=>{console.error(e.stack);process.exit(1)});
