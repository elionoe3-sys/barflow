import { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Shield, Users, Printer, Database,
  Save, Download, Upload, RefreshCw, Lock, KeyRound,
  Languages, Wifi, Smartphone, Check, AlertCircle,
  Eye, EyeOff, Phone, Building2, Trash2,
  QrCode, AlertTriangle, HelpCircle, Mail, CreditCard, Loader2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getSetting, setSetting } from '@/utils/db';
import { useProducts } from '@/utils/productStore';
import { useLosses } from '@/utils/lossStore';
import { useTranslation } from 'react-i18next';  // ← AJOUTER CETTE LIGNE


const themes = [
  { id: 'light', label: 'Clair', icon: Sun, preview: 'bg-white border-slate-200' },
   { id: 'daltonien', label: '♿ Daltonien', icon: Eye, preview: 'bg-[#f5f0e8] border-[#d4c9b8]' },
  { id: 'senegal', label: 'Sénégal 🇸🇳', icon: Monitor, preview: 'bg-gradient-to-r from-green-600 via-yellow-400 to-red-600 border-green-700' },
];

const colorSchemes = [
  { id: 'violet', label: 'Violet', preview: 'bg-gradient-to-r from-violet-500 to-purple-600' },
  { id: 'emerald', label: 'Émeraude', preview: 'bg-gradient-to-r from-emerald-500 to-teal-600' },
  { id: 'blue', label: 'Bleu', preview: 'bg-gradient-to-r from-blue-500 to-cyan-600' },
  { id: 'rose', label: 'Rose', preview: 'bg-gradient-to-r from-rose-500 to-pink-600' },
  { id: 'amber', label: 'Ambre', preview: 'bg-gradient-to-r from-amber-500 to-orange-600' },
];

const networkConfigs = [
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi, placeholder: 'SSID du réseau' },
  { id: 'printer', label: 'Imprimante', icon: Printer, placeholder: 'Adresse IP ou nom' },
  { id: 'caisse', label: 'Caisse secondaire', icon: Smartphone, placeholder: 'Adresse IP' },
];

const SECRET_QUESTIONS = [
  'Quel est le nom de votre premier animal de compagnie ?',
  'Quel est le prénom de votre mère ?',
  'Dans quelle ville êtes-vous né(e) ?',
  'Quel était le nom de votre école primaire ?',
  'Quelle est la marque de votre premier véhicule ?',
  'Quel est votre plat préféré ?',
  'Quel est le surnom de votre meilleur(e) ami(e) ?',
];

