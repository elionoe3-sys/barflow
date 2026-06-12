// Reappro.tsx - Version avec universalSync
import { useState, useEffect, useMemo } from 'react';
import {
  Truck, Building2, Phone, Package, Plus, X, Edit3, Trash2,
  ChevronDown, ChevronUp, Check, LayoutGrid, ShoppingCart,
  Clock, History, Users, Download, Filter, CalendarDays,
  PackageCheck, AlertCircle, TrendingUp, DollarSign, BarChart3,
  Award, Target, Zap, Crown, Activity, PieChart as PieChartIcon,
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

// ── Types ─────────────────────────────────────────────────────
export interface SupplierProduct {
  productId: string;
  productName: string;
  unitType: 'unité' | 'carton';
  pricePerUnit: number;
  pricePerCarton?: number;
  qtyPerCarton?: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  products: SupplierProduct[];
  createdAt: string;
  notes?: string;
}

export interface ReapproOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
}

export interface ReapproOrder {
  id: string;
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  items: ReapproOrderItem[];
  totalAmount: number;
  status: 'brouillon' | 'envoyée' | 'reçue' | 'annulée';
  createdAt: string;
  receivedAt?: string;
  notes?: string;
}

// ── Store ─────────────────────────────────────────────────────
function loadReapproOrders(): ReapproOrder[] {
  try {
    const saved = localStorage.getItem('barflow_reappro_orders');
    return saved ? JSON.parse(saved) : generateDemoOrders();
  } catch { return []; }
}
function saveReapproOrders(orders: ReapproOrder[]) {
  localStorage.setItem('barflow_reappro_orders', JSON.stringify(orders));
}

function generateDemoOrders(): ReapproOrder[] {
  const now = new Date();
  const demo: ReapproOrder[] = [];
  const suppliers = ['Coca Cola Sénégal', 'Les Vins du Monde', 'SOBODI', 'Diageo Sénégal'];
  const products = [
    { id: 'p1', name: 'Flag Spéciale', price: 700, unit: 'bouteilles' },
    { id: 'p2', name: 'Gazelle', price: 600, unit: 'bouteilles' },
    { id: 'p7', name: 'Vin Rouge Toubab', price: 2500, unit: 'bouteilles' },
    { id: 'p9', name: 'Coca Cola', price: 450, unit: 'bouteilles' },
    { id: 'p12', name: 'Whisky Johnnie', price: 6000, unit: 'bouteilles' },
    { id: 'p13', name: 'Gin Gordon', price: 5000, unit: 'bouteilles' },
  ];
  const statuses: ReapproOrder['status'][] = ['reçue', 'reçue', 'reçue', 'envoyée', 'reçue'];
  for (let i = 0; i < 12; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (i * 7 + Math.floor(Math.random() * 5)));
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedProds = [...products].sort(() => Math.random() - 0.5).slice(0, numItems);
    const items: ReapproOrderItem[] = selectedProds.map(p => {
      const qty = Math.floor(Math.random() * 48) + 12;
      return { productId: p.id, productName: p.name, quantity: qty, unitPrice: p.price, totalPrice: qty * p.price, unit: p.unit };
    });
    const total = items.reduce((s, it) => s + it.totalPrice, 0);
    const receivedAt = statuses[i % statuses.length] === 'reçue' ? new Date(date.getTime() + 86400000 * 2).toISOString() : undefined;
    demo.push({
      id: `CMD-${String(i + 1).padStart(3, '0')}`,
      supplierName: suppliers[i % suppliers.length],
      items,
      totalAmount: total,
      status: statuses[i % statuses.length],
      createdAt: date.toISOString(),
      receivedAt,
    });
  }
  return demo.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

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

const gradientMap = {
  emerald: 'from-emerald-500 to-teal-600',
  violet: 'from-violet-500 to-purple-600',
  blue: 'from-blue-500 to-cyan-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-pink-600',
};

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
};

