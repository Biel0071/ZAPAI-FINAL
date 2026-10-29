/**
 * Migration 050: Update Catalog Product Images to Static Public Assets
 * Points all product images to `/assets/catalog/...` for zero-auth high-performance delivery.
 */

exports.up = async function (knex) {
  const updates = [
    { code: 'TIJ-8F-MIL', img: '/assets/catalog/tijolo_8f.jpg' },
    { code: 'TIJ-MAC-MIL', img: '/assets/catalog/tijolo_macico.jpg' },
    { code: 'CIM-CPII-50', img: '/assets/catalog/cimento_cp2.png' },
    { code: 'CIM-CPIII-50', img: '/assets/catalog/cimento_cp2.png' },
    { code: 'AGR-AREIA-M3', img: '/assets/catalog/blocos.png' },
    { code: 'AGR-BRITA-1-M3', img: '/assets/catalog/blocos.png' },
    { code: 'CHUR-65-COMP', img: '/assets/catalog/churras_65.png' },
    { code: 'CHUR-75-PREM', img: '/assets/catalog/churras_75.jpg' },
    { code: 'TEL-FIB-244', img: '/assets/catalog/telha_fibro.jpg' },
    { code: 'CXA-1000L-FTL', img: '/assets/catalog/caixa_dagua.png' },
    { code: 'CXA-5000L-FTL', img: '/assets/catalog/caixa_dagua.png' },
    { code: 'BET-400L-2CV', img: '/assets/catalog/betoneira.png' },
    { code: 'TNT-ACR-18L', img: '/assets/catalog/tinta.png' },
    { code: 'ARG-AC3-20', img: '/assets/catalog/cimento_cp2.png' },
    { code: 'BLC-EST-14', img: '/assets/catalog/blocos.png' },
  ];

  for (const item of updates) {
    await knex('products')
      .where({ code: item.code })
      .update({
        images: JSON.stringify([item.img]),
        updated_at: knex.fn.now(),
      });
  }
};

exports.down = async function (knex) {
  // no-op
};
