// Stocks.tsx - Version avec universalSync
import { useState, useEffect } from 'react';
import {
  Search, Plus, X, Settings,
  History, ClipboardCheck, TrendingUp, PackagePlus, PackageCheck, Edit3, Trash2, Check
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { stockMovements } from '@/data';
import { useCategories, initCategories, loadCategoriesFromStorage } from '@/utils/productStore';
import { defaultCategories } from '@/data';
import type { Product } from '@/types';
import { useLosses, type LossReason } from '@/utils/lossStore';
import { predictStockRupture } from '@/utils/stockPrediction';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';

export function Stocks() {
  // Données en temps réel depuis IndexedDB + Sync
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reapproProductId, setReapproProductId] = useState('');
  const [reapproQty, setReapproQty] = useState('');
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

  const [newProduct, setNewProduct] = useState({
    name: '', category: 'bières', stock: '', stockUnit: 'bouteilles',
    seuilAlerte: '10', seuilCritique: '5', image: '🍺',
    prices: { bouteille: '', demi: '', quart: '', verre: '', canette: '' },
    activePriceFormats: ['bouteille'] as ('bouteille' | 'demi' | 'quart' | 'verre' | 'canette')[],
  });

  const [editProductForm, setEditProductForm] = useState({
    name: '', category: 'bières', stock: '', stockUnit: 'bouteilles',
    seuilAlerte: '', seuilCritique: '', bottleSize: '', supplements: '', notes: '',
    prices: { bouteille: '', demi: '', quart: '', verre: '', canette: '' },
    activePriceFormats: [] as ('bouteille' | 'demi' | 'quart' | 'verre' | 'canette')[],
  });

  useEffect(() => {
    const saved = localStorage.getItem('barflow_categories');
    if (!saved) {
      initCategories(defaultCategories);
    } else {
      loadCategoriesFromStorage();
    }
    refreshCategories();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (editingProduct) {
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
      });
    }
  }, [editingProduct]);

  const filteredProducts = (products || []).filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStockStatus = (product: Product) => {
    const ratio = product.stock / product.seuilAlerte;
    if (ratio <= 0.5) return { color: 'text-red-600 bg-red-50 border-red-200', label: 'Critique', icon: '🔴' };
    if (ratio <= 1) return { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Bas', icon: '🟡' };
    if (ratio <= 2) return { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Moyen', icon: '🔵' };
    return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: 'Bon', icon: '🟢' };
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const success = await addNewCategory(newCategoryName.trim(), '📦', '#8B5CF6');
    if (success) {
      setNewCategoryName('');
      refreshCategories();
      window.dispatchEvent(new Event('categoriesUpdated'));
    }
  };

  const handleEditCategory = async (oldName: string) => {
    if (!editingCategoryName.trim()) return;
    const newName = editingCategoryName.trim().toLowerCase();
    if (newName === oldName) {
      setEditingCategory(null);
      return;
    }
    await editCategory(oldName, newName);
    setEditingCategory(null);
    setEditingCategoryName('');
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
      alert(error instanceof Error ? error.message : "Impossible de supprimer cette catégorie");
    }
  };

  const handleNewProductSubmit = async () => {
    if (!newProduct.name || !newProduct.stock) return;
    const hasPrice = Object.values(newProduct.prices).some(p => p !== '');
    if (!hasPrice) { alert("Veuillez définir au moins un prix."); return; }

    const product = {
      name: newProduct.name,
      category: newProduct.category as Product['category'],
      prices: {
        bouteille: newProduct.prices.bouteille ? parseInt(newProduct.prices.bouteille) : undefined,
        demi: newProduct.prices.demi ? parseInt(newProduct.prices.demi) : undefined,
        quart: newProduct.prices.quart ? parseInt(newProduct.prices.quart) : undefined,
        verre: newProduct.prices.verre ? parseInt(newProduct.prices.verre) : undefined,
        canette: newProduct.prices.canette ? parseInt(newProduct.prices.canette) : undefined,
      },
      activePriceFormats: newProduct.activePriceFormats,
      stock: parseInt(newProduct.stock) || 0,
      stockUnit: newProduct.stockUnit,
      seuilAlerte: parseInt(newProduct.seuilAlerte) || 10,
      seuilCritique: parseInt(newProduct.seuilCritique) || 5,
      image: newProduct.image,
    };

    await universalSync.addProduit(product);
    setShowNewProduct(false);
    setNewProduct({
      name: '', category: 'bières', stock: '', stockUnit: 'bouteilles',
      seuilAlerte: '10', seuilCritique: '5', image: '🍺',
      prices: { bouteille: '', demi: '', quart: '', verre: '', canette: '' },
      activePriceFormats: ['bouteille'],
    });
  };

  const handleEditProductSubmit = async () => {
    if (!editingProduct || !editProductForm.name) return;
    const hasPrice = Object.values(editProductForm.prices).some(p => p !== '');
    if (!hasPrice) { alert("Veuillez définir au moins un prix."); return; }

    const updatedProduct = {
      ...editingProduct,
      name: editProductForm.name,
      category: editProductForm.category as Product['category'],
      prices: {
        bouteille: editProductForm.prices.bouteille ? parseInt(editProductForm.prices.bouteille) : undefined,
        demi: editProductForm.prices.demi ? parseInt(editProductForm.prices.demi) : undefined,
        quart: editProductForm.prices.quart ? parseInt(editProductForm.prices.quart) : undefined,
        verre: editProductForm.prices.verre ? parseInt(editProductForm.prices.verre) : undefined,
        canette: editProductForm.prices.canette ? parseInt(editProductForm.prices.canette) : undefined,
      },
      activePriceFormats: editProductForm.activePriceFormats,
      stock: parseInt(editProductForm.stock) || 0,
      stockUnit: editProductForm.stockUnit,
      seuilAlerte: parseInt(editProductForm.seuilAlerte) || 10,
      seuilCritique: parseInt(editProductForm.seuilCritique) || 5,
      options: {
        bottleSize: editProductForm.bottleSize,
        supplements: editProductForm.supplements.split(',').map(item => item.trim()).filter(Boolean),
        notes: editProductForm.notes,
      },
    };

    await universalSync.updateProduit(editingProduct.id, updatedProduct);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = (products || []).find(item => item.id === productId);
    if (!product) return;
    if (!window.confirm(`Supprimer ${product.name} définitivement ?`)) return;
    await universalSync.deleteProduit(productId);
    if (selectedProduct?.id === productId) setSelectedProduct(null);
  };

  const handleReapproSubmit = async () => {
    if (!reapproProductId || !reapproQty) return;
    const qty = parseInt(reapproQty);
    if (isNaN(qty) || qty <= 0) return;
    const prod = (products || []).find(p => p.id === reapproProductId);
    if (prod) await universalSync.updateProduit(reapproProductId, { ...prod, stock: prod.stock + qty });

    setReapproSuccess(true);
    setTimeout(() => {
      setReapproSuccess(false);
      setShowReappro(false);
      setReapproProductId('');
      setReapproQty('');
      setReapproSupplier('');
      setReapproPrice('');
    }, 1500);
  };

  const handleLossSubmit = async () => {
    if (!inventoryProduct || !lossReason || !inventoryQty) return;
    const qty = parseInt(inventoryQty);
    if (isNaN(qty)) return;

    let quantitePerdue = qty;
    let nouveauStock = inventoryProduct.stock;

    if (lossReason === 'inventaire') {
      quantitePerdue = Math.max(0, inventoryProduct.stock - qty);
      nouveauStock = qty;
    } else {
      nouveauStock = Math.max(0, inventoryProduct.stock - qty);
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

    await universalSync.updateProduit(inventoryProduct.id, { ...inventoryProduct, stock: nouveauStock });

    setShowInventory(false);
    setInventoryProduct(null);
    setInventoryQty('');
    setLossReason('casse');
    setLossNote('');
  };

  const RenderPriceFormats = ({ form, setForm }: { form: typeof editProductForm, setForm: typeof setEditProductForm }) => (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
        Formats & Prix (FCFA)
        <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Cochez pour activer</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(['bouteille', 'demi', 'quart', 'verre', 'canette'] as const).map((format) => {
          const isActive = form.activePriceFormats.includes(format);
          return (
            <div key={format} className={`p-3 rounded-xl border transition-colors ${isActive ? 'border-violet-300 bg-violet-50/50' : 'border-slate-200 bg-white'}`}>
              <label className="text-xs font-semibold text-slate-700 capitalize flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...form.activePriceFormats, format]
                      : form.activePriceFormats.filter(f => f !== format);
                    setForm({ ...form, activePriceFormats: updated });
                  }}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                {format}
              </label>
              <input
                type="number"
                placeholder="Prix"
                disabled={!isActive}
                defaultValue={form.prices[format] === 0 ? '' : form.prices[format]}
                onBlur={(e) => {
                  const newValue = e.target.value === '' ? 0 : Number(e.target.value);
                  setForm({
                    ...form,
                    prices: { ...form.prices, [format]: newValue }
                  });
                }}
                className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des Stocks</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi en temps réel et inventaires</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowMovements(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md shadow-slate-200 hover:shadow-xl transition-all flex items-center gap-1.5 active:scale-95">
            <History size={14} /> Mouvements
          </button>
          <button onClick={() => setShowPredictions(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200 hover:shadow-xl transition-all flex items-center gap-1.5 active:scale-95">
            <TrendingUp size={16} /> Prévisions
          </button>
          <button onClick={() => setShowNewProduct(true)} className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200 hover:shadow-xl transition-all flex items-center gap-1.5 active:scale-95">
            <PackagePlus size={16} /> Nouveau produit
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Rechercher un produit..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 items-center">
          <button onClick={() => setSelectedCategory('all')} className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all', selectedCategory === 'all' ? 'bg-violet-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}>Tous</button>
          {categories.map(cat => {
            const catObj = categoryList.find(c => c.name === cat);
            return (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn('px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all', selectedCategory === cat ? 'bg-violet-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}>
                {catObj?.emoji || '🏷️'} {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            );
          })}
          <button onClick={() => setShowManageCategories(true)} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center shrink-0 border border-slate-200" title="Gérer les catégories">
            <Settings size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-20">
          {(filteredProducts || []).map(product => {
            const status = getStockStatus(product);
            const prediction = predictStockRupture(product);
            return (
              <div key={product.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:border-violet-200 transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${product.color}20` }}>{product.image}</div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
                        <p className="text-[10px] text-slate-500 capitalize">{product.category}</p>
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', status.color)}>{status.icon} {status.label}</span>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Stock actuel</span>
                      <span className={cn('text-sm font-bold', product.stock <= product.seuilCritique ? 'text-red-600' : product.stock <= product.seuilAlerte ? 'text-amber-600' : 'text-slate-900')}>{product.stock} {product.stockUnit}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', product.stock <= product.seuilCritique ? 'bg-red-500' : product.stock <= product.seuilAlerte ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (product.stock / Math.max(product.seuilAlerte * 2, 1)) * 100)}%` }} />
                    </div>
                  </div>
                  {prediction.status !== 'normal' && (
                    <div className={cn(
                      'mt-2 text-[10px] font-medium p-1.5 rounded-lg text-center',
                      prediction.status === 'critical' ? 'bg-red-100 text-red-700' :
                      prediction.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                      prediction.status === 'rupture' ? 'bg-red-200 text-red-800' :
                      'bg-blue-100 text-blue-700'
                    )}>
                      {prediction.message}
                    </div>
                  )}
                </div>
                <div className="space-y-2 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setReapproProductId(product.id); setReapproQty(''); setShowReappro(true); }} className="py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-1 border border-emerald-100"><Plus size={13} /> + Stock</button>
                    <button onClick={(e) => { e.stopPropagation(); setInventoryProduct(product); setInventoryQty(String(product.stock)); setShowInventory(true); }} className="py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all flex items-center justify-center gap-1 border border-blue-100"><ClipboardCheck size={13} /> Inventaire</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }} className="py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 active:scale-95 transition-all flex items-center justify-center gap-1 border border-violet-100"><Edit3 size={13} /> Modifier</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }} className="py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center gap-1 border border-red-100"><Trash2 size={13} /> Supprimer</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRÉVISIONS MODAL - garder le même */}
      {showPredictions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowPredictions(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Prévisions de rupture de stock</h3>
              </div>
              <button onClick={() => setShowPredictions(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl">📊 Basé sur la consommation moyenne des 7 derniers jours</p>
            <div className="space-y-2">
              {(products || []).map(product => {
                const prediction = predictStockRupture(product);
                return (
                  <div key={product.id} className={cn(
                    'flex items-center justify-between p-3 rounded-xl border transition-all',
                    prediction.status === 'critical' ? 'bg-red-50 border-red-200' :
                    prediction.status === 'warning' ? 'bg-amber-50 border-amber-200' :
                    prediction.status === 'rupture' ? 'bg-red-100 border-red-300' :
                    'bg-slate-50 border-slate-100'
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{product.image}</span>
                        <p className="font-semibold text-slate-800 text-sm">{product.name}</p>
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          prediction.status === 'critical' ? 'bg-red-200 text-red-800' :
                          prediction.status === 'warning' ? 'bg-amber-200 text-amber-800' :
                          prediction.status === 'rupture' ? 'bg-red-300 text-red-900' :
                          'bg-emerald-100 text-emerald-700'
                        )}>
                          {prediction.status === 'critical' ? 'Critique' :
                           prediction.status === 'warning' ? 'Attention' :
                           prediction.status === 'rupture' ? 'Rupture' : 'OK'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-slate-600">Stock: <strong className={prediction.currentStock <= product.seuilCritique ? 'text-red-600' : 'text-slate-800'}>{prediction.currentStock}</strong> {product.stockUnit}</span>
                        <span className="text-slate-600">Conso: <strong>{prediction.dailyConsumption.toFixed(1)}</strong>/jour</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-sm font-bold',
                        prediction.status === 'critical' ? 'text-red-600' :
                        prediction.status === 'warning' ? 'text-amber-600' :
                        prediction.status === 'rupture' ? 'text-red-700' :
                        'text-emerald-600'
                      )}>
                        {prediction.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GESTION CATÉGORIES MODAL */}
      {showManageCategories && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={() => setShowManageCategories(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Settings size={20} className="text-violet-600" /> Paramétrer les Catégories</h3>
              <button onClick={() => setShowManageCategories(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
            </div>
            <div className="flex gap-2 mb-4 shrink-0">
              <input type="text" placeholder="Nouvelle catégorie..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 p-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
              <button onClick={handleAddCategory} className="px-4 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-1"><Plus size={16} /> Ajouter</button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {categoryList.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  {editingCategory === cat.name ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} className="flex-1 p-1.5 border rounded-lg text-xs focus:outline-none bg-white" autoFocus />
                      <button onClick={() => handleEditCategory(cat.name)} className="p-1.5 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
                      <button onClick={() => setEditingCategory(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="capitalize font-medium text-slate-700 flex items-center gap-2">{cat.emoji} {cat.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingCategory(cat.name); setEditingCategoryName(cat.name); }} className="p-1.5 text-slate-500 hover:text-violet-600 rounded-lg" title="Renommer"><Edit3 size={14} /></button>
                        <button onClick={() => handleDeleteCategory(cat.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg" title="Supprimer"><Trash2 size={14} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INVENTAIRE MODAL */}
      {showInventory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { setShowInventory(false); setInventoryProduct(null); setInventoryQty(''); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><ClipboardCheck size={18} className="text-red-600" /></div>
                <div><h3 className="text-lg font-bold text-slate-900">Pertes & Ajustements</h3><p className="text-xs text-slate-500">Saisie d'une perte ou correction de stock</p></div>
              </div>
              <button onClick={() => { setShowInventory(false); setInventoryProduct(null); setInventoryQty(''); }} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Produit concerné</label>
              <select value={inventoryProduct?.id || ''} onChange={e => { const p = (products || []).find(p => p.id === e.target.value) || null; setInventoryProduct(p); setInventoryQty(''); }} className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30">
                <option value="">-- Sélectionner un produit --</option>
                {(products || []).map(p => (<option key={p.id} value={p.id}>{p.image} {p.name} (stock: {p.stock})</option>))}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Motif</label>
              <div className="grid grid-cols-2 gap-2">
                {([{ id: 'casse', label: '💥 Casse', desc: 'Bouteille cassée' }, { id: 'offert', label: '🎁 Offert', desc: 'Offert au client/staff' }, { id: 'ecart', label: '⚖️ Écart', desc: 'Erreur / vol détecté' }, { id: 'peremption', label: '🗑️ Péremption', desc: 'Produit expiré/jeté' }, { id: 'inventaire', label: '📋 Inventaire', desc: 'Comptage physique réel' }, { id: 'autre', label: '📝 Autre', desc: 'Autre motif' }] as { id: LossReason; label: string; desc: string }[]).map(m => (
                  <button key={m.id} onClick={() => setLossReason(m.id)} className={cn('p-3 rounded-xl border-2 text-left transition-all', lossReason === m.id ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-200')}>
                    <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {inventoryProduct && lossReason && (
              <div className="mb-4">
                {lossReason === 'inventaire' ? (
                  <>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Stock réel compté (affiché : <span className="text-violet-600">{inventoryProduct.stock}</span>)</label>
                    <input type="number" min="0" value={inventoryQty} onChange={e => setInventoryQty(e.target.value)} placeholder="Entrez le stock réel" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30" />
                    {inventoryQty !== '' && (
                      <div className={cn('mt-2 p-2 rounded-lg text-xs font-medium', parseInt(inventoryQty) < inventoryProduct.stock ? 'bg-red-50 text-red-700' : parseInt(inventoryQty) > inventoryProduct.stock ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600')}>
                        {parseInt(inventoryQty) < inventoryProduct.stock ? `⚠️ Écart : -${inventoryProduct.stock - parseInt(inventoryQty)} unités` : parseInt(inventoryQty) > inventoryProduct.stock ? `✅ Écart positif : +${parseInt(inventoryQty) - inventoryProduct.stock} unités` : '✅ Stock conforme'}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Quantité perdue (actuel : <span className="text-violet-600">{inventoryProduct.stock}</span>)</label>
                    <input type="number" min="1" max={inventoryProduct.stock} value={inventoryQty} onChange={e => setInventoryQty(e.target.value)} placeholder="Ex: 2" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30" />
                    {inventoryQty && <p className="text-xs text-red-600 mt-1 font-medium">💸 Valeur perdue : {(parseInt(inventoryQty) * (inventoryProduct.prices?.bouteille || 0)).toLocaleString()} FCFA</p>}
                  </>
                )}
              </div>
            )}
            {inventoryProduct && lossReason && inventoryQty && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Note (optionnel)</label>
                <input type="text" value={lossNote} onChange={e => setLossNote(e.target.value)} placeholder="Ex: Bouteille cassée..." className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30" />
              </div>
            )}
            <button onClick={handleLossSubmit} disabled={!inventoryProduct || !lossReason || !inventoryQty} className={cn('w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2', inventoryProduct && lossReason && inventoryQty ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}><Check size={18} /> Enregistrer</button>
          </div>
        </div>
      )}

      {/* RÉAPPRO MODAL */}
      {showReappro && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!reapproSuccess) setShowReappro(false); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl animate-slideIn sm:animate-fadeIn" onClick={e => e.stopPropagation()}>
            {reapproSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><PackageCheck size={32} className="text-emerald-600" /></div>
                <h3 className="text-lg font-bold text-slate-900">Stock mis à jour !</h3>
                <p className="text-sm text-slate-500 mt-1">Le réapprovisionnement a été enregistré</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><PackagePlus size={20} className="text-emerald-600" /> Réapprovisionnement</h3>
                  <button onClick={() => setShowReappro(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
                </div>
                <div className="space-y-3">
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1.5">Produit *</label><select value={reapproProductId} onChange={(e) => setReapproProductId(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white"><option value="">— Sélectionner un produit —</option>{(products || []).map(p => (<option key={p.id} value={p.id}>{p.image} {p.name} (Stock: {p.stock} {p.stockUnit})</option>))}</select></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1.5">Quantité reçue *</label><input type="number" min={1} value={reapproQty} onChange={(e) => setReapproQty(e.target.value)} placeholder="Ex: 24" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" autoFocus /></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1.5">Fournisseur</label><input type="text" value={reapproSupplier} onChange={(e) => setReapproSupplier(e.target.value)} placeholder="Ex: Coca Cola Sénégal" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" /></div>
                  <div><label className="text-xs font-semibold text-slate-600 block mb-1.5">Prix d'achat / unité</label><input type="number" min={0} value={reapproPrice} onChange={(e) => setReapproPrice(e.target.value)} placeholder="Ex: 700" className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" /></div>
                  {reapproProductId && reapproQty && parseInt(reapproQty) > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
                      <p className="font-semibold">Récapitulatif :</p>
                      <p className="mt-1">+ {reapproQty} {(products || []).find(p => p.id === reapproProductId)?.stockUnit || 'unités'} de <strong>{(products || []).find(p => p.id === reapproProductId)?.name}</strong></p>
                      {reapproPrice && <p>Coût total : <strong>{(parseInt(reapproQty) * parseInt(reapproPrice)).toLocaleString()} FCFA</strong></p>}
                    </div>
                  )}
                  <button onClick={handleReapproSubmit} disabled={!reapproProductId || !reapproQty || parseInt(reapproQty) <= 0} className={cn('w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2', reapproProductId && reapproQty && parseInt(reapproQty) > 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200 active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}><PackageCheck size={18} /> Confirmer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CRÉER PRODUIT MODAL */}
      {showNewProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowNewProduct(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900">Créer un Produit</h3><button onClick={() => setShowNewProduct(false)} className="text-slate-400"><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Nom du produit *</label><input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" placeholder="Ex: Gazelle" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Catégorie *</label><select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm bg-white capitalize">
                {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
              </select></div>
              <RenderPriceFormats form={newProduct} setForm={setNewProduct} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Stock Initial *</label><input type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" placeholder="0" /></div>
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Unité de mesure</label><input type="text" value={newProduct.stockUnit} onChange={e => setNewProduct({...newProduct, stockUnit: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" /></div>
              </div>
              <button onClick={handleNewProductSubmit} className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm mt-2">Créer le produit</button>
            </div>
          </div>
        </div>
      )}

      {/* MODIFIER PRODUIT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-[55] flex items-end sm:items-center justify-center" onClick={() => setEditingProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900">Modifier le Produit</h3><button onClick={() => setEditingProduct(null)} className="text-slate-400"><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Nom du produit *</label><input type="text" value={editProductForm.name} onChange={e => setEditProductForm({...editProductForm, name: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Catégorie *</label><select value={editProductForm.category} onChange={e => setEditProductForm({...editProductForm, category: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm bg-white capitalize">
                {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
              </select></div>
              <RenderPriceFormats form={editProductForm} setForm={setEditProductForm} />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Seuil Alerte</label><input type="number" value={editProductForm.seuilAlerte} onChange={e => setEditProductForm({...editProductForm, seuilAlerte: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" /></div>
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Seuil Critique</label><input type="number" value={editProductForm.seuilCritique} onChange={e => setEditProductForm({...editProductForm, seuilCritique: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" /></div>
              </div>
              <div className="space-y-2 pt-1 border-t">
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Volume / Taille</label><input type="text" value={editProductForm.bottleSize} onChange={e => setEditProductForm({...editProductForm, bottleSize: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" placeholder="Ex: 33cl" /></div>
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Suppléments</label><input type="text" value={editProductForm.supplements} onChange={e => setEditProductForm({...editProductForm, supplements: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" placeholder="Citron, Glaçons" /></div>
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Notes internes</label><textarea value={editProductForm.notes} onChange={e => setEditProductForm({...editProductForm, notes: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm h-16 resize-none" placeholder="Notes optionnelles..." /></div>
              </div>
              <button onClick={handleEditProductSubmit} className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl text-sm mt-2">Enregistrer les modifications</button>
            </div>
          </div>
        </div>
      )}

      {/* MOUVEMENTS MODAL */}
      {showMovements && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowMovements(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><History size={20} /> Flux Récents</h3><button onClick={() => setShowMovements(false)} className="text-slate-400"><X size={20} /></button></div>
            <div className="space-y-2">
              {stockMovements.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 border rounded-xl">
                  <div><p className="font-semibold text-slate-800">{m.productId}</p><p className="text-[10px] text-slate-400">{m.date instanceof Date ? m.date.toLocaleDateString() : m.date} - {m.type === 'entrée' ? 'Réappro' : 'Vente'}</p></div>
                  <span className={cn('font-bold', m.type === 'entrée' ? 'text-emerald-600' : 'text-red-500')}>{m.type === 'entrée' ? '+' : '-'}{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}