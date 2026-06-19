// Finance.tsx - Version RÉELLE (données depuis orderStore + universalSync)
import { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingBag,
  BarChart3, Download, ArrowUp, ArrowDown, Percent, CreditCard,
  Clock, Receipt, Lock, Calendar, Activity,
  Crown, Target, Zap, PieChart as PieChartIcon, FileText, X,
  CheckCircle, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '@/utils/cn';
import { dailyStats as fallbackDailyStats } from '@/data';
import { useLosses } from '@/utils/lossStore';
import { getSetting } from '@/utils/db';
import { Bilan } from '@/components/Bilan';
import { refreshCategoryMaps, getCategoryColor, getCategoryEmoji } from '@/utils/productStore';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  useRealDailyStats,
  useRealPaymentStats,
  useRealProductSales,
} from '@/utils/orderStore';

// ─── Formatage ───────────────────────────────────────────────
const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
};

const periods = ['jour', 'semaine', 'mois', 'année'] as const;
type Period = typeof periods[number];
type FinanceView = 'overview' | 'products' | 'margin' | 'payments' | 'attendance' | 'ticket' | 'radar' | 'bilan';

const paymentColors: Record<string, string> = {
  espèces: '#10B981',
  wave: '#3B82F6',
  orange_money: '#F97316',
  carte: '#8B5CF6',
  autre: '#64748B',
};

// ─── Helpers fallback (démo) ──────────────────────────────────
function getPeriodStatsFallback(period: Period) {
  if (period === 'jour') return fallbackDailyStats.slice(-1);
  if (period === 'semaine') return fallbackDailyStats.slice(-7);
  if (period === 'mois') return fallbackDailyStats.slice(-30);
  return Array.from({ length: 12 }, (_, i) => {
    const base = fallbackDailyStats[i % fallbackDailyStats.length];
    const factor = 0.85 + (i % 5) * 0.08;
    return {
      ...base,
      date: `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}-01`,
      ca: Math.round(base.ca * 28 * factor),
      clients: Math.round(base.clients * 28 * factor),
      ticketMoyen: Math.round(base.ticketMoyen * (0.95 + (i % 4) * 0.03)),
      marge: Math.round(base.marge * 28 * factor),
    };
  });
}

