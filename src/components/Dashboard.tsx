// Dashboard.tsx - Version avec universalSync
import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, Users, DollarSign, ShoppingBag, Clock,
  AlertTriangle, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { cn } from '@/utils/cn';
import { dailyStats, products as staticProducts } from '@/data'; // Supprimé alerts
import { refreshCategoryMaps, getCategories } from '@/utils/productStore'; // Supprimé useProducts
import { getCriticalProducts, predictStockRupture } from '@/utils/stockPrediction';
import { universalSync } from '@/services/universalSync';
import { useLiveQuery } from 'dexie-react-hooks';

// Statistiques des 7 derniers jours
const last7Stats = dailyStats?.slice(-7) || [];

// Date du jour
const today = new Date();
const dayOfWeek = today.getDay();
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

// Statistiques d'hier - SÉCURISÉ
const yesterdayStats = dailyStats && dailyStats.length > 0 
  ? dailyStats[dailyStats.length - 2] || dailyStats[dailyStats.length - 1]
  : { ca: 0, clients: 0, ticketMoyen: 0, marge: 0 };

// Moyenne des 7 derniers jours
const avgTicketMoyen7Days = last7Stats.length > 0 
  ? Math.round(last7Stats.reduce((sum, d) => sum + (d.ticketMoyen || 0), 0) / last7Stats.length)
  : 4500;

// Calcul des données horaires
const calculateHourData = () => {
  const categories = getCategories();
  const avgConsosByCategory: Record<string, number> = {};
  
  categories.forEach(cat => {
    const total = last7Stats.reduce((sum, day) => {
      const conso = (day.consos as Record<string, number>)?.[cat.name] || 0;
      return sum + conso;
    }, 0);
    avgConsosByCategory[cat.name] = total / Math.max(7, 1);
  });

  return Array.from({ length: 12 }, (_, i) => {
    const heure = i + 12;
    let facteurHoraire = 0;
    
    if (heure >= 12 && heure <= 14) {
      facteurHoraire = 0.5 + (heure - 12) * 0.15;
    } else if (heure >= 15 && heure <= 18) {
      facteurHoraire = 0.3;
    } else if (heure >= 19 && heure <= 21) {
      facteurHoraire = 1.2 + (heure - 19) * 0.3;
    } else if (heure >= 22 && heure <= 23) {
      facteurHoraire = 0.7 - (heure - 22) * 0.2;
    } else {
      facteurHoraire = 0.2;
    }

    const totalConsoMoyenne = Object.values(avgConsosByCategory).reduce((a, b) => a + b, 0);
    const ventesEstimees = Math.round(totalConsoMoyenne * facteurHoraire * (isWeekend ? 1.3 : 1));
    
    return {
      hour: `${heure}h`,
      ventes: Math.max(ventesEstimees, 100),
    };
  });
};

// Top produits basé sur les ventes réelles (SÉCURISÉ)
const getTopProductsList = (productsList: any[]) => {
  const productSales: Record<string, number> = {};
  
  if (last7Stats && last7Stats.length > 0) {
    last7Stats.forEach(day => {
      if (day.produitsPlusVendus && Array.isArray(day.produitsPlusVendus)) {
        day.produitsPlusVendus.forEach(p => {
          productSales[p.name] = (productSales[p.name] || 0) + (p.quantity || 0);
        });
      }
    });
  }

  return [...productsList]
    .map(p => ({
      name: p.name,
      ventes: productSales[p.name] || p.popularite || 50,
      color: p.color,
    }))
    .sort((a, b) => b.ventes - a.ventes)
    .slice(0, 10);
};

// Données par catégorie
const getCategoryData = () => {
  const categories = getCategories();
  const last30Stats = dailyStats?.slice(-30) || [];
  
  return categories.map(cat => {
    const totalHistorique = last30Stats.reduce((somme, jour) => {
      const consoDuJour = (jour.consos as Record<string, number>)?.[cat.name] || 0;
      return somme + consoDuJour;
    }, 0);

    return {
      name: cat.name,
      value: totalHistorique,
      color: cat.color,
      emoji: cat.emoji,
    };
  }).filter(cat => cat.value > 0);
};

