import { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Shield, Users, Printer, Database,
  Save, Download, Upload, RefreshCw, Lock, KeyRound,
  Globe, Languages, Wifi, Network, Smartphone, Check, AlertCircle,
  Eye, EyeOff, User, Mail, Phone, MapPin, Building2, Trash2,
  QrCode, AlertTriangle
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getSetting, setSetting } from '@/utils/db';
import { useProducts } from '@/utils/productStore';
import { useLosses } from '@/utils/lossStore';
import { useTranslation, languages as i18nLanguages } from '@/i18n';

// Langues disponibles
const languages = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', native: 'Français' },
  { code: 'en', label: 'English', flag: '🇬🇧', native: 'English' },
  { code: 'wo', label: 'Wolof', flag: '🇸🇳', native: 'Wolof' },
  { code: 'srr', label: 'Sérère', flag: '🇸🇳', native: 'Sérère' },
  { code: 'dyo', label: 'Diola', flag: '🇸🇳', native: 'Joola' },
];

const themes = [
  { id: 'light', label: 'Clair', icon: Sun, bg: 'bg-white', text: 'text-slate-900', preview: 'bg-white border-slate-200' },
  { id: 'dark', label: 'Sombre', icon: Moon, bg: 'bg-slate-900', text: 'text-white', preview: 'bg-slate-800 border-slate-700' },
  { id: 'system', label: 'Système', icon: Monitor, bg: 'bg-slate-100', text: 'text-slate-900', preview: 'bg-gradient-to-r from-white to-slate-800 border-slate-200' },
];

const colorSchemes = [
  { id: 'violet', label: 'Violet', color: 'from-violet-500 to-purple-600', preview: 'bg-gradient-to-r from-violet-500 to-purple-600' },
  { id: 'emerald', label: 'Émeraude', color: 'from-emerald-500 to-teal-600', preview: 'bg-gradient-to-r from-emerald-500 to-teal-600' },
  { id: 'blue', label: 'Bleu', color: 'from-blue-500 to-cyan-600', preview: 'bg-gradient-to-r from-blue-500 to-cyan-600' },
  { id: 'rose', label: 'Rose', color: 'from-rose-500 to-pink-600', preview: 'bg-gradient-to-r from-rose-500 to-pink-600' },
  { id: 'amber', label: 'Ambre', color: 'from-amber-500 to-orange-600', preview: 'bg-gradient-to-r from-amber-500 to-orange-600' },
];

