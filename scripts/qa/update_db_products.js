const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });
  const check = await pool.query("SELECT id, name, images FROM products WHERE id = 'prod_bloco_10_100un'");
  console.log('Current in DB:', check.rows);

  const imagesArray = [
    '/assets/catalog/bloco_10_100un.png',
    '/assets/catalog/bloco_10_100un_2.png',
    '/assets/catalog/bloco_10_100un_3.png'
  ];

  if (check.rows.length > 0) {
    await pool.query(
      "UPDATE products SET images = $1 WHERE id = 'prod_bloco_10_100un'",
      [JSON.stringify(imagesArray)]
    );
    console.log('Updated prod_bloco_10_100un images in database.');
  } else {
    console.log('prod_bloco_10_100un row not found in products table.');
  }

  // Also fix message 334249 in messages table so its media_path and media_url are relative /assets/catalog/bloco_10_100un.png
  await pool.query(
    "UPDATE messages SET media_path = '/assets/catalog/bloco_10_100un.png', media_type = 'product', type = 'product' WHERE id = 334249"
  );
  console.log('Fixed message 334249 in messages table.');

  await pool.end();
}

main().catch(console.error);