export function Settings() {
  const { t, i18n } = useTranslation('settings');  // ← AJOUTER CETTE LIGNE (déplacer vers le haut)

  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'backup' | 'security' | 'payments'>('general');
  const [theme, setTheme] = useState('light');
  const [colorScheme, setColorScheme] = useState('violet');
  const [language, setLanguage] = useState('fr');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [adminPassword, setAdminPassword] = useState('admin123');
  

  // Verrouillage de l'onglet Paiements (Wave / Orange Money)
  const [paymentsUnlocked, setPaymentsUnlocked] = useState(false);
  const [paymentsPasswordInput, setPaymentsPasswordInput] = useState('');
  const [paymentsPasswordError, setPaymentsPasswordError] = useState('');

  // Changement mot de passe
  const [changePasswordMode, setChangePasswordMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [secretQuestion, setSecretQuestion] = useState(SECRET_QUESTIONS[0]);
  const [secretAnswer, setSecretAnswer] = useState('');
  const [savedSecretQuestion, setSavedSecretQuestion] = useState('');
  const [savedSecretAnswer, setSavedSecretAnswer] = useState('');

  // Récupération mot de passe
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'choose' | 'email' | 'offline' | 'code' | 'reset'>('choose');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sendingEmail, setSendingEmail] = useState(false);

  // SUPPRIMER CETTE LIGNE (déjà déclaré plus haut)
  // const { t, i18n } = useTranslation('settings');

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('barflow_lang', lang);
    setLanguage(lang);
  };

  const [restaurantInfo, setRestaurantInfo] = useState({ name: '', address: '', phone: '', email: '', taxNumber: '' });
  const [printerSettings, setPrinterSettings] = useState({ type: 'network', ipAddress: '', port: '9100', paperSize: '80mm' });
  const [networkSettings, setNetworkSettings] = useState({ wifi: '', printer: '', caisseSecondaire: '' });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);

  const [waveApi, setWaveApi] = useState({ merchantId: '', apiKey: '', apiSecret: '', webhookSecret: '' });
  const [orangeApi, setOrangeApi] = useState({ merchantId: '', apiLogin: '', apiPassword: '', apiKey: '' });
  const [merchantNumbers, setMerchantNumbers] = useState({ wave: '', orange: '' });

  const { products } = useProducts();
  const { losses } = useLosses();

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const applyFullTheme = (themeMode: string, colorSchemeMode: string) => {
    const html = document.documentElement;
    
    // Appliquer le thème
    if (themeMode === 'daltonien') {
      html.setAttribute('data-theme', 'daltonien');
      html.style.setProperty('--color-barflow-primary', '#0077BB');
      html.style.setProperty('--color-barflow-secondary', '#EE7733');
      html.style.setProperty('--color-barflow-accent', '#009988');
      html.style.setProperty('--color-barflow-primary-dark', '#005588');
      html.style.setProperty('--app-primary-light', '#e6f0fa');
      html.style.setProperty('--app-primary-dark', '#005588');
    } else if (themeMode === 'senegal') {
      html.setAttribute('data-theme', 'senegal');
      html.style.setProperty('--color-barflow-primary', '#00a859');
      html.style.setProperty('--color-barflow-secondary', '#e31b23');
      html.style.setProperty('--color-barflow-accent', '#fdce12');
      html.style.setProperty('--color-barflow-primary-dark', '#008544');
      html.style.setProperty('--app-primary-light', '#e8f5e9');
      html.style.setProperty('--app-primary-dark', '#008544');
    } else if (themeMode === 'light') {
      html.setAttribute('data-theme', 'light');
      // Réinitialiser toutes les variables
      html.style.removeProperty('--color-barflow-primary');
      html.style.removeProperty('--color-barflow-secondary');
      html.style.removeProperty('--color-barflow-accent');
      html.style.removeProperty('--color-barflow-primary-dark');
      html.style.removeProperty('--app-primary-light');
      html.style.removeProperty('--app-primary-dark');
    } else {
      // 'system' - par défaut on utilise light
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.setAttribute('data-theme', isDark ? 'daltonien' : 'light');
      html.style.removeProperty('--color-barflow-primary');
      html.style.removeProperty('--color-barflow-secondary');
      html.style.removeProperty('--color-barflow-accent');
      html.style.removeProperty('--color-barflow-primary-dark');
      html.style.removeProperty('--app-primary-light');
      html.style.removeProperty('--app-primary-dark');
    }
    
    // Appliquer la couleur (sauf pour les thèmes qui ont leurs propres couleurs)
    if (themeMode !== 'senegal' && themeMode !== 'daltonien') {
      html.setAttribute('data-color', colorSchemeMode);
      const colorMap: Record<string, string> = {
        violet: '#8B5CF6', emerald: '#10B981', blue: '#3B82F6', rose: '#F43F5E', amber: '#F59E0B',
      };
      html.style.setProperty('--color-barflow-primary', colorMap[colorSchemeMode] || '#8B5CF6');
    } else {
      // Pour les thèmes Sénégal et Daltonien, on fixe data-color
      html.setAttribute('data-color', themeMode === 'senegal' ? 'senegal' : 'daltonien');
    }
  };

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handle = () => applyFullTheme('system', colorScheme);
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, [theme, colorScheme]);

  useEffect(() => {
    const load = async () => {
      const savedTheme = await getSetting('theme');
      const savedColor = await getSetting('color_scheme');
      const savedLanguage = await getSetting('language');
      const savedPwd = await getSetting('admin_password');
      const savedInfo = await getSetting('restaurant_info');
      const savedPrinter = await getSetting('printer_settings');
      const savedNetwork = await getSetting('network_settings');
      const savedWave = await getSetting('wave_api');
      const savedOrange = await getSetting('orange_api');
      const savedMerchant = await getSetting('merchant_numbers');
      const savedSQ = await getSetting('secret_question');
      const savedSA = await getSetting('secret_answer');

      const nt = savedTheme?.value as string || 'light';
      const nc = savedColor?.value as string || 'violet';
      if (savedTheme) setTheme(nt);
      if (savedColor) setColorScheme(nc);
      if (savedLanguage) {
        const lang = savedLanguage.value as string;
        setLanguage(lang);
        i18n.changeLanguage(lang);
      }
      if (savedPwd) setAdminPassword(savedPwd.value as string);
      if (savedInfo) setRestaurantInfo(savedInfo.value as any);
      if (savedPrinter) setPrinterSettings(savedPrinter.value as any);
      if (savedNetwork) setNetworkSettings(savedNetwork.value as any);
      if (savedWave) setWaveApi(savedWave.value as any);
      if (savedOrange) setOrangeApi(savedOrange.value as any);
      if (savedMerchant) setMerchantNumbers(savedMerchant.value as any);
      if (savedSQ) { setSavedSecretQuestion(savedSQ.value as string); setSecretQuestion(savedSQ.value as string); }
      if (savedSA) setSavedSecretAnswer(savedSA.value as string);
      applyFullTheme(nt, nc);
    };
    load();
  }, []);

  const showMessage = (msg: string, isError = false) => {
    if (isError) { setErrorMessage(msg); setTimeout(() => setErrorMessage(''), 3000); }
    else { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(''), 3000); }
  };

  const verifyPassword = async (action: () => void) => {
    if (passwordInput === adminPassword) {
      setPasswordError(''); setShowPasswordModal(false); setPasswordInput(''); action();
    } else {
      setPasswordError('Mot de passe incorrect');
    }
  };

  const saveGeneralSettings = async () => {
    await setSetting('theme', theme, new Date().toISOString());
    await setSetting('color_scheme', colorScheme, new Date().toISOString());
    await setSetting('language', language, new Date().toISOString());
    await setSetting('restaurant_info', restaurantInfo, new Date().toISOString());
    applyFullTheme(theme, colorScheme);
    showMessage('Paramètres généraux sauvegardés !');
  };

  const saveApiSettings = async () => {
    await setSetting('wave_api', waveApi, new Date().toISOString());
    await setSetting('orange_api', orangeApi, new Date().toISOString());
    await setSetting('merchant_numbers', merchantNumbers, new Date().toISOString());
    showMessage('Configurations API sauvegardées !');
  };

  const saveNetworkSettings = async () => {
    await setSetting('printer_settings', printerSettings, new Date().toISOString());
    await setSetting('network_settings', networkSettings, new Date().toISOString());
    showMessage('Paramètres réseau sauvegardés !');
  };

  const testWaveConnection = async () => {
    if (!waveApi.merchantId || !waveApi.apiKey) { showMessage('Veuillez remplir Merchant ID et API Key Wave', true); return; }
    try {
      const res = await fetch('http://localhost:3001/api/wave/balance', {
        headers: { 'x-wave-api-key': waveApi.apiKey },
      });
      const data = await res.json();
      if (res.ok) showMessage('✅ Wave API : connexion réussie');
      else showMessage(`❌ Wave API : ${data.error || 'connexion échouée'}`, true);
    } catch {
      showMessage('❌ Impossible de contacter le serveur backend (port 3001)', true);
    }
  };

  const testOrangeConnection = async () => {
    if (!orangeApi.merchantId || !orangeApi.apiLogin) { showMessage('Veuillez remplir Merchant ID et API Login Orange Money', true); return; }
    try {
      const res = await fetch('http://localhost:3001/api/orangemoney/test');
      const data = await res.json();
      if (res.ok && data.ok) showMessage('✅ Orange Money API : connexion réussie');
      else showMessage(`❌ Orange Money API : ${data.error || 'connexion échouée'}`, true);
    } catch {
      showMessage('❌ Impossible de contacter le serveur backend (port 3001)', true);
    }
  };

  const exportData = async () => {
    const data = { products, losses, settings: { theme, colorScheme, language, restaurantInfo, printerSettings, networkSettings, waveApi, orangeApi, merchantNumbers }, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `barflow_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    showMessage('Données exportées avec succès !');
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try { JSON.parse(e.target?.result as string); showMessage('Données importées avec succès !'); }
      catch { showMessage("Erreur lors de l'import", true); }
    };
    reader.readAsText(file);
  };

  const resetAllData = async () => {
    localStorage.clear(); indexedDB.deleteDatabase('barflow-db');
    showMessage("Toutes les données ont été réinitialisées. L'application va redémarrer...");
    setTimeout(() => window.location.reload(), 2000);
  };

  const resetSettings = async () => {
    await setSetting('theme', 'light', new Date().toISOString());
    await setSetting('color_scheme', 'violet', new Date().toISOString());
    await setSetting('language', 'fr', new Date().toISOString());
    setTheme('light'); setColorScheme('violet'); setLanguage('fr');
    setRestaurantInfo({ name: '', address: '', phone: '', email: '', taxNumber: '' });
    setPrinterSettings({ type: 'network', ipAddress: '', port: '9100', paperSize: '80mm' });
    setNetworkSettings({ wifi: '', printer: '', caisseSecondaire: '' });
    setWaveApi({ merchantId: '', apiKey: '', apiSecret: '', webhookSecret: '' });
    setOrangeApi({ merchantId: '', apiLogin: '', apiPassword: '', apiKey: '' });
    setMerchantNumbers({ wave: '', orange: '' });
    showMessage('Paramètres réinitialisés !');
  };

  const changePassword = async () => {
    setPasswordError('');
    if (currentPassword !== adminPassword) { setPasswordError('Mot de passe actuel incorrect'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Les nouveaux mots de passe ne correspondent pas'); return; }
    if (newPassword.length < 4) { setPasswordError('Le mot de passe doit contenir au moins 4 caractères'); return; }
    if (!secretAnswer.trim()) { setPasswordError('Veuillez renseigner la réponse à la question secrète'); return; }
    await setSetting('admin_password', newPassword, new Date().toISOString());
    await setSetting('secret_question', secretQuestion, new Date().toISOString());
    await setSetting('secret_answer', secretAnswer.trim().toLowerCase(), new Date().toISOString());
    setAdminPassword(newPassword);
    setSavedSecretQuestion(secretQuestion);
    setSavedSecretAnswer(secretAnswer.trim().toLowerCase());
    setChangePasswordMode(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSecretAnswer('');
    showMessage('Mot de passe et question secrète enregistrés !');
  };

  // ── Récupération mot de passe ────────────────────────────────
  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const startRecovery = () => {
    setShowRecovery(true);
    setRecoveryStep(isOnline ? 'choose' : 'offline');
    setRecoveryCode(''); setEnteredCode(''); setRecoveryAnswer('');
    setNewRecoveryPassword(''); setRecoveryError('');
  };

  const sendCode = async () => {
    if (!restaurantInfo.email) {
      setRecoveryError('Aucun email enregistré pour ce bar.');
      return;
    }
    setSendingEmail(true);
    setRecoveryError('');
    const code = generateCode();
    try {
      const res = await fetch('http://localhost:3001/api/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: restaurantInfo.email, code, barName: restaurantInfo.name }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRecoveryCode(code);
        setRecoveryStep('code');
        showMessage(`Code envoyé à ${restaurantInfo.email}`);
      } else {
        setRecoveryError(data.error || "Échec de l'envoi de l'email. Vérifiez la configuration GMAIL_USER / GMAIL_APP_PASSWORD côté serveur.");
      }
    } catch {
      setRecoveryError('Impossible de contacter le serveur backend (port 3001). Vérifiez qu\'il est bien lancé.');
    } finally {
      setSendingEmail(false);
    }
  };

  const verifyCode = () => {
    if (enteredCode === recoveryCode) { setRecoveryStep('reset'); setRecoveryError(''); }
    else { setRecoveryError('Code incorrect, réessayez.'); }
  };

  const verifySecretAnswer = () => {
    if (recoveryAnswer.trim().toLowerCase() === savedSecretAnswer) {
      setRecoveryStep('reset'); setRecoveryError('');
    } else {
      setRecoveryError('Réponse incorrecte.');
    }
  };

  const resetPasswordFromRecovery = async () => {
    if (newRecoveryPassword.length < 4) { setRecoveryError('Minimum 4 caractères.'); return; }
    await setSetting('admin_password', newRecoveryPassword, new Date().toISOString());
    setAdminPassword(newRecoveryPassword);
    setShowRecovery(false);
    showMessage('Mot de passe réinitialisé avec succès !');
  };

  // ── Styles communs dark-mode safe ────────────────────────────
  const inputCls = "w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500";
  const labelCls = "text-xs font-semibold text-slate-700 block mb-1";

  return (
    <div className="p-4 lg:p-8 space-y-6 min-h-screen" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>

      {/* Dark mode text fix global */}
      <style>{`
        html[data-theme="dark"] .settings-card {
          background-color: #1e293b !important;
          border-color: #334155 !important;
          color: #f1f5f9 !important;
        }
        html[data-theme="dark"] .settings-card label,
        html[data-theme="dark"] .settings-card p,
        html[data-theme="dark"] .settings-card span,
        html[data-theme="dark"] .settings-card h2,
        html[data-theme="dark"] .settings-card h3 {
          color: #e2e8f0 !important;
        }
        html[data-theme="dark"] .settings-card input,
        html[data-theme="dark"] .settings-card select,
        html[data-theme="dark"] .settings-card textarea {
          background-color: #0f172a !important;
          border-color: #475569 !important;
          color: #f1f5f9 !important;
        }
        html[data-theme="dark"] .settings-card .text-slate-500,
        html[data-theme="dark"] .settings-card .text-slate-600 {
          color: #94a3b8 !important;
        }
        html[data-theme="dark"] .settings-card .text-slate-900 {
          color: #f1f5f9 !important;
        }
        html[data-theme="dark"] .settings-card .bg-slate-50 {
          background-color: #0f172a !important;
        }
        html[data-theme="dark"] .settings-card .border-slate-200 {
          border-color: #334155 !important;
        }
        html[data-theme="dark"] .settings-nav {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }
        html[data-theme="dark"] .settings-nav button:not(.active-nav) {
          color: #94a3b8 !important;
        }
        html[data-theme="dark"] .settings-nav button:not(.active-nav):hover {
          background-color: #0f172a !important;
          color: #e2e8f0 !important;
        }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 lg:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">{t('title')}</h1>  {/* ← MODIFIER */}
          <p className="text-violet-200 mt-1">{t('subtitle')}</p>  {/* ← MODIFIER */}
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-500 text-white px-4 py-2 rounded-xl shadow-lg animate-fade-in-up flex items-center gap-2">
          <Check size={16} /> {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-20 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg animate-fade-in-up flex items-center gap-2">
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl shadow-sm border settings-nav" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        {[
          { id: 'general', label: t('tabs.general'), icon: Sun },  // ← MODIFIER
          { id: 'network', label: t('tabs.network'), icon: Wifi },  // ← MODIFIER
          { id: 'backup', label: t('tabs.backup'), icon: Database },  // ← MODIFIER
          { id: 'payments', label: t('tabs.payments'), icon: CreditCard },  // ← MODIFIER
          { id: 'security', label: t('tabs.security'), icon: Shield },  // ← MODIFIER
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200', isActive ? 'active-nav bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100')}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== ONGLET GÉNÉRAL ==================== */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Thème */}
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
              <Sun size={20} className="text-amber-500" /> {t('themes.title')}  {/* ← MODIFIER */}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {themes.map(t => {
                const Icon = t.icon;
                const isSelected = theme === t.id;
                return (
                  <button key={t.id} onClick={() => setTheme(t.id)}
                    className={cn('p-4 rounded-xl border-2 transition-all text-left', isSelected ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300')}>
                    <div className={cn('w-full h-20 rounded-lg mb-3 border', t.preview)} />
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={isSelected ? 'text-violet-600' : 'text-slate-400'} />
                      <span className={cn('font-medium', isSelected ? 'text-violet-700' : 'text-slate-700')}>{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {colorSchemes.map(scheme => (
                <button key={scheme.id} onClick={() => setColorScheme(scheme.id)}
                  className={cn('p-2 rounded-lg border-2 transition-all', colorScheme === scheme.id ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200')}>
                  <div className={cn('w-full h-8 rounded-lg mb-1', scheme.preview)} />
                  <span className="text-xs font-medium text-slate-600">{scheme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Langues */}
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
              <Languages size={20} className="text-blue-500" /> {t('languages.title')}  {/* ← MODIFIER */}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { code: 'fr', label: t('languages.french'), flag: '🇫🇷', native: 'FR' },  // ← MODIFIER
                { code: 'en', label: t('languages.english'), flag: '🇬🇧', native: 'EN' },  // ← MODIFIER
                { code: 'wo', label: t('languages.wolof'), flag: '🇸🇳', native: 'WO' },  // ← MODIFIER
                { code: 'srr', label: 'Sérère', flag: '🇸🇳', native: 'SRR' },
                { code: 'dyo', label: 'Diola', flag: '🇸🇳', native: 'DYO' },
                { code: 'man', label: 'Mancagne', flag: '🇸🇳', native: 'MAN' },
                { code: 'ar', label: 'العربية', flag: '🇸🇦', native: 'AR' },
              ].map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={cn(
                    'group relative p-3 rounded-xl border-2 transition-all duration-300 text-center',
                    'hover:scale-105 hover:shadow-lg active:scale-95',
                    language === lang.code
                      ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 shadow-md shadow-violet-200/50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                  style={{
                    backgroundColor: language === lang.code ? 'var(--app-surface)' : undefined,
                  }}
                >
                  <div className="text-4xl mb-2 transition-transform group-hover:scale-110">
                    {lang.flag}
                  </div>
                  <p className={cn(
                    'text-sm font-semibold transition-colors',
                    language === lang.code ? 'text-violet-700' : 'text-slate-700 group-hover:text-slate-900'
                  )}>
                    {lang.label}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-slate-400 mt-0.5">
                    {lang.native}
                  </p>
                  {language === lang.code && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center shadow-md">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between">
              <span className="text-sm text-violet-700 flex items-center gap-2">
                <Languages size={16} className="text-violet-500" />
                {t('languages.select')} : <strong>  {/* ← MODIFIER */}
                  {language === 'fr' && 'Français'}
                  {language === 'en' && 'English'}
                  {language === 'wo' && 'Wolof'}
                  {language === 'srr' && 'Sérère'}
                  {language === 'dyo' && 'Diola'}
                  {language === 'man' && 'Mancagne'}
                  {language === 'ar' && 'العربية'}
                </strong>
              </span>
              <span className="text-2xl">
                {language === 'fr' && '🇫🇷'}
                {language === 'en' && '🇬🇧'}
                {language === 'wo' && '🇸🇳'}
                {language === 'srr' && '🇸🇳'}
                {language === 'dyo' && '🇸🇳'}
                {language === 'man' && '🇸🇳'}
                {language === 'ar' && '🇸🇦'}
              </span>
            </div>
          </div>

          {/* Infos établissement */}
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
              <Building2 size={20} className="text-emerald-500" /> {t('restaurant.title')}  {/* ← MODIFIER */}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>{t('restaurant.name')}</label><input type="text" value={restaurantInfo.name} onChange={e => setRestaurantInfo({...restaurantInfo, name: e.target.value})} className={inputCls} placeholder={t('restaurant.name_placeholder')} /></div>  {/* ← MODIFIER */}
              <div><label className={labelCls}>{t('restaurant.phone')}</label><input type="tel" value={restaurantInfo.phone} onChange={e => setRestaurantInfo({...restaurantInfo, phone: e.target.value})} className={inputCls} placeholder={t('restaurant.phone_placeholder')} /></div>
              <div><label className={labelCls}>{t('restaurant.email')}</label><input type="email" value={restaurantInfo.email} onChange={e => setRestaurantInfo({...restaurantInfo, email: e.target.value})} className={inputCls} placeholder={t('restaurant.email_placeholder')} /></div>
              <div><label className={labelCls}>{t('restaurant.address')}</label><input type="text" value={restaurantInfo.address} onChange={e => setRestaurantInfo({...restaurantInfo, address: e.target.value})} className={inputCls} placeholder={t('restaurant.address_placeholder')} /></div>
              <div><label className={labelCls}>{t('restaurant.taxNumber')}</label><input type="text" value={restaurantInfo.taxNumber} onChange={e => setRestaurantInfo({...restaurantInfo, taxNumber: e.target.value})} className={inputCls} placeholder={t('restaurant.taxNumber_placeholder')} /></div>
            </div>
            <button onClick={saveGeneralSettings} className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-md hover:shadow-xl transition-all flex items-center gap-2">
              <Save size={16} /> {t('restaurant.save')}  {/* ← MODIFIER */}
            </button>
          </div>
        </div>
      )}

      {/* ==================== ONGLET RÉSEAU ==================== */}
      {activeTab === 'network' && (
        <div className="space-y-6">
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><Wifi size={20} className="text-blue-500" /> {t('network.title')}</h2>  {/* ← MODIFIER */}
            <div className="space-y-4">
              {networkConfigs.map(config => {
                const Icon = config.icon;
                const value = networkSettings[config.id as keyof typeof networkSettings];
                return (
                  <div key={config.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Icon size={18} className="text-blue-600" /></div>
                    <div className="flex-1">
                      <label className={labelCls}>{t(`network.${config.id}`)}</label>  {/* ← MODIFIER */}
                      <input type="text" value={value} onChange={e => setNetworkSettings({...networkSettings, [config.id]: e.target.value})} className={inputCls} placeholder={config.placeholder} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><Printer size={20} className="text-emerald-500" /> {t('network.printer')}</h2>  {/* ← MODIFIER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Type</label><select value={printerSettings.type} onChange={e => setPrinterSettings({...printerSettings, type: e.target.value})} className={inputCls}><option value="network">Réseau (Ethernet/Wi-Fi)</option><option value="usb">USB</option><option value="bluetooth">Bluetooth</option></select></div>
              <div><label className={labelCls}>Adresse IP</label><input type="text" value={printerSettings.ipAddress} onChange={e => setPrinterSettings({...printerSettings, ipAddress: e.target.value})} className={inputCls} placeholder="192.168.1.100" /></div>
              <div><label className={labelCls}>Port</label><input type="text" value={printerSettings.port} onChange={e => setPrinterSettings({...printerSettings, port: e.target.value})} className={inputCls} placeholder="9100" /></div>
              <div><label className={labelCls}>Format papier</label><select value={printerSettings.paperSize} onChange={e => setPrinterSettings({...printerSettings, paperSize: e.target.value})} className={inputCls}><option value="58mm">58mm</option><option value="80mm">80mm</option></select></div>
            </div>
            <button onClick={saveNetworkSettings} className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold text-sm shadow-md flex items-center gap-2"><Save size={16} /> {t('buttons.save')}</button>  {/* ← MODIFIER */}
          </div>
        </div>
      )}

      {/* ==================== ONGLET SAUVEGARDE ==================== */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><Database size={20} className="text-amber-500" /> {t('backup.title')}</h2>  {/* ← MODIFIER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={exportData} className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left hover:shadow-md transition-all"><Download size={24} className="text-emerald-600 mb-2" /><p className="font-semibold text-emerald-800">{t('backup.export')}</p><p className="text-xs text-emerald-600 mt-1">{t('backup.export_desc')}</p></button>  {/* ← MODIFIER */}
              <div className="relative">
                <button onClick={() => document.getElementById('importFile')?.click()} className="w-full p-4 rounded-xl bg-blue-50 border border-blue-200 text-left hover:shadow-md transition-all"><Upload size={24} className="text-blue-600 mb-2" /><p className="font-semibold text-blue-800">{t('backup.import')}</p><p className="text-xs text-blue-600 mt-1">{t('backup.import_desc')}</p></button>  {/* ← MODIFIER */}
                <input id="importFile" type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files?.[0]) { setPendingAction({ type: 'import', data: e.target.files[0] }); setShowPasswordModal(true); }}} />
              </div>
            </div>
          </div>
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}><RefreshCw size={20} className="text-red-500" /> {t('backup.reset')}</h2>  {/* ← MODIFIER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => { setPendingAction({ type: 'resetSettings' }); setShowPasswordModal(true); }} className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-left hover:shadow-md transition-all"><RefreshCw size={24} className="text-amber-600 mb-2" /><p className="font-semibold text-amber-800">{t('backup.resetSettings')}</p><p className="text-xs text-amber-600 mt-1">{t('backup.resetSettings_desc')}</p></button>  {/* ← MODIFIER */}
              <button onClick={() => { setPendingAction({ type: 'resetAll' }); setShowPasswordModal(true); }} className="p-4 rounded-xl bg-red-50 border border-red-200 text-left hover:shadow-md transition-all"><Trash2 size={24} className="text-red-600 mb-2" /><p className="font-semibold text-red-800">{t('backup.resetAll')}</p><p className="text-xs text-red-600 mt-1">{t('backup.resetAll_desc')}</p></button>  {/* ← MODIFIER */}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ONGLET PAIEMENTS (verrouillé) ==================== */}
      {activeTab === 'payments' && (
        !paymentsUnlocked ? (
          <div className="min-h-[60vh] flex items-center justify-center p-6">
            <div className="settings-card rounded-2xl border p-8 shadow-sm max-w-md w-full text-center" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                <Lock size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--app-text)' }}>{t('payments.locked')}</h2>  {/* ← MODIFIER */}
              <p className="text-sm text-slate-500 mb-5">{t('payments.lockedMessage')}</p>  {/* ← MODIFIER */}
              <input
                type="password"
                value={paymentsPasswordInput}
                onChange={e => setPaymentsPasswordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  if (paymentsPasswordInput === adminPassword) { setPaymentsUnlocked(true); setPaymentsPasswordError(''); setPaymentsPasswordInput(''); }
                  else setPaymentsPasswordError('Mot de passe incorrect');
                }}
                placeholder="Mot de passe administrateur"
                className={cn(inputCls, 'text-center mb-3')}
                autoFocus
              />
              {paymentsPasswordError && <p className="text-red-500 text-sm mb-3">{paymentsPasswordError}</p>}
              <button
                onClick={() => {
                  if (paymentsPasswordInput === adminPassword) { setPaymentsUnlocked(true); setPaymentsPasswordError(''); setPaymentsPasswordInput(''); }
                  else setPaymentsPasswordError('Mot de passe incorrect');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-md"
              >
                {t('payments.unlock')}  {/* ← MODIFIER */}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                <Check size={15} /> {t('payments.unlocked')}  {/* ← MODIFIER */}
              </div>
              <button
                onClick={() => setPaymentsUnlocked(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium flex items-center gap-2 hover:bg-slate-200"
              >
                <Lock size={14} /> Reverrouiller
              </button>
            </div>

            <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
                <CreditCard size={20} className="text-blue-500" /> {t('payments.title')}  {/* ← MODIFIER */}
              </h2>
              <p className="text-sm text-slate-500 mb-4">{t('payments.subtitle')}</p>  {/* ← MODIFIER */}

              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Smartphone size={18} className="text-blue-600" /><h3 className="font-bold text-blue-800">{t('payments.wave.title')}</h3></div>  {/* ← MODIFIER */}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', waveApi.merchantId && waveApi.apiKey ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800')}>
                    {waveApi.merchantId && waveApi.apiKey ? '✅ Configuré' : '⚠️ Non configuré'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className={labelCls}>{t('payments.wave.merchantId')}</label><input type="text" value={waveApi.merchantId} onChange={e => setWaveApi({...waveApi, merchantId: e.target.value})} className={inputCls} placeholder="wave_merchant_xxxxx" /></div>
                  <div><label className={labelCls}>{t('payments.wave.apiKey')}</label>
                    <div className="relative">
                      <input type={showApiKeys ? 'text' : 'password'} value={waveApi.apiKey} onChange={e => setWaveApi({...waveApi, apiKey: e.target.value})} className={cn(inputCls, 'pr-10')} placeholder="wave_api_xxxxxxxx" />
                      <button onClick={() => setShowApiKeys(!showApiKeys)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">{showApiKeys ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                  </div>
                  <div><label className={labelCls}>{t('payments.wave.apiSecret')}</label><input type="password" value={waveApi.apiSecret} onChange={e => setWaveApi({...waveApi, apiSecret: e.target.value})} className={inputCls} placeholder="wave_secret_xxxxxxxx" /></div>
                  <div><label className={labelCls}>{t('payments.wave.webhookSecret')}</label><input type="password" value={waveApi.webhookSecret} onChange={e => setWaveApi({...waveApi, webhookSecret: e.target.value})} className={inputCls} placeholder="webhook_secret" /></div>
                </div>
                <button onClick={testWaveConnection} className="mt-3 text-xs text-blue-600 underline flex items-center gap-1"><QrCode size={12} /> {t('payments.wave.test')}</button>  {/* ← MODIFIER */}
              </div>

              <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Smartphone size={18} className="text-orange-600" /><h3 className="font-bold text-orange-800">{t('payments.orange.title')}</h3></div>  {/* ← MODIFIER */}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', orangeApi.merchantId && orangeApi.apiLogin ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800')}>
                    {orangeApi.merchantId && orangeApi.apiLogin ? '✅ Configuré' : '⚠️ Non configuré'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className={labelCls}>{t('payments.orange.merchantId')}</label><input type="text" value={orangeApi.merchantId} onChange={e => setOrangeApi({...orangeApi, merchantId: e.target.value})} className={inputCls} placeholder="om_merchant_xxxxx" /></div>
                  <div><label className={labelCls}>{t('payments.orange.apiLogin')}</label><input type="text" value={orangeApi.apiLogin} onChange={e => setOrangeApi({...orangeApi, apiLogin: e.target.value})} className={inputCls} placeholder="login_om" /></div>
                  <div><label className={labelCls}>{t('payments.orange.apiPassword')}</label><input type="password" value={orangeApi.apiPassword} onChange={e => setOrangeApi({...orangeApi, apiPassword: e.target.value})} className={inputCls} placeholder="••••••••" /></div>
                  <div><label className={labelCls}>{t('payments.orange.apiKey')}</label><input type="password" value={orangeApi.apiKey} onChange={e => setOrangeApi({...orangeApi, apiKey: e.target.value})} className={inputCls} placeholder="om_key_xxxxxxxx" /></div>
                </div>
                <button onClick={testOrangeConnection} className="mt-3 text-xs text-orange-600 underline flex items-center gap-1"><QrCode size={12} /> {t('payments.orange.test')}</button>  {/* ← MODIFIER */}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2"><Phone size={14} /> Autocollant marchand</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className={labelCls}>{t('payments.wave.merchant_number')}</label><input type="tel" value={merchantNumbers.wave} onChange={e => setMerchantNumbers({...merchantNumbers, wave: e.target.value})} className={inputCls} placeholder="77 000 00 00" /></div>
                  <div><label className={labelCls}>{t('payments.orange.merchant_number')}</label><input type="tel" value={merchantNumbers.orange} onChange={e => setMerchantNumbers({...merchantNumbers, orange: e.target.value})} className={inputCls} placeholder="78 000 00 00" /></div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  Pour obtenir vos clés API Wave et Orange Money, vous devez avoir un compte marchand agréé.
                </p>
              </div>
              <button onClick={saveApiSettings} className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-md flex items-center gap-2">
                <Save size={16} /> {t('payments.save')}  {/* ← MODIFIER */}
              </button>
            </div>
          </div>
        )
      )}

      {/* ==================== ONGLET SÉCURITÉ ==================== */}
      {activeTab === 'security' && (
        <div className="space-y-6">

          {/* Changement mot de passe */}
          <div className="settings-card rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
            <h2 className="font-semibold text-lg mb-5 flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
              <KeyRound size={20} className="text-violet-500" /> {t('security.password.title')}  {/* ← MODIFIER */}
            </h2>

            {!changePasswordMode ? (
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => setChangePasswordMode(true)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-md flex items-center gap-2">
                  <KeyRound size={16} /> {t('security.password.change')}  {/* ← MODIFIER */}
                </button>
                <button onClick={startRecovery} className="px-6 py-2.5 rounded-xl bg-amber-100 text-amber-800 font-semibold text-sm border border-amber-300 flex items-center gap-2 hover:bg-amber-200 transition-colors">
                  <HelpCircle size={16} /> {t('security.password.forgot')}  {/* ← MODIFIER */}
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} /> {passwordError}
                  </div>
                )}

                <div>
                  <label className={labelCls}>{t('security.password.current')}</label>  {/* ← MODIFIER */}
                  <div className="relative">
                    <input type={showCurrentPwd ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls} placeholder={t('security.password.current_placeholder')} />  {/* ← MODIFIER */}
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t('security.password.new')}</label>  {/* ← MODIFIER */}
                  <div className="relative">
                    <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} placeholder={t('security.password.new_placeholder')} />  {/* ← MODIFIER */}
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t('security.password.confirm')}</label>  {/* ← MODIFIER */}
                  <div className="relative">
                    <input type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} placeholder={t('security.password.confirm_placeholder')} />  {/* ← MODIFIER */}
                    <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5"><HelpCircle size={14} className="text-violet-500" /> {t('security.secret.title')}</p>  {/* ← MODIFIER */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>{t('security.secret.question')}</label>  {/* ← MODIFIER */}
                      <select value={secretQuestion} onChange={e => setSecretQuestion(e.target.value)} className={inputCls}>
                        {SECRET_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{t('security.secret.answer')}</label>  {/* ← MODIFIER */}
                      <input type="text" value={secretAnswer} onChange={e => setSecretAnswer(e.target.value)} className={inputCls} placeholder={t('security.secret.answer_placeholder')} />  {/* ← MODIFIER */}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={changePassword} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold flex items-center gap-2 hover:bg-emerald-600">
                    <Check size={16} /> Valider
                  </button>
                  <button onClick={() => { setChangePasswordMode(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSecretAnswer(''); setPasswordError(''); }} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50">
                    {t('buttons.cancel')}  {/* ← MODIFIER */}
                  </button>
                </div>
              </div>
            )}

            {savedSecretQuestion && !changePasswordMode && (
              <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-start gap-2">
                <HelpCircle size={15} className="text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-violet-800">{t('security.secret.title')}</p>  {/* ← MODIFIER */}
                  <p className="text-xs text-violet-600 mt-0.5">{savedSecretQuestion}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <p className="text-sm text-amber-800 flex items-center gap-2">
              <Shield size={18} /> {t('security.info')}  {/* ← MODIFIER */}
            </p>
          </div>
        </div>
      )}

      {/* ==================== MODAL MOT DE PASSE ==================== */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4"><Lock size={24} className="text-violet-600" /><h3 className="text-xl font-bold text-slate-900">Autorisation requise</h3></div>
            <p className="text-sm text-slate-500 mb-4">Cette action nécessite le mot de passe administrateur.</p>
            <input type="password" placeholder="Mot de passe" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyPassword(() => { if (pendingAction?.type === 'import' && pendingAction.data) importData(pendingAction.data); if (pendingAction?.type === 'resetSettings') resetSettings(); if (pendingAction?.type === 'resetAll') resetAllData(); })} className="w-full p-3 rounded-xl border border-slate-200 mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900" autoFocus />
            {passwordError && <p className="text-red-500 text-sm mb-4">{passwordError}</p>}
            <div className="flex gap-3">
              <button onClick={() => verifyPassword(() => { if (pendingAction?.type === 'import' && pendingAction.data) importData(pendingAction.data); if (pendingAction?.type === 'resetSettings') resetSettings(); if (pendingAction?.type === 'resetAll') resetAllData(); })} className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold">{t('buttons.confirm')}</button>  {/* ← MODIFIER */}
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); }} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600">{t('buttons.cancel')}</button>  {/* ← MODIFIER */}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL RÉCUPÉRATION MOT DE PASSE ==================== */}
      {showRecovery && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowRecovery(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle size={22} />
                  <h3 className="text-lg font-bold">{t('security.password.forgot')}</h3>  {/* ← MODIFIER */}
                </div>
                <button onClick={() => setShowRecovery(false)} className="text-white/70 hover:text-white">✕</button>
              </div>
              <div className="flex gap-2 mt-3">
                {['choose','phone','email','code','offline','reset'].map((step, i) => (
                  <div key={step} className={cn('h-1 rounded-full flex-1 transition-all', recoveryStep === step || (i < ['choose','phone','email','code','offline','reset'].indexOf(recoveryStep)) ? 'bg-white' : 'bg-white/30')} />
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {recoveryError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} /> {recoveryError}
                </div>
              )}

              {recoveryStep === 'choose' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 text-center">Comment voulez-vous récupérer votre accès ?</p>
                  <div className="space-y-3">
                    {restaurantInfo.email && (
                      <button onClick={() => { setRecoveryStep('email'); }} className="w-full p-4 rounded-xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 transition-all text-left flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center"><Mail size={18} className="text-violet-600" /></div>
                        <div>
                          <p className="font-semibold text-violet-900">Recevoir un code par Email</p>
                          <p className="text-xs text-violet-600">Envoi vers {restaurantInfo.email.replace(/(.{2}).+(@.+)/, '$1•••$2')}</p>
                        </div>
                      </button>
                    )}
                    {!restaurantInfo.email && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                        ⚠️ Aucun email enregistré. Configurez-le dans Général → Informations établissement.
                      </div>
                    )}
                    {savedSecretAnswer && (
                      <button onClick={() => setRecoveryStep('offline')} className="w-full p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 transition-all text-left flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"><HelpCircle size={18} className="text-emerald-600" /></div>
                        <div>
                          <p className="font-semibold text-emerald-900">Question secrète (hors ligne)</p>
                          <p className="text-xs text-emerald-600">Répondre à votre question de sécurité</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {recoveryStep === 'email' && (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto"><Mail size={28} className="text-violet-600" /></div>
                  <p className="text-sm text-slate-600">Un code à 6 chiffres sera envoyé à <strong>{restaurantInfo.email}</strong></p>
                  <button onClick={sendCode} disabled={sendingEmail} className={cn('w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2', sendingEmail ? 'bg-violet-300 text-white cursor-not-allowed' : 'bg-violet-500 text-white hover:bg-violet-600')}>
                    {sendingEmail ? <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</> : <>✉️ Envoyer le code Email</>}
                  </button>
                  <button onClick={() => setRecoveryStep('choose')} className="text-sm text-slate-500 underline">← Retour</button>
                </div>
              )}

              {recoveryStep === 'code' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 text-center">Entrez le code à 6 chiffres reçu par email</p>
                  <input type="text" maxLength={6} value={enteredCode} onChange={e => setEnteredCode(e.target.value.replace(/\D/, ''))} className="w-full p-4 rounded-xl border-2 border-slate-200 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-violet-500 text-slate-900" placeholder="000000" autoFocus />
                  <button onClick={verifyCode} disabled={enteredCode.length !== 6} className={cn('w-full py-3 rounded-xl font-bold', enteredCode.length === 6 ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    Vérifier le code
                  </button>
                  <button onClick={() => setRecoveryStep('email')} className="w-full text-sm text-slate-500 underline">← Retour</button>
                </div>
              )}

              {recoveryStep === 'offline' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1"><HelpCircle size={13} /> Question secrète</p>
                    <p className="text-sm font-medium text-emerald-900">{savedSecretQuestion}</p>
                  </div>
                  <div>
                    <label className={labelCls}>Votre réponse</label>
                    <input type="text" value={recoveryAnswer} onChange={e => setRecoveryAnswer(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="Votre réponse" autoFocus />
                  </div>
                  <button onClick={verifySecretAnswer} disabled={!recoveryAnswer.trim()} className={cn('w-full py-3 rounded-xl font-bold', recoveryAnswer.trim() ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    Vérifier la réponse
                  </button>
                  {isOnline && <button onClick={() => setRecoveryStep('choose')} className="w-full text-sm text-slate-500 underline">← Retour</button>}
                </div>
              )}

              {recoveryStep === 'reset' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2"><Check size={28} className="text-emerald-600" /></div>
                    <p className="text-sm font-semibold text-slate-700">Identité vérifiée ! Choisissez votre nouveau mot de passe.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Nouveau mot de passe *</label>
                    <input type="password" value={newRecoveryPassword} onChange={e => setNewRecoveryPassword(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30" placeholder="Minimum 4 caractères" autoFocus />
                  </div>
                  <button onClick={resetPasswordFromRecovery} disabled={newRecoveryPassword.length < 4} className={cn('w-full py-3 rounded-xl font-bold', newRecoveryPassword.length >= 4 ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                    Enregistrer le nouveau mot de passe
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}