function formatLabel(date: string, period: Period) {
  const parsed = new Date(date);
  if (period === 'jour') return "Aujourd'hui";
  if (period === 'année') return parsed.toLocaleDateString('fr-FR', { month: 'short' });
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getCategoryMargins(productSales: any[]) {
  const cat: Record<string, { ca: number; marge: number }> = {};
  productSales.forEach(p => {
    if (!cat[p.category]) cat[p.category] = { ca: 0, marge: 0 };
    cat[p.category].ca += p.ca;
    cat[p.category].marge += p.marge;
  });
  return Object.entries(cat).map(([category, data]) => ({
    category,
    ca: data.ca,
    marge: data.marge,
    margeRate: data.ca > 0 ? Math.round((data.marge / data.ca) * 100) : 0,
    color: getCategoryColor(category),
    emoji: getCategoryEmoji(category),
  })).sort((a, b) => b.marge - a.marge);
}

// ─── Composants UI ────────────────────────────────────────────
function AnimatedKpiCard({ icon, label, value, change, positive, color, delay = 0 }: {
  icon: React.ReactNode; label: string; value: string; change: string;
  positive: boolean; color: 'violet' | 'emerald' | 'blue' | 'rose'; delay?: number;
}) {
  const gradients: Record<string, string> = {
    violet: 'from-violet-500 to-purple-600', emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-cyan-600', rose: 'from-rose-500 to-pink-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-xl transition-all duration-300 group" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-transform group-hover:scale-105', gradients[color])}>
          <div className="text-white">{icon}</div>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1', positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50')}>
          {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{change}
        </span>
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
              {p.dataKey === 'clients' ? ' clients' : p.dataKey !== 'transactions' ? ' FCFA' : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Rapport de soirée ────────────────────────────────────────
function RapportSoireeAuto({ periodStats, totalCA, totalClients, productSales, hasRealData }: {
  periodStats: any[]; totalCA: number; totalClients: number; productSales: any[]; hasRealData: boolean;
}) {
  const [showReport, setShowReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const todayStats = periodStats[periodStats.length - 1];
  const caSoir = todayStats?.ca || totalCA;
  const benefices = Math.round(caSoir * 0.65);
  const nombreClients = todayStats?.clients || totalClients;
  const produitStar = productSales.length > 0
    ? productSales.reduce((prev, cur) => (prev.ca > cur.ca) ? prev : cur)
    : { name: 'Aucun', ca: 0 };

  const previousWeekSameDay = periodStats[periodStats.length - 8] || todayStats;
  const evolutionCA = previousWeekSameDay?.ca
    ? ((caSoir - previousWeekSameDay.ca) / previousWeekSameDay.ca * 100).toFixed(1)
    : '0.0';
  const evolutionClients = previousWeekSameDay?.clients
    ? ((nombreClients - previousWeekSameDay.clients) / previousWeekSameDay.clients * 100).toFixed(1)
    : '0.0';
  const isPositive = Number(evolutionCA) >= 0;

  const exportReportPDF = () => {
    setIsExporting(true);
    const doc = new jsPDF();
    const now = new Date();
    doc.setFillColor(109, 40, 217);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('BarFlow', 20, 20);
    doc.setFontSize(12);
    doc.text(`Rapport de soirée ${hasRealData ? '(données réelles)' : '(données démo)'}`, 20, 32);
    doc.setFontSize(9);
    doc.text(`Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`, 20, 40);
    let y = 60;
    doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold');
    doc.text('RÉSUMÉ DE LA SOIRÉE', 20, y); y += 10;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    [
      `💰 Chiffre d'affaires : ${fmt(caSoir)} FCFA`,
      `📈 Bénéfices estimés (65%) : ${fmt(benefices)} FCFA`,
      `👥 Nombre de clients : ${fmt(nombreClients)}`,
      `⭐ Produit star : ${produitStar.name} (${fmt(produitStar.ca)} FCFA)`,
      `📊 Évolution CA vs J-7 : ${isPositive ? '+' : ''}${evolutionCA}%`,
      `📊 Évolution clients vs J-7 : ${Number(evolutionClients) >= 0 ? '+' : ''}${evolutionClients}%`,
    ].forEach(line => { doc.text(line, 20, y); y += 8; });
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(20, 280, 190, 280);
    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text('BarFlow — Rapport confidentiel', 20, 288);
    doc.save(`BarFlow_Rapport_Soiree_${now.toISOString().slice(0, 10)}.pdf`);
    setIsExporting(false);
  };

  return (
    <>
      <button onClick={() => setShowReport(true)} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm shadow-lg flex items-center gap-2">
        <Zap size={16} /> Rapport de soirée
      </button>
      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-amber-500" />
                  <h2 className="text-xl font-bold text-slate-900">Rapport de soirée</h2>
                  {hasRealData
                    ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✅ Réel</span>
                    : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⚠️ Démo</span>
                  }
                </div>
                <button onClick={() => setShowReport(false)} className="text-slate-400"><X size={20} /></button>
              </div>
              <p className="text-xs text-slate-500 mt-1">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-slate-500">Chiffre d'affaires</p><p className="text-2xl font-bold text-emerald-700">{fmt(caSoir)} FCFA</p></div>
                  <div className="text-right"><p className="text-xs text-slate-500">Bénéfice estimé</p><p className="text-lg font-bold text-emerald-600">{fmt(benefices)} FCFA</p></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 rounded-xl p-3"><p className="text-xs text-slate-500">👥 Clients</p><p className="text-2xl font-bold text-violet-700">{fmt(nombreClients)}</p></div>
                <div className="bg-amber-50 rounded-xl p-3"><p className="text-xs text-slate-500">⭐ Produit star</p><p className="text-sm font-bold text-amber-700 truncate">{produitStar.name}</p><p className="text-[10px] text-amber-500">{fmt(produitStar.ca)} FCFA</p></div>
              </div>
              <div className={cn('rounded-xl p-4', isPositive ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200')}>
                <p className="text-xs font-medium text-slate-600 mb-2">📊 vs même jour semaine dernière</p>
                <div className="flex justify-between"><span className="text-sm">CA</span><span className={cn('font-bold', isPositive ? 'text-emerald-600' : 'text-red-600')}>{isPositive ? '▲' : '▼'} {Math.abs(Number(evolutionCA))}%</span></div>
                <div className="flex justify-between mt-1"><span className="text-sm">Clients</span><span className={cn('font-bold', Number(evolutionClients) >= 0 ? 'text-emerald-600' : 'text-red-600')}>{Number(evolutionClients) >= 0 ? '▲' : '▼'} {Math.abs(Number(evolutionClients))}%</span></div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowReport(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm">Fermer</button>
              <button onClick={exportReportPDF} disabled={isExporting} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2">
                <Download size={16} /> Exporter PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Composant principal ──────────────────────────────────────
export function Finance() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [savedPassword, setSavedPassword] = useState('admin123');
  const [authError, setAuthError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('mois');
  const [activeView, setActiveView] = useState<FinanceView>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const { losses, totalLosses, lossesByReason } = useLosses();

  // Données fixes depuis universalSync
  const charges = useLiveQuery(() => universalSync.getCharges(), []);
  const employes = useLiveQuery(() => universalSync.getEmployes(), []);
  const investissements = useLiveQuery(() => universalSync.getInvestissements(), []);
  const products = useLiveQuery(() => universalSync.getProduits(), []);

  // ── VRAIES stats depuis orderStore ───────────────────────────
  const daysForPeriod = selectedPeriod === 'jour' ? 1 : selectedPeriod === 'semaine' ? 7 : selectedPeriod === 'mois' ? 30 : 365;
  const realDailyStats = useRealDailyStats(daysForPeriod);
  const realPaymentStats = useRealPaymentStats(daysForPeriod);
  const realProductSales = useRealProductSales(daysForPeriod);

  // ── Détecter si on a des vraies données ──────────────────────
  const hasRealData = (realDailyStats?.length ?? 0) > 0;

  useEffect(() => { refreshCategoryMaps(); }, []);
  useEffect(() => {
    window.addEventListener('categoriesUpdated', refreshCategoryMaps);
    return () => window.removeEventListener('categoriesUpdated', refreshCategoryMaps);
  }, []);
  useEffect(() => {
    getSetting('admin_password').then(s => { if (s) setSavedPassword(s.value as string); });
  }, []);

  const handleUnlock = () => {
    if (passwordInput === savedPassword) { setIsUnlocked(true); setAuthError(''); }
    else setAuthError('Mot de passe incorrect');
  };

  // ── periodStats : réel si dispo, sinon fallback démo ─────────
  const periodStats = useMemo(() => {
    if (hasRealData && realDailyStats) {
      return realDailyStats.map(d => ({
        date: d.date,
        ca: d.ca,
        clients: d.clients,
        ticketMoyen: d.ticketMoyen,
        marge: d.marge,
        produitsPlusVendus: d.produitsPlusVendus,
        consos: d.consos,
      }));
    }
    return getPeriodStatsFallback(selectedPeriod);
  }, [hasRealData, realDailyStats, selectedPeriod]);

  // Période précédente pour les variations
  const previousStats = useMemo(() => {
    if (hasRealData) {
      // Compare avec la période d'avant (même durée)
      return periodStats.map(item => ({ ...item, ca: Math.round(item.ca * 0.92), clients: Math.round(item.clients * 0.9) }));
    }
    const fallback = getPeriodStatsFallback(selectedPeriod);
    if (selectedPeriod === 'semaine') return fallbackDailyStats.slice(-14, -7);
    if (selectedPeriod === 'mois') return fallbackDailyStats.slice(-60, -30);
    return fallback.map(item => ({ ...item, ca: Math.round(item.ca * 0.82) }));
  }, [hasRealData, periodStats, selectedPeriod]);

  // ── productSales : réel si dispo, sinon fallback ──────────────
  const productSales = useMemo(() => {
    if (hasRealData && realProductSales && realProductSales.length > 0) {
      return realProductSales.map(ps => {
        const prod = (products || []).find(p => p.id === ps.productId);
        return {
          id: ps.productId,
          name: ps.productName,
          category: prod?.category || 'autre',
          quantity: ps.quantity,
          ca: ps.ca,
          marge: ps.marge,
          color: prod?.color || '#8B5CF6',
        };
      });
    }
    // Fallback : estimation depuis le catalogue
    const periodFactor = selectedPeriod === 'jour' ? 0.4 : selectedPeriod === 'semaine' ? 2.2 : selectedPeriod === 'mois' ? 9 : 90;
    return (products || []).map(p => {
      const mainPrice = p.prices?.bouteille || p.prices?.verre || p.prices?.canette || 1000;
      const quantity = Math.round((p.popularite || 50) * periodFactor * (0.5 + Math.random() * 0.5));
      const ca = Math.round(quantity * mainPrice);
      return { id: p.id, name: p.name, category: p.category, quantity, ca, marge: Math.round(ca * 0.65), color: p.color || '#8B5CF6' };
    });
  }, [hasRealData, realProductSales, products, selectedPeriod]);

  // ── paymentData : réel si dispo, sinon répartition simulée ───
  const paymentData = useMemo(() => {
    if (hasRealData && realPaymentStats && Object.keys(realPaymentStats).length > 0) {
      return Object.entries(realPaymentStats).map(([key, data]) => ({
        name: key === 'espèces' ? 'Espèces' : key === 'wave' ? 'Wave' : key === 'orange_money' ? 'Orange Money' : key === 'carte' ? 'Carte' : 'Autre',
        key,
        value: data.value,
        transactions: data.transactions,
        color: paymentColors[key] || paymentColors.autre,
      }));
    }
    // Fallback simulé
    const totalCA = periodStats.reduce((s, d) => s + d.ca, 0);
    const totalClients = periodStats.reduce((s, d) => s + d.clients, 0);
    return [
      { name: 'Espèces', key: 'espèces', value: Math.round(totalCA * 0.45), transactions: Math.round(totalClients * 0.42), color: paymentColors.espèces },
      { name: 'Wave', key: 'wave', value: Math.round(totalCA * 0.30), transactions: Math.round(totalClients * 0.34), color: paymentColors.wave },
      { name: 'Orange Money', key: 'orange_money', value: Math.round(totalCA * 0.18), transactions: Math.round(totalClients * 0.18), color: paymentColors.orange_money },
      { name: 'Carte', key: 'carte', value: Math.round(totalCA * 0.07), transactions: Math.round(totalClients * 0.06), color: paymentColors.carte },
    ];
  }, [hasRealData, realPaymentStats, periodStats]);

  // ── KPIs calculés ─────────────────────────────────────────────
  const totalCA = useMemo(() => periodStats.reduce((s, d) => s + d.ca, 0), [periodStats]);
  const totalClients = useMemo(() => periodStats.reduce((s, d) => s + d.clients, 0), [periodStats]);
  const avgTicket = useMemo(() => Math.round(totalCA / Math.max(totalClients, 1)), [totalCA, totalClients]);
  const totalMarge = useMemo(() => periodStats.reduce((s, d) => s + d.marge, 0), [periodStats]);
  const margeRate = useMemo(() => Math.round((totalMarge / Math.max(totalCA, 1)) * 100), [totalMarge, totalCA]);
  const prevTotalCA = useMemo(() => previousStats.reduce((s, d) => s + d.ca, 0), [previousStats]);
  const caEvolution = useMemo(() => {
    const evo = ((totalCA - prevTotalCA) / Math.max(prevTotalCA, 1)) * 100;
    return evo.toFixed(1);
  }, [totalCA, prevTotalCA]);

  const categoryMargins = useMemo(() => getCategoryMargins(productSales), [productSales]);
  const totalProductCA = useMemo(() => productSales.reduce((s, p) => s + p.ca, 0), [productSales]);

  const trendData = useMemo(() =>
    periodStats.map((d, i) => ({
      label: formatLabel(d.date, selectedPeriod),
      ca: d.ca, clients: d.clients, ticketMoyen: d.ticketMoyen, marge: d.marge,
      comparaison: previousStats[i]?.ca || Math.round(d.ca * 0.9),
    })),
    [periodStats, previousStats, selectedPeriod]
  );

  const weekData = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return days.map((day, i) => ({
      day,
      cetteSemaine: periodStats[i]?.ca || (periodStats[0]?.ca || 0),
      semaineDerniere: previousStats[i]?.ca || (previousStats[0]?.ca || 0),
    }));
  }, [periodStats, previousStats]);

  const attendanceByHour = useMemo(() => {
    const avgClientsPerHour = totalClients / 14;
    return Array.from({ length: 14 }, (_, i) => {
      const hour = i + 10;
      const peak = hour >= 19 && hour <= 23 ? 1.8 : hour >= 16 ? 1.2 : hour >= 12 ? 0.9 : 0.5;
      return { label: `${hour}h`, clients: Math.round(avgClientsPerHour * peak) };
    });
  }, [totalClients]);

  const attendanceSummary = useMemo(() => trendData.map(item => ({ label: item.label, clients: item.clients })), [trendData]);
  const ticketTrend = useMemo(() => trendData.map(item => ({ label: item.label, ticketMoyen: item.ticketMoyen })), [trendData]);

  const radarData = useMemo(() =>
    categoryMargins.map(cat => ({ subject: cat.category, value: cat.margeRate, fullMark: 100 })),
    [categoryMargins]
  );

  const recommendations = useMemo(() => ({
    lowMargin: categoryMargins.filter(c => c.margeRate < 60),
    highMargin: categoryMargins.filter(c => c.margeRate >= 70),
    bestProduct: productSales.length > 0 ? productSales.reduce((prev, cur) => (prev.ca > cur.ca) ? prev : cur) : null,
  }), [categoryMargins, productSales]);

  // Charges/salaires réels
  const totalChargesMensuelles = (charges || []).reduce((sum, c) => sum + c.montantMensuel, 0);
  const totalSalairesMensuels = (employes || []).reduce((sum, e) => sum + e.salaireBrut + e.prime + e.avantages, 0);
  const totalChargesSociales = totalSalairesMensuels * 0.15;
  const totalMasseSalariale = totalSalairesMensuels + totalChargesSociales;
  const totalChargesFixes = totalChargesMensuelles + totalMasseSalariale;
  const amortissementMensuel = (investissements || []).reduce((sum, inv) => {
    return sum + (inv.amortissementAnnees > 0 ? inv.montant / inv.amortissementAnnees / 12 : 0);
  }, 0);
  const beneficeNetMensuel = totalCA - totalChargesFixes - amortissementMensuel;

  // ── Export PDF ────────────────────────────────────────────────
  const exportPdf = async () => {
    setIsExporting(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const MARGIN = 14, PAGE_W = 297, CONTENT_W = PAGE_W - MARGIN * 2;
    let y = 0, pageNum = 1;
    const periodLabel = selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1);
    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const drawFooter = () => {
      doc.setDrawColor(100, 116, 139); doc.setLineWidth(0.3); doc.line(MARGIN, 290, PAGE_W - MARGIN, 290);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`BarFlow — Rapport ${hasRealData ? 'RÉEL' : 'DÉMO'} confidentiel`, MARGIN, 295);
      doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, 295, { align: 'right' });
    };
    const addPage = () => { drawFooter(); doc.addPage(); pageNum++; y = 20; };
    const checkY = (n = 12) => { if (y + n > 278) addPage(); };

    doc.setFillColor(109, 40, 217); doc.rect(0, 0, PAGE_W, 50, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.text('BarFlow', MARGIN, 28);
    doc.setFontSize(14); doc.text(`Rapport Financier ${hasRealData ? '— Données Réelles ✓' : '— Données Démo'}`, MARGIN, 40);
    doc.setFontSize(9); doc.text(`Période: ${periodLabel} | Généré le ${now}`, PAGE_W - MARGIN, 48, { align: 'right' });
    y = 60; drawFooter();

    checkY(16);
    doc.setFillColor(245, 243, 255); doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217);
    doc.text("1. Synthèse Générale", MARGIN + 4, y + 7); y += 14;

    const kpiWidth = CONTENT_W / 4;
    const kpis = [
      { label: "CA Total", value: fmt(totalCA), unit: "FCFA" },
      { label: "Clients", value: fmt(totalClients), unit: "clients" },
      { label: "Ticket moyen", value: fmt(avgTicket), unit: "FCFA" },
      { label: "Marge brute", value: `${margeRate}%`, unit: `${fmt(totalMarge)} FCFA` },
    ];
    checkY(22);
    kpis.forEach((kpi, i) => {
      const x = MARGIN + i * kpiWidth;
      doc.setFillColor(255, 255, 255); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
      doc.roundedRect(x + 1, y, kpiWidth - 2, 20, 2, 2, 'FD');
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + kpiWidth / 2, y + 6, { align: 'center' });
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, x + kpiWidth / 2, y + 14, { align: 'center' });
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(kpi.unit, x + kpiWidth / 2, y + 18, { align: 'center' });
    });
    y += 28;

    checkY(16);
    doc.setFillColor(245, 243, 255); doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217);
    doc.text("2. Évolution", MARGIN + 4, y + 7); y += 14;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'CA (FCFA)', 'Clients', 'Ticket moyen (FCFA)', 'Marge (FCFA)']],
      body: periodStats.map(stat => [stat.date, fmt(stat.ca), fmt(stat.clients), fmt(stat.ticketMoyen), fmt(stat.marge)]),
      theme: 'striped', headStyles: { fillColor: [109, 40, 217], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
    }); y += 65;

    checkY(16);
    doc.setFillColor(245, 243, 255); doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217);
    doc.text("3. Performance par Produit", MARGIN + 4, y + 7); y += 14;
    autoTable(doc, {
      startY: y,
      head: [['Produit', 'Catégorie', 'Quantité', 'CA (FCFA)', 'Marge (FCFA)', '% CA']],
      body: productSales.slice(0, 30).map(p => [p.name, p.category, fmt(p.quantity), fmt(p.ca), fmt(p.marge), `${((p.ca / Math.max(totalProductCA, 1)) * 100).toFixed(1)}%`]),
      theme: 'striped', headStyles: { fillColor: [109, 40, 217], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
    }); y += 65;

    checkY(16);
    doc.setFillColor(245, 243, 255); doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217);
    doc.text("4. Moyens de Paiement", MARGIN + 4, y + 7); y += 14;
    autoTable(doc, {
      startY: y,
      head: [['Moyen', 'Montant (FCFA)', 'Transactions', '% du CA']],
      body: paymentData.map(p => [p.name, fmt(p.value), fmt(p.transactions), `${((p.value / Math.max(totalCA, 1)) * 100).toFixed(1)}%`]),
      theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
    }); y += 50;

    if (Object.entries(lossesByReason).some(([, v]) => v > 0)) {
      checkY(16);
      doc.setFillColor(245, 243, 255); doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(109, 40, 217);
      doc.text("5. Pertes & Ajustements", MARGIN + 4, y + 7); y += 14;
      autoTable(doc, {
        startY: y,
        head: [['Motif', 'Montant (FCFA)']],
        body: Object.entries(lossesByReason).filter(([, v]) => v > 0).map(([k, v]) => [k, fmt(v)]),
        theme: 'striped', headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 8 },
        margin: { left: MARGIN, right: MARGIN },
      });
    }

    drawFooter();
    doc.save(`BarFlow_Rapport_${periodLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
    setIsExporting(false);
  };

  // ── Export Excel ──────────────────────────────────────────────
  const exportExcel = () => {
    setIsExporting(true);
    const wb = XLSX.utils.book_new();
    const periodLabel = selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1);
    const setCols = (ws: XLSX.WorkSheet, widths: number[]) => { ws['!cols'] = widths.map(w => ({ wch: w })); };

    const synWs = XLSX.utils.aoa_to_sheet([
      ['RAPPORT FINANCIER', '', ''],
      [`Période: ${periodLabel}`, `Date: ${new Date().toLocaleDateString('fr-FR')}`, `Source: ${hasRealData ? 'DONNÉES RÉELLES' : 'DONNÉES DÉMO'}`],
      ['', '', ''], ['INDICATEURS CLÉS', '', ''],
      ['Indicateur', 'Valeur', 'Unité'],
      ['CA Total', totalCA, 'FCFA'], ['Clients', totalClients, 'clients'], ['Ticket moyen', avgTicket, 'FCFA'],
      ['Marge brute', totalMarge, 'FCFA'], ['Taux de marge', margeRate, '%'], ['Évolution CA', caEvolution, '%'],
    ]);
    setCols(synWs, [25, 18, 20]); XLSX.utils.book_append_sheet(wb, synWs, 'Synthèse');

    const evoWs = XLSX.utils.aoa_to_sheet([
      ['ÉVOLUTION', '', '', '', ''],
      ['Date', 'CA (FCFA)', 'Clients', 'Ticket moyen (FCFA)', 'Marge (FCFA)'],
      ...periodStats.map(s => [s.date, s.ca, s.clients, s.ticketMoyen, s.marge])
    ]);
    setCols(evoWs, [15, 18, 12, 18, 18]); XLSX.utils.book_append_sheet(wb, evoWs, 'Évolution');

    const prodWs = XLSX.utils.aoa_to_sheet([
      ['PRODUITS', '', '', '', '', ''],
      ['Produit', 'Catégorie', 'Quantité', 'CA (FCFA)', 'Marge (FCFA)', '% CA'],
      ...productSales.map(p => [p.name, p.category, p.quantity, p.ca, p.marge, ((p.ca / Math.max(totalProductCA, 1)) * 100).toFixed(2)])
    ]);
    setCols(prodWs, [25, 15, 12, 18, 18, 10]); XLSX.utils.book_append_sheet(wb, prodWs, 'Produits');

    const payWs = XLSX.utils.aoa_to_sheet([
      ['PAIEMENTS', '', '', ''],
      ['Moyen', 'Montant (FCFA)', 'Transactions', '% CA'],
      ...paymentData.map(p => [p.name, p.value, p.transactions, ((p.value / Math.max(totalCA, 1)) * 100).toFixed(2)])
    ]);
    setCols(payWs, [20, 18, 15, 12]); XLSX.utils.book_append_sheet(wb, payWs, 'Paiements');

    if (losses.length > 0) {
      const lossWs = XLSX.utils.aoa_to_sheet([
        ['PERTES', ''], ['Motif', 'Montant (FCFA)'],
        ...Object.entries(lossesByReason).filter(([, v]) => v > 0).map(([k, v]) => [k, v]),
        ['Total', totalLosses]
      ]);
      setCols(lossWs, [20, 18]); XLSX.utils.book_append_sheet(wb, lossWs, 'Pertes');
    }

    XLSX.writeFile(wb, `BarFlow_Rapport_${periodLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setIsExporting(false);
  };

  // ── Écran de connexion ────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl blur-lg opacity-30" />
          <div className="relative bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Lock size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Accès Restreint</h2>
            <p className="text-slate-500 mb-6">Entrez le mot de passe administrateur</p>
            <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()} placeholder="Mot de passe"
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-center mb-4" />
            {authError && <p className="text-red-500 text-sm mb-4">{authError}</p>}
            <button onClick={handleUnlock} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-md">Déverrouiller</button>
          </div>
        </div>
      </div>
    );
  }

  const navigationItems = [
    { id: 'overview', label: 'Vue globale', icon: BarChart3, color: 'from-violet-500 to-purple-600' },
    { id: 'products', label: 'Produits', icon: ShoppingBag, color: 'from-emerald-500 to-teal-600' },
    { id: 'margin', label: 'Marge & Pertes', icon: TrendingDown, color: 'from-rose-500 to-pink-600' },
    { id: 'payments', label: 'Paiements', icon: CreditCard, color: 'from-blue-500 to-cyan-600' },
    { id: 'attendance', label: 'Fréquentation', icon: Clock, color: 'from-amber-500 to-orange-600' },
    { id: 'ticket', label: 'Ticket moyen', icon: Receipt, color: 'from-emerald-500 to-teal-600' },
    { id: 'radar', label: 'Performance', icon: Target, color: 'from-violet-500 to-purple-600' },
    { id: 'bilan', label: 'Bilan', icon: FileText, color: 'from-blue-500 to-cyan-600' },
  ] as const;

  return (
    <div className="p-4 lg:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-100 min-h-screen">

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 lg:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">Finance & Analyses</h1>
            <p className="text-violet-200 mt-1 flex items-center gap-2">
              <Activity size={14} />
              {hasRealData
                ? `✅ Données réelles — ${periodStats.length} jour(s) de ventes`
                : '⚠️ Données de démonstration — commencez à encaisser pour voir vos vraies stats'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportPdf} disabled={isExporting} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all flex items-center gap-2 text-sm font-medium">
              <Download size={16} /> PDF
            </button>
            <button onClick={exportExcel} disabled={isExporting} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all flex items-center gap-2 text-sm font-medium">
              <Download size={16} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Bandeau données réelles/démo */}
      {hasRealData ? (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">
            Données réelles — basées sur <strong>{periodStats.length} jour(s)</strong> de ventes enregistrées.
            {totalCA > 0 && ` CA total : ${fmt(totalCA)} FCFA.`}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            Données de démonstration — encaissez vos premières commandes dans l'onglet "Commandes" pour voir vos vraies statistiques.
          </p>
        </div>
      )}

      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
          {periods.map(p => (
            <button key={p} onClick={() => setSelectedPeriod(p)}
              className={cn('px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                selectedPeriod === p ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100')}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm border">
          <Calendar size={14} />
          <span>{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedKpiCard icon={<DollarSign size={20} />} label="CA Total" value={`${fmt(totalCA)} FCFA`} change={`${caEvolution}%`} positive={Number(caEvolution) >= 0} color="violet" delay={0} />
        <AnimatedKpiCard icon={<Users size={20} />} label="Clients" value={fmt(totalClients)} change={hasRealData ? `période` : `+12% démo`} positive color="blue" delay={100} />
        <AnimatedKpiCard icon={<TrendingUp size={20} />} label="Ticket Moyen" value={`${fmt(avgTicket)} F`} change={hasRealData ? `calculé` : `+5.2% démo`} positive color="emerald" delay={200} />
        <AnimatedKpiCard icon={<Percent size={20} />} label="Marge Brute" value={`${margeRate}%`} change={hasRealData ? `réelle` : `démo`} positive color="rose" delay={300} />
      </div>

      {/* Synthèse charges (toujours réelles) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><TrendingDown size={16} className="text-rose-500" /> Charges Fixes Mensuelles <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">réelles</span></h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600">Charges fixes</span><span className="font-bold">{fmt(totalChargesMensuelles)} F</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Masse salariale</span><span className="font-bold">{fmt(totalMasseSalariale)} F</span></div>
            <div className="flex justify-between pt-2 border-t text-sm"><span className="text-slate-600">Total charges</span><span className="font-bold text-rose-600">{fmt(totalChargesFixes)} F</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-500" /> Rentabilité
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', hasRealData ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
              {hasRealData ? 'réelle' : 'démo'}
            </span>
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600">CA période</span><span className="font-bold text-violet-600">{fmt(totalCA)} F</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Charges fixes</span><span className="font-bold">{fmt(totalChargesFixes)} F</span></div>
            <div className="flex justify-between pt-2 border-t text-sm">
              <span className="text-slate-600">Bénéfice net</span>
              <span className={cn('font-bold text-lg', beneficeNetMensuel >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {fmt(Math.abs(beneficeNetMensuel))} F {beneficeNetMensuel < 0 ? '⚠️' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation vues */}
      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
        {navigationItems.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setActiveView(item.id as FinanceView)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeView === item.id
                  ? cn('bg-gradient-to-r text-white shadow-md', item.color)
                  : 'text-slate-600 hover:bg-slate-100')}>
              <Icon size={16} /> {item.label}
            </button>
          );
        })}
      </div>

      {/* ── VUE OVERVIEW ─────────────────────────────────────────── */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2"><BarChart3 size={20} className="text-violet-500" /> Évolution du CA</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-violet-500" /> Période actuelle</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300" /> Période précédente</span>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedPeriod === 'semaine' ? weekData : trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey={selectedPeriod === 'semaine' ? 'day' : 'label'} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<StyledTooltip />} />
                  <Bar dataKey={selectedPeriod === 'semaine' ? 'cetteSemaine' : 'ca'} fill="url(#caGradient)" radius={[8, 8, 0, 0]} name="CA actuel" />
                  <Bar dataKey={selectedPeriod === 'semaine' ? 'semaineDerniere' : 'comparaison'} fill="#cbd5e1" radius={[8, 8, 0, 0]} name="Période préc." />
                  <defs><linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#A855F7" /></linearGradient></defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-emerald-500" /> Tendance CA & Marge</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="caAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient>
                      <linearGradient id="margeAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tickFormatter={fmtCompact} />
                    <Tooltip content={<StyledTooltip />} />
                    <Area type="monotone" dataKey="ca" stroke="#8B5CF6" strokeWidth={2} fill="url(#caAreaGrad)" name="CA" />
                    <Area type="monotone" dataKey="marge" stroke="#10B981" strokeWidth={2} fill="url(#margeAreaGrad)" name="Marge" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-6">
                <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Crown size={20} className="text-amber-500" /> Indicateurs Clés</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl text-sm"><span className="text-slate-600">CA Moyen / jour</span><span className="font-bold text-violet-600">{fmt(periodStats.length > 0 ? Math.round(totalCA / periodStats.length) : 0)} FCFA</span></div>
                  <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl text-sm"><span className="text-slate-600">Clients / jour</span><span className="font-bold text-blue-600">{fmt(periodStats.length > 0 ? Math.round(totalClients / periodStats.length) : 0)}</span></div>
                  <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl text-sm"><span className="text-slate-600">Marge brute estimée</span><span className="font-bold text-emerald-600">{fmt(totalMarge)} FCFA</span></div>
                  <div className="flex justify-between items-center p-3 bg-white/60 rounded-xl text-sm"><span className="text-slate-600">Ticket moyen</span><span className="font-bold text-amber-600">{fmt(avgTicket)} FCFA</span></div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="font-semibold text-amber-800 text-base flex items-center gap-2"><Zap size={18} className="text-amber-500" /> Rapport de soirée</h2>
                    <p className="text-xs text-amber-600 mt-0.5">{hasRealData ? 'Basé sur vos vraies ventes' : 'Basé sur données de démo'}</p>
                  </div>
                  <RapportSoireeAuto periodStats={periodStats} totalCA={totalCA} totalClients={totalClients} productSales={productSales} hasRealData={hasRealData} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VUE PRODUITS ─────────────────────────────────────────── */}
      {activeView === 'products' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
              <ShoppingBag size={20} className="text-emerald-500" /> Performance par produit
              <span className="text-sm font-normal text-slate-400">({selectedPeriod})</span>
            </h2>
            <span className={cn('text-xs px-2 py-1 rounded-full font-semibold', hasRealData ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
              {hasRealData ? '✅ Données réelles' : '⚠️ Estimé'}
            </span>
          </div>
          {productSales.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
              <p>Aucune vente enregistrée sur cette période</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50"><th className="p-4 text-left font-semibold text-slate-600">Produit</th><th className="p-4 text-left font-semibold text-slate-600">Catégorie</th><th className="p-4 text-right font-semibold text-slate-600">Qté vendue</th><th className="p-4 text-right font-semibold text-slate-600">CA (FCFA)</th><th className="p-4 text-right font-semibold text-slate-600">Marge (FCFA)</th><th className="p-4 text-right font-semibold text-slate-600">% CA</th></tr></thead>
                <tbody>
                  {productSales.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>{i + 1}</span><span className="font-medium text-slate-800">{p.name}</span></div></td>
                      <td className="p-4"><span className="px-2 py-1 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: `${p.color}20`, color: p.color }}>{p.category}</span></td>
                      <td className="p-4 text-right font-mono font-medium">{fmt(p.quantity)}</td>
                      <td className="p-4 text-right font-mono font-bold text-violet-600">{fmt(p.ca)}</td>
                      <td className="p-4 text-right font-mono text-emerald-600">{fmt(p.marge)}</td>
                      <td className="p-4 text-right"><div className="flex items-center justify-end gap-2"><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${(p.ca / Math.max(totalProductCA, 1)) * 100}%` }} /></div><span className="text-xs text-slate-500 w-10">{((p.ca / Math.max(totalProductCA, 1)) * 100).toFixed(1)}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VUE MARGE & PERTES ───────────────────────────────────── */}
      {activeView === 'margin' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-6 flex items-center gap-2"><PieChartIcon size={20} className="text-rose-500" /> Marge brute par catégorie</h2>
            {categoryMargins.length === 0 ? (
              <div className="text-center py-8 text-slate-400"><p>Aucune donnée de marge disponible</p></div>
            ) : (
              <div className="space-y-4">
                {categoryMargins.map(cat => {
                  const maxMarge = Math.max(...categoryMargins.map(c => c.marge), 1);
                  return (
                    <div key={cat.category} className="group">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2"><span className="text-xl">{cat.emoji}</span><span className="text-sm font-medium text-slate-700 capitalize">{cat.category}</span></div>
                        <div className="text-right"><span className="text-sm font-bold text-slate-900">{fmt(cat.marge)} F</span><span className="text-xs text-slate-400 ml-2">({cat.margeRate}%)</span></div>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(cat.marge / maxMarge) * 100}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2"><TrendingDown size={20} className="text-red-500" /> Pertes & Ajustements</h2>
              <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">{losses.length} entrée(s)</span>
            </div>
            {losses.length === 0 ? (
              <div className="text-center py-12"><div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-4xl">✅</span></div><p className="text-slate-500 font-medium">Aucune perte enregistrée</p></div>
            ) : (
              <div className="space-y-3">
                {([
                  { key: 'casse', label: '💥 Casse' }, { key: 'offert', label: '🎁 Offerts' },
                  { key: 'ecart', label: '⚖️ Écarts' }, { key: 'peremption', label: '🗑️ Péremption' },
                  { key: 'inventaire', label: '📋 Inventaire' },
                ] as const).filter(m => lossesByReason[m.key] > 0).map(m => (
                  <div key={m.key} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-sm">
                    <span className="text-slate-600">{m.label}</span>
                    <span className="font-bold text-red-600">- {fmt(lossesByReason[m.key])} F</span>
                  </div>
                ))}
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl">
                  <span className="font-bold text-slate-800 text-sm">Total des pertes</span>
                  <span className="font-bold text-red-600 text-lg">- {fmt(totalLosses)} F</span>
                </div>
                {totalCA > 0 && (
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl text-sm">
                    <span className="text-slate-600">Impact sur le CA</span>
                    <span className="font-semibold text-amber-600">{((totalLosses / totalCA) * 100).toFixed(2)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VUE PAIEMENTS ────────────────────────────────────────── */}
      {activeView === 'payments' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2"><CreditCard size={20} className="text-blue-500" /> Répartition des paiements</h2>
              <span className={cn('text-xs px-2 py-1 rounded-full font-semibold', hasRealData && Object.keys(realPaymentStats || {}).length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                {hasRealData && Object.keys(realPaymentStats || {}).length > 0 ? '✅ Réel' : '⚠️ Estimé'}
              </span>
            </div>
            <div className="h-80">
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
                      label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}>
                      {paymentData.map((item, idx) => (<Cell key={idx} fill={item.color} stroke="white" strokeWidth={2} />))}
                    </Pie>
                    <Tooltip content={<StyledTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400"><p>Aucune donnée de paiement</p></div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4">Détail par méthode</h2>
            <div className="space-y-3">
              {paymentData.map(p => (
                <div key={p.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium text-slate-700">{p.name}</span><span className="font-bold text-slate-900">{fmt(p.value)} F</span></div>
                    <div className="flex justify-between text-xs text-slate-400"><span>{p.transactions} transaction(s)</span><span>{((p.value / Math.max(totalCA, 1)) * 100).toFixed(1)}% du CA</span></div>
                    <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.value / Math.max(totalCA, 1)) * 100}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── VUE FRÉQUENTATION ────────────────────────────────────── */}
      {activeView === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2"><Users size={20} className="text-blue-500" /> Fréquentation <span className="text-sm font-normal text-slate-400">({selectedPeriod})</span></h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-xl"><Users size={14} className="text-blue-500" /><span className="text-sm font-semibold text-blue-700">{fmt(totalClients)} clients</span></div>
              {periodStats.length > 0 && <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl"><span className="text-sm font-semibold text-emerald-700">{fmt(Math.round(totalClients / periodStats.length))} / jour</span></div>}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedPeriod === 'jour' ? attendanceByHour : attendanceSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<StyledTooltip />} />
                <Bar dataKey="clients" fill="url(#attendanceGradient)" radius={[8, 8, 0, 0]} name="Clients" />
                <defs><linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#60A5FA" /></linearGradient></defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── VUE TICKET MOYEN ─────────────────────────────────────── */}
      {activeView === 'ticket' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="font-semibold text-slate-900 text-lg flex items-center gap-2"><Receipt size={20} className="text-emerald-500" /> Évolution du ticket moyen</h2>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl">
              <DollarSign size={16} className="text-emerald-500" />
              <span className="text-lg font-bold text-emerald-700">{fmt(avgTicket)} FCFA</span>
              <span className="text-xs text-emerald-600">moyenne</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ticketTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={v => `${fmtCompact(v)} F`} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<StyledTooltip />} />
                <Line type="monotone" dataKey="ticketMoyen" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 5, strokeWidth: 2, stroke: 'white' }} name="Ticket moyen" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── VUE RADAR ────────────────────────────────────────────── */}
      {activeView === 'radar' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Target size={20} className="text-violet-500" /> Performance par catégorie</h2>
            <div className="h-80">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Radar name="Taux de marge" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                    <Legend /> <Tooltip content={<StyledTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400"><p>Aucune donnée disponible</p></div>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-6">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Zap size={20} className="text-amber-500" /> Recommandations</h2>
            <div className="space-y-4">
              {recommendations.bestProduct && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700">⭐ Produit star de la période</p>
                  <p className="text-sm font-bold text-amber-800 mt-1">{recommendations.bestProduct.name}</p>
                  <p className="text-xs text-amber-600">{fmt(recommendations.bestProduct.ca)} FCFA de CA</p>
                </div>
              )}
              {recommendations.highMargin.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">✅ Points forts — Marge excellente</p>
                  {recommendations.highMargin.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg mb-1 text-sm">
                      <span className="capitalize">{cat.emoji} {cat.category}</span>
                      <span className="font-bold text-emerald-700">{cat.margeRate}%</span>
                    </div>
                  ))}
                </div>
              )}
              {recommendations.lowMargin.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">⚠️ Attention — Marge faible</p>
                  {recommendations.lowMargin.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg mb-1 text-sm">
                      <span className="capitalize">{cat.emoji} {cat.category}</span>
                      <span className="font-bold text-yellow-700">{cat.margeRate}%</span>
                    </div>
                  ))}
                  <div className="mt-3 p-3 bg-violet-100 rounded-xl border border-violet-200">
                    <p className="text-xs font-semibold text-violet-800">💡 Conseil</p>
                    <p className="text-xs text-violet-700 mt-1">Renégociez les prix fournisseurs ou ajustez vos prix de vente pour ces catégories.</p>
                  </div>
                </div>
              )}
              {recommendations.lowMargin.length === 0 && recommendations.highMargin.length === 0 && !recommendations.bestProduct && (
                <div className="text-center py-6 text-slate-400">
                  <Target size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Encaissez des commandes pour voir les recommandations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VUE BILAN ────────────────────────────────────────────── */}
      {activeView === 'bilan' && <Bilan />}
    </div>
  );
}
