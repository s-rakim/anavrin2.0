import { Router } from 'express';
import { all } from '../db.js';
import { getProduct, serializeProduct } from '../services.js';
import { h, notFound } from '../util.js';

const router = Router();

const SORTS = {
  featured: 'review_count DESC',
  'price-asc': 'price ASC',
  'price-desc': 'price DESC',
  rating: 'rating DESC',
  newest: 'id DESC',
};

router.get('/products', h((req, res) => {
  const { q = '', category = '', sort = 'featured' } = req.query;
  const where = ['active = 1'];
  const params = [];
  if (q) {
    where.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)');
    const like = `%${String(q).slice(0, 80)}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('category = ?');
    params.push(String(category));
  }
  const order = SORTS[sort] || SORTS.featured;
  const rows = all(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY ${order}, id`, ...params);
  res.json({ products: rows.map(serializeProduct) });
}));

router.get('/products/:id', h((req, res) => {
  const product = getProduct(Number(req.params.id));
  if (!product || !product.active) throw notFound('This product is no longer available.');
  res.json({ product });
}));

router.get('/categories', (req, res) => {
  const rows = all(`SELECT category AS name, COUNT(*) AS count FROM products WHERE active = 1 GROUP BY category ORDER BY category`);
  res.json({ categories: rows });
});

export default router;
