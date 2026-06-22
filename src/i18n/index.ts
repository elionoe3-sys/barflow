import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ─── FRANÇAIS ───────────────────────────────────────────────
import frCommon from './locales/fr/common.json';
import frSettings from './locales/fr/settings.json';
import frOrders from './locales/fr/orders.json';
import frStocks from './locales/fr/stocks.json';
import frDashboard from './locales/fr/dashboard.json';
import frReappro from './locales/fr/reappro.json';
import frFinance from './locales/fr/finance.json';
import frBilan from './locales/fr/bilan.json';
import frLicense from './locales/fr/license.json';
import frPayments from './locales/fr/payments.json';
import frSidebar from './locales/fr/sidebar.json';
import frSync from './locales/fr/sync.json';
import frPdf from './locales/fr/pdf.json';
import frValidation from './locales/fr/validation.json';

// ─── ANGLAIS ──────────────────────────────────────────────────
import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enOrders from './locales/en/orders.json';
import enStocks from './locales/en/stocks.json';
import enDashboard from './locales/en/dashboard.json';
import enReappro from './locales/en/reappro.json';
import enFinance from './locales/en/finance.json';
import enBilan from './locales/en/bilan.json';
import enLicense from './locales/en/license.json';
import enPayments from './locales/en/payments.json';
import enSidebar from './locales/en/sidebar.json';
import enSync from './locales/en/sync.json';
import enPdf from './locales/en/pdf.json';
import enValidation from './locales/en/validation.json';

// ─── ARABE ────────────────────────────────────────────────────
import arCommon from './locales/ar/common.json';
import arSettings from './locales/ar/settings.json';
import arOrders from './locales/ar/orders.json';
import arStocks from './locales/ar/stocks.json';
import arDashboard from './locales/ar/dashboard.json';
import arReappro from './locales/ar/reappro.json';
import arFinance from './locales/ar/finance.json';
import arBilan from './locales/ar/bilan.json';
import arLicense from './locales/ar/license.json';
import arPayments from './locales/ar/payments.json';
import arSidebar from './locales/ar/sidebar.json';
import arSync from './locales/ar/sync.json';
import arPdf from './locales/ar/pdf.json';
import arValidation from './locales/ar/validation.json';

// ─── WOLOF ────────────────────────────────────────────────────
import woCommon from './locales/wo/common.json';
import woSettings from './locales/wo/settings.json';
import woOrders from './locales/wo/orders.json';
import woStocks from './locales/wo/stocks.json';
import woDashboard from './locales/wo/dashboard.json';
import woReappro from './locales/wo/reappro.json';
import woFinance from './locales/wo/finance.json';
import woBilan from './locales/wo/bilan.json';
import woLicense from './locales/wo/license.json';
import woPayments from './locales/wo/payments.json';
import woSidebar from './locales/wo/sidebar.json';
import woSync from './locales/wo/sync.json';
import woPdf from './locales/wo/pdf.json';
import woValidation from './locales/wo/validation.json';

// ─── DIOLA (DYO) ─────────────────────────────────────────────
import dyoCommon from './locales/dyo/common.json';
import dyoSettings from './locales/dyo/settings.json';
import dyoOrders from './locales/dyo/orders.json';
import dyoStocks from './locales/dyo/stocks.json';
import dyoDashboard from './locales/dyo/dashboard.json';
import dyoReappro from './locales/dyo/reappro.json';
import dyoFinance from './locales/dyo/finance.json';
import dyoBilan from './locales/dyo/bilan.json';
import dyoLicense from './locales/dyo/license.json';
import dyoPayments from './locales/dyo/payments.json';
import dyoSidebar from './locales/dyo/sidebar.json';
import dyoSync from './locales/dyo/sync.json';
import dyoPdf from './locales/dyo/pdf.json';
import dyoValidation from './locales/dyo/validation.json';

// ─── SÉRÈRE (SRR) ────────────────────────────────────────────
import srrCommon from './locales/srr/common.json';
import srrSettings from './locales/srr/settings.json';
import srrOrders from './locales/srr/orders.json';
import srrStocks from './locales/srr/stocks.json';
import srrDashboard from './locales/srr/dashboard.json';
import srrReappro from './locales/srr/reappro.json';
import srrFinance from './locales/srr/finance.json';
import srrBilan from './locales/srr/bilan.json';
import srrLicense from './locales/srr/license.json';
import srrPayments from './locales/srr/payments.json';
import srrSidebar from './locales/srr/sidebar.json';
import srrSync from './locales/srr/sync.json';
import srrPdf from './locales/srr/pdf.json';
import srrValidation from './locales/srr/validation.json';

