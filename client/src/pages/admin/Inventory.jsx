import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, ArchiveRestore, Boxes, ImagePlus, Link2, PackagePlus, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { money } from '../../lib/format';
import { LiquidSegmented } from '../../components/LiquidGlass';
import { EmptyState, Field, Modal, Spinner } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

const EMPTY = { name: '', category: '', price: '', compareAtPrice: '', stock: '0', lowStockThreshold: '5', imageUrl: '', description: '' };

/** Inventory: add and edit items, change images, restock, and archive products. All changes go live instantly. */
export default function Inventory() {
  const { toast } = useToast();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('all');
  const [editing, setEditing] = useState(null); // product or {} for new
  const [restocking, setRestocking] = useState(null);
  const [imaging, setImaging] = useState(null);

  const load = useCallback(async () => {
    try { setError(''); setProducts((await api('/admin/products')).products); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upsert = useCallback((p) => setProducts((prev) => prev && (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev])), []);
  useSocketEvent('product:updated', upsert);
  useSocketEvent('product:removed', ({ id }) => setProducts((prev) => prev && prev.map((x) => (x.id === id ? { ...x, active: false } : x))));

  const categories = useMemo(() => [...new Set((products || []).map((p) => p.category))].sort(), [products]);
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products || []).filter((p) => {
      if (view === 'low' && !(p.active && p.stock <= p.lowStockThreshold)) return false;
      if (view === 'archived' && p.active) return false;
      if (view === 'all' && !p.active) return false;
      return !term || p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term);
    });
  }, [products, q, view]);
  const lowCount = (products || []).filter((p) => p.active && p.stock <= p.lowStockThreshold).length;

  const toggleActive = async (p) => {
    try {
      upsert((await api(`/admin/products/${p.id}`, { method: 'PATCH', body: { active: !p.active } })).product);
      toast(p.active ? `${p.name} hidden from the store.` : `${p.name} is back in the store.`);
    } catch (err) { toast(err.message, { type: 'error' }); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}? Products with past orders are archived instead.`)) return;
    try {
      const r = await api(`/admin/products/${p.id}`, { method: 'DELETE' });
      if (r.archived) { upsert({ ...p, active: false }); toast(`${p.name} has order history, so it was archived.`, { type: 'info' }); }
      else { setProducts((prev) => prev.filter((x) => x.id !== p.id)); toast(`${p.name} deleted.`); }
    } catch (err) { toast(err.message, { type: 'error' }); }
  };

  return (
    <>
      <AdminHeader title="Inventory" subtitle="Update items, prices, images and stock. Changes show in the store instantly."
        actions={<button className="btn btn-primary" onClick={() => setEditing({})}><Plus className="size-4" aria-hidden /> Add product</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <LiquidSegmented size="sm" value={view} onChange={setView} options={[
          { value: 'all', label: 'In store', count: (products || []).filter((p) => p.active).length },
          { value: 'low', label: 'Low stock', count: lowCount },
          { value: 'archived', label: 'Archived', count: (products || []).filter((p) => !p.active).length },
        ]} />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="field rounded-full pl-10" />
        </div>
      </div>

      {error ? <div className="card"><EmptyState title="Couldn’t load inventory" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState></div>
        : !products ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>
        : visible.length === 0 ? <div className="card"><EmptyState icon={Boxes} title="No products here" /></div>
        : (
          <motion.ul layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {visible.map((p, i) => {
                const low = p.stock <= p.lowStockThreshold;
                const pct = Math.min(100, (p.stock / Math.max(p.lowStockThreshold * 4, 1)) * 100);
                return (
                  <motion.li key={p.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i, 9) * 0.03 }} className={`card flex flex-col overflow-hidden ${p.active ? '' : 'opacity-70'}`}>
                    <div className="flex gap-4 p-4">
                      <button onClick={() => setImaging(p)} className="group relative size-24 shrink-0 overflow-hidden rounded-xl bg-silver-100" aria-label={`Change image for ${p.name}`}>
                        <img src={p.imageUrl} alt="" className="size-full object-cover transition group-hover:scale-105" />
                        <span className="absolute inset-0 grid place-items-center bg-brand-950/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          <ImagePlus className="size-5" aria-hidden />
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{p.category}</p>
                        <p className="line-clamp-2 font-medium">{p.name}</p>
                        <p className="mt-1 text-sm font-semibold tabular">{money(p.price)}{p.compareAtPrice > p.price && <span className="ml-2 font-normal text-muted line-through">{money(p.compareAtPrice)}</span>}</p>
                      </div>
                    </div>
                    <div className="px-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${p.stock === 0 ? 'text-danger-700' : low ? 'text-warn-700' : 'text-ok-700'}`}>
                          <motion.span key={p.stock} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="inline-block tabular">{p.stock}</motion.span> in stock
                        </span>
                        <span className="text-muted">Alert at {p.lowStockThreshold}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-silver-200">
                        <motion.div className={`h-full rounded-full ${p.stock === 0 ? 'bg-danger-700' : low ? 'bg-warn-700' : 'bg-brand-600'}`}
                          initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1 border-t border-silver-200 bg-silver-50 px-2 py-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => setRestocking(p)}><PackagePlus className="size-4" aria-hidden /> Restock</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}><Pencil className="size-4" aria-hidden /> Edit</button>
                      <span className="ml-auto flex">
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(p)} aria-label={p.active ? `Archive ${p.name}` : `Restore ${p.name}`} title={p.active ? 'Hide from store' : 'Show in store'}>
                          {p.active ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
                        </button>
                        <button className="btn btn-ghost btn-sm hover:!text-danger-700" onClick={() => remove(p)} aria-label={`Delete ${p.name}`} title="Delete"><Trash2 className="size-4" /></button>
                      </span>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}

      <ProductForm product={editing} categories={categories} onClose={() => setEditing(null)} onSaved={(p, isNew) => { upsert(p); toast(isNew ? `${p.name} added to the store.` : `${p.name} updated.`); }} />
      <RestockModal product={restocking} onClose={() => setRestocking(null)} onSaved={(p) => { upsert(p); toast(`${p.name} now has ${p.stock} in stock.`); }} />
      <ImageModal product={imaging} onClose={() => setImaging(null)} onSaved={(p) => { upsert(p); toast(`Image updated for ${p.name}.`); }} />
    </>
  );
}

