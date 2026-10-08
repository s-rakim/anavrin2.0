import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { useCart } from './CartContext';

const CatalogContext = createContext(null);

/** Active catalogue kept live: stock, prices and images update the moment an admin or a sale changes them. */
export function CatalogProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickRef, setQuickRef] = useState(null); // { id, scope }
  const { syncProduct } = useCart();

  const load = useCallback(async () => {
    try {
      setError(null);
      const { products: list } = await api('/products');
      setProducts(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useSocketEvent('product:updated', (p) => {
    syncProduct(p);
    setProducts((prev) => {
      if (!p.active) return prev.filter((x) => x.id !== p.id);
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
  });
  useSocketEvent('product:removed', ({ id }) => {
    setProducts((prev) => prev.filter((x) => x.id !== id));
  });

  const categories = useMemo(() => {
    const counts = new Map();
    products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Open the preview for a product; `scope` keeps the image morph tied to the card that was clicked.
  const openQuickView = useCallback((product, scope = 'grid') => setQuickRef(product ? { id: product.id, scope } : null), []);
  const closeQuickView = useCallback(() => setQuickRef(null), []);
  const quickView = quickRef ? products.find((p) => p.id === quickRef.id) || null : null;
  const quickScope = quickRef?.scope;

  const value = useMemo(() => ({ products, categories, loading, error, reload: load, quickView, quickScope, openQuickView, closeQuickView }),
    [products, categories, loading, error, load, quickView, quickScope, openQuickView, closeQuickView]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
