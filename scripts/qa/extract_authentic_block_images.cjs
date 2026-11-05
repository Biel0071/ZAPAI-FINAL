const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  
  const imgPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/.user_uploaded/media_1793831411205_570cc2d2.jpg';
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');
  
  await page.setContent(`
    <html>
      <body style="margin:0; background:black;">
        <canvas id="c"></canvas>
      </body>
    </html>
  `);
  
  const extracted = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.getElementById('c');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Helper to extract crop as base64
        function crop(x, y, w, h) {
          const tc = document.createElement('canvas');
          tc.width = w;
          tc.height = h;
          const tctx = tc.getContext('2d');
          tctx.drawImage(c, x, y, w, h, 0, 0, w, h);
          return tc.toDataURL('image/png').split(',')[1];
        }
        
        // Main high-res block image
        // 260 to 767, 78 to 449
        const mainB64 = crop(261, 78, 506, 371);
        
        // Thumbnail 1: 494, 467, 42, 42
        const t1 = crop(493, 466, 44, 44);
        
        // Thumbnail 2: 543, 466, 44, 44
        const t2 = crop(543, 466, 44, 44);
        
        // Thumbnail 3: 593, 466, 44, 44
        const t3 = crop(593, 466, 44, 44);
        
        resolve({ mainB64, t1, t2, t3 });
      };
      img.src = 'data:image/jpeg;base64,' + b64;
    });
  }, imgBase64);
  
  // Save main to public catalog and backend
  const outPaths = [
    'frontend-official/public/assets/catalog/bloco_10_100un.png',
    'frontend-official/public/assets/catalog/real/bloco_10_100un.png',
    'backend/assets/catalog/bloco_10_100un.png',
    'backend/assets/catalog/real/bloco_10_100un.png',
  ];
  
  const mainBuffer = Buffer.from(extracted.mainB64, 'base64');
  for (const p of outPaths) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, mainBuffer);
    console.log('Saved main authentic block image to', p);
  }
  
  // Save gallery images 1, 2, 3
  const t1Buffer = Buffer.from(extracted.mainB64, 'base64'); // main is full res of photo 1!
  const t2Buffer = Buffer.from(extracted.t2, 'base64');
  const t3Buffer = Buffer.from(extracted.t3, 'base64');
  
  const gallery = [
    { name: 'bloco_10_100un_1.png', buf: t1Buffer },
    { name: 'bloco_10_100un_2.png', buf: t2Buffer },
    { name: 'bloco_10_100un_3.png', buf: t3Buffer },
  ];
  
  for (const item of gallery) {
    fs.writeFileSync(`frontend-official/public/assets/catalog/${item.name}`, item.buf);
    fs.writeFileSync(`frontend-official/public/assets/catalog/real/${item.name}`, item.buf);
    fs.writeFileSync(`backend/assets/catalog/${item.name}`, item.buf);
    fs.writeFileSync(`backend/assets/catalog/real/${item.name}`, item.buf);
    console.log(`Saved gallery image ${item.name}`);
  }
  
  await browser.close();
  console.log('ALL AUTHENTIC BLOCK IMAGES EXTRACTED AND SAVED SUCCESSFULLY!');
})();

