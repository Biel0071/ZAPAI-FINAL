const productRepository = require('../../data/repositories/productRepository');

async function getProducts(req, res) {
  try {
    const companyId = req.companyId || req.user?.companyId || 'default';
    const { category, search, limit, offset } = req.query;

    const products = await productRepository.listProducts({
      companyId,
      category,
      search,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });

    return res.json({
      success: true,
      data: products,
      total: products.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao carregar lista de produtos',
    });
  }
}

async function getProductById(req, res) {
  try {
    const companyId = req.companyId || req.user?.companyId || 'default';
    const { id } = req.params;

    const product = await productRepository.getProductById(id, companyId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getProducts,
  getProductById,
};
