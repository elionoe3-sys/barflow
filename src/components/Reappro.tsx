// Reappro.tsx - Version COMPLÈTE avec quantités par index
import { useState, useEffect } from 'react';
import {
  Truck, Building2, Package, Plus, X, Edit3, Trash2,
  ChevronDown, ChevronUp, Check, LayoutGrid, ShoppingCart,
  Clock, History, Users, Download, CalendarDays,
  PackageCheck, AlertCircle, TrendingUp, DollarSign, BarChart3,
  Crown, Activity, PieChart as PieChartIcon, CheckCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/utils/cn';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  reapproDB,
  migrateFromLocalStorage,
  useReapproOrders,
  useSuppliers,
  type Supplier,
  type SupplierProduct,
  type ReapproOrder,
  type ReapproOrderItem,
  calcTotalUnites,
  calcTotalCl,
  qtyDefautParFormat,
} from '@/utils/reapproStore';
import { useCategories } from '@/utils/productStore';
import { recordEntree } from '@/utils/movementStore';
import { useTranslation } from 'react-i18next';

// ── Vignette produit : photo réelle si dispo, sinon emoji générique ──
// (même logique que dans Stocks.tsx — la photo du catalogue doit aussi
// apparaître ici, dans l'écran de commande fournisseur)
function ProductThumb({ product }: { product?: { photo?: string; image?: string; color?: string } | null }) {
  if (product?.photo) {
    return (
      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200">
        <img src={product.photo} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: product ? `${product.color || '#8B5CF6'}20` : '#f1f5f9' }}>
      {product?.image || '📦'}
    </div>
  );
}

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
};

type ReapproTab = 'overview' | 'order' | 'in_progress' | 'history' | 'suppliers';

// ✅ Garder label et labelKey
const TABS: { id: ReapproTab; label: string; labelKey: string; icon: typeof Truck }[] = [
  { id: 'overview',    label: "Vue d'ensemble", labelKey: 'tabs.overview', icon: LayoutGrid  },
  { id: 'order',       label: 'Commande',       labelKey: 'tabs.order',    icon: ShoppingCart },
  { id: 'in_progress', label: 'En cours',       labelKey: 'tabs.in_progress', icon: Clock },
  { id: 'history',     label: 'Historique',     labelKey: 'tabs.history',  icon: History     },
  { id: 'suppliers',   label: 'Fournisseurs',   labelKey: 'tabs.suppliers', icon: Users       },
];

function AnimatedKpiCard({ icon, label, value, change, positive, color }: {
  icon: React.ReactNode; label: string; value: string;
  change?: string; positive?: boolean;
  color: 'emerald' | 'violet' | 'blue' | 'amber' | 'rose';
}) {
  const gradients: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600', violet: 'from-violet-500 to-purple-600',
    blue: 'from-blue-500 to-cyan-600', amber: 'from-amber-500 to-orange-600', rose: 'from-rose-500 to-pink-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform group-hover:scale-105', gradients[color])}>
          <div className="text-white">{icon}</div>
        </div>
        {change && (
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1', positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50')}>
            {positive ? '▲' : '▼'} {change}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
    </div>
  );
}

const StyledTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-xl p-3">
      <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
            <span className="text-slate-600">{p.name}:</span>
          </div>
          <span className="font-bold text-slate-900">{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Composant principal ───────────────────────────────────────
export function Reappro() {
  const { t } = useTranslation('reappro');
  const [activeTab, setActiveTab] = useState<ReapproTab>('overview');

  const products = useLiveQuery(() => universalSync.getProduits(), []);
  const orders = useReapproOrders() || [];
  const suppliers = useSuppliers() || [];

  useEffect(() => {
    migrateFromLocalStorage();
  }, []);

  const hasRealData = orders.some(o => o.status === 'reçue');

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 m-4 lg:m-6 p-6 lg:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">{t('title')}</h1>
            <p className="text-emerald-100 mt-1 flex items-center gap-2">
              <Activity size={14} />
              {hasRealData
                ? `✅ ${orders.filter(o => o.status === 'reçue').length} ${t('info.real_data', { count: orders.filter(o => o.status === 'reçue').length })}`
                : t('info.no_data')
              }
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 mb-2">
        {hasRealData ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              {t('info.real_data', { count: orders.length })}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {t('info.no_data')}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 lg:px-6">
        <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const badge = tab.id === 'in_progress' ? orders.filter(o => o.status === 'envoyée' || o.status === 'brouillon').length : 0;
            // ✅ Utiliser t avec fallback sur label
            const label = t(tab.labelKey, tab.label);
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === tab.id ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100')}>
                <Icon size={16} />
                {label}
                {badge > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6 pt-5">
        {activeTab === 'overview'    && <OverviewTab orders={orders} />}
        {activeTab === 'order'       && <OrderTab suppliers={suppliers} products={products || []} />}
        {activeTab === 'in_progress' && <InProgressTab orders={orders} products={products || []} suppliers={suppliers} />}
        {activeTab === 'history'     && <HistoryTab orders={orders} />}
        {activeTab === 'suppliers'   && <SuppliersTab suppliers={suppliers} products={products || []} />}
      </div>
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────
function OverviewTab({ orders }: { orders: ReapproOrder[] }) {
  const { t } = useTranslation('reappro');
  const now = new Date();
  const receivedOrders = orders.filter(o => o.status === 'reçue');
  const monthlyOrders = receivedOrders.filter(o => {
    const d = new Date(o.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const yearlyOrders = receivedOrders.filter(o => new Date(o.createdAt).getFullYear() === now.getFullYear());

  const totalAchats = receivedOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalAchatsMensuel = monthlyOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalAchatsAnnuel = yearlyOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalArticles = receivedOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);

  const ordersWithDelay = receivedOrders.filter(o => o.receivedAt);
  const avgDeliveryDays = ordersWithDelay.length > 0
    ? Math.round(ordersWithDelay.reduce((sum, o) => {
        const days = (new Date(o.receivedAt!).getTime() - new Date(o.createdAt).getTime()) / (1000 * 3600 * 24);
        return sum + days;
      }, 0) / ordersWithDelay.length)
    : 0;

  const supplierStatsMap: Record<string, { totalAmount: number; orderCount: number; lastOrderDate: Date | null }> = {};
  receivedOrders.forEach(order => {
    if (!supplierStatsMap[order.supplierName]) {
      supplierStatsMap[order.supplierName] = { totalAmount: 0, orderCount: 0, lastOrderDate: null };
    }
    supplierStatsMap[order.supplierName].totalAmount += order.totalAmount;
    supplierStatsMap[order.supplierName].orderCount += 1;
    const d = new Date(order.createdAt);
    if (!supplierStatsMap[order.supplierName].lastOrderDate || d > supplierStatsMap[order.supplierName].lastOrderDate!) {
      supplierStatsMap[order.supplierName].lastOrderDate = d;
    }
  });
  const supplierStats = Object.entries(supplierStatsMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const mOrders = receivedOrders.filter(o => {
      const od = new Date(o.createdAt);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });
    return { month: d.toLocaleString('fr-FR', { month: 'short' }), montant: mOrders.reduce((s, o) => s + o.totalAmount, 0) };
  });

  const chartColors = ['#10B981', '#8B5CF6', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4'];
  const supplierChartData = supplierStats.slice(0, 6).map((s, idx) => ({
    name: s.name.length > 15 ? s.name.slice(0, 12) + '...' : s.name,
    montant: s.totalAmount,
    color: chartColors[idx % chartColors.length],
  }));

  const lastOrder = [...receivedOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (receivedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Package size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-semibold text-slate-500">{t('overview.no_data')}</p>
        <p className="text-sm mt-2">{t('overview.no_data_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedKpiCard icon={<DollarSign size={20} />} label={t('overview.total_purchases')} value={`${fmt(totalAchats)} FCFA`} color="emerald" />
        <AnimatedKpiCard icon={<ShoppingCart size={20} />} label={t('overview.orders_received')} value={fmt(receivedOrders.length)} color="violet" />
        <AnimatedKpiCard icon={<Package size={20} />} label={t('overview.items_ordered')} value={fmt(totalArticles)} color="blue" />
        <AnimatedKpiCard icon={<Clock size={20} />} label={t('overview.avg_delivery')} value={`${avgDeliveryDays} jours`} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-emerald-500" /> {t('overview.monthly')}
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<StyledTooltip />} />
                <Area type="monotone" dataKey="montant" stroke="#10B981" strokeWidth={2} fill="url(#monthGrad)" name={t('overview.monthly')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2 mb-4">
            <PieChartIcon size={20} className="text-violet-500" /> {t('overview.supplier_detail')}
          </h2>
          <div className="h-64">
            {supplierChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={supplierChartData} dataKey="montant" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90} paddingAngle={3}
                    label={({ name, percent }) => (percent || 0) > 0.05 ? `${name} ${Math.round((percent || 0) * 100)}%` : ''}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}>
                    {supplierChartData.map((item, idx) => (
                      <Cell key={idx} fill={item.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<StyledTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p className="text-sm">{t('overview.no_data')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {lastOrder && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={20} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900 text-lg">{t('overview.last_order')}</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-sm text-slate-600">{t('overview.order')}</p><p className="text-xl font-bold text-slate-900">{lastOrder.id}</p><p className="text-sm text-slate-500 mt-1">{lastOrder.supplierName}</p></div>
            <div className="text-center"><p className="text-sm text-slate-600">{t('overview.date')}</p><p className="text-lg font-semibold text-slate-800">{new Date(lastOrder.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
            <div className="text-center"><p className="text-sm text-slate-600">{t('overview.amount')}</p><p className="text-xl font-bold text-emerald-600">{fmt(lastOrder.totalAmount)} FCFA</p></div>
            <div className="text-center"><p className="text-sm text-slate-600">{t('overview.items')}</p><p className="text-lg font-semibold text-slate-800">{lastOrder.items.reduce((s, i) => s + i.quantity, 0)} {t('units.units')}</p></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2"><Building2 size={20} className="text-emerald-500" /> {t('overview.supplier_detail')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50">
              <th className="p-4 text-left font-semibold text-slate-600">{t('overview.supplier')}</th>
              <th className="p-4 text-center font-semibold text-slate-600">{t('overview.nb_orders')}</th>
              <th className="p-4 text-right font-semibold text-slate-600">{t('overview.total_cost')}</th>
              <th className="p-4 text-center font-semibold text-slate-600">{t('overview.last_delivery')}</th>
            </tr></thead>
            <tbody>
              {supplierStats.map((s, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-4"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Building2 size={14} className="text-emerald-600" /></div><span className="font-medium text-slate-800">{s.name}</span></div></td>
                  <td className="p-4 text-center font-medium text-slate-700">{s.orderCount}</td>
                  <td className="p-4 text-right font-bold text-emerald-600">{fmt(s.totalAmount)} F</td>
                  <td className="p-4 text-center text-slate-600">{s.lastOrderDate ? new Date(s.lastOrderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-5">
          <div className="flex items-center gap-2 mb-3"><CalendarDays size={18} className="text-violet-600" /><h3 className="font-semibold text-slate-800">{t('overview.this_month')}</h3></div>
          <div className="flex justify-between"><span className="text-sm text-slate-600">{t('overview.total_purchases')}</span><span className="text-xl font-bold text-violet-600">{fmt(totalAchatsMensuel)} FCFA</span></div>
          <div className="flex justify-between mt-2"><span className="text-sm text-slate-600">{t('overview.orders_received')}</span><span className="text-lg font-semibold text-slate-700">{monthlyOrders.length}</span></div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3"><CalendarDays size={18} className="text-emerald-600" /><h3 className="font-semibold text-slate-800">{t('overview.this_year')}</h3></div>
          <div className="flex justify-between"><span className="text-sm text-slate-600">{t('overview.total_purchases')}</span><span className="text-xl font-bold text-emerald-600">{fmt(totalAchatsAnnuel)} FCFA</span></div>
          <div className="flex justify-between mt-2"><span className="text-sm text-slate-600">{t('overview.orders_received')}</span><span className="text-lg font-semibold text-slate-700">{yearlyOrders.length}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── COMMANDE ─────────────────────────────────────────────────
function OrderTab({ suppliers, products }: { suppliers: Supplier[]; products: any[] }) {
  const { t } = useTranslation('reappro');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || null;
  const supplierCatalogProducts = selectedSupplier
    ? selectedSupplier.products.map(sp => ({ sp, catProd: products.find(p => p.id === sp.productId) }))
    : [];

  const total = supplierCatalogProducts.reduce((sum, { sp }, index) => {
    const qty = quantities[index] || 0;
    const unitPrice = sp.unitType === 'carton' && sp.pricePerCarton ? sp.pricePerCarton : sp.pricePerUnit;
    return sum + qty * unitPrice;
  }, 0);
  const itemsCount = Object.values(quantities).filter(q => q > 0).length;

  const handleQtyChange = (index: number, value: string) => {
    const qty = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [index]: qty }));
  };

  const handleSave = async () => {
    if (!selectedSupplier || itemsCount === 0) return;
    setSaving(true);

    const items: ReapproOrderItem[] = supplierCatalogProducts
      .map(({ sp, catProd }, index) => ({ sp, catProd, index }))
      .filter(({ index }) => (quantities[index] || 0) > 0)
      .map(({ sp, catProd, index }) => {
        const qty = quantities[index] || 0;
        const qtyParCarton = sp.qtyPerCarton || sp.qtyParCarton || 1;
        const totalUnites = sp.unitType === 'carton' ? qty * qtyParCarton : qty;
        const priceCarton = sp.pricePerCarton || 0;
        const pricePerUnit = sp.unitType === 'carton' && priceCarton > 0 && qtyParCarton > 0
          ? Math.round(priceCarton / qtyParCarton)
          : sp.pricePerUnit || 0;
        const prixCommande = sp.unitType === 'carton' ? priceCarton : pricePerUnit;

        return {
          productId: sp.productId || '',
          productName: sp.productName,
          quantity: qty,
          formatLivraison: (sp.unitType === 'carton' ? 'carton' : 'unité') as any,
          qtyParCarton,
          totalUnites,
          totalCl: 0,
          contenanceClUnite: 0,
          unitPrice: prixCommande,
          totalPrice: qty * prixCommande,
          unit: sp.unitType === 'carton' ? 'carton' : 'unité',
        };
      });

    await reapproDB.addOrder({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      supplierPhone: selectedSupplier.phone,
      items,
      totalAmount: items.reduce((s, i) => s + i.totalPrice, 0),
      status: 'envoyée',
      createdAt: new Date().toISOString(),
    });

    setSaving(false);
    setSaveSuccess(true);
    setQuantities({});
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-2">{t('order.supplier')}</label>
        <select value={selectedSupplierId} onChange={e => { setSelectedSupplierId(e.target.value); setQuantities({}); }}
          className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="">{t('order.select_supplier')}</option>
          {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>))}
        </select>
        {suppliers.length === 0 && <p className="text-xs text-amber-600 mt-2 font-medium">{t('order.no_supplier_warning')}</p>}
      </div>

      {selectedSupplier && (
        <>
          {supplierCatalogProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-semibold">{t('order.no_products')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('order.no_products_desc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {supplierCatalogProducts.map(({ sp, catProd }, index) => {
                const qty = quantities[index] || 0;
                const displayPrice = sp.unitType === 'carton' && sp.pricePerCarton ? sp.pricePerCarton : sp.pricePerUnit;
                const displayUnit = sp.unitType === 'carton' ? t('units.carton') : t('units.unit');
                const qtyPerCarton = sp.qtyPerCarton || 0;
                return (
                  <div key={index} className={cn('bg-white rounded-2xl border-2 p-3 flex flex-col gap-2 transition-all', qty > 0 ? 'border-emerald-400 bg-emerald-50/40 shadow-md' : 'border-slate-200 hover:border-slate-300')}>
                    {/* En-tête : vignette + nom */}
                    <div className="flex items-center gap-2">
                      <ProductThumb product={catProd} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">{sp.productName}</p>
                        {catProd && <p className="text-[10px] text-slate-400 mt-0.5">{t('product.stock')}: {catProd.stock}</p>}
                      </div>
                    </div>
                    {/* Prix */}
                    <div className="text-center py-0.5">
                      <p className="text-sm font-black text-emerald-700">{fmt(displayPrice)} F</p>
                      <p className="text-[10px] text-slate-400">/ {displayUnit}{sp.unitType === 'carton' && qtyPerCarton > 0 && ` × ${qtyPerCarton}`}</p>
                    </div>
                    {/* Contrôle quantité compact */}
                    <div className="flex items-center gap-1 w-full">
                      <button
                        onClick={() => setQuantities(prev => ({ ...prev, [index]: Math.max(0, (prev[index] || 0) - 1) }))}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-base shrink-0"
                      >−</button>
                      <input
                        type="number"
                        min={0}
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        onChange={(e) => handleQtyChange(index, e.target.value)}
                        className="flex-1 min-w-0 h-7 rounded-lg border border-slate-200 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                      <button
                        onClick={() => setQuantities(prev => ({ ...prev, [index]: (prev[index] || 0) + 1 }))}
                        className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-base shrink-0"
                      >+</button>
                    </div>
                    {/* Sous-total */}
                    {qty > 0 && (
                      <div className="text-center">
                        <p className="text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-lg py-1">
                          = {fmt(qty * displayPrice)} F
                        </p>
                        {sp.unitType === 'carton' && qtyPerCarton > 0 && (
                          <p className="text-[9px] text-slate-400 mt-0.5">{t('order.so_bottles', { count: qty * qtyPerCarton })}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky bottom-0 shadow-lg">
            {saveSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                <Check size={16} className="text-emerald-600" />
                <p className="text-sm text-emerald-700 font-semibold">{t('order.saved')}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-slate-500">{t('order.recap')}</p>
                <p className="text-sm text-slate-700"><span className="font-bold">{itemsCount} {t('order.products')}</span> · {Object.values(quantities).reduce((s, q) => s + (q || 0), 0)} {t('order.units')}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right"><p className="text-xs text-slate-500">{t('order.total_estimated')}</p><p className="text-xl font-black text-slate-900">{fmt(total)} FCFA</p></div>
                <button onClick={handleSave} disabled={itemsCount === 0 || saving}
                  className={cn('px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all',
                    itemsCount > 0 && !saving ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                  <Check size={18} /> {saving ? t('order.saving') : t('order.save')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── EN COURS ──────────────────────────────────────────────────
function InProgressTab({ orders, products, suppliers }: { orders: ReapproOrder[]; products: any[]; suppliers: Supplier[] }) {
  const { t } = useTranslation('reappro');
  const [selectedOrder, setSelectedOrder] = useState<ReapproOrder | null>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({});
  const [success, setSuccess] = useState(false);
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const inProgressOrders = orders.filter(o => o.status === 'envoyée' || o.status === 'brouillon');
  const allSuppliers = [...new Set(inProgressOrders.map(o => o.supplierName))];
  const filteredOrders = inProgressOrders.filter(o => filterSupplier === 'all' || o.supplierName === filterSupplier);

  const openOrder = (order: ReapproOrder) => {
    setSelectedOrder(order);
    const init: Record<number, string> = {};
    order.items.forEach((_, i) => { init[i] = String(order.items[i].quantity); });
    setReceivedQtys(init);
    setSuccess(false);
    setIsProcessing(false);
  };

  const handleConfirmReceived = async () => {
    if (!selectedOrder || isProcessing) return;
    setIsProcessing(true);

    try {
      const newlyAddedIds: string[] = [];
      const supplier = suppliers.find((s: any) => s.id === selectedOrder.supplierId);

      for (const [i, item] of selectedOrder.items.entries()) {
        const qtyRecu = parseInt(receivedQtys[i] || '0');
        if (qtyRecu <= 0) continue;

        const qtyParCarton = item.qtyParCarton || 1;
        const totalUnitesRecus = item.formatLivraison === 'carton' || item.unit === 'carton'
          ? qtyRecu * qtyParCarton
          : qtyRecu;

        const existingProduct = item.productId
          ? products.find((p: any) => p.id === item.productId)
          : products.find((p: any) => p.nom === item.productName || p.name === item.productName);

        if (existingProduct) {
          await universalSync.updateProduit(existingProduct.id, {
            ...existingProduct,
            stock: existingProduct.stock + totalUnitesRecus,
          });

          await recordEntree({
            productId: existingProduct.id,
            productName: existingProduct.nom || existingProduct.name || item.productName,
            quantity: totalUnitesRecus,
            supplier: selectedOrder.supplierName,
            purchasePrice: item.unitPrice,
            reason: `${t('in_progress.receive')} — ${selectedOrder.supplierName} (${selectedOrder.id})`,
          });
        } else {
          const supplierProduct = supplier?.products?.find(
            (sp: any) => sp.productId === item.productId || sp.productName === item.productName
          );
          const category = (supplierProduct as any)?.category || 'autre';
          const priceParBouteille = item.unit === 'carton' && qtyParCarton > 0
            ? Math.round(item.unitPrice / qtyParCarton)
            : item.unitPrice || 0;

          const addedProduct = await universalSync.addProduit({
            name: item.productName,
            category,
            price: priceParBouteille,
            stock: totalUnitesRecus,
            stockUnit: 'bouteilles',
            seuilAlerte: 10,
            seuilCritique: 5,
            image: '📦',
            color: '#8B5CF6',
            popularite: 50,
            activePriceFormats: ['bouteille'],
            prices: { bouteille: priceParBouteille },
            options: {},
          });
          newlyAddedIds.push(addedProduct.id);

          await recordEntree({
            productId: addedProduct.id,
            productName: item.productName,
            quantity: totalUnitesRecus,
            supplier: selectedOrder.supplierName,
            purchasePrice: priceParBouteille,
            reason: `${t('in_progress.receive')} (nouveau produit) — ${selectedOrder.supplierName} (${selectedOrder.id})`,
          });
        }
      }

      await reapproDB.updateOrderStatus(selectedOrder.id, 'reçue', new Date().toISOString());

      window.dispatchEvent(new CustomEvent('productsUpdated', {
        detail: { addedProductIds: newlyAddedIds },
      }));
      if (newlyAddedIds.length > 0) {
        try {
          localStorage.setItem('barflow_newlyAddedProducts', JSON.stringify({
            ids: newlyAddedIds,
            timestamp: Date.now(),
          }));
        } catch (_) {}
      }

      setSuccess(true);
      setTimeout(() => {
        setSelectedOrder(null);
        setSuccess(false);
        setIsProcessing(false);
      }, 1800);
    } catch (error) {
      console.error('Erreur lors de la réception:', error);
      setIsProcessing(false);
      alert(t('errors.reception_error'));
    }
  };

  const totalReceived = selectedOrder
    ? selectedOrder.items.reduce((s, item, i) => s + (parseInt(receivedQtys[i] || '0') || 0) * item.unitPrice, 0)
    : 0;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-slate-700">{filteredOrders.length} {t('in_progress.waiting')}</span>
        </div>
        <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
          <option value="all">{t('in_progress.all_suppliers')}</option>
          {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4"><PackageCheck size={28} className="text-emerald-400" /></div>
          <p className="text-slate-600 font-semibold">{t('in_progress.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <button key={order.id} onClick={() => openOrder(order)} className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div><p className="font-bold text-slate-800">{order.id}</p><p className="text-xs text-slate-500">{order.supplierName} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-slate-900">{fmt(order.totalAmount)} F</p><p className="text-[10px] text-slate-400">{order.items.reduce((s, i) => s + (i.unit === 'carton' ? i.quantity * (i.qtyParCarton || 1) : i.quantity), 0)} {t('units.bottles')}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => { if (!isProcessing && !success) setSelectedOrder(null); }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div><h3 className="text-base font-bold text-slate-900">{selectedOrder.id}</h3><p className="text-xs text-slate-500">{selectedOrder.supplierName}</p></div>
              {!isProcessing && !success && <button onClick={() => setSelectedOrder(null)} className="text-slate-400"><X size={20} /></button>}
            </div>
            
            {success ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4"><PackageCheck size={36} className="text-emerald-600" /></div>
                <p className="text-xl font-bold text-slate-900">{t('in_progress.success')}</p>
                <p className="text-sm text-slate-500 mt-2">{t('in_progress.success_desc')}</p>
                <p className="text-xs text-violet-500 mt-1">{t('in_progress.success_new')}</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                    {t('in_progress.adjust')}
                    <span className="block text-blue-600 font-semibold mt-1">{t('in_progress.new_products')}</span>
                  </div>
                  
                  {selectedOrder.items.map((item, i) => {
                    const exists = products.some((p: any) => p.id === item.productId || p.nom === item.productName || p.name === item.productName);
                    const isCarton = item.unit === 'carton' || item.formatLivraison === 'carton';
                    const qtyParCarton = item.qtyParCarton || 1;
                    const qtyRecu = parseInt(receivedQtys[i] || '0') || 0;
                    const bouteillesRecues = isCarton ? qtyRecu * qtyParCarton : qtyRecu;
                    return (
                      <div key={i} className={cn('rounded-xl p-3', exists ? 'bg-slate-50' : 'bg-violet-50 border border-violet-200')}>
                        <div className="flex justify-between mb-2 flex-wrap gap-1">
                          <p className="font-semibold text-slate-800 flex items-center gap-2">
                            {item.productName}
                            {!exists && <span className="text-[9px] bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-full font-bold">🆕 {t('in_progress.new_products')}</span>}
                          </p>
                          <p className="text-sm font-bold text-emerald-600">
                            {item.quantity} {isCarton ? `${t('units.carton')}${item.quantity > 1 ? 's' : ''} × ${qtyParCarton}` : item.unit} = <strong>{item.quantity * (isCarton ? qtyParCarton : 1)} {t('units.bottles')}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-slate-600 shrink-0">{t('in_progress.qty_received')}</label>
                          <input 
                            type="number" 
                            min={0} 
                            value={receivedQtys[i] || ''} 
                            onChange={e => setReceivedQtys(prev => ({ ...prev, [i]: e.target.value }))} 
                            className="w-24 p-2 rounded-lg border border-slate-200 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/40" 
                          />
                          <span className="text-xs text-slate-500">{isCarton ? `${t('units.carton')}${qtyRecu > 1 ? 's' : ''}` : t('units.unit_plural')}</span>
                          {qtyRecu > 0 && isCarton && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              = {bouteillesRecues} {t('in_progress.received')}
                            </span>
                          )}
                          {receivedQtys[i] && parseInt(receivedQtys[i]) !== item.quantity && (
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', 
                              parseInt(receivedQtys[i]) < item.quantity ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}>
                              {parseInt(receivedQtys[i]) < item.quantity ? `⚠️ ${t('in_progress.gap_less', { count: item.quantity - parseInt(receivedQtys[i]) })}` : `${t('in_progress.gap_more', { count: parseInt(receivedQtys[i]) - item.quantity })}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="bg-slate-900 rounded-2xl p-4 flex justify-between text-white">
                    <span>{t('in_progress.total_received')}</span>
                    <span className="text-lg font-bold text-emerald-400">{fmt(totalReceived)} FCFA</span>
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 flex gap-3">
                  <button 
                    onClick={() => setSelectedOrder(null)} 
                    disabled={isProcessing}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium"
                  >
                    {t('in_progress.cancel')}
                  </button>
                  <button 
                    onClick={handleConfirmReceived} 
                    disabled={isProcessing}
                    className={cn('flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2',
                      isProcessing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl')}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('in_progress.processing')}
                      </>
                    ) : (
                      <>
                        <PackageCheck size={18} />
                        {t('in_progress.confirm')}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HISTORIQUE ────────────────────────────────────────────────
function HistoryTab({ orders }: { orders: ReapproOrder[] }) {
  const { t } = useTranslation('reappro');
  const [filterStatus, setFilterStatus] = useState<ReapproOrder['status'] | 'all'>('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<ReapproOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const allSuppliers = [...new Set(orders.map(o => o.supplierName))];
  const filteredOrders = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterSupplier !== 'all' && o.supplierName !== filterSupplier) return false;
    return true;
  });

  const statusLabel = (s: ReapproOrder['status']) => {
    const map = {
      brouillon: t('history.status_draft'),
      envoyée: t('history.status_sent'),
      reçue: t('history.status_received'),
      annulée: t('history.status_cancelled'),
    };
    return map[s] || s;
  };
  const statusColor = (s: ReapproOrder['status']) => ({
    brouillon: 'bg-slate-100 text-slate-600', envoyée: 'bg-blue-100 text-blue-700',
    reçue: 'bg-emerald-100 text-emerald-700', annulée: 'bg-red-100 text-red-600',
  }[s]);

  const openDetail = (order: ReapproOrder) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const exportOrderPDF = (order: ReapproOrder) => {
    const doc = new jsPDF();
    const now = new Date();
    
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('BarFlow', 20, 20);
    doc.setFontSize(12);
    doc.text(t('pdf.title'), 20, 32);
    doc.setFontSize(9);
    doc.text(`${t('pdf.generated', { date: now.toLocaleDateString('fr-FR'), time: now.toLocaleTimeString('fr-FR') })}`, 20, 40);
    
    let y = 60;
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(t('pdf.general_info'), 20, y);
    y += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${t('pdf.order_id', { id: order.id })}`, 20, y);
    y += 8;
    doc.text(`${t('pdf.supplier', { name: order.supplierName })}`, 20, y);
    y += 8;
    if (order.supplierPhone) doc.text(`${t('pdf.phone', { phone: order.supplierPhone })}`, 20, y);
    y += 8;
    doc.text(`${t('pdf.date', { date: new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) })}`, 20, y);
    y += 8;
    if (order.receivedAt) doc.text(`${t('pdf.receipt_date', { date: new Date(order.receivedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) })}`, 20, y);
    y += 8;
    doc.text(`${t('pdf.status', { status: statusLabel(order.status) })}`, 20, y);
    y += 12;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(t('pdf.articles'), 20, y);
    y += 10;
    
    autoTable(doc, {
      startY: y,
      head: [[t('pdf.product'), t('pdf.qty'), t('pdf.unit_price'), t('pdf.total')]],
      body: order.items.map(item => [
        item.productName,
        `${item.quantity} ${item.unit}`,
        `${item.unitPrice.toLocaleString()} F`,
        `${item.totalPrice.toLocaleString()} F`
      ]),
      foot: [['', '', t('pdf.total'), `${order.totalAmount.toLocaleString()} FCFA`]],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
      footStyles: { fillColor: [240, 248, 240], textColor: [15, 23, 42], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(t('pdf.confidential'), 20, 280);
    doc.text(t('pdf.page'), 190, 280, { align: 'right' });
    
    doc.save(`Commande_${order.id}_${now.toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
          <option value="all">{t('history.all_status')}</option>
          <option value="reçue">{t('history.status_received')}</option>
          <option value="envoyée">{t('history.status_sent')}</option>
          <option value="brouillon">{t('history.status_draft')}</option>
        </select>
        <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
          <option value="all">{t('history.all_suppliers')}</option>
          {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto text-sm text-slate-500 flex items-center">{filteredOrders.length} {t('history.commands')}</div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="font-semibold text-slate-900">{t('history.title')}</h2>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-slate-400"><AlertCircle size={40} className="mx-auto mb-3" /><p>{t('history.empty')}</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map(order => (
              <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex-1 cursor-pointer" onClick={() => openDetail(order)}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{order.id}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor(order.status))}>{statusLabel(order.status)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{order.supplierName} · {new Date(order.createdAt).toLocaleDateString('fr-FR')} · {order.items.reduce((s, i) => s + i.quantity, 0)} {t('units.units')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-slate-900">{fmt(order.totalAmount)} F</p>
                  <button 
                    onClick={() => openDetail(order)}
                    className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition"
                  >
                    {t('actions.detail')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DÉTAIL COMMANDE */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedOrder.id}</h3>
                <p className="text-sm text-slate-600">{selectedOrder.supplierName}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">{t('history.order_date')}</p>
                  <p className="text-sm font-semibold">{new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">{t('history.status')}</p>
                  <p className={cn('text-sm font-semibold', 
                    selectedOrder.status === 'reçue' ? 'text-emerald-600' : 
                    selectedOrder.status === 'envoyée' ? 'text-blue-600' : 'text-slate-600')}>
                    {statusLabel(selectedOrder.status)}
                  </p>
                </div>
                {selectedOrder.supplierPhone && (
                  <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-slate-500">{t('history.supplier_phone')}</p>
                    <p className="text-sm font-semibold">{selectedOrder.supplierPhone}</p>
                  </div>
                )}
                {selectedOrder.receivedAt && (
                  <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-slate-500">{t('history.received_date')}</p>
                    <p className="text-sm font-semibold">{new Date(selectedOrder.receivedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                )}
                {selectedOrder.notes && (
                  <div className="bg-amber-50 rounded-xl p-3 col-span-2 border border-amber-200">
                    <p className="text-xs text-amber-600">{t('history.note')}</p>
                    <p className="text-sm text-amber-800">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-3">{t('history.items_ordered')}</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.quantity} × {item.unit} · {item.unitPrice.toLocaleString()} F/{t('units.unit')}</p>
                      </div>
                      <p className="text-sm font-bold text-violet-700">{item.totalPrice.toLocaleString()} F</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-800">{t('history.total')}</span>
                  <span className="text-2xl font-bold text-emerald-700">{selectedOrder.totalAmount.toLocaleString()} FCFA</span>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowDetailModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium">
                {t('actions.close')}
              </button>
              <button 
                onClick={() => exportOrderPDF(selectedOrder)} 
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-xl transition"
              >
                <Download size={16} />
                {t('history.export')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FOURNISSEURS ──────────────────────────────────────────────
function SuppliersTab({ suppliers, products }: { suppliers: Supplier[]; products: any[] }) {
  const { t } = useTranslation('reappro');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [formProducts, setFormProducts] = useState<SupplierProduct[]>([{ 
    productId: '', 
    productName: '', 
    unitType: 'unité', 
    pricePerUnit: 0,
    pricePerCarton: undefined,
    qtyPerCarton: undefined,
    category: '' 
  }]);

  const { categories: categoryList } = useCategories();
  const categories = categoryList.map(c => c.name);

  const emptyProduct: SupplierProduct = { 
    productId: '', 
    productName: '', 
    unitType: 'unité', 
    pricePerUnit: 0,
    pricePerCarton: undefined,
    qtyPerCarton: undefined,
    category: '' 
  };

  const openNewForm = () => {
    setEditingSupplier(null);
    setForm({ name: '', phone: '', notes: '' });
    setFormProducts([{ ...emptyProduct }]);
    setShowForm(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({ name: supplier.name, phone: supplier.phone, notes: supplier.notes || '' });
    setFormProducts(supplier.products.length > 0 ? [...supplier.products] : [{ ...emptyProduct }]);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const validProducts = formProducts.filter(p => p.productName.trim());
    if (editingSupplier) {
      await reapproDB.updateSupplier(editingSupplier.id, { name: form.name, phone: form.phone, notes: form.notes, products: validProducts });
    } else {
      await reapproDB.addSupplier({ name: form.name, phone: form.phone, notes: form.notes, products: validProducts });
    }
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('suppliers.delete_confirm'))) return;
    await reapproDB.deleteSupplier(id);
  };

  const linkProductFromCatalog = (idx: number, productId: string) => {
    const catalogProd = products.find(p => p.id === productId);
    const updated = [...formProducts];
    if (catalogProd) updated[idx] = { ...updated[idx], productId, productName: catalogProd.name, category: catalogProd.category };
    else updated[idx] = { ...updated[idx], productId: '', productName: '', category: '' };
    setFormProducts(updated);
  };

  const updateFormProduct = (idx: number, field: keyof SupplierProduct, value: string | number) => {
    const updated = [...formProducts];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'pricePerCarton' || field === 'qtyPerCarton') {
      const price = field === 'pricePerCarton' ? Number(value) : updated[idx].pricePerCarton || 0;
      const qty = field === 'qtyPerCarton' ? Number(value) : updated[idx].qtyPerCarton || 1;
      if (price > 0 && qty > 0) updated[idx].pricePerUnit = Math.round(price / qty);
    }
    if (field === 'unitType' && value === 'unité') { 
      updated[idx].pricePerCarton = undefined; 
      updated[idx].qtyPerCarton = undefined; 
    }
    setFormProducts(updated);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{suppliers.length} {t('suppliers.title').toLowerCase()}</p>
        <button onClick={openNewForm} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-lg">{t('suppliers.add')}</button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-semibold">{t('suppliers.empty')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('suppliers.empty_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}>
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center"><Building2 size={20} className="text-emerald-600" /></div>
                  <div>
                    <p className="font-bold text-slate-900">{supplier.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {supplier.phone && <span className="text-xs text-slate-500">📞 {supplier.phone}</span>}
                      <span className="text-xs text-slate-400">{supplier.products.length} {t('suppliers.products_count', { count: supplier.products.length })}</span>
                    </div>
                  </div>
                  <div className="ml-auto">{expandedId === supplier.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </button>
                <div className="flex items-center gap-2 ml-2">
                  <button onClick={() => openEditForm(supplier)} className="p-2 rounded-lg bg-violet-50 text-violet-700"><Edit3 size={15} /></button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
              {expandedId === supplier.id && supplier.products.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  {supplier.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-2">{t('suppliers.notes')}: {supplier.notes}</p>}
                  <div className="space-y-2">
                    {supplier.products.map((sp, i) => (
                      <div key={i} className="bg-white rounded-xl border p-3 flex justify-between text-sm">
                        <div>
                          <p className="font-semibold">{sp.productName}</p>
                          <p className="text-xs text-slate-500">
                            {sp.unitType === 'carton' ? `${t('suppliers.carton')} ×${sp.qtyPerCarton || '?'}` : t('suppliers.unit')} 
                            · {sp.category || t('suppliers.other')}
                            {sp.unitType === 'carton' && sp.pricePerCarton && (
                              <span className="ml-1 text-emerald-600 font-bold">{fmt(sp.pricePerCarton)} F/{t('suppliers.carton').toLowerCase()}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{fmt(sp.pricePerUnit)} F</p>
                          <p className="text-xs text-slate-400">/ {sp.unitType === 'carton' ? t('units.unit') : t('units.unit')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between p-5 border-b">
              <div><h3 className="font-bold text-lg">{editingSupplier ? t('suppliers.edit') : t('suppliers.add')} {t('suppliers.title').toLowerCase()}</h3><p className="text-xs text-slate-500">{t('suppliers.saved_local')}</p></div>
              <button onClick={() => setShowForm(false)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <input type="text" placeholder={t('suppliers.name_placeholder')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200" />
              <input type="tel" placeholder={t('suppliers.phone_placeholder')} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200" />
              <input type="text" placeholder={t('suppliers.notes_placeholder')} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200" />
              <div className="border-t pt-3">
                <div className="flex justify-between mb-3"><p className="font-semibold text-sm">{t('suppliers.products')}</p><button onClick={() => setFormProducts([...formProducts, { ...emptyProduct }])} className="text-emerald-600 text-sm font-semibold">{t('suppliers.add_product')}</button></div>
                {formProducts.map((fp, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 mt-2 space-y-2">
                    <select value={fp.productId} onChange={e => linkProductFromCatalog(idx, e.target.value)} className="w-full p-2 rounded-lg border text-sm bg-white">
                      <option value="">{t('suppliers.catalog_link')}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.image} {p.name}</option>)}
                    </select>
                    <input type="text" placeholder={t('suppliers.product_name')} value={fp.productName} onChange={e => updateFormProduct(idx, 'productName', e.target.value)} className="w-full p-2 rounded-lg border text-sm" />
                    
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">{t('suppliers.category')}</label>
                      <select value={fp.category || ''} onChange={e => updateFormProduct(idx, 'category', e.target.value)} className="w-full p-2 rounded-lg border text-sm bg-white capitalize">
                        <option value="">{t('suppliers.select_category')}</option>
                        {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                      </select>
                    </div>
                    
                    <div className="flex gap-2">
                      <button onClick={() => updateFormProduct(idx, 'unitType', 'unité')} className={cn('flex-1 py-2 rounded-lg border text-sm', fp.unitType === 'unité' ? 'bg-emerald-100 border-emerald-400 font-semibold' : 'bg-white')}>{t('suppliers.unit')}</button>
                      <button onClick={() => updateFormProduct(idx, 'unitType', 'carton')} className={cn('flex-1 py-2 rounded-lg border text-sm', fp.unitType === 'carton' ? 'bg-emerald-100 border-emerald-400 font-semibold' : 'bg-white')}>{t('suppliers.carton')}</button>
                    </div>
                    
                    {fp.unitType === 'unité' ? (
                      <input type="number" placeholder={t('suppliers.price_unit')} value={fp.pricePerUnit || ''} onChange={e => updateFormProduct(idx, 'pricePerUnit', Number(e.target.value))} className="w-full p-2 rounded-lg border text-sm" />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" placeholder={t('suppliers.price_carton')} value={fp.pricePerCarton || ''} onChange={e => updateFormProduct(idx, 'pricePerCarton', Number(e.target.value))} className="p-2 rounded-lg border text-sm" />
                        <input type="number" placeholder={t('suppliers.qty_per_carton')} value={fp.qtyPerCarton || ''} onChange={e => updateFormProduct(idx, 'qtyPerCarton', Number(e.target.value))} className="p-2 rounded-lg border text-sm" />
                      </div>
                    )}
                    {formProducts.length > 1 && <button onClick={() => setFormProducts(formProducts.filter((_, i) => i !== idx))} className="text-red-500 text-xs font-semibold">{t('suppliers.remove_product')}</button>}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium">{t('actions.cancel')}</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold">{t('actions.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}