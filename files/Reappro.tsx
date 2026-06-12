import { useState } from 'react';
import {
  Truck, Building2, Phone, Package, Plus, X, Edit3, Trash2,
  ChevronDown, ChevronUp, Check, LayoutGrid, ShoppingCart,
  Clock, History, Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useProducts } from '@/utils/productStore';

// ── Types ─────────────────────────────────────────────────────
export interface SupplierProduct {
  productId: string;     // lié au catalogue si existant, sinon ''
  productName: string;
  unitType: 'unité' | 'carton';
  pricePerUnit: number;
  pricePerCarton?: number;
  qtyPerCarton?: number; // unités dans un carton
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  products: SupplierProduct[];
  createdAt: string;
  notes?: string;
}

// ── Store fournisseurs (localStorage) ────────────────────────
function loadSuppliers(): Supplier[] {
  try {
    const saved = localStorage.getItem('barflow_suppliers');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}
function saveSuppliers(suppliers: Supplier[]) {
  localStorage.setItem('barflow_suppliers', JSON.stringify(suppliers));
}

type ReapproTab = 'overview' | 'order' | 'in_progress' | 'history' | 'suppliers';

const TABS: { id: ReapproTab; label: string; icon: typeof Truck }[] = [
  { id: 'overview',    label: "Vue d'ensemble", icon: LayoutGrid  },
  { id: 'order',       label: 'Commande',        icon: ShoppingCart },
  { id: 'in_progress', label: 'En cours',        icon: Clock       },
  { id: 'history',     label: 'Historique',      icon: History     },
  { id: 'suppliers',   label: 'Fournisseurs',    icon: Users       },
];

// ── Composant principal ───────────────────────────────────────
export function Reappro() {
  const [activeTab, setActiveTab] = useState<ReapproTab>('overview');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 lg:p-6 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Truck size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Réapprovisionnement</h1>
            <p className="text-sm text-slate-500">Gestion des commandes fournisseurs</p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
                  activeTab === tab.id
                    ? 'text-emerald-700 border-emerald-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700',
                )}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 pt-5">
        {activeTab === 'overview'    && <OverviewTab />}
        {activeTab === 'order'       && <OrderTab />}
        {activeTab === 'in_progress' && <InProgressTab />}
        {activeTab === 'history'     && <HistoryTab />}
        {activeTab === 'suppliers'   && <SuppliersTab />}
      </div>
    </div>
  );
}

