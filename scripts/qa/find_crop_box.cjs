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
  
  const crops = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.getElementById('c');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Scan for central image bounding box
        // We know the main image is roughly in the center, between y=70 and y=450, x=200 and x=800
        const idata = ctx.getImageData(0, 0, c.width, c.height);
        const data = idata.data;
        
        // Let's find boundaries of the main image
        // Dark background around is ~ #111b21 (r ~ 17, g ~ 27, b ~ 33)
        let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
        for (let y = 70; y < 450; y++) {
          for (let x = 200; x < 800; x++) {
            const idx = (y * c.width + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            // Not background black/dark
            if (r > 35 || g > 40 || b > 45) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        
        resolve({
          main: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
        });
      };
      img.src = 'data:image/jpeg;base64,' + b64;
    });
  }, imgBase64);
  
  console.log('Detected main image crop box:', crops);
  await browser.close();
})();