function AnimatedKpiCard({ icon, label, value, change, positive, color, delay = 0 }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  color: 'emerald' | 'violet' | 'blue' | 'amber' | 'rose';
  delay?: number;
}) {
  const getGradient = (c: string) => {
    const gradients: Record<string, string> = {
      emerald: 'from-emerald-500 to-teal-600',
      violet: 'from-violet-500 to-purple-600',
      blue: 'from-blue-500 to-cyan-600',
      amber: 'from-amber-500 to-orange-600',
      rose: 'from-rose-500 to-pink-600',
    };
    return gradients[c] || gradients.emerald;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-xl transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn(
          "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform group-hover:scale-105",
          getGradient(color)
        )}>
          <div className="text-white">{icon}</div>
        </div>
        {change && (
          <span className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1',
            positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
          )}>
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
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-xl p-3">
        <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              <span className="text-slate-600">{p.name}:</span>
            </div>
            <span className="font-bold text-slate-900">
              {typeof p.value === 'number' ? fmt(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ── Composant principal ───────────────────────────────────────
export function Reappro() {
  const [activeTab, setActiveTab] = useState<ReapproTab>('overview');
  const [orders, setOrders] = useState<ReapproOrder[]>(loadReapproOrders);
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);

  // Données produits depuis universalSync (pour le catalogue)
  const products = useLiveQuery(() => universalSync.getProduits(), []);

  const refreshData = () => {
    setOrders(loadReapproOrders());
    setSuppliers(loadSuppliers());
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 m-4 lg:m-6 p-6 lg:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">Réapprovisionnement</h1>
            <p className="text-emerald-100 mt-1 flex items-center gap-2">
              <Activity size={14} />
              Gestion des commandes fournisseurs
            </p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 pt-5">
        {activeTab === 'overview' && <OverviewTab orders={orders} suppliers={suppliers} />}
        {activeTab === 'order' && <OrderTab suppliers={suppliers} products={products || []} onOrderCreated={refreshData} />}
        {activeTab === 'in_progress' && <InProgressTab onUpdate={refreshData} />}
        {activeTab === 'history' && <HistoryTab orders={orders} suppliers={suppliers} />}
        {activeTab === 'suppliers' && <SuppliersTab suppliers={suppliers} onUpdate={refreshData} />}
      </div>
    </div>
  );
}

// ── ONGLET VUE D'ENSEMBLE ───────────────────────────────────────────
function OverviewTab({ orders, suppliers }: { orders: ReapproOrder[]; suppliers: Supplier[] }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const receivedOrders = orders.filter(o => o.status === 'reçue');
  const monthlyOrders = receivedOrders.filter(o => {
    const d = new Date(o.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const yearlyOrders = receivedOrders.filter(o => new Date(o.createdAt).getFullYear() === currentYear);

  const totalAchats = receivedOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalAchatsMensuel = monthlyOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalAchatsAnnuel = yearlyOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalArticles = receivedOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);

  const lastOrder = receivedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const ordersWithDelay = receivedOrders.filter(o => o.receivedAt);
  const avgDeliveryDays = ordersWithDelay.length > 0
    ? Math.round(ordersWithDelay.reduce((sum, o) => {
        const created = new Date(o.createdAt);
        const received = new Date(o.receivedAt!);
        const days = (received.getTime() - created.getTime()) / (1000 * 3600 * 24);
        return sum + days;
      }, 0) / ordersWithDelay.length)
    : 0;

  const supplierStatsMap = new Map<string, { totalAmount: number; orderCount: number; lastOrderDate: Date | null }>();
  
  receivedOrders.forEach(order => {
    const existing = supplierStatsMap.get(order.supplierName);
    const orderDate = new Date(order.createdAt);
    if (existing) {
      existing.totalAmount += order.totalAmount;
      existing.orderCount += 1;
      if (!existing.lastOrderDate || orderDate > existing.lastOrderDate) {
        existing.lastOrderDate = orderDate;
      }
    } else {
      supplierStatsMap.set(order.supplierName, {
        totalAmount: order.totalAmount,
        orderCount: 1,
        lastOrderDate: orderDate,
      });
    }
  });

  const supplierStats = Array.from(supplierStatsMap.entries()).map(([name, data]) => ({
    name,
    totalAmount: data.totalAmount,
    orderCount: data.orderCount,
    lastOrderDate: data.lastOrderDate,
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const monthOrders = receivedOrders.filter(o => {
      const d = new Date(o.createdAt);
      return d.getMonth() === i && d.getFullYear() === currentYear;
    });
    const total = monthOrders.reduce((s, o) => s + o.totalAmount, 0);
    return { month: new Date(currentYear, i, 1).toLocaleString('fr-FR', { month: 'short' }), montant: total };
  });

  const chartColors = ['#10B981', '#8B5CF6', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];
  const supplierChartData = supplierStats.slice(0, 6).map((s, idx) => ({
    name: s.name.length > 15 ? s.name.substring(0, 12) + '...' : s.name,
    montant: s.totalAmount,
    color: chartColors[idx % chartColors.length]
  }));
  const hasChartData = supplierChartData.length > 0 && supplierChartData.some(d => d.montant > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedKpiCard icon={<DollarSign size={20} />} label="Total achats" value={`${fmt(totalAchats)} FCFA`} color="emerald" />
        <AnimatedKpiCard icon={<ShoppingCart size={20} />} label="Commandes reçues" value={fmt(receivedOrders.length)} color="violet" />
        <AnimatedKpiCard icon={<Package size={20} />} label="Articles commandés" value={fmt(totalArticles)} color="blue" />
        <AnimatedKpiCard icon={<Clock size={20} />} label="Délai livraison moyen" value={`${avgDeliveryDays} jours`} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
              <BarChart3 size={20} className="text-emerald-500" />
              Achats mensuels {currentYear}
            </h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={(v) => fmtCompact(v)} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<StyledTooltip />} />
                <Area type="monotone" dataKey="montant" stroke="#10B981" strokeWidth={2} fill="url(#monthlyGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
              <PieChartIcon size={20} className="text-violet-500" />
              Répartition par fournisseur
            </h2>
          </div>
          <div className="h-64">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={supplierChartData}
                    dataKey="montant"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ name, percent }) => {
  const pct = percent || 0;
  return pct > 0.05 ? `${name} ${Math.round(pct * 100)}%` : '';
}}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {supplierChartData.map((item, idx) => (
                      <Cell key={idx} fill={item.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<StyledTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <PieChartIcon size={48} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucune donnée disponible</p>
                <p className="text-xs mt-1">Ajoutez des commandes reçues pour voir la répartition</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {lastOrder && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={20} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900 text-lg">📦 Dernière commande reçue</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-600">Commande</p>
              <p className="text-xl font-bold text-slate-900">{lastOrder.id}</p>
              <p className="text-sm text-slate-500 mt-1">{lastOrder.supplierName}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-600">Date</p>
              <p className="text-lg font-semibold text-slate-800">
                {new Date(lastOrder.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-600">Montant</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(lastOrder.totalAmount)} FCFA</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-600">Articles</p>
              <p className="text-lg font-semibold text-slate-800">{lastOrder.items.reduce((s, i) => s + i.quantity, 0)} unités</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
            <Building2 size={20} className="text-emerald-500" />
            Détail par fournisseur
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-4 text-left font-semibold text-slate-600">Fournisseur</th>
                <th className="p-4 text-center font-semibold text-slate-600">Nb commandes</th>
                <th className="p-4 text-right font-semibold text-slate-600">Coût total (FCFA)</th>
                <th className="p-4 text-center font-semibold text-slate-600">Dernière livraison</th>
              </tr>
            </thead>
            <tbody>
              {supplierStats.map((supplier, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Building2 size={14} className="text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-800">{supplier.name}</span>
                    </div>
                   </td>
                  <td className="p-4 text-center font-medium text-slate-700">{supplier.orderCount}</td>
                  <td className="p-4 text-right font-bold text-emerald-600">{fmt(supplier.totalAmount)} F</td>
                  <td className="p-4 text-center text-slate-600">
                    {supplier.lastOrderDate
                      ? new Date(supplier.lastOrderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                      : '-'}
                   </td>
                 </tr>
              ))}
              {supplierStats.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Aucune commande reçue pour le moment</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={18} className="text-violet-600" />
            <h3 className="font-semibold text-slate-800">📅 Ce mois-ci</h3>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Total achats</span>
            <span className="text-xl font-bold text-violet-600">{fmt(totalAchatsMensuel)} FCFA</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-slate-600">Commandes reçues</span>
            <span className="text-lg font-semibold text-slate-700">{monthlyOrders.length}</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-slate-800">📆 Cette année</h3>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Total achats</span>
            <span className="text-xl font-bold text-emerald-600">{fmt(totalAchatsAnnuel)} FCFA</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-slate-600">Commandes reçues</span>
            <span className="text-lg font-semibold text-slate-700">{yearlyOrders.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ONGLET COMMANDE ───────────────────────────────────────────
function OrderTab({ suppliers, products, onOrderCreated }: { suppliers: Supplier[]; products: any[]; onOrderCreated: () => void }) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || null;

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setQuantities({});
    setSaveSuccess(false);
  };

  const supplierCatalogProducts = selectedSupplier
    ? selectedSupplier.products.map(sp => ({ sp, catProd: products.find(p => p.id === sp.productId) }))
    : [];

  const total = supplierCatalogProducts.reduce((sum, { sp }) => {
    const qty = quantities[sp.productId] || 0;
    return sum + qty * sp.pricePerUnit;
  }, 0);

  const itemsCount = Object.values(quantities).filter(q => q > 0).length;

  const handleQtyChange = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const handleSave = () => {
    if (!selectedSupplier) return;
    const items: ReapproOrderItem[] = supplierCatalogProducts
      .filter(({ sp }) => (quantities[sp.productId] || 0) > 0)
      .map(({ sp, catProd }) => {
        const qty = quantities[sp.productId];
        return {
          productId: sp.productId,
          productName: sp.productName,
          quantity: qty,
          unitPrice: sp.pricePerUnit,
          totalPrice: qty * sp.pricePerUnit,
          unit: catProd?.stockUnit || 'unités',
        };
      });

    if (items.length === 0) return;

    const newOrder: ReapproOrder = {
      id: `CMD-${Date.now().toString(36).toUpperCase()}`,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      supplierPhone: selectedSupplier.phone,
      items,
      totalAmount: items.reduce((s, i) => s + i.totalPrice, 0),
      status: 'envoyée',
      createdAt: new Date().toISOString(),
    };

    const all = loadReapproOrders();
    saveReapproOrders([newOrder, ...all]);
    onOrderCreated();
    setSaveSuccess(true);
    setQuantities({});
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-2">Fournisseur</label>
        <select
          value={selectedSupplierId}
          onChange={e => handleSupplierChange(e.target.value)}
          className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          <option value="">— Sélectionner un fournisseur —</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>
          ))}
        </select>
        {suppliers.length === 0 && (
          <p className="text-xs text-amber-600 mt-2 font-medium">⚠️ Aucun fournisseur enregistré. Ajoutez-en dans l'onglet "Fournisseurs".</p>
        )}
      </div>

      {selectedSupplier && (
        <>
          {supplierCatalogProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-semibold">Aucun produit lié au catalogue</p>
              <p className="text-xs text-slate-400 mt-1">Modifiez ce fournisseur et liez ses produits au catalogue.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {supplierCatalogProducts.map(({ sp, catProd }) => {
                const qty = quantities[sp.productId] || 0;
                return (
                  <div key={sp.productId} className={cn(
                    'bg-white rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all',
                    qty > 0 ? 'border-emerald-400 bg-emerald-50/40 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  )}>
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: catProd ? `${catProd.color}20` : '#f1f5f9' }}>
                        {catProd?.image || '📦'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900">{sp.productName}</p>
                        {catProd && <p className="text-[10px] text-slate-400">Stock: {catProd.stock}</p>}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-emerald-700">{fmt(sp.pricePerUnit)} F</p>
                      <p className="text-[10px] text-slate-400">/ unité</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleQtyChange(sp.productId, String(Math.max(0, qty - 1)))} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold">−</button>
                      <input type="number" min={0} value={qty === 0 ? '' : qty} placeholder="0" onChange={e => handleQtyChange(sp.productId, e.target.value)} className="flex-1 h-8 rounded-lg border border-slate-200 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/40" />
                      <button onClick={() => handleQtyChange(sp.productId, String(qty + 1))} className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold">+</button>
                    </div>
                    {qty > 0 && <p className="text-[11px] font-bold text-center text-emerald-700 bg-emerald-100 rounded-lg py-1">= {fmt(qty * sp.pricePerUnit)} F</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky bottom-0 shadow-lg">
            {saveSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                <Check size={16} className="text-emerald-600" />
                <p className="text-sm text-emerald-700 font-semibold">✅ Commande enregistrée !</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-slate-500">Récapitulatif</p>
                <p className="text-sm text-slate-700"><span className="font-bold">{itemsCount} produit(s)</span> · {Object.values(quantities).reduce((s, q) => s + (q || 0), 0)} unités</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total estimé</p>
                  <p className="text-xl font-black text-slate-900">{fmt(total)} FCFA</p>
                </div>
                <button onClick={handleSave} disabled={itemsCount === 0} className={cn(
                  'px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all',
                  itemsCount > 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}>
                  <Check size={18} /> Enregistrer
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── ONGLET EN COURS ───────────────────────────────────────────
function InProgressTab({ onUpdate }: { onUpdate: () => void }) {
  const [orders, setOrders] = useState<ReapproOrder[]>(() => loadReapproOrders().filter(o => o.status === 'envoyée' || o.status === 'brouillon'));
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<ReapproOrder | null>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({});
  const [success, setSuccess] = useState(false);

  const allOrders = loadReapproOrders();
  const inProgressOrders = allOrders.filter(o => o.status === 'envoyée' || o.status === 'brouillon');
  const allSuppliers = [...new Set(inProgressOrders.map(o => o.supplierName))];
  const filteredOrders = inProgressOrders.filter(o => selectedSupplier === 'all' || o.supplierName === selectedSupplier);

  // Produits depuis universalSync pour mettre à jour les stocks
  const products = useLiveQuery(() => universalSync.getProduits(), []);

  const openOrder = (order: ReapproOrder) => {
    setSelectedOrder(order);
    const init: Record<number, string> = {};
    order.items.forEach((_, i) => { init[i] = ''; });
    setReceivedQtys(init);
    setSuccess(false);
  };

  const handleConfirmReceived = async () => {
    if (!selectedOrder) return;
    
    // Mettre à jour les stocks via universalSync
    for (const [i, item] of selectedOrder.items.entries()) {
      const qty = parseInt(receivedQtys[i] || '0');
      if (qty <= 0 || !item.productId) continue;
      const prod = products?.find(p => p.id === item.productId);
      if (prod) {
        await universalSync.updateProduit(prod.id, { ...prod, stock: prod.stock + qty });
      }
    }
    
    const all = loadReapproOrders();
    const updated = all.map(o => o.id === selectedOrder.id ? { ...o, status: 'reçue' as const, receivedAt: new Date().toISOString() } : o);
    saveReapproOrders(updated);
    setSuccess(true);
    setTimeout(() => {
      setSelectedOrder(null);
      setSuccess(false);
      setOrders(loadReapproOrders().filter(o => o.status === 'envoyée' || o.status === 'brouillon'));
      onUpdate();
    }, 1800);
  };

  const totalReceived = selectedOrder ? selectedOrder.items.reduce((s, item, i) => s + (parseInt(receivedQtys[i] || '0') || 0) * item.unitPrice, 0) : 0;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-slate-700">{filteredOrders.length} commande(s) en attente</span>
        </div>
        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
          <option value="all">Tous les fournisseurs</option>
          {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4"><PackageCheck size={28} className="text-emerald-400" /></div>
          <p className="text-slate-600 font-semibold">Aucune commande en cours</p>
          <p className="text-sm text-slate-400 mt-1">Toutes les commandes ont été reçues.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <button key={order.id} onClick={() => openOrder(order)} className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{order.id}</p>
                  <p className="text-xs text-slate-500">{order.supplierName} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{fmt(order.totalAmount)} F</p>
                  <p className="text-[10px] text-slate-400">{order.items.reduce((s, i) => s + i.quantity, 0)} unités</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div><h3 className="text-base font-bold text-slate-900">{selectedOrder.id}</h3><p className="text-xs text-slate-500">{selectedOrder.supplierName}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400"><X size={20} /></button>
            </div>
            {success ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4"><PackageCheck size={36} className="text-emerald-600" /></div>
                <p className="text-xl font-bold text-slate-900">Commande reçue !</p>
                <p className="text-sm text-slate-500 mt-2">Les stocks ont été mis à jour.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex justify-between">
                        <p className="font-semibold text-slate-800">{item.productName}</p>
                        <p className="text-sm font-bold text-emerald-600">{fmt(item.unitPrice)} F × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-xs text-slate-600">Qté reçue:</label>
                        <input type="number" min={0} max={item.quantity * 2} value={receivedQtys[i] || ''} onChange={e => setReceivedQtys(prev => ({ ...prev, [i]: e.target.value }))} className="w-24 p-2 rounded-lg border border-slate-200 text-sm text-center" />
                        <span className="text-xs text-slate-500">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-900 rounded-2xl p-4 flex justify-between text-white">
                    <span>Total reçu</span>
                    <span className="text-lg font-bold text-emerald-400">{fmt(totalReceived)} FCFA</span>
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 flex gap-3">
                  <button onClick={() => setSelectedOrder(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600">Annuler</button>
                  <button onClick={handleConfirmReceived} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold">Commande reçue</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ONGLET HISTORIQUE ─────────────────────────────────────────
function HistoryTab({ orders, suppliers }: { orders: ReapproOrder[]; suppliers: Supplier[] }) {
  const [filterStatus, setFilterStatus] = useState<ReapproOrder['status'] | 'all'>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const allSuppliers = [...new Set(orders.map(o => o.supplierName))];

  const filteredOrders = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (filterSupplier !== 'all' && o.supplierName !== filterSupplier) return false;
    return true;
  });

  const statusLabel = (s: ReapproOrder['status']) => ({ brouillon: 'Brouillon', envoyée: 'Envoyée', reçue: 'Reçue', annulée: 'Annulée' }[s]);
  const statusColor = (s: ReapproOrder['status']) => ({
    brouillon: 'bg-slate-100 text-slate-600', envoyée: 'bg-blue-100 text-blue-700',
    reçue: 'bg-emerald-100 text-emerald-700', annulée: 'bg-red-100 text-red-600',
  }[s]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
          <option value="all">Tous les statuts</option>
          <option value="reçue">Reçue</option>
          <option value="envoyée">Envoyée</option>
          <option value="brouillon">Brouillon</option>
        </select>
        <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
          <option value="all">Tous les fournisseurs</option>
          {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h2 className="font-semibold text-slate-900">📋 Historique des commandes</h2>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16"><AlertCircle size={40} className="mx-auto mb-3 text-slate-300" /><p className="text-slate-500">Aucune commande</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map(order => (
              <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{order.id}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor(order.status))}>{statusLabel(order.status)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{order.supplierName} · {new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{fmt(order.totalAmount)} F</p>
                  <p className="text-[10px] text-slate-400">{order.items.reduce((s, i) => s + i.quantity, 0)} unités</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ONGLET FOURNISSEURS ───────────────────────────────────────────
function SuppliersTab({ suppliers, onUpdate }: { suppliers: Supplier[]; onUpdate: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [formProducts, setFormProducts] = useState<SupplierProduct[]>([{ productId: '', productName: '', unitType: 'unité', pricePerUnit: 0 }]);

  // Produits depuis universalSync pour le catalogue
  const products = useLiveQuery(() => universalSync.getProduits(), []);

  const emptyProduct: SupplierProduct = { productId: '', productName: '', unitType: 'unité', pricePerUnit: 0 };

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

  const handleSave = () => {
    if (!form.name.trim()) return;
    const validProducts = formProducts.filter(p => p.productName.trim());
    let updatedSuppliers: Supplier[];
    if (editingSupplier) {
      updatedSuppliers = suppliers.map(s => s.id === editingSupplier.id ? { ...s, name: form.name, phone: form.phone, notes: form.notes, products: validProducts } : s);
    } else {
      const newSupplier: Supplier = { id: `sup-${Date.now()}`, name: form.name, phone: form.phone, notes: form.notes, products: validProducts, createdAt: new Date().toISOString() };
      updatedSuppliers = [newSupplier, ...suppliers];
    }
    saveSuppliers(updatedSuppliers);
    onUpdate();
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    const updated = suppliers.filter(s => s.id !== id);
    saveSuppliers(updated);
    onUpdate();
  };

  const linkProductFromCatalog = (idx: number, productId: string) => {
    const catalogProd = products?.find(p => p.id === productId);
    const updated = [...formProducts];
    if (catalogProd) updated[idx] = { ...updated[idx], productId, productName: catalogProd.name };
    else updated[idx] = { ...updated[idx], productId: '', productName: '' };
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
    if (field === 'unitType' && value === 'unité') { updated[idx].pricePerCarton = undefined; updated[idx].qtyPerCarton = undefined; }
    setFormProducts(updated);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{suppliers.length} fournisseur(s)</p>
        <button onClick={openNewForm} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-lg">+ Nouveau fournisseur</button>
      </div>
      {suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center"><Building2 size={40} className="mx-auto mb-3 text-slate-300" /><p>Aucun fournisseur</p></div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}>
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center"><Building2 size={20} className="text-emerald-600" /></div>
                  <div><p className="font-bold text-slate-900">{supplier.name}</p><div className="flex items-center gap-3 mt-0.5">{supplier.phone && <span className="text-xs text-slate-500">📞 {supplier.phone}</span>}<span className="text-xs text-slate-400">{supplier.products.length} produit(s)</span></div></div>
                  <div className="ml-auto">{expandedId === supplier.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                </button>
                <div className="flex items-center gap-2 ml-2"><button onClick={() => openEditForm(supplier)} className="p-2 rounded-lg bg-violet-50 text-violet-700"><Edit3 size={15} /></button><button onClick={() => handleDelete(supplier.id)} className="p-2 rounded-lg bg-red-50 text-red-600"><Trash2 size={15} /></button></div>
              </div>
              {expandedId === supplier.id && supplier.products.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  {supplier.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-2">📝 {supplier.notes}</p>}
                  <div className="space-y-2">{supplier.products.map((sp, i) => <div key={i} className="bg-white rounded-xl border p-3 flex justify-between"><div><p className="font-semibold">{sp.productName}</p><p className="text-xs text-slate-500">{sp.unitType === 'carton' ? `Carton ×${sp.qtyPerCarton}` : 'Unité'}</p></div><div className="text-right"><p className="font-bold text-emerald-600">{fmt(sp.pricePerUnit)} F</p><p className="text-xs text-slate-400">/ unité</p></div></div>)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between p-5 border-b"><div><h3 className="font-bold">{editingSupplier ? 'Modifier' : 'Nouveau'} fournisseur</h3><p className="text-xs text-slate-500">Remplissez les informations</p></div><button onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <input type="text" placeholder="Nom du fournisseur *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200" />
              <input type="tel" placeholder="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200" />
              <input type="text" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200" />
              <div className="border-t pt-3"><div className="flex justify-between"><p className="font-semibold">Produits</p><button onClick={() => setFormProducts([...formProducts, { ...emptyProduct }])} className="text-emerald-600 text-sm">+ Ajouter</button></div>
                {formProducts.map((fp, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 mt-2 space-y-2">
                    <select value={fp.productId} onChange={e => linkProductFromCatalog(idx, e.target.value)} className="w-full p-2 rounded-lg border"><option value="">Lier au catalogue</option>{(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    <input type="text" placeholder="Nom produit" value={fp.productName} onChange={e => updateFormProduct(idx, 'productName', e.target.value)} className="w-full p-2 rounded-lg border" />
                    <div className="flex gap-2"><button onClick={() => updateFormProduct(idx, 'unitType', 'unité')} className={cn('flex-1 py-2 rounded-lg border', fp.unitType === 'unité' ? 'bg-emerald-100 border-emerald-400' : 'bg-white')}>Unité</button><button onClick={() => updateFormProduct(idx, 'unitType', 'carton')} className={cn('flex-1 py-2 rounded-lg border', fp.unitType === 'carton' ? 'bg-emerald-100 border-emerald-400' : 'bg-white')}>Carton</button></div>
                    {fp.unitType === 'unité' ? <input type="number" placeholder="Prix unité (FCFA)" value={fp.pricePerUnit || ''} onChange={e => updateFormProduct(idx, 'pricePerUnit', Number(e.target.value))} className="w-full p-2 rounded-lg border" /> : (
                      <div className="grid grid-cols-2 gap-2"><input type="number" placeholder="Prix carton" value={fp.pricePerCarton || ''} onChange={e => updateFormProduct(idx, 'pricePerCarton', Number(e.target.value))} className="p-2 rounded-lg border" /><input type="number" placeholder="Unités/carton" value={fp.qtyPerCarton || ''} onChange={e => updateFormProduct(idx, 'qtyPerCarton', Number(e.target.value))} className="p-2 rounded-lg border" /></div>
                    )}
                    {formProducts.length > 1 && <button onClick={() => setFormProducts(formProducts.filter((_, i) => i !== idx))} className="text-red-500 text-sm">Supprimer</button>}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3"><button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border">Annuler</button><button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold">Enregistrer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}