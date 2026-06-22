import type { TabId } from '@/types';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart3, Settings,
  Bell, LogOut, Menu, X, Truck,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// ✅ Garder label pour l'affichage, mais utiliser les clés de traduction
const tabs: { id: TabId; label: string; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Tableau de Bord', labelKey: 'links.dashboard', icon: LayoutDashboard },
  { id: 'orders',    label: 'Commandes',       labelKey: 'links.orders',    icon: ShoppingCart    },
  { id: 'stocks',    label: 'Gestion des Stocks', labelKey: 'links.stocks', icon: Package         },
  { id: 'reappro',   label: 'Réapprovisionnement', labelKey: 'links.reappro', icon: Truck           },
  { id: 'finance',   label: 'Finance & Analyses', labelKey: 'links.finance', icon: BarChart3       },
  { id: 'settings',  label: 'Paramètres',      labelKey: 'links.settings',  icon: Settings        },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { t } = useTranslation('sidebar');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-slate-900 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div className="flag-gradient w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
          <span className="font-bold text-white text-sm">{t('brand.name')}</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white p-1">
          <Menu size={22} />
        </button>
      </div>

      <aside className={cn(
        'fixed lg:relative z-40 h-screen transition-all duration-300 flex flex-col',
        'lg:w-[260px]',
        mobileOpen ? 'w-[260px] left-0' : 'w-[260px] -left-[260px] lg:left-0',
        'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white',
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flag-gradient w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
              B
            </div>
            <div className="animate-fadeIn">
              <h1 className="font-bold text-base leading-tight">{t('brand.name')}</h1>
              <p className="text-[10px] text-white/50 font-medium">{t('brand.tagline')}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-white/40 hover:text-white transition-colors lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            // ✅ Utiliser labelKey pour la traduction, label en fallback
            const label = t(tab.labelKey, tab.label);
            return (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setMobileOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600/40 to-fuchsia-600/20 text-white shadow-md border border-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all',
                  isActive ? 'bg-violet-500/30' : 'bg-white/5 group-hover:bg-white/10',
                )}>
                  <Icon size={18} className={isActive ? 'text-violet-300' : ''} />
                </div>
                <span className="text-sm font-medium animate-fadeIn">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Espace vide en bas - plus rien n'est affiché */}
        <div className="px-3 py-3" />
      </aside>
    </>
  );
}