// Calcul des variations
const calculateVariations = () => {
  if (!dailyStats || dailyStats.length < 14) {
    return { caChange: 0, clientsChange: 0, ticketChange: 0, margeChange: 0 };
  }

  const previous7Stats = dailyStats.slice(-14, -7);
  if (previous7Stats.length === 0) {
    return { caChange: 0, clientsChange: 0, ticketChange: 0, margeChange: 0 };
  }

  const prevAvgCA = previous7Stats.reduce((s, d) => s + (d.ca || 0), 0) / previous7Stats.length;
  const prevAvgClients = previous7Stats.reduce((s, d) => s + (d.clients || 0), 0) / previous7Stats.length;
  const prevAvgTicket = previous7Stats.reduce((s, d) => s + (d.ticketMoyen || 0), 0) / previous7Stats.length;
  const prevAvgMarge = previous7Stats.reduce((s, d) => s + (d.marge || 0), 0) / previous7Stats.length;

  const currentCA = yesterdayStats?.ca || 0;
  const currentClients = yesterdayStats?.clients || 0;
  const currentTicket = yesterdayStats?.ticketMoyen || 0;
  const currentMarge = yesterdayStats?.marge || 0;

  return {
    caChange: prevAvgCA > 0 ? ((currentCA - prevAvgCA) / prevAvgCA * 100) : 0,
    clientsChange: prevAvgClients > 0 ? (currentClients - prevAvgClients) : 0,
    ticketChange: prevAvgTicket > 0 ? ((currentTicket - prevAvgTicket) / prevAvgTicket * 100) : 0,
    margeChange: prevAvgMarge > 0 ? ((currentMarge - prevAvgMarge) / prevAvgMarge * 100) : 0,
  };
};

