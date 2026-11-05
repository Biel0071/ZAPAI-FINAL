const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const imgPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/.user_uploaded/media_1793831411205_570cc2d2.jpg';
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');
  
  await page.setContent(`
    <html>
      <body style="margin:0; background:black;">
        <img id="srcImg" src="data:image/jpeg;base64,${imgBase64}" />
      </body>
    </html>
  `);
  
  const info = await page.evaluate(() => {
    const img = document.getElementById('srcImg');
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  });
  
  console.log('Image dimensions:', info);
  await browser.close();
})();
