import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'anavrin.cart';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((l) => l && l.productId && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage unavailable */ }
  }, [lines]);

  const add = useCallback((product, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const max = Math.max(product.stock, 0);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: Math.min(l.quantity + quantity, max) } : l));
      }
      return [...prev, {
        productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl,
        stock: product.stock, quantity: Math.min(quantity, max),
      }];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setLines((prev) => prev
      .map((l) => (l.productId === productId ? { ...l, quantity: Math.max(0, Math.min(quantity, l.stock)) } : l))
      .filter((l) => l.quantity > 0));
  }, []);

  const remove = useCallback((productId) => setLines((prev) => prev.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => setLines([]), []);

  /** Keep cart lines in sync with live product updates (price, stock, image). */
  const syncProduct = useCallback((p) => {
    setLines((prev) => prev.map((l) => (l.productId === p.id
      ? { ...l, name: p.name, price: p.price, imageUrl: p.imageUrl, stock: p.active ? p.stock : 0, quantity: Math.min(l.quantity, p.active ? p.stock : 0) || l.quantity }
      : l)));
  }, []);

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  const value = useMemo(() => ({ lines, add, setQuantity, remove, clear, syncProduct, count, subtotal, open, setOpen }),
    [lines, add, setQuantity, remove, clear, syncProduct, count, subtotal, open]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
export const DELIVERY_FEE = 200;
export const FREE_DELIVERY_OVER = 5000;
export const deliveryFee = (subtotal) => (subtotal >= FREE_DELIVERY_OVER || subtotal === 0 ? 0 : DELIVERY_FEE);
