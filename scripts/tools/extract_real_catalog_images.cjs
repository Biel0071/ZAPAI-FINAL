const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '../../backend/node_modules/sharp'));

async function extract() {
  const modalImgPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/.user_uploaded/media_1793831411205_570cc2d2.jpg';
  const chatImgPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/.user_uploaded/media_1793831349162_678754a4.jpg';

  const outDirs = [
    path.join(__dirname, '../../backend/uploads/catalog/real'),
    path.join(__dirname, '../../backend/assets/catalog/real'),
    path.join(__dirname, '../../frontend-official/public/assets/catalog/real'),
    path.join(__dirname, '../../frontend-official/public/assets/catalog'),
    path.join(__dirname, '../../frontend-official/dist/assets/catalog/real'),
    path.join(__dirname, '../../frontend-official/dist/assets/catalog'),
  ];

  for (const dir of outDirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. High-Res Main Photo from WhatsApp Modal (Image 4)
  // Photo is from x: 261, y: 79, w: 506, h: 380
  const mainBuffer = await sharp(modalImgPath)
    .extract({ left: 261, top: 79, width: 506, height: 380 })
    .png({ quality: 100 })
    .toBuffer();

  // 2. Chat Preview (1:1 aspect ratio square preview from WhatsApp Web chat card)
  // In Image 2 (chatImgPath), width: 1024, height: 544
  // The product image is in the green card on the right:
  // x: 765 to 962 (width: 197), y: 247 to 444 (height: 197)
  const chatBuffer = await sharp(chatImgPath)
    .extract({ left: 765, top: 247, width: 197, height: 197 })
    .png({ quality: 100 })
    .toBuffer();

  // 3. Thumbnails from Modal (Image 4)
  // Thumbnail 1: x: 494 to 538 (w: 44), y: 466 to 510 (h: 44)
  // Thumbnail 2: x: 549 to 591 (w: 42), y: 466 to 510 (h: 44)
  // Thumbnail 3: x: 596 to 640 (w: 44), y: 466 to 510 (h: 44)
  const thumb2Buffer = await sharp(modalImgPath)
    .extract({ left: 548, top: 465, width: 44, height: 45 })
    .resize(400, 400, { fit: 'inside' })
    .png({ quality: 100 })
    .toBuffer();

  const thumb3Buffer = await sharp(modalImgPath)
    .extract({ left: 595, top: 465, width: 46, height: 45 })
    .resize(400, 400, { fit: 'inside' })
    .png({ quality: 100 })
    .toBuffer();

  // Save the authentic images into all locations
  for (const dir of outDirs) {
    // bloco_10_100un.png is the primary image (the real block photo)
    fs.writeFileSync(path.join(dir, 'bloco_10_100un.png'), chatBuffer);
    fs.writeFileSync(path.join(dir, 'bloco_10_100un_main.png'), mainBuffer);
    fs.writeFileSync(path.join(dir, 'bloco_10_100un_1.png'), mainBuffer);
    fs.writeFileSync(path.join(dir, 'bloco_10_100un_2.png'), thumb2Buffer);
    fs.writeFileSync(path.join(dir, 'bloco_10_100un_3.png'), thumb3Buffer);
  }

  console.log('Successfully extracted and saved authentic images:');
  console.log('- bloco_10_100un.png (Primary chat crop, 197x197)');
  console.log('- bloco_10_100un_1.png (High-res modal full view, 506x380)');
  console.log('- bloco_10_100un_2.png (Angle 2 / stack view)');
  console.log('- bloco_10_100un_3.png (Isolated cinder block on white)');
}

extract().catch(console.error);