// ── Onglet : Fournisseurs ─────────────────────────────────────
function SuppliersTab() {
  const { products: catalogProducts } = useProducts();
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Formulaire fournisseur
  const emptyForm = { name: '', phone: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  // Produits du formulaire
  const emptyProduct: SupplierProduct = {
    productId: '', productName: '', unitType: 'unité',
    pricePerUnit: 0, pricePerCarton: undefined, qtyPerCarton: undefined,
  };
  const [formProducts, setFormProducts] = useState<SupplierProduct[]>([{ ...emptyProduct }]);

  const openNewForm = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setFormProducts([{ ...emptyProduct }]);
    setShowForm(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({ name: supplier.name, phone: supplier.phone, notes: supplier.notes || '' });
    setFormProducts(supplier.products.length > 0 ? [...supplier.products] : [{ ...emptyProduct }]);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const validProducts = formProducts.filter(p => p.productName.trim());

    if (editingSupplier) {
      const updated = suppliers.map(s =>
        s.id === editingSupplier.id
          ? { ...s, name: form.name, phone: form.phone, notes: form.notes, products: validProducts }
          : s
      );
      setSuppliers(updated);
      saveSuppliers(updated);
    } else {
      const newSupplier: Supplier = {
        id: `sup-${Date.now()}`,
        name: form.name,
        phone: form.phone,
        notes: form.notes,
        products: validProducts,
        createdAt: new Date().toISOString(),
      };
      const updated = [newSupplier, ...suppliers];
      setSuppliers(updated);
      saveSuppliers(updated);
    }
    closeForm();
  };

  const handleDelete = (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    if (!supplier) return;
    if (!window.confirm(`Supprimer le fournisseur "${supplier.name}" ?`)) return;
    const updated = suppliers.filter(s => s.id !== id);
    setSuppliers(updated);
    saveSuppliers(updated);
  };

  // Produits dans le formulaire
  const updateFormProduct = (idx: number, field: keyof SupplierProduct, value: string | number) => {
    const updated = [...formProducts];
    const prod = { ...updated[idx], [field]: value };

    // Calcul auto prix unité si carton
    if (field === 'pricePerCarton' || field === 'qtyPerCarton') {
      const price = field === 'pricePerCarton' ? Number(value) : (prod.pricePerCarton || 0);
      const qty   = field === 'qtyPerCarton'   ? Number(value) : (prod.qtyPerCarton || 1);
      if (price > 0 && qty > 0) {
        prod.pricePerUnit = Math.round(price / qty);
      }
    }
    // Si on passe à 'unité', effacer les champs carton
    if (field === 'unitType' && value === 'unité') {
      prod.pricePerCarton = undefined;
      prod.qtyPerCarton   = undefined;
    }

    updated[idx] = prod;
    setFormProducts(updated);
  };

  const linkProductFromCatalog = (idx: number, productId: string) => {
    const catalogProd = catalogProducts.find(p => p.id === productId);
    const updated = [...formProducts];
    if (catalogProd) {
      updated[idx] = {
        ...updated[idx],
        productId,
        productName: catalogProd.name,
      };
    } else {
      updated[idx] = { ...updated[idx], productId: '', productName: '' };
    }
    setFormProducts(updated);
  };

  const addProductRow = () => setFormProducts([...formProducts, { ...emptyProduct }]);
  const removeProductRow = (idx: number) => {
    if (formProducts.length === 1) return;
    setFormProducts(formProducts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header liste */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''} enregistré{suppliers.length > 1 ? 's' : ''}
        </p>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
        >
          <Plus size={16} />
          Nouveau fournisseur
        </button>
      </div>

      {/* Liste des fournisseurs */}
      {suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-semibold">Aucun fournisseur enregistré</p>
          <p className="text-sm text-slate-400 mt-1">Ajoutez votre premier fournisseur pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => {
            const isExpanded = expandedId === supplier.id;
            return (
              <div key={supplier.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between p-4">
                  <button
                    className="flex items-center gap-3 flex-1 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : supplier.id)}
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{supplier.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {supplier.phone && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone size={11} /> {supplier.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Package size={11} /> {supplier.products.length} produit{supplier.products.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="ml-auto mr-3">
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditForm(supplier)}
                      className="p-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Détails produits */}
                {isExpanded && supplier.products.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    {supplier.notes && (
                      <p className="text-xs text-slate-500 italic mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        📝 {supplier.notes}
                      </p>
                    )}
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Catalogue produits</p>
                    <div className="space-y-2">
                      {supplier.products.map((sp, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{sp.productName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {sp.unitType === 'carton'
                                ? `Carton de ${sp.qtyPerCarton} → ${(sp.pricePerCarton || 0).toLocaleString()} FCFA`
                                : 'Vente à l\'unité'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-700">{sp.pricePerUnit.toLocaleString()} FCFA</p>
                            <p className="text-[10px] text-slate-400">/ unité</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL Formulaire ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeForm}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Building2 size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
                  </h3>
                  <p className="text-xs text-slate-500">Remplissez les informations</p>
                </div>
              </div>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Modal body (scrollable) */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* Infos générales */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Informations générales</p>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Nom du fournisseur *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Coca Cola Sénégal"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Numéro de téléphone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="Ex: +221 77 000 00 00"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Notes (optionnel)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ex: Livraison le mardi, min 10 caisses..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Produits */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Produits & Prix d'achat</p>
                  <button
                    onClick={addProductRow}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Plus size={13} /> Ajouter
                  </button>
                </div>

                <div className="space-y-4">
                  {formProducts.map((fp, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                      {/* Ligne suppression */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-600">Produit {idx + 1}</p>
                        {formProducts.length > 1 && (
                          <button
                            onClick={() => removeProductRow(idx)}
                            className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Lier au catalogue OU saisir un nom */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Lier au catalogue</label>
                          <select
                            value={fp.productId}
                            onChange={e => linkProductFromCatalog(idx, e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          >
                            <option value="">— Sélectionner —</option>
                            {catalogProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.image} {p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nom du produit *</label>
                          <input
                            type="text"
                            value={fp.productName}
                            onChange={e => updateFormProduct(idx, 'productName', e.target.value)}
                            placeholder="Ex: Flag Spéciale"
                            className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                      </div>

                      {/* Type : unité ou carton */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">Type de vente</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['unité', 'carton'] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => updateFormProduct(idx, 'unitType', type)}
                              className={cn(
                                'py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                                fp.unitType === type
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
                              )}
                            >
                              {type === 'unité' ? '📦 Unité' : '🗃️ Carton'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Champs selon type */}
                      {fp.unitType === 'unité' ? (
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Prix à l'unité (FCFA) *</label>
                          <input
                            type="number" min={0}
                            value={fp.pricePerUnit || ''}
                            onChange={e => updateFormProduct(idx, 'pricePerUnit', Number(e.target.value))}
                            placeholder="Ex: 700"
                            className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Prix du carton (FCFA) *</label>
                              <input
                                type="number" min={0}
                                value={fp.pricePerCarton || ''}
                                onChange={e => updateFormProduct(idx, 'pricePerCarton', Number(e.target.value))}
                                placeholder="Ex: 16800"
                                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Unités / carton *</label>
                              <input
                                type="number" min={1}
                                value={fp.qtyPerCarton || ''}
                                onChange={e => updateFormProduct(idx, 'qtyPerCarton', Number(e.target.value))}
                                placeholder="Ex: 24"
                                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>
                          </div>
                          {/* Prix unité calculé auto */}
                          {fp.pricePerCarton && fp.qtyPerCarton && fp.qtyPerCarton > 0 ? (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                              <Check size={14} className="text-emerald-600 shrink-0" />
                              <p className="text-xs text-emerald-800 font-medium">
                                Prix à l'unité calculé automatiquement :{' '}
                                <span className="font-black text-emerald-700">
                                  {Math.round(fp.pricePerCarton / fp.qtyPerCarton).toLocaleString()} FCFA
                                </span>
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-100 rounded-xl p-2.5 text-xs text-slate-500 text-center">
                              Entrez le prix et la quantité pour calculer le prix unitaire
                            </div>
                          )}
                        </div>
                      )}

                      {/* Marge indicative si lié au catalogue */}
                      {fp.productId && fp.pricePerUnit > 0 && (() => {
                        const cat = catalogProducts.find(p => p.id === fp.productId);
                        if (!cat) return null;
                        const marge = cat.price - fp.pricePerUnit;
                        const margeRate = Math.round((marge / cat.price) * 100);
                        return (
                          <div className={cn(
                            'flex items-center justify-between rounded-xl p-3 text-xs font-medium border',
                            marge > 0 ? 'bg-violet-50 border-violet-200 text-violet-800' : 'bg-red-50 border-red-200 text-red-700',
                          )}>
                            <span>Marge indicative (prix vente : {cat.price.toLocaleString()} F)</span>
                            <span className="font-black">
                              {marge > 0 ? '+' : ''}{marge.toLocaleString()} F ({margeRate}%)
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-5 border-t border-slate-100 shrink-0 flex gap-3">
              <button
                onClick={closeForm}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm bg-white hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2',
                  form.name.trim()
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                )}
              >
                <Check size={16} />
                {editingSupplier ? 'Enregistrer' : 'Créer le fournisseur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglets à venir (placeholders) ────────────────────────────
function OverviewTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <LayoutGrid size={40} className="mb-3 opacity-40" />
      <p className="font-semibold text-slate-500">Vue d'ensemble</p>
      <p className="text-sm mt-1">Disponible prochainement</p>
    </div>
  );
}

function OrderTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <ShoppingCart size={40} className="mb-3 opacity-40" />
      <p className="font-semibold text-slate-500">Passer une commande</p>
      <p className="text-sm mt-1">Disponible prochainement</p>
    </div>
  );
}

function InProgressTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Clock size={40} className="mb-3 opacity-40" />
      <p className="font-semibold text-slate-500">Commandes en cours</p>
      <p className="text-sm mt-1">Disponible prochainement</p>
    </div>
  );
}

function HistoryTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <History size={40} className="mb-3 opacity-40" />
      <p className="font-semibold text-slate-500">Historique des commandes</p>
      <p className="text-sm mt-1">Disponible prochainement</p>
    </div>
  );
}