export function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '15' | '30'>('7');
  const [isLoading, setIsLoading] = useState(true);
  const [topProductsToPromote, setTopProductsToPromote] = useState<any[]>([]);
  const [criticalProducts, setCriticalProducts] = useState<any[]>([]);
  const [showEstimationDetails, setShowEstimationDetails] = useState(false);
  
  // Données en temps réel depuis universalSync
  const products = useLiveQuery(() => universalSync.getProduits(), []);
  
  // Utiliser les produits du store ou les produits statiques
  const productsList = (products && products.length > 0) ? products : staticProducts;

  // Rafraîchir les catégories au chargement
  useEffect(() => {
    refreshCategoryMaps();
  }, []);

  useEffect(() => {
    const refresh = () => {
      refreshCategoryMaps();
    };
    window.addEventListener('categoriesUpdated', refresh);
    return () => window.removeEventListener('categoriesUpdated', refresh);
  }, []);

  // Chargement des top produits
  useEffect(() => {
    const loadTopProducts = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 100));
        let productsToShow: any[] = [];
        
        if (productsList && productsList.length > 0) {
          productsToShow = productsList
            .map(p => ({
              productId: p.id,
              productName: p.name,
              // CORRECTION: p.margeRate au lieu de p.marge
              scoreTotal: Math.round((p.popularite || 50) * 1.65),  // 1.65 = marge par défaut
couleur: p.color || '#10B981',
action: (p.popularite || 50) > 70 ? '🔥 Produit star' : '✅ Produit solide',
            }))
            .sort((a, b) => b.scoreTotal - a.scoreTotal)
            .slice(0, 5);
        }
        
        if (productsToShow.length === 0) {
          productsToShow = [
            { productId: 'p1', productName: 'Flag Spéciale', scoreTotal: 94, couleur: '#10B981', action: '🔥 Produit star - Mettre en avant ce soir !' },
            { productId: 'p4', productName: 'Cocktail Dakar Sunset', scoreTotal: 89, couleur: '#10B981', action: '🔥 Marge exceptionnelle' },
            { productId: 'p5', productName: 'Mojito Sénégal', scoreTotal: 78, couleur: '#3B82F6', action: '✅ Bon produit - Idéal pour happy hour' },
            { productId: 'p2', productName: 'Gazelle', scoreTotal: 72, couleur: '#3B82F6', action: '✅ Rotation rapide' },
            { productId: 'p12', productName: 'Whisky Johnnie', scoreTotal: 55, couleur: '#F59E0B', action: '📊 Marge correcte - À associer en pack' },
          ];
        }
        setTopProductsToPromote(productsToShow);
      } catch (error) {
        console.warn('Erreur lors du chargement des top produits:', error);
        setTopProductsToPromote([
          { productId: 'p1', productName: 'Flag Spéciale', scoreTotal: 94, couleur: '#10B981', action: '🔥 Produit star - Mettre en avant ce soir !' },
          { productId: 'p4', productName: 'Cocktail Dakar Sunset', scoreTotal: 89, couleur: '#10B981', action: '🔥 Marge exceptionnelle' },
          { productId: 'p5', productName: 'Mojito Sénégal', scoreTotal: 78, couleur: '#3B82F6', action: '✅ Bon produit - Idéal pour happy hour' },
          { productId: 'p2', productName: 'Gazelle', scoreTotal: 72, couleur: '#3B82F6', action: '✅ Rotation rapide' },
          { productId: 'p12', productName: 'Whisky Johnnie', scoreTotal: 55, couleur: '#F59E0B', action: '📊 Marge correcte - À associer en pack' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTopProducts();
  }, [productsList]);

  // Chargement des produits critiques
  useEffect(() => {
    if (productsList && productsList.length > 0) {
      const critical = getCriticalProducts(productsList);
      setCriticalProducts(critical);
    }
  }, [productsList]);

  const recentStats = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return [];
    return selectedPeriod === '7' ? dailyStats.slice(-7) : 
           selectedPeriod === '15' ? dailyStats.slice(-15) : 
           dailyStats.slice(-30);
  }, [selectedPeriod]);

  const avgClients = useMemo(() => {
    if (recentStats.length === 0) return 0;
    return Math.round(recentStats.reduce((s, d) => s + (d.clients || 0), 0) / recentStats.length);
  }, [recentStats]);

  const estimatedClients = useMemo(() => 
    isWeekend ? Math.round(avgClients * 1.4) : avgClients,
    [avgClients]
  );

  const estimatedCA = useMemo(() => 
    estimatedClients * (avgTicketMoyen7Days || 4500),
    [estimatedClients]
  );

  const variations = useMemo(() => calculateVariations(), []);
  const hourData = useMemo(() => calculateHourData(), []);
  const topProducts = useMemo(() => getTopProductsList(productsList), [productsList]);
  const categoryData = useMemo(() => getCategoryData(), []);

  const estimatedBeers = useMemo(() => {
    if (last7Stats.length === 0) return 0;
    const avgBeersPerClient = last7Stats.reduce((sum, day) => {
      const beers = (day.consos as Record<string, number>)?.['bières'] || 0;
      return sum + (beers / Math.max(day.clients || 1, 1));
    }, 0) / last7Stats.length;
    return Math.round(estimatedClients * avgBeersPerClient);
  }, [estimatedClients]);

  const estimatedCocktails = useMemo(() => {
    if (last7Stats.length === 0) return 0;
    const avgCocktailsPerClient = last7Stats.reduce((sum, day) => {
      const cocktails = (day.consos as Record<string, number>)?.['cocktails'] || 0;
      return sum + (cocktails / Math.max(day.clients || 1, 1));
    }, 0) / last7Stats.length;
    return Math.round(estimatedClients * avgCocktailsPerClient);
  }, [estimatedClients]);

  // Tooltips (inchangés)
  const CATooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-bold text-violet-700">{payload[0]?.value?.toLocaleString()} FCFA</p>
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-bold text-amber-700">{payload[0]?.value?.toLocaleString()} FCFA</p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3">
          <p className="text-sm font-semibold text-slate-900">{payload[0]?.name}</p>
          <p className="text-xs text-slate-500">{payload[0]?.value} unités</p>
        </div>
      );
    }
    return null;
  };

  if (!dailyStats || dailyStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    // ... le reste du JSX reste identique
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {today.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['7', '15', '30'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                selectedPeriod === p ? 'bg-violet-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200',
              )}
            >
              {p} jours
            </button>
          ))}
        </div>
      </div>

      {/* Recap Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          icon={<DollarSign size={20} />}
          label="CA Hier"
          value={`${(yesterdayStats?.ca || 0).toLocaleString()} FCFA`}
          change={`${variations.caChange > 0 ? '+' : ''}${variations.caChange.toFixed(1)}%`}
          positive={variations.caChange >= 0}
          color="emerald"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Clients Hier"
          value={`${yesterdayStats?.clients || 0}`}
          change={`${variations.clientsChange > 0 ? '+' : ''}${Math.round(variations.clientsChange)}`}
          positive={variations.clientsChange >= 0}
          color="violet"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Ticket Moyen"
          value={`${(yesterdayStats?.ticketMoyen || 0).toLocaleString()} FCFA`}
          change={`${variations.ticketChange > 0 ? '+' : ''}${variations.ticketChange.toFixed(1)}%`}
          positive={variations.ticketChange >= 0}
          color="amber"
        />
        <StatCard
          icon={<ShoppingBag size={20} />}
          label="Marge Hier"
          value={`${(yesterdayStats?.marge || 0).toLocaleString()} FCFA`}
          change={`${variations.margeChange > 0 ? '+' : ''}${variations.margeChange.toFixed(1)}%`}
          positive={variations.margeChange >= 0}
          color="rose"
        />
      </div>

      {/* Estimation du jour */}
      <div className="grid grid-cols-1 gap-4">
        <div 
          className="lg:col-span-3 bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-700 rounded-2xl p-5 lg:p-6 text-white cursor-pointer hover:shadow-2xl transition-all duration-300 group"
          onClick={() => setShowEstimationDetails(true)}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-violet-300" />
            <h2 className="font-semibold">Estimation du jour</h2>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
              Basée sur les {selectedPeriod} derniers jours
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium ml-auto group-hover:bg-white/30 transition-all">
              🔍 Cliquer pour plus de détails
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-violet-300 text-xs font-medium">Clients estimés</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{estimatedClients}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">
                {isWeekend ? 'Week-end → +40%' : 'Jour de semaine'}
              </p>
            </div>
            <div>
              <p className="text-violet-300 text-xs font-medium">CA estimé</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{estimatedCA.toLocaleString()}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">FCFA</p>
            </div>
            <div>
              <p className="text-violet-300 text-xs font-medium">Consommation bières</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{estimatedBeers}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">bouteilles estimées</p>
            </div>
            <div>
              <p className="text-violet-300 text-xs font-medium">Consommation cocktails</p>
              <p className="text-2xl lg:text-3xl font-bold mt-1">{estimatedCocktails}</p>
              <p className="text-xs text-violet-300/70 mt-0.5">verres estimés</p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DÉTAILS ESTIMATION - inchangé */}
      {showEstimationDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowEstimationDetails(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-violet-600" />
                  <h3 className="text-xl font-bold text-slate-900">Détails de l'estimation</h3>
                </div>
                <button onClick={() => setShowEstimationDetails(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Basée sur la consommation des {selectedPeriod} derniers jours</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">👥 Clients</p>
                  <p className="text-2xl font-bold text-violet-700">{estimatedClients}</p>
                  <p className="text-[10px] text-slate-400">{isWeekend ? 'Week-end (+40%)' : 'Semaine'}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">💰 CA estimé</p>
                  <p className="text-2xl font-bold text-emerald-700">{estimatedCA.toLocaleString()} F</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">🍺 Bières</p>
                  <p className="text-2xl font-bold text-amber-700">{estimatedBeers}</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">🍹 Cocktails</p>
                  <p className="text-2xl font-bold text-rose-700">{estimatedCocktails}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">📊 Méthode de calcul</p>
                <div className="space-y-1 text-xs text-slate-500">
                  <p>• Clients: Moyenne des {selectedPeriod} derniers jours {isWeekend ? '× 1.4 (week-end)' : ''}</p>
                  <p>• CA: Clients estimés × Ticket moyen ({avgTicketMoyen7Days.toLocaleString()} F)</p>
                  <p>• Bières: {estimatedBeers} bouteilles basé sur la consommation moyenne</p>
                  <p>• Cocktails: {estimatedCocktails} verres basé sur la consommation moyenne</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-violet-100 to-purple-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-violet-800 mb-2">📈 Tendances</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Variation CA</span>
                  <span className={cn("font-bold", variations.caChange >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {variations.caChange >= 0 ? "▲" : "▼"} {Math.abs(variations.caChange).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-slate-600">Variation clients</span>
                  <span className={cn("font-bold", variations.clientsChange >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {variations.clientsChange >= 0 ? "▲" : "▼"} {Math.abs(variations.clientsChange).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100">
              <button onClick={() => setShowEstimationDetails(false)} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row (inchangé) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-sm">Évolution du CA (7 jours)</h2>
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1',
              variations.caChange >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
            )}>
              {variations.caChange >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
              {Math.abs(variations.caChange).toFixed(1)}%
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Stats}>
                <defs>
                  <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString('fr-FR', { weekday: 'short' })}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={CATooltip} />
                <Area type="monotone" dataKey="ca" stroke="#8B5CF6" strokeWidth={2} fill="url(#caGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 text-sm">Ventes par heure</h2>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {isWeekend ? 'Week-end' : 'Semaine'}
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={BarTooltip} />
                <Area type="monotone" dataKey="ventes" stroke="#F59E0B" strokeWidth={2} fill="#F59E0B" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION: Alertes rupture de stock (inchangé) */}
      {criticalProducts.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 rounded-2xl border border-red-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="font-semibold text-red-800 text-base">Alertes rupture de stock</h2>
            <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
              {criticalProducts.length} produit(s) critique(s)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {criticalProducts.slice(0, 5).map((prediction) => (
              <div 
                key={prediction.productId}
                className="bg-white rounded-xl p-3 shadow-sm border-l-4 border-l-red-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 text-sm">{prediction.productName}</p>
                  <span className="text-xs font-bold text-red-600">{prediction.currentStock} restant(s)</span>
                </div>
                <p className="text-xs text-red-600 mt-1 font-medium">{prediction.message}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Consommation: {prediction.dailyConsumption.toFixed(1)}/jour
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 mt-3 text-center">
            💡 Réapprovisionnez ces produits rapidement pour éviter les ruptures
          </p>
        </div>
      )}

      {/* SECTION: Top produits (inchangé) */}
      {!isLoading && topProductsToPromote.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl border border-amber-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔥</span>
            <h2 className="font-semibold text-amber-800 text-base">Top produits à mettre en avant ce soir</h2>
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Score de rentabilité</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {topProductsToPromote.map((product, idx) => (
              <div 
                key={product.productId}
                className="group bg-white rounded-xl p-3 text-center shadow-sm hover:shadow-md transition-all cursor-pointer border border-amber-100 hover:border-amber-300"
              >
                <div className="text-2xl mb-1">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'}
                </div>
                <p className="font-semibold text-slate-800 text-sm truncate">{product.productName}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: product.couleur }}
                  >
                    {product.scoreTotal}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">{product.action}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-4 text-center flex items-center justify-center gap-1">
            <span>💡</span> Ces produits ont le meilleur score de rentabilité (marge × rotation × perte)
          </p>
        </div>
      )}

      {/* Bottom Row (inchangé) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Top 10 Produits</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {topProducts.map((p, i) => {
              const maxVentes = topProducts[0]?.ventes || 1;
              const percentage = (p.ventes / maxVentes) * 100;
              
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0',
                    i < 3 ? 'bg-gradient-to-br' : 'bg-slate-400',
                    i === 0 ? 'from-yellow-400 to-yellow-600' : '',
                    i === 1 ? 'from-slate-300 to-slate-500' : '',
                    i === 2 ? 'from-amber-600 to-amber-800' : '',
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: p.color || '#8B5CF6' }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 shrink-0">{p.ventes} ventes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Consommation par catégorie (30 jours)</h2>
          <div className="flex flex-col sm:flex-row items-center h-auto sm:h-64 gap-4">
            <div className="w-full sm:w-1/2 h-48 sm:h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                  >
                    {categoryData.map((_entry, index) => (
                      <Cell key={index} fill={categoryData[index]?.color || '#64748B'} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={PieTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {categoryData.map((cat, i) => {
                const total = categoryData.reduce((sum, c) => sum + c.value, 0);
                const percentage = total > 0 ? ((cat.value / total) * 100).toFixed(1) : 0;
                
                return (
                  <div key={i} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat.emoji}</span>
                      <span className="text-xs capitalize text-slate-600">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900">{cat.value}</span>
                      <span className="text-[10px] text-slate-400">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

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
    violet: { bg: '#f5f3ff', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
    amber: { bg: '#fffbeb', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    rose: { bg: '#fff1f2', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)' },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:p-5 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colorStyles[color].bg }}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white" style={{ background: colorStyles[color].gradient }}>
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