// Stocks.tsx - Gestion stock en centilitres
import { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, X, Settings,
  History, ClipboardCheck, TrendingUp, PackagePlus, PackageCheck, Edit3, Trash2, Check, FlaskConical
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { stockMovements } from '@/data';
import { useCategories, initCategories, loadCategoriesFromStorage } from '@/utils/productStore';
import { defaultCategories } from '@/data';
import type { Product, VolumeConfig, getClPourFormat as GetClFn } from '@/types';
import { getClPourFormat, formatStockDisplay, getStockBouteilles } from '@/types';
import { useLosses, type LossReason } from '@/utils/lossStore';
import { predictStockRupture } from '@/utils/stockPrediction';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';

// ── Valeurs par défaut contenance selon catégorie ─────────────
function contenanceDefaut(category: string): number {
  if (category === 'bières') return 65;        // 65cl bouteille standard SN
  if (category === 'vins') return 75;
  if (category === 'spiritueux') return 70;
  if (category === 'softs') return 33;
  if (category === 'cocktails') return 0;      // pas de bouteille
  return 75;
}

function clVerreDefaut(category: string): number {
  if (category === 'bières') return 33;        // demi bière
  if (category === 'vins') return 15;
  if (category === 'spiritueux') return 4;     // dose standard whisky/gin
  if (category === 'softs') return 33;
  if (category === 'cocktails') return 25;
  return 10;
}

// ── Affichage stock lisible ───────────────────────────────────
function StockBadge({ product }: { product: Product }) {
  if (product.volumeConfig && product.stockCl != null) {
    const contenanceCl = parseFloat(product.volumeConfig.contenanceCl);
    const stockCl = parseFloat(product.stockCl.toString());
    const bouteilles = Math.floor(stockCl / contenanceCl);
    const resteCl = Math.round((stockCl % contenanceCl) * 10) / 10;
    return (
      <span className="font-bold tabular-nums">
        {bouteilles} btl{resteCl > 0 ? ` + ${resteCl}cl` : ''}
        <span className="text-[10px] font-normal ml-1 opacity-70">({stockCl}cl)</span>
      </span>
    );
  }
  return <span className="font-bold">{product.stock} {product.stockUnit}</span>;
}

export function Stocks() {
  const products = useLiveQuery(() => universalSync.getProduits(), []);
  const { addLoss } = useLosses();
  const { categories: categoryList, addNewCategory, editCategory, removeCategory, refreshCategories } = useCategories();
  const categories = categoryList.map(c => c.name);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showReappro, setShowReappro] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reapproProductId, setReapproProductId] = useState('');
  const [reapproQty, setReapproQty] = useState('');
  const [reapproFormat, setReapproFormat] = useState<'unité' | 'carton12' | 'carton24' | 'carton'>('unité');
  const [reapproQtyParCarton, setReapproQtyParCarton] = useState(12);
  const [reapproSupplier, setReapproSupplier] = useState('');
  const [reapproPrice, setReapproPrice] = useState('');
  const [reapproSuccess, setReapproSuccess] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);
  const [inventoryQty, setInventoryQty] = useState('');
  const [lossReason, setLossReason] = useState<LossReason>('casse');
  const [lossNote, setLossNote] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const newlyAddedTimeoutRef = useRef<number | null>(null);

  // ── Formulaire nouveau produit ────────────────────────────
  const defaultNewProduct = {
    name: '', category: 'bières', stock: '', stockUnit: 'bouteilles',
    seuilAlerte: '10', seuilCritique: '5', image: '🍺',
    prices: { bouteille: '', demi: '', quart: '', verre: '', canette: '' },
    activePriceFormats: ['bouteille'] as ('bouteille' | 'demi' | 'quart' | 'verre' | 'canette')[],
    // Volume config
    useVolumeCl: false,
    contenanceCl: '75',
    clParBouteille: '',
    clParDemi: '',
    clParQuart: '',
    clParVerre: '',
    clParCanette: '',
  };
  const [newProduct, setNewProduct] = useState({ ...defaultNewProduct });

  // ── Formulaire édition produit ────────────────────────────
  const [editProductForm, setEditProductForm] = useState({
    name: '', category: 'bières', stock: '', stockUnit: 'bouteilles',
    seuilAlerte: '', seuilCritique: '', bottleSize: '', supplements: '', notes: '',
    prices: { bouteille: '', demi: '', quart: '', verre: '', canette: '' },
    activePriceFormats: [] as ('bouteille' | 'demi' | 'quart' | 'verre' | 'canette')[],
    useVolumeCl: false,
    contenanceCl: '75',
    clParBouteille: '',
    clParDemi: '',
    clParQuart: '',
    clParVerre: '',
    clParCanette: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('barflow_categories');
    if (!saved) initCategories(defaultCategories);
    else loadCategoriesFromStorage();
    refreshCategories();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (editingProduct) {
      const vc = editingProduct.volumeConfig;
      setEditProductForm({
        name: editingProduct.name || '',
        category: editingProduct.category || 'bières',
        stock: String(editingProduct.stock || ''),
        stockUnit: editingProduct.stockUnit || 'bouteilles',
        seuilAlerte: String(editingProduct.seuilAlerte || 10),
        seuilCritique: String(editingProduct.seuilCritique || 5),
        bottleSize: editingProduct.options?.bottleSize || '',
        supplements: editingProduct.options?.supplements?.join(', ') || '',
        notes: editingProduct.options?.notes || '',
        prices: {
          bouteille: editingProduct.prices?.bouteille ? String(editingProduct.prices.bouteille) : '',
          demi: editingProduct.prices?.demi ? String(editingProduct.prices.demi) : '',
          quart: editingProduct.prices?.quart ? String(editingProduct.prices.quart) : '',
          verre: editingProduct.prices?.verre ? String(editingProduct.prices.verre) : '',
          canette: editingProduct.prices?.canette ? String(editingProduct.prices.canette) : '',
        },
        activePriceFormats: editingProduct.activePriceFormats || ['bouteille'],
        useVolumeCl: !!vc,
        contenanceCl: vc ? String(vc.contenanceCl) : String(contenanceDefaut(editingProduct.category)),
        clParBouteille: vc?.clParBouteille ? String(vc.clParBouteille) : '',
        clParDemi: vc?.clParDemi ? String(vc.clParDemi) : '',
        clParQuart: vc?.clParQuart ? String(vc.clParQuart) : '',
        clParVerre: vc?.clParVerre ? String(vc.clParVerre) : '',
        clParCanette: vc?.clParCanette ? String(vc.clParCanette) : '',
      });
    }
  }, [editingProduct]);

  // Met à jour les valeurs par défaut quand on change la catégorie (nouveau produit)
  useEffect(() => {
    if (!newProduct.useVolumeCl) return;
    const contenance = contenanceDefaut(newProduct.category);
    const clVerre = clVerreDefaut(newProduct.category);
    setNewProduct(prev => ({
      ...prev,
      contenanceCl: String(contenance),
      clParVerre: String(clVerre),
      clParDemi: contenance > 0 ? String(Math.round(contenance / 2 * 10) / 10) : '',
      clParQuart: contenance > 0 ? String(Math.round(contenance / 4 * 10) / 10) : '',
    }));
  }, [newProduct.category, newProduct.useVolumeCl]);

  useEffect(() => {
    // Load persisted newly added product IDs from localStorage on mount
    const loadPersisted = () => {
      try {
        const stored = localStorage.getItem('barflow_newlyAddedProducts');
        if (stored) {
          const parsed = JSON.parse(stored);
          const { ids, timestamp } = parsed;
          const now = Date.now();
          const ttl = 3000; // 3 seconds
          if (now - timestamp < ttl) {
            setNewlyAddedIds(new Set(ids));
            // Set a timeout to clear after remaining time
            const remaining = ttl - (now - timestamp);
            newlyAddedTimeoutRef.current = window.setTimeout(() => {
              setNewlyAddedIds(new Set());
              newlyAddedTimeoutRef.current = null;
            }, remaining);
          } else {
            // Expired, clear storage
            localStorage.removeItem('barflow_newlyAddedProducts');
          }
        }
      } catch (e) {
        console.warn('Failed to load persisted newly added product IDs:', e);
      }
    };

    loadPersisted();

    const handleProductsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const addedIds = customEvent.detail?.addedProductIds as string[] || [];
      if (addedIds.length > 0) {
        // Clear any existing timeout
        if (newlyAddedTimeoutRef.current !== null) {
          clearTimeout(newlyAddedTimeoutRef.current);
          newlyAddedTimeoutRef.current = null;
        }
        setNewlyAddedIds(prev => {
          const newSet = new Set(prev);
          addedIds.forEach(id => newSet.add(id));
          return newSet;
        });
        // Set new timeout to clear after 3 seconds
        newlyAddedTimeoutRef.current = window.setTimeout(() => {
          setNewlyAddedIds(new Set());
          newlyAddedTimeoutRef.current = null;
          // Also clear storage
          try {
            localStorage.removeItem('barflow_newlyAddedProducts');
          } catch (e) {
            console.warn('Failed to clear persisted newly added product IDs:', e);
          }
        }, 3000);
        // Persist for late-mounted components
        try {
          const stored = {
            ids: addedIds,
            timestamp: Date.now()
          };
          localStorage.setItem('barflow_newlyAddedProducts', JSON.stringify(stored));
        } catch (e) {
          console.warn('Failed to persist newly added product IDs:', e);
        }
      }
      // Keep loading indicator
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 100);
    };

    window.addEventListener('productsUpdated', handleProductsUpdated);
    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated);
      if (newlyAddedTimeoutRef.current !== null) {
        clearTimeout(newlyAddedTimeoutRef.current);
        newlyAddedTimeoutRef.current = null;
      }
    };
  }, []); // empty deps: run once on mount

  const filteredProducts = (products || []).filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStockStatus = (product: Product) => {
    const stockBtl = getStockBouteilles(product);
    const seuil = product.seuilAlerte ?? 10;
    const ratio = stockBtl / seuil;
    if (ratio <= 0.5) return { color: 'text-red-600 bg-red-50 border-red-200', label: 'Critique', icon: '🔴' };
    if (ratio <= 1)   return { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Bas', icon: '🟡' };
    if (ratio <= 2)   return { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Moyen', icon: '🔵' };
    return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Bon', icon: '🟢' };
  };

  // ── Calculs réappro ───────────────────────────────────────
  const getReapproTotaux = () => {
    if (!reapproQty || !reapproProductId) return { totalUnites: 0, totalCl: 0 };
    const qty = parseInt(reapproQty) || 0;
    const prod = (products || []).find(p => p.id === reapproProductId);
    let totalUnites = qty;
    if (reapproFormat !== 'unité') totalUnites = qty * reapproQtyParCarton;
    const contenanceCl = prod?.volumeConfig?.contenanceCl ? parseFloat(prod.volumeConfig.contenanceCl) : 0;
    const totalCl = contenanceCl > 0 ? Math.round(totalUnites * contenanceCl * 10) / 10 : 0;
    return { totalUnites, totalCl };
  };

  // ── Helpers construction volumeConfig ─────────────────────
  const buildVolumeConfig = (form: typeof newProduct): VolumeConfig | undefined => {
    if (!form.useVolumeCl) return undefined;
    const contenance = parseFloat(form.contenanceCl) || 75;
    return {
      contenanceCl: contenance,
      clParBouteille: form.clParBouteille ? parseFloat(form.clParBouteille) : contenance,
      clParDemi:      form.clParDemi      ? parseFloat(form.clParDemi)      : Math.round(contenance / 2 * 10) / 10,
      clParQuart:     form.clParQuart     ? parseFloat(form.clParQuart)     : Math.round(contenance / 4 * 10) / 10,
      clParVerre:     form.clParVerre     ? parseFloat(form.clParVerre)     : clVerreDefaut(form.category),
      clParCanette:   form.clParCanette   ? parseFloat(form.clParCanette)   : contenance,
    };
  };

  // ── Handlers CRUD ─────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const ok = await addNewCategory(newCategoryName.trim(), '📦', '#8B5CF6');
    if (ok) { setNewCategoryName(''); refreshCategories(); window.dispatchEvent(new Event('categoriesUpdated')); }
  };

  const handleEditCategory = async (oldName: string) => {
    if (!editingCategoryName.trim()) return;
    const newName = editingCategoryName.trim().toLowerCase();
    if (newName !== oldName) await editCategory(oldName, newName);
    setEditingCategory(null); setEditingCategoryName('');
    refreshCategories();
    if (selectedCategory === oldName) setSelectedCategory(newName);
    window.dispatchEvent(new Event('categoriesUpdated'));
  };

  const handleDeleteCategory = async (catName: string) => {
    try {
      await removeCategory(catName);
      refreshCategories();
      if (selectedCategory === catName) setSelectedCategory('all');
      window.dispatchEvent(new Event('categoriesUpdated'));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible de supprimer');
    }
  };

  const handleNewProductSubmit = async () => {
    if (!newProduct.name || !newProduct.stock) return;
    const hasPrice = Object.values(newProduct.prices).some(p => p !== '');
    if (!hasPrice) { alert('Veuillez définir au moins un prix.'); return; }

    const vc = buildVolumeConfig(newProduct);
    const stockInit = parseInt(newProduct.stock) || 0;
    const stockCl = vc ? stockInit * vc.contenanceCl : undefined;

    const product = {
      name: newProduct.name,
      category: newProduct.category as Product['category'],
      prices: {
        bouteille: newProduct.prices.bouteille ? parseFloat(newProduct.prices.bouteille) : undefined,
        demi:      newProduct.prices.demi      ? parseFloat(newProduct.prices.demi)      : undefined,
        quart:     newProduct.prices.quart     ? parseFloat(newProduct.prices.quart)     : undefined,
        verre:     newProduct.prices.verre     ? parseFloat(newProduct.prices.verre)     : undefined,
        canette:   newProduct.prices.canette   ? parseFloat(newProduct.prices.canette)   : undefined,
      },
      activePriceFormats: newProduct.activePriceFormats,
      stock: stockInit,
      stockCl,
      volumeConfig: vc,
      stockUnit: newProduct.stockUnit,
      seuilAlerte: parseInt(newProduct.seuilAlerte) || 10,
      seuilCritique: parseInt(newProduct.seuilCritique) || 5,
      image: newProduct.image,
    };
    await universalSync.addProduit(product);
    setShowNewProduct(false);
    setNewProduct({ ...defaultNewProduct });
  };

  const handleEditProductSubmit = async () => {
    if (!editingProduct || !editProductForm.name) return;
    const hasPrice = Object.values(editProductForm.prices).some(p => p !== '');
    if (!hasPrice) { alert('Veuillez définir au moins un prix.'); return; }

    const vc = buildVolumeConfig(editProductForm);
    const stockVal = parseInt(editProductForm.stock) || 0;

    // Si on active le mode cl et qu'il n'y avait pas de stockCl avant : initialiser
    let stockCl: number | undefined = editingProduct.stockCl;
    if (vc && !editingProduct.volumeConfig) {
      stockCl = stockVal * vc.contenanceCl; // initialisation depuis stock actuel
    } else if (!vc) {
      stockCl = undefined;
    }

    const updatedProduct = {
      ...editingProduct,
      name: editProductForm.name,
      price: parseFloat(editProductForm.prices.bouteille) || 0,
      category: editProductForm.category,
      stock: stockVal,
      stockCl,
      volumeConfig: vc,
      stockUnit: editProductForm.stockUnit,
      seuilAlerte: parseInt(editProductForm.seuilAlerte) || 10,
      seuilCritique: parseInt(editProductForm.seuilCritique) || 5,
      activePriceFormats: editProductForm.activePriceFormats || ['bouteille'],
      prices: {
        bouteille: editProductForm.prices.bouteille ? parseFloat(editProductForm.prices.bouteille) : undefined,
        demi:      editProductForm.prices.demi      ? parseFloat(editProductForm.prices.demi)      : undefined,
        quart:     editProductForm.prices.quart     ? parseFloat(editProductForm.prices.quart)     : undefined,
        verre:     editProductForm.prices.verre     ? parseFloat(editProductForm.prices.verre)     : undefined,
        canette:   editProductForm.prices.canette   ? parseInt(editProductForm.prices.canette)   : undefined,
      },
      options: {
        bottleSize: editProductForm.bottleSize,
        supplements: editProductForm.supplements.split(',').map(s => s.trim()).filter(Boolean),
        notes: editProductForm.notes,
      },
    };
    await universalSync.updateProduit(editingProduct.id, updatedProduct);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = (products || []).find(p => p.id === productId);
    if (!product) return;
    if (!window.confirm(`Supprimer ${product.name} définitivement ?`)) return;
    await universalSync.deleteProduit(productId);
  };

  // ── Réappro avec gestion cl ───────────────────────────────
  const handleReapproSubmit = async () => {
    if (!reapproProductId || !reapproQty) return;
    const { totalUnites, totalCl } = getReapproTotaux();
    if (totalUnites <= 0) return;

    const prod = (products || []).find(p => p.id === reapproProductId);
    if (!prod) return;

    const updatedFields: Partial<Product> = { stock: prod.stock + totalUnites };
    if (prod.volumeConfig && totalCl > 0) {
      const stockCl = parseFloat(prod.stockCl.toString()) || prod.stock * parseFloat(prod.volumeConfig.contenanceCl);
      updatedFields.stockCl = stockCl + totalCl;
    }
    await universalSync.updateProduit(reapproProductId, { ...prod, ...updatedFields });

    setReapproSuccess(true);
    setTimeout(() => {
      setReapproSuccess(false); setShowReappro(false);
      setReapproProductId(''); setReapproQty('');
      setReapproFormat('unité'); setReapproQtyParCarton(12);
      setReapproSupplier(''); setReapproPrice('');
    }, 1800);
  };

  // ── Inventaire/pertes ─────────────────────────────────────
  const handleLossSubmit = async () => {
    if (!inventoryProduct || !lossReason || !inventoryQty) return;
    const qty = parseFloat(inventoryQty);
    if (isNaN(qty)) return;

    let quantitePerdue = qty;
    let nouveauStock = inventoryProduct.stock;
    let newStockCl = inventoryProduct.stockCl;

    if (lossReason === 'inventaire') {
      // qty = stock réel en bouteilles
      quantitePerdue = Math.max(0, inventoryProduct.stock - qty);
      nouveauStock = qty;
      if (inventoryProduct.volumeConfig && newStockCl != null) {
        newStockCl = qty * inventoryProduct.volumeConfig.contenanceCl;
      }
    } else {
      nouveauStock = Math.max(0, inventoryProduct.stock - qty);
      if (inventoryProduct.volumeConfig && newStockCl != null) {
        const clADeduire = qty * inventoryProduct.volumeConfig.contenanceCl;
        newStockCl = Math.max(0, newStockCl - clADeduire);
      }
    }

    addLoss({
      id: `loss-${Date.now()}`,
      productId: inventoryProduct.id,
      productName: inventoryProduct.name,
      productPrice: inventoryProduct.prices?.bouteille || 0,
      quantity: quantitePerdue,
      reason: lossReason,
      stockAvant: inventoryProduct.stock,
      stockReel: lossReason === 'inventaire' ? qty : undefined,
      valeurPerdue: quantitePerdue * (inventoryProduct.prices?.bouteille || 0),
      date: new Date().toISOString(),
      note: lossNote,
    });

    const updatePayload: any = { ...inventoryProduct, stock: nouveauStock };
    if (newStockCl !== undefined) updatePayload.stockCl = newStockCl;
    await universalSync.updateProduit(inventoryProduct.id, updatePayload);

    setShowInventory(false); setInventoryProduct(null);
    setInventoryQty(''); setLossReason('casse'); setLossNote('');
  };

  // ── Composant formulaire prix + volume ────────────────────
  const PrixVolumeForm = ({ form, setForm }: { form: any; setForm: (f: any) => void }) => {
    const contenance = parseFloat(form.contenanceCl) || 75;
    return (
      <div className="space-y-4">
        {/* Formats & Prix */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Formats & Prix (FCFA)</p>
          <div className="grid grid-cols-2 gap-3">
            {(['bouteille', 'demi', 'quart', 'verre', 'canette'] as const).map(format => {
              const isActive = form.activePriceFormats.includes(format);
              return (
                <div key={format} className={`p-3 rounded-xl border transition-colors ${isActive ? 'border-violet-300 bg-violet-50/50' : 'border-slate-200 bg-white'}`}>
                  <label className="text-xs font-semibold text-slate-700 capitalize flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => {
                        const updated = e.target.checked
                          ? [...form.activePriceFormats, format]
                          : form.activePriceFormats.filter((f: string) => f !== format);
                        setForm({ ...form, activePriceFormats: updated });
                      }}
                      className="rounded border-slate-300 text-violet-600"
                    />
                    {format}
                  </label>
                  <input
                    type="number"
                    placeholder="Prix FCFA"
                    disabled={!isActive}
                    value={form.prices[format] || ''}
                    onChange={e => setForm({ ...form, prices: { ...form.prices, [format]: e.target.value } })}
                    className="w-full p-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Section gestion en centilitres */}
        <div className="border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={form.useVolumeCl}
              onChange={e => setForm({ ...form, useVolumeCl: e.target.checked })}
              className="rounded border-slate-300 text-violet-600"
            />
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <FlaskConical size={13} className="text-violet-500" />
              Gestion en centilitres (vins, spiritueux, bières)
            </span>
          </label>

          {form.useVolumeCl && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Contenance de la bouteille (cl) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form.contenanceCl}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 75;
                    setForm({
                      ...form,
                      contenanceCl: e.target.value,
                      clParBouteille: String(val),
                      clParDemi: form.clParDemi || String(Math.round(val / 2 * 10) / 10),
                      clParQuart: form.clParQuart || String(Math.round(val / 4 * 10) / 10),
                    });
                  }}
                  className="w-full p-2 rounded-lg border border-violet-300 text-sm bg-white"
                  placeholder="75"
                />
                <p className="text-[10px] text-violet-600 mt-1">
                  Exemples : 75cl vin, 70cl whisky/gin, 65cl bière Flag/Gazelle, 33cl canette
                </p>
              </div>

              <p className="text-xs font-semibold text-slate-600">Volume servi par format (cl) :</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'clParBouteille', label: 'Bouteille', placeholder: String(contenance), hint: 'Bouteille entière' },
                  { key: 'clParDemi',      label: 'Demi',      placeholder: String(Math.round(contenance / 2 * 10) / 10), hint: 'Demi-bouteille' },
                  { key: 'clParQuart',     label: 'Quart',     placeholder: String(Math.round(contenance / 4 * 10) / 10), hint: 'Quart de bouteille' },
                  { key: 'clParVerre',     label: 'Verre',     placeholder: clVerreDefaut(form.category).toString(), hint: 'Service au verre' },
                  { key: 'clParCanette',   label: 'Canette',   placeholder: '33', hint: 'Canette entière' },
                ].map(({ key, label, placeholder, hint }) => (
                  <div key={key}>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">{label}</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder={placeholder}
                      value={form[key] || ''}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      className="w-full p-2 rounded-lg border border-violet-200 text-xs bg-white"
                    />
                    <p className="text-[9px] text-slate-400">{hint}</p>
                  </div>
                ))}
              </div>

              {/* Récapitulatif live */}
              {form.activePriceFormats.length > 0 && (
                <div className="bg-white rounded-lg border border-violet-200 p-2 text-[10px] space-y-1">
                  <p className="font-bold text-violet-700 mb-1">📊 Récapitulatif :</p>
                  {form.activePriceFormats.map((fmt: string) => {
                    const clKey = `clPar${fmt.charAt(0).toUpperCase() + fmt.slice(1)}`;
                    const cl = parseFloat(form[clKey]) || parseFloat((() => {
                      if (fmt === 'bouteille') return String(contenance);
                      if (fmt === 'demi') return String(Math.round(contenance / 2 * 10) / 10);
                      if (fmt === 'quart') return String(Math.round(contenance / 4 * 10) / 10);
                      if (fmt === 'verre') return String(clVerreDefaut(form.category));
                      return '33';
                    })());
                    const services = cl > 0 ? (contenance / cl).toFixed(1) : '—';
                    return (
                      <div key={fmt} className="flex justify-between text-slate-600">
                        <span className="capitalize">{fmt}</span>
                        <span>{cl}cl → <strong>{services} service(s)/btl</strong></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des Stocks</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi en temps réel — stock en centilitres pour vins & spiritueux</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowMovements(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md flex items-center gap-1.5 active:scale-95">
            <History size={14} /> Mouvements
          </button>
          <button onClick={() => setShowPredictions(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md flex items-center gap-1.5 active:scale-95">
            <TrendingUp size={16} /> Prévisions
          </button>
          <button onClick={() => setShowNewProduct(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md flex items-center gap-1.5 active:scale-95">
            <PackagePlus size={16} /> Nouveau produit
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 items-center">
          <button onClick={() => setSelectedCategory('all')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap', selectedCategory === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}>
            Tous
          </button>
          {categories.map(cat => {
            const catObj = categoryList.find(c => c.name === cat);
            return (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap', selectedCategory === cat ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}>
                {catObj?.emoji || '🏷️'} {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            );
          })}
          <button onClick={() => setShowManageCategories(true)} className="p-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Grille produits */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
          {(filteredProducts || []).map(product => {
            const status = getStockStatus(product);
            const stockClNum = product.stockCl != null ? parseFloat(product.stockCl.toString()) : 0;
            const contenanceClNum = product.volumeConfig?.contenanceCl ? parseFloat(product.volumeConfig.contenanceCl) : 1;
            const stockBtl = product.volumeConfig && product.stockCl != null ? stockClNum / contenanceClNum : product.stock;
            const prediction = predictStockRupture({ ...product, stock: Math.floor(stockBtl) } as any);
            const hasVolume = !!product.volumeConfig && product.stockCl != null;

            return (
              <div key={product.id} className={`bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex flex-col justify-between ${newlyAddedIds.has(product.id) ? 'border-2 border-emerald-400 animate-pulse' : ''}`}>
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${product.color}20` }}>
                        {product.image}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
                        <p className="text-[10px] text-slate-500 capitalize flex items-center gap-1">
                          {product.category}
                          {hasVolume && <span className="bg-violet-100 text-violet-700 px-1 rounded font-bold">cl</span>}
                        </p>
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', status.color)}>
                      {status.icon} {status.label}
                    </span>
                  </div>

                  {/* Barre de stock */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Stock</span>
                      <span className={cn('text-sm', stockBtl <= (product.seuilCritique ?? 5) ? 'text-red-600 font-bold' : stockBtl <= (product.seuilAlerte ?? 10) ? 'text-amber-600 font-bold' : 'text-slate-900 font-semibold')}>
                        <StockBadge product={product} />
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', stockBtl <= (product.seuilCritique ?? 5) ? 'bg-red-500' : stockBtl <= (product.seuilAlerte ?? 10) ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(100, (stockBtl / Math.max((product.seuilAlerte ?? 10) * 2, 1)) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Infos volumes si configuré */}
                  {hasVolume && product.volumeConfig && (
                    <div className="bg-violet-50 rounded-lg px-2 py-1.5 mb-2 text-[10px] text-violet-700">
                      <span className="font-semibold">Vol. btl : {parseFloat(product.volumeConfig.contenanceCl)}cl</span>
                      {product.volumeConfig.clParVerre && (
                        <span className="ml-2">· Verre : {parseFloat(product.volumeConfig.clParVerre)}cl ({(parseFloat(product.volumeConfig.contenanceCl) / parseFloat(product.volumeConfig.clParVerre)).toFixed(1)} services/btl)</span>
                      )}
                    </div>
                  )}

                  {prediction.status !== 'normal' && (
                    <div className={cn('mt-1 text-[10px] font-medium p-1.5 rounded-lg text-center',
                      prediction.status === 'critical' || prediction.status === 'rupture' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                      {prediction.message}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setReapproProductId(product.id); setReapproQty(''); setShowReappro(true); }}
                      className="py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center justify-center gap-1 active:scale-95">
                      <Plus size={13} /> + Stock
                    </button>
                    <button onClick={() => { setInventoryProduct(product); setInventoryQty(String(product.stock)); setShowInventory(true); }}
                      className="py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 flex items-center justify-center gap-1 active:scale-95">
                      <ClipboardCheck size={13} /> Inventaire
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setEditingProduct(product)}
                      className="py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold border border-violet-100 flex items-center justify-center gap-1 active:scale-95">
                      <Edit3 size={13} /> Modifier
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)}
                      className="py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-100 flex items-center justify-center gap-1 active:scale-95">
                      <Trash2 size={13} /> Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL PRÉVISIONS ─────────────────────────────────── */}
      {showPredictions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowPredictions(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><TrendingUp size={20} className="text-blue-600" /> Prévisions rupture</h3>
              <button onClick={() => setShowPredictions(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {(products || []).map(product => {
                const stockClNum = product.stockCl != null ? parseFloat(product.stockCl.toString()) : 0;
                const contenanceClNum = product.volumeConfig?.contenanceCl ? parseFloat(product.volumeConfig.contenanceCl) : 1;
                const stockBtl = product.volumeConfig && product.stockCl != null ? stockClNum / contenanceClNum : product.stock;
                const prediction = predictStockRupture({ ...product, stock: Math.floor(stockBtl) } as any);
                return (
                  <div key={product.id} className={cn('flex items-center justify-between p-3 rounded-xl border',
                    prediction.status === 'critical' || prediction.status === 'rupture' ? 'bg-red-50 border-red-200' :
                    prediction.status === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100')}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{product.image}</span>
                        <p className="font-semibold text-slate-800 text-sm">{product.name}</p>
                        {product.volumeConfig && <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">cl</span>}
                      </div>
                      <div className="text-xs mt-1 text-slate-600">
                        Stock : <strong><StockBadge product={product} /></strong>
                        {product.volumeConfig && <span className="ml-2 text-violet-600">({parseFloat(product.stockCl.toString())}cl)</span>}
                      </div>
                    </div>
                    <p className={cn('text-sm font-bold text-right',
                      prediction.status === 'critical' || prediction.status === 'rupture' ? 'text-red-600' :
                      prediction.status === 'warning' ? 'text-amber-600' : 'text-emerald-600')}>
                      {prediction.message}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL GESTION CATÉGORIES ─────────────────────────── */}
      {showManageCategories && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={() => setShowManageCategories(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Settings size={20} className="text-violet-600" /> Catégories</h3>
              <button onClick={() => setShowManageCategories(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-4 shrink-0">
              <input type="text" placeholder="Nouvelle catégorie..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                className="flex-1 p-2.5 border rounded-xl text-sm" />
              <button onClick={handleAddCategory} className="px-4 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl flex items-center gap-1">
                <Plus size={16} /> Ajouter
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {categoryList.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border text-sm">
                  {editingCategory === cat.name ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)}
                        className="flex-1 p-1.5 border rounded-lg text-xs bg-white" autoFocus />
                      <button onClick={() => handleEditCategory(cat.name)} className="p-1.5 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
                      <button onClick={() => setEditingCategory(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="capitalize font-medium text-slate-700">{cat.emoji} {cat.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingCategory(cat.name); setEditingCategoryName(cat.name); }} className="p-1.5 text-slate-500 hover:text-violet-600 rounded-lg"><Edit3 size={14} /></button>
                        <button onClick={() => handleDeleteCategory(cat.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL INVENTAIRE/PERTES ──────────────────────────── */}
      {showInventory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { setShowInventory(false); setInventoryProduct(null); setInventoryQty(''); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Pertes & Ajustements</h3>
              <button onClick={() => { setShowInventory(false); setInventoryProduct(null); setInventoryQty(''); }} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Produit concerné</label>
              <select value={inventoryProduct?.id || ''} onChange={e => { const p = (products || []).find(p => p.id === e.target.value) || null; setInventoryProduct(p); setInventoryQty(''); }}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm">
                <option value="">-- Sélectionner --</option>
                {(products || []).map(p => (<option key={p.id} value={p.id}>{p.image} {p.name} (stock: {p.stock})</option>))}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Motif</label>
              <div className="grid grid-cols-2 gap-2">
                {([{ id: 'casse', label: '💥 Casse' }, { id: 'offert', label: '🎁 Offert' }, { id: 'ecart', label: '⚖️ Écart' }, { id: 'peremption', label: '🗑️ Péremption' }, { id: 'inventaire', label: '📋 Inventaire' }, { id: 'autre', label: '📝 Autre' }] as { id: LossReason; label: string }[]).map(m => (
                  <button key={m.id} onClick={() => setLossReason(m.id)}
                    className={cn('p-3 rounded-xl border-2 text-left text-sm font-semibold', lossReason === m.id ? 'border-red-400 bg-red-50' : 'border-slate-200')}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {inventoryProduct && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  {lossReason === 'inventaire' ? `Stock réel (actuel : ${inventoryProduct.stock} btl)` : `Quantité perdue (bouteilles)`}
                </label>
                <input type="number" min="0" value={inventoryQty} onChange={e => setInventoryQty(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
                {inventoryProduct.volumeConfig && inventoryQty && (
                  <p className="text-xs text-violet-600 mt-1 font-medium">
                    ≈ {Math.round(parseFloat(inventoryQty) * inventoryProduct.volumeConfig.contenanceCl * 10) / 10} cl
                  </p>
                )}
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Note (optionnel)</label>
              <input type="text" value={lossNote} onChange={e => setLossNote(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
            </div>
            <button onClick={handleLossSubmit} disabled={!inventoryProduct || !inventoryQty}
              className={cn('w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2',
                inventoryProduct && inventoryQty ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
              <Check size={18} /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL RÉAPPRO ────────────────────────────────────── */}
      {showReappro && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!reapproSuccess) setShowReappro(false); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            {reapproSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><PackageCheck size={32} className="text-emerald-600" /></div>
                <h3 className="text-lg font-bold text-slate-900">Stock mis à jour !</h3>
                {(() => { const t = getReapproTotaux(); return t.totalCl > 0 ? <p className="text-sm text-violet-600 mt-1">+{t.totalUnites} bouteilles · +{t.totalCl}cl</p> : <p className="text-sm text-slate-500 mt-1">+{t.totalUnites} unités</p>; })()}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><PackagePlus size={20} className="text-emerald-600" /> Réapprovisionnement</h3>
                  <button onClick={() => setShowReappro(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <div className="space-y-3">
                  {/* Produit */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Produit *</label>
                    <select value={reapproProductId} onChange={e => setReapproProductId(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white">
                      <option value="">— Sélectionner —</option>
                      {(products || []).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.image} {p.name} — {p.volumeConfig ? `${p.stockCl ?? 0}cl` : `${p.stock} ${p.stockUnit}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Format livraison */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Format de livraison</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { id: 'unité',    label: '📦 Unité',       desc: '1 bouteille à la fois' },
                        { id: 'carton12', label: '📦 Carton ×12',  desc: '12 bouteilles/carton' },
                        { id: 'carton24', label: '📦 Carton ×24',  desc: '24 bouteilles/carton' },
                        { id: 'carton',   label: '📦 Carton autre', desc: 'Quantité custom' },
                      ] as const).map(f => (
                        <button key={f.id} onClick={() => {
                          setReapproFormat(f.id);
                          if (f.id === 'carton12') setReapproQtyParCarton(12);
                          else if (f.id === 'carton24') setReapproQtyParCarton(24);
                        }}
                          className={cn('p-2.5 rounded-xl border-2 text-left text-xs transition-all',
                            reapproFormat === f.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300')}>
                          <p className="font-bold text-slate-800">{f.label}</p>
                          <p className="text-slate-500 mt-0.5">{f.desc}</p>
                        </button>
                      ))}
                    </div>
                    {reapproFormat === 'carton' && (
                      <div className="mt-2">
                        <label className="text-xs text-slate-600">Bouteilles par carton</label>
                        <input type="number" min="1" value={reapproQtyParCarton} onChange={e => setReapproQtyParCarton(parseInt(e.target.value) || 12)}
                          className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 text-sm" />
                      </div>
                    )}
                  </div>

                  {/* Quantité */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                      Quantité reçue ({reapproFormat === 'unité' ? 'bouteilles' : 'cartons'}) *
                    </label>
                    <input type="number" min={1} value={reapproQty} onChange={e => setReapproQty(e.target.value)}
                      placeholder="Ex: 2" className="w-full p-3 rounded-xl border border-slate-200 text-sm" autoFocus />
                  </div>

                  {/* Fournisseur & Prix */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Fournisseur</label>
                      <input type="text" value={reapproSupplier} onChange={e => setReapproSupplier(e.target.value)}
                        placeholder="Ex: Castel" className="w-full p-2.5 rounded-xl border border-slate-200 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Prix achat/unité</label>
                      <input type="number" value={reapproPrice} onChange={e => setReapproPrice(e.target.value)}
                        placeholder="FCFA" className="w-full p-2.5 rounded-xl border border-slate-200 text-sm" />
                    </div>
                  </div>

                  {/* Récapitulatif */}
                  {reapproProductId && reapproQty && (() => {
                    const { totalUnites, totalCl } = getReapproTotaux();
                    const prod = (products || []).find(p => p.id === reapproProductId);
                    return totalUnites > 0 ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
                        <p className="font-semibold">Récapitulatif réception :</p>
                        <p>+ <strong>{totalUnites} bouteilles</strong> de {prod?.name}</p>
                        {totalCl > 0 && <p>= <strong>{totalCl}cl</strong> ajoutés au stock</p>}
                        {reapproFormat !== 'unité' && <p>({reapproQty} carton{parseInt(reapproQty) > 1 ? 's' : ''} × {reapproQtyParCarton} btl)</p>}
                        {reapproPrice && <p>Coût total : <strong>{(totalUnites * parseInt(reapproPrice)).toLocaleString()} FCFA</strong></p>}
                      </div>
                    ) : null;
                  })()}

                  <button onClick={handleReapproSubmit} disabled={!reapproProductId || !reapproQty}
                    className={cn('w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-2',
                      reapproProductId && reapproQty ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    <PackageCheck size={18} /> Confirmer réception
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL CRÉER PRODUIT ──────────────────────────────── */}
      {showNewProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowNewProduct(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Créer un produit</h3>
              <button onClick={() => setShowNewProduct(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nom *</label>
                <input type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm" placeholder="Ex: Bordeaux Rouge" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Catégorie *</label>
                <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm bg-white capitalize">
                  {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Stock initial *</label>
                  <input type="number" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" placeholder="Ex: 12" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Unité</label>
                  <input type="text" value={newProduct.stockUnit} onChange={e => setNewProduct({ ...newProduct, stockUnit: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Seuil alerte</label>
                  <input type="number" value={newProduct.seuilAlerte} onChange={e => setNewProduct({ ...newProduct, seuilAlerte: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Seuil critique</label>
                  <input type="number" value={newProduct.seuilCritique} onChange={e => setNewProduct({ ...newProduct, seuilCritique: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" />
                </div>
              </div>
              <PrixVolumeForm form={newProduct} setForm={setNewProduct} />
              <button onClick={handleNewProductSubmit}
                className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm mt-2">
                Créer le produit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MODIFIER PRODUIT ───────────────────────────── */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-[55] flex items-end sm:items-center justify-center" onClick={() => setEditingProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Modifier le produit</h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Nom *</label>
                <input type="text" value={editProductForm.name} onChange={e => setEditProductForm({ ...editProductForm, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Catégorie</label>
                <select value={editProductForm.category} onChange={e => setEditProductForm({ ...editProductForm, category: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-sm bg-white capitalize">
                  {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Seuil alerte</label>
                  <input type="number" value={editProductForm.seuilAlerte} onChange={e => setEditProductForm({ ...editProductForm, seuilAlerte: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Seuil critique</label>
                  <input type="number" value={editProductForm.seuilCritique} onChange={e => setEditProductForm({ ...editProductForm, seuilCritique: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" />
                </div>
              </div>
              <PrixVolumeForm form={editProductForm} setForm={setEditProductForm} />
              <div className="space-y-2 pt-2 border-t">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Suppléments</label>
                  <input type="text" value={editProductForm.supplements} onChange={e => setEditProductForm({ ...editProductForm, supplements: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm" placeholder="Citron, Glaçons" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Notes internes</label>
                  <textarea value={editProductForm.notes} onChange={e => setEditProductForm({ ...editProductForm, notes: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-sm h-16 resize-none" />
                </div>
              </div>
              <button onClick={handleEditProductSubmit}
                className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm mt-2">
                Enregistrer les modifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MOUVEMENTS ─────────────────────────────────── */}
      {showMovements && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowMovements(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><History size={20} /> Flux Récents</h3>
              <button onClick={() => setShowMovements(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-2">
              {stockMovements.map(m => (
                <div key={m.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 border rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-800">{m.productId}</p>
                    <p className="text-[10px] text-slate-400">{m.date instanceof Date ? m.date.toLocaleDateString() : m.date} — {m.type}</p>
                  </div>
                  <span className={cn('font-bold', m.type === 'entrée' ? 'text-emerald-600' : 'text-red-500')}>
                    {m.type === 'entrée' ? '+' : '-'}{m.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