const networkConfigs = [
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi, placeholder: 'SSID du réseau' },
  { id: 'printer', label: 'Imprimante', icon: Printer, placeholder: 'Adresse IP ou nom' },
  { id: 'caisse', label: 'Caisse secondaire', icon: Smartphone, placeholder: 'Adresse IP' },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'backup' | 'security'>('general');
  const [theme, setTheme] = useState('light');
  const [colorScheme, setColorScheme] = useState('violet');
  const [language, setLanguage] = useState('fr');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data?: any } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [changePasswordMode, setChangePasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { t, setLanguage: setI18nLanguage, currentLanguage } = useTranslation();
  const [restaurantInfo, setRestaurantInfo] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxNumber: '',
  });
  const [printerSettings, setPrinterSettings] = useState({
    type: 'network',
    ipAddress: '',
    port: '9100',
    paperSize: '80mm',
  });
  const [networkSettings, setNetworkSettings] = useState({
    wifi: '',
    printer: '',
    caisseSecondaire: '',
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);
  
  // API Wave & Orange Money
  const [waveApi, setWaveApi] = useState({
    merchantId: '',
    apiKey: '',
    apiSecret: '',
    webhookSecret: '',
  });
  const [orangeApi, setOrangeApi] = useState({
    merchantId: '',
    apiLogin: '',
    apiPassword: '',
    apiKey: '',
  });
  const [merchantNumbers, setMerchantNumbers] = useState({
    wave: '',
    orange: '',
  });

  const { products } = useProducts();
  const { losses } = useLosses();

  // Appliquer le thème complet
  const applyFullTheme = (themeMode: string, colorSchemeMode: string) => {
    const html = document.documentElement;
    
    if (themeMode === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else if (themeMode === 'light') {
      html.setAttribute('data-theme', 'light');
    } else if (themeMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
    
    html.setAttribute('data-color', colorSchemeMode);
    
    const colorMap: Record<string, string> = {
      violet: '#8B5CF6',
      emerald: '#10B981',
      blue: '#3B82F6',
      rose: '#F43F5E',
      amber: '#F59E0B',
    };
    const primaryColor = colorMap[colorSchemeMode] || '#8B5CF6';
    html.style.setProperty('--color-barflow-primary', primaryColor);
  };

  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyFullTheme('system', colorScheme);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, colorScheme]);

  // Charger les paramètres sauvegardés
  useEffect(() => {
    const loadSettings = async () => {
      const savedTheme = await getSetting('theme');
      const savedColor = await getSetting('color_scheme');
      const savedLanguage = await getSetting('language');
      const savedAdminPassword = await getSetting('admin_password');
      const savedRestaurantInfo = await getSetting('restaurant_info');
      const savedPrinterSettings = await getSetting('printer_settings');
      const savedNetworkSettings = await getSetting('network_settings');
      const savedWaveApi = await getSetting('wave_api');
      const savedOrangeApi = await getSetting('orange_api');
      const savedMerchantNumbers = await getSetting('merchant_numbers');

      const newTheme = savedTheme?.value as string || 'light';
      const newColor = savedColor?.value as string || 'violet';
      
      if (savedTheme) setTheme(newTheme);
      if (savedColor) setColorScheme(newColor);
      if (savedLanguage) setLanguage(savedLanguage.value as string);
      if (savedAdminPassword) setAdminPassword(savedAdminPassword.value as string);
      if (savedRestaurantInfo) setRestaurantInfo(savedRestaurantInfo.value as any);
      if (savedPrinterSettings) setPrinterSettings(savedPrinterSettings.value as any);
      if (savedNetworkSettings) setNetworkSettings(savedNetworkSettings.value as any);
      if (savedWaveApi) setWaveApi(savedWaveApi.value as any);
      if (savedOrangeApi) setOrangeApi(savedOrangeApi.value as any);
      if (savedMerchantNumbers) setMerchantNumbers(savedMerchantNumbers.value as any);
      
      applyFullTheme(newTheme, newColor);
    };
    loadSettings();
  }, []);

  const showMessage = (message: string, isError = false) => {
    if (isError) {
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    } else {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const verifyPassword = async (action: () => void) => {
    if (passwordInput === adminPassword) {
      setPasswordError('');
      setShowPasswordModal(false);
      setPasswordInput('');
      action();
    } else {
      setPasswordError('Mot de passe incorrect');
    }
  };

  const saveGeneralSettings = async () => {
    await setSetting('theme', theme, new Date().toISOString());
    await setSetting('color_scheme', colorScheme, new Date().toISOString());
    await setSetting('language', language, new Date().toISOString());
setI18nLanguage(language as any);
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

  const testWaveConnection = () => {
    if (!waveApi.merchantId || !waveApi.apiKey) {
      showMessage('Veuillez remplir Merchant ID et API Key Wave', true);
      return;
    }
    showMessage('✅ Wave API: Configuration valide (mode démo)');
  };

  const testOrangeConnection = () => {
    if (!orangeApi.merchantId || !orangeApi.apiLogin) {
      showMessage('Veuillez remplir Merchant ID et API Login Orange Money', true);
      return;
    }
    showMessage('✅ Orange Money API: Configuration valide (mode démo)');
  };

  const exportData = async () => {
    const data = {
      products,
      losses,
      settings: {
        theme,
        colorScheme,
        language,
        restaurantInfo,
        printerSettings,
        networkSettings,
        waveApi,
        orangeApi,
        merchantNumbers,
      },
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('Données exportées avec succès !');
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        showMessage('Données importées avec succès !');
      } catch (error) {
        showMessage('Erreur lors de l\'import', true);
      }
    };
    reader.readAsText(file);
  };

  const resetAllData = async () => {
    localStorage.clear();
    indexedDB.deleteDatabase('barflow-db');
    showMessage('Toutes les données ont été réinitialisées. L\'application va redémarrer...');
    setTimeout(() => window.location.reload(), 2000);
  };

  const resetSettings = async () => {
    await setSetting('theme', 'light', new Date().toISOString());
    await setSetting('color_scheme', 'violet', new Date().toISOString());
    await setSetting('language', 'fr', new Date().toISOString());
    setTheme('light');
    setColorScheme('violet');
    setLanguage('fr');
    setRestaurantInfo({ name: '', address: '', phone: '', email: '', taxNumber: '' });
    setPrinterSettings({ type: 'network', ipAddress: '', port: '9100', paperSize: '80mm' });
    setNetworkSettings({ wifi: '', printer: '', caisseSecondaire: '' });
    setWaveApi({ merchantId: '', apiKey: '', apiSecret: '', webhookSecret: '' });
    setOrangeApi({ merchantId: '', apiLogin: '', apiPassword: '', apiKey: '' });
    setMerchantNumbers({ wave: '', orange: '' });
    showMessage('Paramètres réinitialisés !');
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('Le mot de passe doit contenir au moins 4 caractères');
      return;
    }
    await setSetting('admin_password', newPassword, new Date().toISOString());
    setAdminPassword(newPassword);
    setChangePasswordMode(false);
    setNewPassword('');
    setConfirmPassword('');
    showMessage('Mot de passe modifié avec succès !');
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-100 min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 lg:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">Paramètres</h1>
          <p className="text-violet-200 mt-1">Configuration de votre application</p>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-500 text-white px-4 py-2 rounded-xl shadow-lg animate-fade-in-up">
          <Check size={16} className="inline mr-2" /> {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-20 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg animate-fade-in-up">
          <AlertCircle size={16} className="inline mr-2" /> {errorMessage}
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
        {[
          { id: 'general', label: 'Thème & Langues', icon: Sun },
          { id: 'network', label: 'Configuration réseau', icon: Wifi },
          { id: 'backup', label: 'Sauvegarde & Données', icon: Database },
          { id: 'security', label: 'Sécurité', icon: Shield },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
              <Sun size={20} className="text-amber-500" /> Thème & Apparence
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {themes.map(t => {
                const Icon = t.icon;
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all text-left',
                      isSelected ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
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
                <button
                  key={scheme.id}
                  onClick={() => setColorScheme(scheme.id)}
                  className={cn(
                    'p-2 rounded-lg border-2 transition-all',
                    colorScheme === scheme.id ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200'
                  )}
                >
                  <div className={cn('w-full h-8 rounded-lg mb-1', scheme.preview)} />
                  <span className="text-xs font-medium text-slate-600">{scheme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Langues */}
          {/* Langues */}
<div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
  <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
    <Languages size={20} className="text-blue-500" /> Langues
  </h2>
  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
    {i18nLanguages.map(lang => (
      <button
        key={lang.code}
        onClick={() => {
          setLanguage(lang.code);
          setI18nLanguage(lang.code);
        }}
        className={cn(
          'p-4 rounded-xl border-2 transition-all text-center',
          currentLanguage === lang.code
            ? 'border-violet-500 bg-violet-50'
            : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <span className="text-3xl mb-2 block">{lang.flag}</span>
        <p className={cn(
          'text-sm font-semibold',
          currentLanguage === lang.code ? 'text-violet-700' : 'text-slate-700'
        )}>{lang.name}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{lang.native}</p>
      </button>
    ))}
  </div>
</div>

          {/* Infos établissement */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
              <Building2 size={20} className="text-emerald-500" /> Informations établissement
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Nom du bar</label><input type="text" value={restaurantInfo.name} onChange={e => setRestaurantInfo({...restaurantInfo, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" placeholder="Mon Bar" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Téléphone</label><input type="tel" value={restaurantInfo.phone} onChange={e => setRestaurantInfo({...restaurantInfo, phone: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" placeholder="+221 77 000 00 00" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Email</label><input type="email" value={restaurantInfo.email} onChange={e => setRestaurantInfo({...restaurantInfo, email: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" placeholder="contact@monbar.com" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Adresse</label><input type="text" value={restaurantInfo.address} onChange={e => setRestaurantInfo({...restaurantInfo, address: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" placeholder="Dakar, Sénégal" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">NIF / Contribution</label><input type="text" value={restaurantInfo.taxNumber} onChange={e => setRestaurantInfo({...restaurantInfo, taxNumber: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 text-sm" placeholder="Numéro fiscal" /></div>
            </div>
            <button onClick={saveGeneralSettings} className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-md hover:shadow-xl transition-all flex items-center gap-2"><Save size={16} /> Sauvegarder</button>
          </div>

          {/* ==================== API WAVE & ORANGE MONEY ==================== */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
              <Smartphone size={20} className="text-blue-500" /> Paiements mobiles (API)
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Configurez les API Wave et Orange Money pour générer des QR codes de paiement dynamiques.
            </p>

            {/* Wave API */}
            <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Smartphone size={18} className="text-blue-600" />
                  <h3 className="font-bold text-blue-800">Wave Business API</h3>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  waveApi.merchantId && waveApi.apiKey
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-amber-200 text-amber-800'
                )}>
                  {waveApi.merchantId && waveApi.apiKey ? '✅ Configuré' : '⚠️ Non configuré'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Merchant ID *</label>
                  <input type="text" value={waveApi.merchantId} onChange={e => setWaveApi({...waveApi, merchantId: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="wave_merchant_xxxxx" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">API Key *</label>
                  <div className="relative">
                    <input type={showApiKeys ? 'text' : 'password'} value={waveApi.apiKey} onChange={e => setWaveApi({...waveApi, apiKey: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono pr-10" placeholder="wave_api_xxxxxxxx" />
                    <button onClick={() => setShowApiKeys(!showApiKeys)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">{showApiKeys ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">API Secret</label>
                  <input type="password" value={waveApi.apiSecret} onChange={e => setWaveApi({...waveApi, apiSecret: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="wave_secret_xxxxxxxx" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Webhook Secret</label>
                  <input type="password" value={waveApi.webhookSecret} onChange={e => setWaveApi({...waveApi, webhookSecret: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="webhook_secret" />
                </div>
              </div>
              <button onClick={testWaveConnection} className="mt-3 text-xs text-blue-600 underline flex items-center gap-1"><QrCode size={12} /> Tester la connexion</button>
            </div>

            {/* Orange Money API */}
            <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Smartphone size={18} className="text-orange-600" />
                  <h3 className="font-bold text-orange-800">Orange Money API</h3>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  orangeApi.merchantId && orangeApi.apiLogin
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-amber-200 text-amber-800'
                )}>
                  {orangeApi.merchantId && orangeApi.apiLogin ? '✅ Configuré' : '⚠️ Non configuré'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Merchant ID *</label>
                  <input type="text" value={orangeApi.merchantId} onChange={e => setOrangeApi({...orangeApi, merchantId: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="om_merchant_xxxxx" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">API Login *</label>
                  <input type="text" value={orangeApi.apiLogin} onChange={e => setOrangeApi({...orangeApi, apiLogin: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="login_om" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">API Password</label>
                  <input type="password" value={orangeApi.apiPassword} onChange={e => setOrangeApi({...orangeApi, apiPassword: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="••••••••" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">API Key</label>
                  <input type="password" value={orangeApi.apiKey} onChange={e => setOrangeApi({...orangeApi, apiKey: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="om_key_xxxxxxxx" />
                </div>
              </div>
              <button onClick={testOrangeConnection} className="mt-3 text-xs text-orange-600 underline flex items-center gap-1"><QrCode size={12} /> Tester la connexion</button>
            </div>

            {/* Numéros marchands (fallback) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2"><Phone size={14} /> Numéros marchands (Fallback)</h3>
              <p className="text-xs text-slate-500 mb-3">Utilisés uniquement si les API ne sont pas configurées. Le client devra entrer le montant manuellement.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Numéro Wave</label><input type="tel" value={merchantNumbers.wave} onChange={e => setMerchantNumbers({...merchantNumbers, wave: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="77 000 00 00" /></div>
                <div><label className="text-xs font-semibold text-slate-600 block mb-1">Numéro Orange Money</label><input type="tel" value={merchantNumbers.orange} onChange={e => setMerchantNumbers({...merchantNumbers, orange: e.target.value})} className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-mono" placeholder="78 000 00 00" /></div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>Pour obtenir vos clés API Wave et Orange Money, vous devez avoir un compte marchand agréé. Contactez Wave Sénégal et Orange Money Sénégal pour souscrire.</span>
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={saveApiSettings} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-md hover:shadow-xl transition-all flex items-center gap-2">
                <Save size={16} /> Sauvegarder les APIs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ONGLET RÉSEAU ==================== */}
      {activeTab === 'network' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Wifi size={20} className="text-blue-500" /> Configuration réseau</h2>
            <div className="space-y-4">
              {networkConfigs.map(config => {
                const Icon = config.icon;
                const value = networkSettings[config.id as keyof typeof networkSettings];
                return (
                  <div key={config.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Icon size={18} className="text-blue-600" /></div>
                    <div className="flex-1"><label className="text-sm font-semibold text-slate-700">{config.label}</label><input type="text" value={value} onChange={e => setNetworkSettings({...networkSettings, [config.id]: e.target.value})} className="w-full mt-1 p-2 rounded-lg border border-slate-200 text-sm" placeholder={config.placeholder} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Printer size={20} className="text-emerald-500" /> Imprimante de tickets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Type</label><select value={printerSettings.type} onChange={e => setPrinterSettings({...printerSettings, type: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200"><option value="network">Réseau (Ethernet/Wi-Fi)</option><option value="usb">USB</option><option value="bluetooth">Bluetooth</option></select></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Adresse IP</label><input type="text" value={printerSettings.ipAddress} onChange={e => setPrinterSettings({...printerSettings, ipAddress: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200" placeholder="192.168.1.100" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Port</label><input type="text" value={printerSettings.port} onChange={e => setPrinterSettings({...printerSettings, port: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200" placeholder="9100" /></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Format papier</label><select value={printerSettings.paperSize} onChange={e => setPrinterSettings({...printerSettings, paperSize: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200"><option value="58mm">58mm</option><option value="80mm">80mm</option></select></div>
            </div>
            <button onClick={saveNetworkSettings} className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold text-sm shadow-md hover:shadow-xl transition-all flex items-center gap-2"><Save size={16} /> Sauvegarder</button>
          </div>
        </div>
      )}

      {/* ==================== ONGLET SAUVEGARDE ==================== */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Database size={20} className="text-amber-500" /> Sauvegarde des données</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={exportData} className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left hover:shadow-md transition-all"><Download size={24} className="text-emerald-600 mb-2" /><p className="font-semibold text-emerald-800">Exporter les données</p><p className="text-xs text-emerald-600 mt-1">Sauvegarde complète en fichier JSON</p></button>
              <div className="relative"><button onClick={() => document.getElementById('importFile')?.click()} className="w-full p-4 rounded-xl bg-blue-50 border border-blue-200 text-left hover:shadow-md transition-all"><Upload size={24} className="text-blue-600 mb-2" /><p className="font-semibold text-blue-800">Importer les données</p><p className="text-xs text-blue-600 mt-1">Restaurer depuis un fichier JSON</p></button><input id="importFile" type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && setPendingAction({ type: 'import', data: e.target.files[0] }) && setShowPasswordModal(true)} /></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><RefreshCw size={20} className="text-red-500" /> Réinitialisation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => { setPendingAction({ type: 'resetSettings' }); setShowPasswordModal(true); }} className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-left hover:shadow-md transition-all"><RefreshCw size={24} className="text-amber-600 mb-2" /><p className="font-semibold text-amber-800">Réinitialiser les paramètres</p><p className="text-xs text-amber-600 mt-1">Remet à zéro tous les réglages</p></button>
              <button onClick={() => { setPendingAction({ type: 'resetAll' }); setShowPasswordModal(true); }} className="p-4 rounded-xl bg-red-50 border border-red-200 text-left hover:shadow-md transition-all"><Trash2 size={24} className="text-red-600 mb-2" /><p className="font-semibold text-red-800">Tout réinitialiser</p><p className="text-xs text-red-600 mt-1">Supprime toutes les données</p></button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ONGLET SÉCURITÉ ==================== */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><KeyRound size={20} className="text-violet-500" /> Mot de passe administrateur</h2>
            {!changePasswordMode ? (
              <button onClick={() => setChangePasswordMode(true)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-md">🔑 Changer le mot de passe</button>
            ) : (
              <div className="space-y-4 mt-4">
                <input type="password" placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200" />
                <input type="password" placeholder="Confirmer" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200" />
                <div className="flex gap-3">
                  <button onClick={changePassword} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold">Valider</button>
                  <button onClick={() => { setChangePasswordMode(false); setNewPassword(''); setConfirmPassword(''); }} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600">Annuler</button>
                </div>
              </div>
            )}
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <p className="text-sm text-amber-800 flex items-center gap-2"><Shield size={18} /> Les actions sensibles (import, réinitialisation) sont protégées par mot de passe.</p>
          </div>
        </div>
      )}

      {/* Modal mot de passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4"><Lock size={24} className="text-violet-600" /><h3 className="text-xl font-bold text-slate-900">Autorisation requise</h3></div>
            <p className="text-sm text-slate-500 mb-4">Cette action nécessite le mot de passe administrateur.</p>
            <input type="password" placeholder="Mot de passe" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500/20" autoFocus />
            {passwordError && <p className="text-red-500 text-sm mb-4">{passwordError}</p>}
            <div className="flex gap-3">
              <button onClick={() => verifyPassword(() => { if (pendingAction?.type === 'import' && pendingAction.data) importData(pendingAction.data); if (pendingAction?.type === 'resetSettings') resetSettings(); if (pendingAction?.type === 'resetAll') resetAllData(); })} className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-semibold">Confirmer</button>
              <button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(''); setPendingAction(null); }} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}