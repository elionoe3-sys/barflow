// Dashboard.tsx - VERSION DONNÉES RÉELLES
// Remplace entièrement les données statiques de data.ts par les vraies données de orderStore
import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, Users, DollarSign, ShoppingBag, Clock,
  ArrowUp, ArrowDown, X, AlertCircle, CheckCircle,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { cn } from '@/utils/cn';
import { getCriticalProducts } from '@/utils/stockPrediction';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '@/utils/db';
import { useTranslation } from 'react-i18next';
import { refreshCategoryMaps, getCategories } from '@/utils/productStore';
import {
  useRealDailyStats,
  useRealPaymentStats,
  useRealProductSales,
  useTodayStats,
} from '@/utils/orderStore';

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '15' | '30'>('7');
  const [barName, setBarName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [criticalProducts, setCriticalProducts] = useState<any[]>([]);
  const [showEstimationDetails, setShowEstimationDetails] = useState(false);

  // ── Données réelles depuis IndexedDB ────────────────────────
  const products = useLiveQuery(() => universalSync.getProduits(), []);
  const todayStats = useTodayStats();
  const daysForPeriod = selectedPeriod === '7' ? 7 : selectedPeriod === '15' ? 15 : 30;
  const realDailyStats = useRealDailyStats(daysForPeriod);
  const realPaymentStats = useRealPaymentStats(daysForPeriod);
  const realProductSales = useRealProductSales(daysForPeriod);

  const hasRealData = (realDailyStats?.length ?? 0) > 0;

  useEffect(() => {
    getSetting('restaurant_info').then(info => {
      if (info?.value && typeof info.value === 'object') {
        const name = (info.value as any).name;
        if (name) setBarName(name);
      }
    });
  }, []);

  useEffect(() => { refreshCategoryMaps(); }, []);

  useEffect(() => {
    if (products !== undefined) {
      if (products && products.length > 0) {
        setCriticalProducts(getCriticalProducts(products as any));
      }
      setIsLoading(false);
    }
  }, [products]);

  // ── KPIs calculés depuis les vraies données ──────────────────
  const totalCA = useMemo(() =>
    (realDailyStats || []).reduce((s, d) => s + d.ca, 0), [realDailyStats]);
  const totalClients = useMemo(() =>
    (realDailyStats || []).reduce((s, d) => s + d.clients, 0), [realDailyStats]);
  const avgTicket = useMemo(() =>
    totalClients > 0 ? Math.round(totalCA / totalClients) : 0, [totalCA, totalClients]);
  const totalMarge = useMemo(() =>
    (realDailyStats || []).reduce((s, d) => s + d.marge, 0), [realDailyStats]);

  // Variations 1ère moitié vs 2ème moitié de la période
  const halfLen = Math.floor((realDailyStats || []).length / 2);
  const prevCA = (realDailyStats || []).slice(0, halfLen).reduce((s, d) => s + d.ca, 0);
  const currCA = (realDailyStats || []).slice(halfLen).reduce((s, d) => s + d.ca, 0);
  const caChange = prevCA > 0 ? ((currCA - prevCA) / prevCA * 100) : 0;
  const prevClients = (realDailyStats || []).slice(0, halfLen).reduce((s, d) => s + d.clients, 0);
  const currClients = (realDailyStats || []).slice(halfLen).reduce((s, d) => s + d.clients, 0);
  const clientsChange = currClients - prevClients;

  // ── Données graphique CA ─────────────────────────────────────
  const chartData = useMemo(() => {
    if (!realDailyStats || realDailyStats.length === 0) return [];
    return realDailyStats.map(d => ({ date: d.date, ca: d.ca, marge: d.marge }));
  }, [realDailyStats]);

  // ── Top produits ─────────────────────────────────────────────
  const topProducts = useMemo(() => {
    if (!realProductSales || realProductSales.length === 0) return [];
    return [...realProductSales]
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 10)
      .map(ps => {
        const prod = (products || []).find(p => p.id === ps.productId);
        return { name: ps.productName, ventes: ps.quantity, ca: ps.ca, color: prod?.color || '#8B5CF6' };
      });
  }, [realProductSales, products]);

  // ── Répartition par catégorie ─────────────────────────────────
  const categoryData = useMemo(() => {
    if (!realProductSales || realProductSales.length === 0) return [];
    const categories = getCategories();
    const catMap: Record<string, { value: number; color: string; emoji: string }> = {};
    categories.forEach(cat => { catMap[cat.name] = { value: 0, color: cat.color, emoji: cat.emoji }; });
    realProductSales.forEach(ps => {
      const prod = (products || []).find(p => p.id === ps.productId);
      const cat = prod?.category || 'autres';
      if (!catMap[cat]) catMap[cat] = { value: 0, color: '#64748B', emoji: '📦' };
      catMap[cat].value += ps.quantity;
    });
    return Object.entries(catMap).filter(([, v]) => v.value > 0).map(([name, v]) => ({ name, ...v }));
  }, [realProductSales, products]);

  // ── Estimation soirée ─────────────────────────────────────────
  const today = new Date();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const nbJours = (realDailyStats || []).length || 1;
  const avgClientsPerDay = totalClients / nbJours;
  const estimatedClients = Math.round(isWeekend ? avgClientsPerDay * 1.4 : avgClientsPerDay);
  const estimatedCA = estimatedClients * (avgTicket || 0);

  // ── Tooltips ─────────────────────────────────────────────────
  const CATooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3">
        <p className="text-xs text-slate-500">
          {new Date(label).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
        </p>
        <p className="text-sm font-bold text-violet-700">{payload[0]?.value?.toLocaleString()} FCFA</p>
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3">
        <p className="text-sm font-semibold text-slate-900">{payload[0]?.name}</p>
        <p className="text-xs text-slate-500">{payload[0]?.value} unité(s)</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="page-header relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 lg:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {t('title')}
              </h1>
              {barName && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/20 text-white border border-white/30">
                  🍺 {barName}
                </span>
              )}
            </div>
            <p className="text-white/70 text-sm mt-1">
              {today.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {hasRealData ? (
                <>
                  <CheckCircle size={13} className="text-emerald-300" />
                  <span className="text-xs text-emerald-200 font-medium">
                    Données réelles — {realDailyStats?.length} jour(s) de ventes
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={13} className="text-amber-300" />
                  <span className="text-xs text-amber-200 font-medium">
                    Aucune vente — encaissez dans l'onglet Commandes
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['7', '15', '30'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  selectedPeriod === p
                    ? 'bg-white/20 text-white shadow-md'
                    : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20',
                )}
              >
                {p}j
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard icon={<DollarSign size={20} />} label={`CA (${selectedPeriod}j)`}
          value={`${totalCA.toLocaleString()} FCFA`}
          change={hasRealData ? `${caChange > 0 ? '+' : ''}${caChange.toFixed(1)}%` : '—'}
          positive={caChange >= 0} color="emerald" />
        <StatCard icon={<Users size={20} />} label="Clients"
          value={`${totalClients}`}
          change={hasRealData ? `${clientsChange >= 0 ? '+' : ''}${clientsChange}` : '—'}
          positive={clientsChange >= 0} color="violet" />
        <StatCard icon={<TrendingUp size={20} />} label="Ticket moyen"
          value={`${avgTicket.toLocaleString()} FCFA`}
          change={hasRealData ? 'réel' : '—'} positive={true} color="amber" />
        <StatCard icon={<ShoppingBag size={20} />} label="Marge (65%)"
          value={`${totalMarge.toLocaleString()} FCFA`}
          change={hasRealData ? 'estimée' : '—'} positive={true} color="rose" />
      </div>

      {/* ── Stats du jour ────────────────────────────────────────── */}
      {todayStats && todayStats.ca > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-emerald-600" />
            <h2 className="font-semibold text-emerald-800">Aujourd'hui — temps réel</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500">CA du jour</p>
              <p className="text-xl font-bold text-emerald-700">{todayStats.ca.toLocaleString()} F</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Commandes payées</p>
              <p className="text-xl font-bold text-violet-700">{todayStats.clients}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Ticket moyen</p>
              <p className="text-xl font-bold text-amber-700">
                {todayStats.clients > 0
                  ? Math.round(todayStats.ca / todayStats.clients).toLocaleString()
                  : 0} F
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Estimation soirée ────────────────────────────────────── */}
      {hasRealData && avgClientsPerDay > 0 && (
        <div
          className="bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-700 rounded-2xl p-5 lg:p-6 text-white cursor-pointer hover:shadow-2xl transition-all group"
          onClick={() => setShowEstimationDetails(true)}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-violet-300" />
            <h2 className="font-semibold">Estimation ce soir</h2>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
              basé sur {selectedPeriod}j réels
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full ml-auto group-hover:bg-white/30 transition-all">
              Voir détails →
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-violet-300 text-xs font-medium">Clients attendus</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{estimatedClients}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">
                {isWeekend ? '× 1.4 weekend' : 'jour de semaine'}
              </p>
            </div>
            <div>
              <p className="text-violet-300 text-xs font-medium">CA estimé</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{estimatedCA.toLocaleString()}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">FCFA</p>
            </div>
            <div>
              <p className="text-violet-300 text-xs font-medium">Moy. clients/jour</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{Math.round(avgClientsPerDay)}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">sur {nbJours}j</p>
            </div>
            <div>
              <p className="text-violet-300 text-xs font-medium">Ticket moyen réel</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{avgTicket.toLocaleString()}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">FCFA</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal estimation ─────────────────────────────────────── */}
      {showEstimationDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEstimationDetails(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Clock size={20} className="text-violet-600" /> Estimation de soirée
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basé sur {nbJours} jour(s) de données réelles
                </p>
              </div>
              <button onClick={() => setShowEstimationDetails(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                { label: '👥 Clients attendus', value: String(estimatedClients), color: 'bg-violet-50 text-violet-700' },
                { label: '💰 CA estimé', value: estimatedCA.toLocaleString() + ' F', color: 'bg-emerald-50 text-emerald-700' },
                { label: '🎯 Ticket moyen', value: avgTicket.toLocaleString() + ' F', color: 'bg-amber-50 text-amber-700' },
                { label: '📊 Jours analysés', value: String(nbJours), color: 'bg-blue-50 text-blue-700' },
              ].map((item, i) => (
                <div key={i} className={`rounded-xl p-3 text-center ${item.color}`}>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-2xl font-bold mt-1">{item.value}</p>
                </div>
              ))}
              <div className="col-span-2 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                <p className="font-semibold mb-1">📐 Méthode de calcul</p>
                <p>• Moyenne des clients sur {nbJours}j : {Math.round(avgClientsPerDay)}/jour</p>
                {isWeekend && <p>• Coefficient weekend appliqué : × 1.4</p>}
                <p>• CA estimé = {estimatedClients} clients × {avgTicket.toLocaleString()} F ticket moyen</p>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100">
              <button onClick={() => setShowEstimationDetails(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Graphiques ───────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Évolution CA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-sm">
              Évolution CA ({selectedPeriod}j)
            </h2>
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-medium',
              hasRealData ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
            )}>
              {hasRealData ? '✅ Données réelles' : '⚠️ Aucune vente'}
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={CATooltip} />
                  <Area type="monotone" dataKey="ca" stroke="#8B5CF6" strokeWidth={2}
                    fill="url(#caGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune vente enregistrée</p>
                <p className="text-xs mt-1">Encaissez dans l'onglet Commandes</p>
              </div>
            </div>
          )}
        </div>

        {/* Répartition par catégorie */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">
            Ventes par catégorie ({selectedPeriod}j)
          </h2>
          {categoryData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center h-auto sm:h-64 gap-4">
              <div className="w-full sm:w-1/2 h-48 sm:h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75} paddingAngle={3}
                      dataKey="value" labelLine={false}>
                      {categoryData.map((_entry, index) => (
                        <Cell key={index}
                          fill={categoryData[index]?.color || '#64748B'}
                          stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={PieTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {categoryData.map((cat, i) => {
                  const total = categoryData.reduce((s, c) => s + c.value, 0);
                  const pct = total > 0 ? ((cat.value / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.emoji}</span>
                        <span className="text-xs capitalize text-slate-600">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900">{cat.value}</span>
                        <span className="text-[10px] text-slate-400">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune vente enregistrée</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Top produits ─────────────────────────────────────────── */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">
            🏆 Top produits ({selectedPeriod}j) —{' '}
            <span className="text-emerald-600 font-normal">données réelles</span>
          </h2>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
            {topProducts.map((p, i) => {
              const maxVentes = topProducts[0]?.ventes || 1;
              const percentage = (p.ventes / maxVentes) * 100;
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0',
                    i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                    i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800' : 'bg-slate-400'
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: p.color || '#8B5CF6' }} />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 shrink-0">
                        {p.ventes} vente(s)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-violet-600 shrink-0">
                    {p.ca.toLocaleString()} F
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Moyens de paiement ───────────────────────────────────── */}
      {realPaymentStats && Object.keys(realPaymentStats).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">
            💳 Répartition des paiements ({selectedPeriod}j)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(realPaymentStats).map(([method, data]) => {
              const labels: Record<string, string> = {
                espèces: '💵 Espèces',
                wave: '📱 Wave',
                orange_money: '📱 Orange Money',
                carte: '💳 Carte',
              };
              const colors: Record<string, string> = {
                espèces: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                wave: 'bg-blue-50 border-blue-200 text-blue-700',
                orange_money: 'bg-orange-50 border-orange-200 text-orange-700',
                carte: 'bg-violet-50 border-violet-200 text-violet-700',
              };
              return (
                <div key={method}
                  className={`rounded-xl border p-3 ${colors[method] || 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  <p className="text-xs font-semibold">{labels[method] || method}</p>
                  <p className="text-lg font-bold mt-1">{data.value.toLocaleString()} F</p>
                  <p className="text-[10px] opacity-70">{data.transactions} transaction(s)</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Alertes stock critiques ──────────────────────────────── */}
      {criticalProducts.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 rounded-2xl border border-red-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="font-semibold text-red-800 text-base">Alertes stock critiques</h2>
            <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
              {criticalProducts.length} produit(s)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {criticalProducts.slice(0, 5).map(p => (
              <div key={p.productId}
                className="bg-white rounded-xl p-3 shadow-sm border-l-4 border-l-red-500 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 text-sm">{p.productName}</p>
                  <span className="text-xs font-bold text-red-600">{p.currentStock} restant(s)</span>
                </div>
                <p className="text-xs text-red-600 mt-1 font-medium">{p.message}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {p.dailyConsumption.toFixed(1)}/jour (moy.)
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 mt-3 text-center">
            💡 Allez dans Réapprovisionnement pour commander
          </p>
        </div>
      )}

    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ icon, label, value, change, positive, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  positive: boolean;
  color: 'emerald' | 'violet' | 'amber' | 'rose';
}) {
  const colorStyles = {
    emerald: { bg: '#ecfdf5', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
    violet:  { bg: '#f5f3ff', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
    amber:   { bg: '#fffbeb', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    rose:    { bg: '#fff1f2', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: colorStyles[color].bg }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{ background: colorStyles[color].gradient }}>
            {icon}
          </div>
        </div>
        <span className={cn(
          'text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5',
          positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50',
        )}>
          {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          {change}
        </span>
      </div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-lg lg:text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}