async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  return (await api('/admin/uploads', { method: 'POST', form })).url;
}

/** Upload a file or paste a link, with a live preview. */
function ImagePicker({ value, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Images must be 5 MB or smaller.'); return; }
    setError(''); setBusy(true);
    try { onChange(await uploadImage(file)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${drag ? 'border-brand-500 bg-brand-50' : 'border-silver-300 bg-silver-50'}`}
      >
        <AnimatePresence mode="wait">
          {value ? (
            <motion.img key={value} src={value} alt="Product preview" className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} />
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-muted">
              <ImagePlus className="mx-auto mb-2 size-7" aria-hidden /> Drop an image here
            </motion.div>
          )}
        </AnimatePresence>
        {busy && <div className="absolute inset-0 grid place-items-center bg-white/70"><Spinner className="size-6 text-brand-700" /></div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}><Upload className="size-4" aria-hidden /> Upload from device</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <div className="relative mt-3">
        <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="field pl-10 text-sm" placeholder="…or paste an image link (https://)" aria-label="Image link" />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const isNew = product && !product.id;
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    setError(''); setBusy(false);
    setForm(product.id ? {
      name: product.name, category: product.category, price: String(product.price), compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
      stock: String(product.stock), lowStockThreshold: String(product.lowStockThreshold), imageUrl: product.imageUrl, description: product.description,
    } : EMPTY);
  }, [product]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.imageUrl) { setError('Add a product image.'); return; }
    setBusy(true);
    const body = {
      name: form.name, category: form.category, description: form.description, imageUrl: form.imageUrl,
      price: Number(form.price), compareAtPrice: form.compareAtPrice === '' ? null : Number(form.compareAtPrice),
      lowStockThreshold: Number(form.lowStockThreshold),
    };
    try {
      const { product: saved } = isNew
        ? await api('/admin/products', { method: 'POST', body: { ...body, stock: Number(form.stock) } })
        : await api(`/admin/products/${product.id}`, { method: 'PATCH', body });
      onSaved(saved, isNew);
      onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal open={!!product} onClose={onClose} title={isNew ? 'Add a product' : 'Edit product'} wide>
      <form onSubmit={submit} className="grid gap-6 p-5 md:grid-cols-[1fr_1.3fr]">
        <ImagePicker value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
        <div className="space-y-4">
          <Field label="Product name" htmlFor="pname"><input id="pname" required value={form.name} onChange={set('name')} className="field" /></Field>
          <Field label="Category" htmlFor="pcat" hint="Pick an existing category or type a new one.">
            <input id="pcat" required list="cats" value={form.category} onChange={set('category')} className="field" />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (KSh)" htmlFor="pprice"><input id="pprice" required type="number" min="1" step="1" inputMode="numeric" value={form.price} onChange={set('price')} className="field" /></Field>
            <Field label="Was price (optional)" htmlFor="pcmp" hint="Shows a discount badge."><input id="pcmp" type="number" min="1" step="1" inputMode="numeric" value={form.compareAtPrice} onChange={set('compareAtPrice')} className="field" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {isNew
              ? <Field label="Opening stock" htmlFor="pstock"><input id="pstock" type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={set('stock')} className="field" /></Field>
              : <Field label="Stock" hint="Use Restock to change stock."><p className="field bg-silver-50 tabular">{product?.stock}</p></Field>}
            <Field label="Low-stock alert at" htmlFor="plow"><input id="plow" type="number" min="0" step="1" inputMode="numeric" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} className="field" /></Field>
          </div>
          <Field label="Description" htmlFor="pdesc"><textarea id="pdesc" rows={4} value={form.description} onChange={set('description')} className="field resize-none" /></Field>
          {error && <p className="rounded-xl bg-danger-100 px-3.5 py-2.5 text-sm font-medium text-danger-700" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <><Spinner /> Saving…</> : isNew ? 'Add to store' : 'Save changes'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function RestockModal({ product, onClose, onSaved }) {
  const [mode, setMode] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (product) { setMode('add'); setQuantity(''); setNote(''); setError(''); setBusy(false); } }, [product]);

  const n = Number(quantity);
  const after = mode === 'add' ? (product?.stock || 0) + (n || 0) : n || 0;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { product: saved } = await api(`/admin/products/${product.id}/stock`, { method: 'POST', body: { mode, quantity: n, note } });
      onSaved(saved); onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal open={!!product} onClose={onClose} title={product ? `Restock · ${product.name}` : ''}>
      {product && (
        <form onSubmit={submit} className="space-y-4 p-5">
          <LiquidSegmented value={mode} onChange={setMode} size="sm" options={[{ value: 'add', label: 'Add delivery' }, { value: 'set', label: 'Correct count' }]} />
          <Field label={mode === 'add' ? 'Units received' : 'Actual units on the shelf'} htmlFor="qty">
            <input id="qty" autoFocus required type="number" min={mode === 'add' ? 1 : 0} step="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="field text-lg" />
          </Field>
          <Field label="Note (optional)" htmlFor="rnote"><input id="rnote" value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="Supplier, invoice number, reason…" /></Field>
          <div className="flex items-center justify-between rounded-2xl bg-silver-100 px-4 py-3 text-sm">
            <span className="text-ink-soft">Stock now <b className="tabular">{product.stock}</b></span>
            <span className="text-ink-soft">After <motion.b key={after} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="inline-block text-brand-800 tabular">{after}</motion.b></span>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || quantity === ''}>{busy ? <Spinner /> : 'Update stock'}</button>
        </form>
      )}
    </Modal>
  );
}

function ImageModal({ product, onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (product) { setUrl(product.imageUrl); setBusy(false); setError(''); } }, [product]);
  const save = async () => {
    setBusy(true);
    try {
      const { product: saved } = await api(`/admin/products/${product.id}`, { method: 'PATCH', body: { imageUrl: url } });
      onSaved(saved); onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Modal open={!!product} onClose={onClose} title={product ? `Change image · ${product.name}` : ''}>
      {product && (
        <div className="space-y-4 p-5">
          <ImagePicker value={url} onChange={setUrl} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy || !url || url === product.imageUrl} onClick={save}>{busy ? <Spinner /> : 'Save image'}</button>
        </div>
      )}
    </Modal>
  );
}