// ─── MANCAGNE (MAN) ──────────────────────────────────────────
import manCommon from './locales/man/common.json';
import manSettings from './locales/man/settings.json';
import manOrders from './locales/man/orders.json';
import manStocks from './locales/man/stocks.json';
import manDashboard from './locales/man/dashboard.json';
import manReappro from './locales/man/reappro.json';
import manFinance from './locales/man/finance.json';
import manBilan from './locales/man/bilan.json';
import manLicense from './locales/man/license.json';
import manPayments from './locales/man/payments.json';
import manSidebar from './locales/man/sidebar.json';
import manSync from './locales/man/sync.json';
import manPdf from './locales/man/pdf.json';
import manValidation from './locales/man/validation.json';

// ─── LANGUES DISPONIBLES ─────────────────────────────────────
export const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', native: 'Français', dir: 'ltr' },
  { code: 'en', name: 'English', flag: '🇬🇧', native: 'English', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', native: 'العربية', dir: 'rtl' },
  { code: 'wo', name: 'Wolof', flag: '🇸🇳', native: 'Wolof', dir: 'ltr' },
  { code: 'dyo', name: 'Diola', flag: '🇸🇳', native: 'Diola', dir: 'ltr' },
  { code: 'srr', name: 'Sérère', flag: '🇸🇳', native: 'Sérère', dir: 'ltr' },
  { code: 'man', name: 'Mancagne', flag: '🇸🇳', native: 'Mancagne', dir: 'ltr' },
];

// ─── RESSOURCES ──────────────────────────────────────────────
const resources = {
  fr: {
    common: frCommon,
    settings: frSettings,
    orders: frOrders,
    stocks: frStocks,
    dashboard: frDashboard,
    reappro: frReappro,
    finance: frFinance,
    bilan: frBilan,
    license: frLicense,
    payments: frPayments,
    sidebar: frSidebar,
    sync: frSync,
    pdf: frPdf,
    validation: frValidation,
  },
  en: {
    common: enCommon,
    settings: enSettings,
    orders: enOrders,
    stocks: enStocks,
    dashboard: enDashboard,
    reappro: enReappro,
    finance: enFinance,
    bilan: enBilan,
    license: enLicense,
    payments: enPayments,
    sidebar: enSidebar,
    sync: enSync,
    pdf: enPdf,
    validation: enValidation,
  },
  ar: {
    common: arCommon,
    settings: arSettings,
    orders: arOrders,
    stocks: arStocks,
    dashboard: arDashboard,
    reappro: arReappro,
    finance: arFinance,
    bilan: arBilan,
    license: arLicense,
    payments: arPayments,
    sidebar: arSidebar,
    sync: arSync,
    pdf: arPdf,
    validation: arValidation,
  },
  wo: {
    common: woCommon,
    settings: woSettings,
    orders: woOrders,
    stocks: woStocks,
    dashboard: woDashboard,
    reappro: woReappro,
    finance: woFinance,
    bilan: woBilan,
    license: woLicense,
    payments: woPayments,
    sidebar: woSidebar,
    sync: woSync,
    pdf: woPdf,
    validation: woValidation,
  },
  dyo: {
    common: dyoCommon,
    settings: dyoSettings,
    orders: dyoOrders,
    stocks: dyoStocks,
    dashboard: dyoDashboard,
    reappro: dyoReappro,
    finance: dyoFinance,
    bilan: dyoBilan,
    license: dyoLicense,
    payments: dyoPayments,
    sidebar: dyoSidebar,
    sync: dyoSync,
    pdf: dyoPdf,
    validation: dyoValidation,
  },
  srr: {
    common: srrCommon,
    settings: srrSettings,
    orders: srrOrders,
    stocks: srrStocks,
    dashboard: srrDashboard,
    reappro: srrReappro,
    finance: srrFinance,
    bilan: srrBilan,
    license: srrLicense,
    payments: srrPayments,
    sidebar: srrSidebar,
    sync: srrSync,
    pdf: srrPdf,
    validation: srrValidation,
  },
  man: {
    common: manCommon,
    settings: manSettings,
    orders: manOrders,
    stocks: manStocks,
    dashboard: manDashboard,
    reappro: manReappro,
    finance: manFinance,
    bilan: manBilan,
    license: manLicense,
    payments: manPayments,
    sidebar: manSidebar,
    sync: manSync,
    pdf: manPdf,
    validation: manValidation,
  },
};

// ─── GESTION RTL (Right to Left) ─────────────────────────────
const rtlLanguages = ['ar'];

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('barflow_lang') || 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    ns: [
      'common', 'settings', 'orders', 'stocks', 'dashboard',
      'reappro', 'finance', 'bilan', 'license', 'payments',
      'sidebar', 'sync', 'pdf', 'validation',
    ],
    defaultNS: 'common',
  });

// Changer la direction du document quand la langue change
i18n.on('languageChanged', (lng) => {
  const isRTL = rtlLanguages.includes(lng);
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
  
  if (isRTL) {
    document.documentElement.classList.add('rtl');
  } else {
    document.documentElement.classList.remove('rtl');
  }
  
  localStorage.setItem('barflow_lang', lng);
});

export default i18n;