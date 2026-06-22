// ============================================
// src/App.tsx — Version avec système de licence
// ============================================

import { useState, useEffect } from 'react';
import type { TabId } from '@/types';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { Orders } from '@/components/Orders';
import { Stocks } from '@/components/Stocks';
import { Finance } from '@/components/Finance';
import { Settings } from '@/components/Settings';
import { Reappro } from '@/components/Reappro';
import { LicenseGate } from '@/components/LicenseGate';
import { initDbWithDefaults } from '@/utils/db-offline';
import { db } from '@/db';
import { products } from '@/data';
import { useBarInfo } from '@/hooks/useBarInfo';
import {
  verifyLicense,
  loadLicense,
  getPlanFeatures,
  type LicenseInfo,
  type Plan,
} from '@/utils/license';
import i18n from '@/i18n';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId | 'settings'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const { barInfo } = useBarInfo();


  // Appliquer la direction RTL pour l'arabe
  useEffect(() => {
  const lang = i18n.language || 'fr';
  const html = document.documentElement;
  if (lang === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'fr');
  }
}, []);

  useEffect(() => {
    // 1. Vérifie la licence sauvegardée
    const savedKey = loadLicense();
    if (savedKey) {
      const result = verifyLicense(savedKey);
      if (result.valid) {
        setLicenseInfo(result);
      }
    }

    // 2. Initialise la base de données
    initDbWithDefaults(products as unknown as Record<string, unknown>[])
      .then(async () => {
        // Nettoyage ponctuel des doublons de produits créés par l'ancien bug
        // (addProduit générait un nouvel uuid à chaque démarrage au lieu de
        // respecter l'id du produit statique, donc les 15 produits par
        // défaut étaient réinjectés à chaque ouverture de l'app).
        // On ne le fait qu'une fois grâce à un flag dans localStorage.
        const dedupeDone = localStorage.getItem('barflow_dedupe_v1_done');
        if (!dedupeDone) {
          try {
            const removed = await db.dedupeProduits();
            if (removed > 0) {
              console.log(`🧹 Nettoyage : ${removed} produit(s) en double supprimé(s).`);
            }
          } catch (e) {
            console.warn('Échec du nettoyage des doublons:', e);
          } finally {
            localStorage.setItem('barflow_dedupe_v1_done', '1');
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Écran de chargement ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-fuchsia-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl mx-auto mb-4 animate-pulse">
            B
          </div>
          <h1 className="text-xl font-bold text-slate-900">BarFlow</h1>
          <p className="text-sm text-slate-500 mt-1">Chargement en cours...</p>
          <div className="mt-4 w-32 h-1 bg-slate-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Écran de licence si pas de licence valide ────────────────
  if (!licenseInfo?.valid) {
    return (
      <LicenseGate
        onActivated={(info) => setLicenseInfo(info)}
      />
    );
  }

  // ── Logiciel principal ───────────────────────────────────────
  const features = getPlanFeatures(licenseInfo.plan as Plan);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return features.canAccessDashboard
          ? <Dashboard />
          : <Locked tab="Tableau de bord" />;
      case 'orders':
        return features.canAccessOrders
          ? <Orders />
          : <Locked tab="Commandes" />;
      case 'stocks':
        return features.canAccessStocks
          ? <Stocks />
          : <Locked tab="Stocks" />;
      case 'reappro':
        return features.canAccessStocks
          ? <Reappro />
          : <Locked tab="Réapprovisionnement" />;
      case 'finance':
        return features.canAccessFinance
          ? <Finance />
          : <Locked tab="Finance" />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Bandeau licence en haut */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <LicenseBanner info={licenseInfo} plan={features.label} />
        
        {/* Affichage des informations du bar dans l'en-tête */}
        {barInfo.name && (
          <div className="hidden lg:block absolute top-4 right-4 z-10 text-right">
            <p className="text-xs font-medium text-white/80">{barInfo.name}</p>
            {barInfo.phone && <p className="text-[10px] text-white/50">{barInfo.phone}</p>}
          </div>
        )}
        
        <main className="flex-1 overflow-auto pt-14 lg:pt-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// ── Composant : page verrouillée ─────────────────────────────
function Locked({ tab }: { tab: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-4xl mx-auto mb-4">
          🔒
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{tab} verrouillé</h2>
        <p className="text-slate-500 text-sm mb-6">
          Cette fonctionnalité n'est pas incluse dans votre formule actuelle.
          Contactez votre revendeur pour upgrader votre licence.
        </p>
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <p className="text-xs text-violet-600 font-medium">
            📞 Contactez-nous pour upgrader
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Composant : bandeau licence ──────────────────────────────
function LicenseBanner({ info, plan }: { info: LicenseInfo; plan: string }) {
  if (!info.valid) return null;

  const isExpiringSoon = info.daysLeft <= 7;
  const isExpiring = info.daysLeft <= 30;

  if (!isExpiring) return null; // Pas de bandeau si > 30 jours

  return (
    <div className={`px-4 py-2 text-xs font-medium text-center ${
      isExpiringSoon
        ? 'bg-red-500 text-white'
        : 'bg-amber-400 text-amber-900'
    }`}>
      {isExpiringSoon
        ? `⚠️ Licence ${plan} expire dans ${info.daysLeft} jour(s) ! Renouvelez maintenant.`
        : `🕐 Licence ${plan} — expire dans ${info.daysLeft} jour(s)`
      }
    </div>
  );
}
