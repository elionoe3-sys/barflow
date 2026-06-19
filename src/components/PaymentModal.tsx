// PaymentModal.tsx — Wave API + Orange Money API + mode hors-ligne + reconciliation
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Lock, Check, CreditCard, Smartphone, Banknote, Edit2,
  Eye, EyeOff, Wifi, WifiOff, RefreshCw, AlertCircle, ExternalLink,
  Clock, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { QRCodeGenerator, generateManualTransactionId } from '@/components/QRCodeGenerator';
import { getSetting } from '@/utils/db';

// ── Types ─────────────────────────────────────────────────────
interface PaymentModalProps {
  orderId: string;
  total: number;
  onClose: () => void;
  onConfirm: (method: string) => void;
  allowedMethods?: PaymentMethod[];
}

type PaymentMethod = 'espèces' | 'wave' | 'orange_money' | 'carte';

export interface PendingWavePayment {
  id: string;
  orderId: string;
  amount: number;
  method: 'wave' | 'orange_money';
  manualRef?: string;
  createdAt: string;
  reconciled: boolean;
  reconciledAt?: string;
}

// ── Store hors-ligne (partagé Wave + OM) ──────────────────────
const PENDING_KEY = 'barflow_pending_wave';

export function loadPendingWavePayments(): PendingWavePayment[] {
  try {
    const s = localStorage.getItem(PENDING_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function savePendingPayment(p: PendingWavePayment) {
  const all = loadPendingWavePayments();
  localStorage.setItem(PENDING_KEY, JSON.stringify([p, ...all]));
}

export function reconcilePendingPayment(id: string) {
  const all = loadPendingWavePayments().map(p =>
    p.id === id ? { ...p, reconciled: true, reconciledAt: new Date().toISOString() } : p
  );
  localStorage.setItem(PENDING_KEY, JSON.stringify(all));
}

export function getPendingCount(): number {
  return loadPendingWavePayments().filter(p => !p.reconciled).length;
}

// ── Appels API Wave ───────────────────────────────────────────
async function createWaveCheckoutSession(params: {
  amount: number; orderId: string;
}): Promise<{ wave_launch_url: string; id: string } | null> {
  try {
    const res = await fetch('http://localhost:3001/api/wave/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: params.amount, currency: 'XOF', client_reference: params.orderId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function checkWaveSession(sessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`http://localhost:3001/api/wave/checkout/${sessionId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.payment_status || null;
  } catch { return null; }
}

// ── Appels API Orange Money ───────────────────────────────────
async function createOmPayment(params: {
  amount: number; orderId: string;
}): Promise<{ qrCode: string | null; deepLink: string | null; payToken: string } | null> {
  try {
    const res = await fetch('http://localhost:3001/api/orangemoney/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: params.amount, orderId: params.orderId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function checkOmStatus(payToken: string): Promise<string | null> {
  try {
    const res = await fetch(`http://localhost:3001/api/orangemoney/status/${payToken}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Orange Money retourne : SUCCESS | FAILED | EXPIRED | PENDING
    return data.status || data.paymentStatus || null;
  } catch { return null; }
}

// ── Composant principal ───────────────────────────────────────
export function PaymentModal({ orderId, total, onClose, onConfirm, allowedMethods }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntryMethod, setManualEntryMethod] = useState<'wave' | 'orange_money'>('wave');
  const [manualRef, setManualRef] = useState('');
  const [manualName, setManualName] = useState('');
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedTxId] = useState(() => generateManualTransactionId());

  // Wave state
  const [waveApiKey, setWaveApiKey] = useState('');
  const [waveMerchant, setWaveMerchant] = useState('');
  const [waveSessionId, setWaveSessionId] = useState('');
  const [waveLaunchUrl, setWaveLaunchUrl] = useState('');
  const [waveLoading, setWaveLoading] = useState(false);
  const [waveError, setWaveError] = useState('');
  const [waveStatus, setWaveStatus] = useState<'idle'|'pending'|'success'|'failed'>('idle');

  // Orange Money state
  const [omClientId, setOmClientId] = useState('');
  const [omMerchant, setOmMerchant] = useState('');
  const [omQrCode, setOmQrCode] = useState<string | null>(null);
  const [omDeepLink, setOmDeepLink] = useState<string | null>(null);
  const [omPayToken, setOmPayToken] = useState('');
  const [omLoading, setOmLoading] = useState(false);
  const [omError, setOmError] = useState('');
  const [omStatus, setOmStatus] = useState<'idle'|'pending'|'success'|'failed'>('idle');

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wavePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const omPollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const storedPassword = useRef('admin123');

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const load = async () => {
      const waveKey  = await getSetting('wave_api_key');
      const waveNum  = await getSetting('wave_merchant_number');
      const omId     = await getSetting('om_client_id');
      const omNum    = await getSetting('orange_merchant_number');
      const pwd      = await getSetting('admin_password');
      if (waveKey?.value)  setWaveApiKey(waveKey.value as string);
      if (waveNum?.value)  setWaveMerchant(waveNum.value as string);
      if (omId?.value)     setOmClientId(omId.value as string);
      if (omNum?.value)    setOmMerchant(omNum.value as string);
      if (pwd?.value)      storedPassword.current = pwd.value as string;
    };
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (wavePollingRef.current) clearInterval(wavePollingRef.current);
      if (omPollingRef.current)   clearInterval(omPollingRef.current);
    };
  }, []);

  // ── Wave ──────────────────────────────────────────────────
  const handleWaveOnline = useCallback(async () => {
    if (!waveApiKey) { setWaveError("Clé API Wave non configurée. Allez dans Paramètres → Wave & Paiements."); return; }
    setWaveLoading(true); setWaveError('');
    const session = await createWaveCheckoutSession({ amount: total, orderId });
    setWaveLoading(false);
    if (!session) { setWaveError("Impossible de créer la session Wave. Vérifiez votre connexion et votre clé API."); return; }
    setWaveSessionId(session.id);
    setWaveLaunchUrl(session.wave_launch_url);
    setWaveStatus('pending');
    window.open(session.wave_launch_url, '_blank');
    // Polling toutes les 3s
    wavePollingRef.current = setInterval(async () => {
      const status = await checkWaveSession(session.id);
      if (status === 'succeeded') {
        clearInterval(wavePollingRef.current!);
        setWaveStatus('success');
        setPaymentSuccess(true);
        setTimeout(() => onConfirm('wave'), 1500);
      } else if (status === 'failed' || status === 'cancelled') {
        clearInterval(wavePollingRef.current!);
        setWaveStatus('failed');
        setWaveError("Paiement échoué ou annulé.");
      }
    }, 3000);
    setTimeout(() => { if (wavePollingRef.current) { clearInterval(wavePollingRef.current); } }, 300000);
  }, [waveApiKey, total, orderId]);

  const handleWaveOffline = () => {
    savePendingPayment({ id: generatedTxId, orderId, amount: total, method: 'wave', createdAt: new Date().toISOString(), reconciled: false });
    setPaymentSuccess(true);
    setTimeout(() => onConfirm('wave'), 1500);
  };

  const handleWaveOfflineManual = () => {
    if (!manualRef.trim()) return;
    savePendingPayment({ id: generatedTxId, orderId, amount: total, method: 'wave', manualRef: manualRef.trim(), createdAt: new Date().toISOString(), reconciled: false });
    setPaymentSuccess(true);
    setTimeout(() => onConfirm('wave'), 1500);
  };

  // ── Orange Money ──────────────────────────────────────────
  const handleOmOnline = useCallback(async () => {
    if (!omClientId) { setOmError("Orange Money non configuré. Allez dans Paramètres → Wave & Paiements."); return; }
    setOmLoading(true); setOmError('');
    const result = await createOmPayment({ amount: total, orderId });
    setOmLoading(false);
    if (!result) { setOmError("Impossible d'initier le paiement Orange Money. Vérifiez votre connexion."); return; }
    setOmQrCode(result.qrCode);
    setOmDeepLink(result.deepLink);
    setOmPayToken(result.payToken);
    setOmStatus('pending');
    // Ouvrir le deeplink si disponible
    if (result.deepLink) window.open(result.deepLink, '_blank');
    // Polling toutes les 4s
    omPollingRef.current = setInterval(async () => {
      const status = await checkOmStatus(result.payToken);
      if (status === 'SUCCESS') {
        clearInterval(omPollingRef.current!);
        setOmStatus('success');
        setPaymentSuccess(true);
        setTimeout(() => onConfirm('orange_money'), 1500);
      } else if (status === 'FAILED' || status === 'EXPIRED') {
        clearInterval(omPollingRef.current!);
        setOmStatus('failed');
        setOmError("Paiement Orange Money échoué ou expiré.");
      }
    }, 4000);
    setTimeout(() => { if (omPollingRef.current) clearInterval(omPollingRef.current); }, 300000);
  }, [omClientId, total, orderId]);

  const handleOmOffline = () => {
    savePendingPayment({ id: generatedTxId, orderId, amount: total, method: 'orange_money', createdAt: new Date().toISOString(), reconciled: false });
    setPaymentSuccess(true);
    setTimeout(() => onConfirm('orange_money'), 1500);
  };

  const handleOmOfflineManual = () => {
    if (!manualRef.trim()) return;
    savePendingPayment({ id: generatedTxId, orderId, amount: total, method: 'orange_money', manualRef: manualRef.trim(), createdAt: new Date().toISOString(), reconciled: false });
    setPaymentSuccess(true);
    setTimeout(() => onConfirm('orange_money'), 1500);
  };

  const resetOm = () => {
    setOmStatus('idle'); setOmError(''); setOmQrCode(null);
    setOmDeepLink(null); setOmPayToken('');
    if (omPollingRef.current) clearInterval(omPollingRef.current);
  };

  const resetWave = () => {
    setWaveStatus('idle'); setWaveError(''); setWaveSessionId(''); setWaveLaunchUrl('');
    if (wavePollingRef.current) clearInterval(wavePollingRef.current);
  };

  // ── Mot de passe ──────────────────────────────────────────
  const verifyPassword = async () => {
    setPasswordError('');
    const stored = await getSetting('admin_password');
    if (stored) storedPassword.current = stored.value as string;
    if (passwordInput === storedPassword.current) {
      setPasswordModal(false); setShowManualEntry(true);
    } else {
      setPasswordError('Mot de passe incorrect');
    }
  };

  const openManualEntry = (method: 'wave' | 'orange_money') => {
    setManualEntryMethod(method);
    setManualRef('');
    setManualName('');
    setPasswordInput('');
    setPasswordError('');
    setPasswordModal(true);
  };

  const confirmPayment = () => {
    setPaymentSuccess(true);
    setTimeout(() => onConfirm(selectedMethod || 'espèces'), 1500);
  };

  const allMethods = [
    { id: 'espèces'      as PaymentMethod, label: 'Espèces',      icon: <Banknote size={22} />,   color: 'from-emerald-500 to-emerald-600', desc: 'Paiement en cash' },
    { id: 'wave'         as PaymentMethod, label: 'Wave',          icon: <Smartphone size={22} />, color: 'from-blue-500 to-blue-600',       desc: 'Paiement via Wave' },
    { id: 'orange_money' as PaymentMethod, label: 'Orange Money',  icon: <Smartphone size={22} />, color: 'from-orange-500 to-orange-600',   desc: 'Paiement via OM' },
    { id: 'carte'        as PaymentMethod, label: 'Carte',          icon: <CreditCard size={22} />, color: 'from-violet-500 to-violet-600',   desc: 'CB / Visa' },
  ];
  const methods = allMethods.filter(m => !allowedMethods || allowedMethods.includes(m.id));

  // ── Modal mot de passe ────────────────────────────────────
  if (passwordModal) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setPasswordModal(false)}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Lock size={24} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Authentification requise</h3>
            <p className="text-sm text-slate-500 mt-1">Saisie manuelle — {manualEntryMethod === 'wave' ? 'Wave' : 'Orange Money'}</p>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                placeholder="Mot de passe administrateur"
                className="w-full p-3 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                autoFocus />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
            <button onClick={verifyPassword}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm">
              Vérifier
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Saisie manuelle ───────────────────────────────────────
  if (showManualEntry) {
    const isWave = manualEntryMethod === 'wave';
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowManualEntry(false)}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isWave ? 'bg-blue-100' : 'bg-orange-100')}>
                <Edit2 size={18} className={isWave ? 'text-blue-600' : 'text-orange-600'} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Saisie manuelle {isWave ? 'Wave' : 'Orange Money'}</h3>
            </div>
            <button onClick={() => setShowManualEntry(false)} className="text-slate-400 p-1"><X size={20} /></button>
          </div>
          <div className={cn('border rounded-xl p-3 mb-4', isWave ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200')}>
            <p className={cn('text-xs font-medium', isWave ? 'text-amber-800' : 'text-orange-800')}>
              ⚠️ Le client a payé via l'autocollant {isWave ? 'Wave' : 'Orange Money'}. Notez la référence de la transaction.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Référence {isWave ? 'Wave' : 'Orange Money'} *
              </label>
              <textarea value={manualRef} onChange={e => setManualRef(e.target.value)}
                placeholder={isWave ? "Ex: WV2025-XXXX" : "Ex: OM-2025-XXXX"}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
                autoFocus />
              <p className="text-[10px] text-slate-400 mt-1">
                Réf locale : <span className="font-mono font-bold text-violet-600">{generatedTxId}</span>
                <span className="ml-2 text-amber-600">· À reconcilier</span>
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Nom du client (optionnel)</label>
              <input type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                placeholder="Pour vérification"
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
            <button
              onClick={isWave ? handleWaveOfflineManual : handleOmOfflineManual}
              disabled={!manualRef.trim()}
              className={cn('w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2',
                manualRef.trim() ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
              <Check size={18} /> Enregistrer (à reconcilier)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Succès ────────────────────────────────────────────────
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Check size={40} className="text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Paiement confirmé !</h3>
          <p className="text-sm text-slate-500 mt-2">Commande {orderId}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-3">{total.toLocaleString()} FCFA</p>
          {!isOnline && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2">
              <p className="text-xs text-amber-700 font-medium">📶 Hors-ligne — à reconcilier en ligne</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Modal principal ───────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Paiement</h2>
            <p className="text-xs text-slate-500">Commande {orderId}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold',
              isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              {isOnline ? 'En ligne' : 'Hors-ligne'}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
          </div>
        </div>

        {/* Total */}
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 mx-4 mt-4 rounded-2xl p-4 text-center text-white">
          <p className="text-sm text-violet-200">Montant à payer</p>
          <p className="text-3xl font-bold mt-1">{total.toLocaleString()} FCFA</p>
        </div>

        <div className="p-4 space-y-4">

          {/* Choix méthode */}
          {!selectedMethod && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Mode de paiement</p>
              <div className="grid grid-cols-2 gap-2.5">
                {methods.map(m => (
                  <button key={m.id} onClick={() => setSelectedMethod(m.id)}
                    className="p-4 rounded-2xl border-2 border-slate-200 hover:border-violet-300 active:scale-[0.97] transition-all text-center">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-2 bg-gradient-to-br', m.color)}>
                      {m.icon}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── WAVE ─────────────────────────────────────── */}
          {selectedMethod === 'wave' && (
            <WaveSection
              total={total} orderId={orderId} isOnline={isOnline}
              waveApiKey={waveApiKey} waveMerchant={waveMerchant}
              generatedTxId={generatedTxId}
              waveLoading={waveLoading} waveError={waveError}
              waveStatus={waveStatus} waveLaunchUrl={waveLaunchUrl}
              onLaunchOnline={handleWaveOnline}
              onOfflineQR={handleWaveOffline}
              onManualEntry={() => openManualEntry('wave')}
              onRetry={resetWave}
            />
          )}

          {/* ── ORANGE MONEY ─────────────────────────────── */}
          {selectedMethod === 'orange_money' && (
            <OmSection
              total={total} orderId={orderId} isOnline={isOnline}
              omClientId={omClientId} omMerchant={omMerchant}
              generatedTxId={generatedTxId}
              omLoading={omLoading} omError={omError}
              omStatus={omStatus} omQrCode={omQrCode} omDeepLink={omDeepLink}
              onLaunchOnline={handleOmOnline}
              onOfflineQR={handleOmOffline}
              onManualEntry={() => openManualEntry('orange_money')}
              onRetry={resetOm}
            />
          )}

          {/* ── ESPÈCES ──────────────────────────────────── */}
          {selectedMethod === 'espèces' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <Banknote size={32} className="text-emerald-600 mx-auto mb-2" />
                <p className="text-2xl font-black text-emerald-800">{total.toLocaleString()} FCFA</p>
                <p className="text-xs text-emerald-600 mt-1">Montant à régler</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Espèces reçues (FCFA)</label>
                <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                  placeholder="Ex: 2000, 5000, 10000..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  autoFocus />
              </div>
              {cashReceived && Number(cashReceived) >= total && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700 font-medium">Monnaie à rendre</p>
                  <p className="text-xl font-black text-amber-800 mt-0.5">{(Number(cashReceived) - total).toLocaleString()} FCFA</p>
                </div>
              )}
              {cashReceived && Number(cashReceived) < total && (
                <p className="text-xs text-red-500 text-center font-medium">⚠️ Montant insuffisant</p>
              )}
              <button onClick={confirmPayment}
                disabled={cashReceived !== '' && Number(cashReceived) < total}
                className={cn('w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5',
                  (cashReceived === '' || Number(cashReceived) >= total)
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
                <Check size={18} /> Confirmer le paiement
              </button>
            </div>
          )}

          {/* ── CARTE ────────────────────────────────────── */}
          {selectedMethod === 'carte' && (
            <div className="space-y-4">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
                <CreditCard size={32} className="text-violet-600 mx-auto mb-2" />
                <p className="text-2xl font-black text-violet-800">{total.toLocaleString()} FCFA</p>
              </div>
              <button onClick={confirmPayment}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
                <Check size={18} /> Confirmer le paiement
              </button>
            </div>
          )}

          {/* Retour */}
          {selectedMethod && (
            <button onClick={() => { setSelectedMethod(null); resetWave(); resetOm(); }}
              className="w-full py-2.5 text-sm text-slate-500 font-medium hover:text-slate-700">
              ← Changer de méthode
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section Wave ──────────────────────────────────────────────
function WaveSection({ total, orderId, isOnline, waveApiKey, waveMerchant, generatedTxId,
  waveLoading, waveError, waveStatus, waveLaunchUrl,
  onLaunchOnline, onOfflineQR, onManualEntry, onRetry }: {
  total: number; orderId: string; isOnline: boolean; waveApiKey: string; waveMerchant: string;
  generatedTxId: string; waveLoading: boolean; waveError: string;
  waveStatus: 'idle'|'pending'|'success'|'failed'; waveLaunchUrl: string;
  onLaunchOnline: () => void; onOfflineQR: () => void; onManualEntry: () => void; onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
        <Smartphone size={20} className="text-blue-600 mx-auto mb-1" />
        <p className="text-sm font-bold text-blue-800">Paiement Wave</p>
        <p className="text-2xl font-black text-blue-900 mt-1">{total.toLocaleString()} FCFA</p>
      </div>
      {waveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{waveError}</p>
        </div>
      )}
      {/* En ligne + API */}
      {isOnline && waveApiKey && waveStatus === 'idle' && (
        <div className="space-y-2">
          <button onClick={onLaunchOnline} disabled={waveLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
            {waveLoading ? <><RefreshCw size={16} className="animate-spin" /> Création session...</> : <><Smartphone size={16} /> Payer avec Wave</>}
          </button>
          <p className="text-[10px] text-center text-slate-400">Ouvre l'app Wave automatiquement · API Business sécurisée</p>
        </div>
      )}
      {/* En attente paiement */}
      {waveStatus === 'pending' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <RefreshCw size={16} className="text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-blue-800">En attente de paiement...</p>
            </div>
            <p className="text-xs text-blue-600">Le client paie dans son app Wave</p>
            {waveLaunchUrl && (
              <button onClick={() => window.open(waveLaunchUrl, '_blank')}
                className="mt-2 flex items-center gap-1 mx-auto text-xs text-blue-700 underline">
                <ExternalLink size={12} /> Rouvrir l'app Wave
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onRetry} className="py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium">Annuler</button>
            <button onClick={onManualEntry} className="py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium flex items-center justify-center gap-1">
              <Edit2 size={14} /> Saisie manuelle
            </button>
          </div>
        </div>
      )}
      {/* Succès */}
      {waveStatus === 'success' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
          <p className="font-bold text-emerald-800">Paiement Wave confirmé !</p>
        </div>
      )}
      {/* En ligne sans API */}
      {isOnline && !waveApiKey && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
              <AlertCircle size={12} /> API Wave non configurée — mode QR basique
            </p>
          </div>
          {waveMerchant ? (
            <div className="flex flex-col items-center bg-white border-2 border-blue-200 rounded-2xl p-4">
              <QRCodeGenerator
                text={`wave://payment?merchant=${waveMerchant.replace(/[\s\-\+]/g, '')}&amount=${total}&currency=XOF&reference=${orderId}`}
                size={200} className="rounded-xl" />
              <p className="text-[10px] text-blue-500 mt-2">Wave: {waveMerchant}</p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500">Aucun numéro Wave configuré</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onManualEntry} className="flex-1 py-3 rounded-xl bg-amber-100 text-amber-800 font-medium text-sm flex items-center justify-center gap-1.5">
              <Edit2 size={16} /> Saisie manuelle
            </button>
            <button onClick={onOfflineQR} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
              <Check size={16} /> Confirmé
            </button>
          </div>
        </div>
      )}
      {/* Hors-ligne */}
      {!isOnline && (
        <OfflineSection total={total} generatedTxId={generatedTxId} color="blue"
          label="Wave" onOfflineQR={onOfflineQR} onManualEntry={onManualEntry} />
      )}
    </div>
  );
}

// ── Section Orange Money ──────────────────────────────────────
function OmSection({ total, orderId, isOnline, omClientId, omMerchant, generatedTxId,
  omLoading, omError, omStatus, omQrCode, omDeepLink,
  onLaunchOnline, onOfflineQR, onManualEntry, onRetry }: {
  total: number; orderId: string; isOnline: boolean; omClientId: string; omMerchant: string;
  generatedTxId: string; omLoading: boolean; omError: string;
  omStatus: 'idle'|'pending'|'success'|'failed'; omQrCode: string | null; omDeepLink: string | null;
  onLaunchOnline: () => void; onOfflineQR: () => void; onManualEntry: () => void; onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
        <Smartphone size={20} className="text-orange-600 mx-auto mb-1" />
        <p className="text-sm font-bold text-orange-800">Paiement Orange Money</p>
        <p className="text-2xl font-black text-orange-900 mt-1">{total.toLocaleString()} FCFA</p>
      </div>
      {omError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{omError}</p>
        </div>
      )}
      {/* En ligne + API */}
      {isOnline && omClientId && omStatus === 'idle' && (
        <div className="space-y-2">
          <button onClick={onLaunchOnline} disabled={omLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
            {omLoading ? <><RefreshCw size={16} className="animate-spin" /> Génération QR...</> : <><Smartphone size={16} /> Payer avec Orange Money</>}
          </button>
          <p className="text-[10px] text-center text-slate-400">Génère un QR code dynamique sécurisé</p>
        </div>
      )}
      {/* QR généré — en attente */}
      {omStatus === 'pending' && (
        <div className="space-y-3">
          {omQrCode ? (
            <div className="flex flex-col items-center bg-white border-2 border-orange-300 rounded-2xl p-4">
              {/* QR base64 fourni par Orange Money */}
              <img src={`data:image/png;base64,${omQrCode}`} alt="QR Orange Money"
                className="w-48 h-48 rounded-xl" />
              <p className="text-xs text-orange-600 mt-2 font-semibold">Scanner avec Orange Money</p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <RefreshCw size={16} className="text-orange-500 animate-spin" />
                <p className="text-sm font-semibold text-orange-800">En attente de paiement...</p>
              </div>
              <p className="text-xs text-orange-600">Le client paie dans son app Orange Money</p>
            </div>
          )}
          {omDeepLink && (
            <button onClick={() => window.open(omDeepLink, '_blank')}
              className="w-full py-2 rounded-xl bg-orange-100 text-orange-800 text-sm font-medium flex items-center justify-center gap-1">
              <ExternalLink size={14} /> Ouvrir l'app Orange Money
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onRetry} className="py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium">Annuler</button>
            <button onClick={onManualEntry} className="py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium flex items-center justify-center gap-1">
              <Edit2 size={14} /> Saisie manuelle
            </button>
          </div>
        </div>
      )}
      {/* Succès */}
      {omStatus === 'success' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
          <p className="font-bold text-emerald-800">Paiement Orange Money confirmé !</p>
        </div>
      )}
      {/* En ligne sans API */}
      {isOnline && !omClientId && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
              <AlertCircle size={12} /> API Orange Money non configurée — mode QR basique
            </p>
          </div>
          {omMerchant ? (
            <div className="flex flex-col items-center bg-white border-2 border-orange-200 rounded-2xl p-4">
              <QRCodeGenerator
                text={`om://payment?merchant=${omMerchant.replace(/[\s\-\+]/g, '')}&amount=${total}&currency=XOF&reference=${orderId}`}
                size={200} className="rounded-xl" />
              <p className="text-[10px] text-orange-500 mt-2">OM: {omMerchant}</p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500">Aucun numéro Orange Money configuré</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onManualEntry} className="flex-1 py-3 rounded-xl bg-amber-100 text-amber-800 font-medium text-sm flex items-center justify-center gap-1.5">
              <Edit2 size={16} /> Saisie manuelle
            </button>
            <button onClick={onOfflineQR} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
              <Check size={16} /> Confirmé
            </button>
          </div>
        </div>
      )}
      {/* Hors-ligne */}
      {!isOnline && (
        <OfflineSection total={total} generatedTxId={generatedTxId} color="orange"
          label="Orange Money" onOfflineQR={onOfflineQR} onManualEntry={onManualEntry} />
      )}
    </div>
  );
}

// ── Section hors-ligne commune (Wave + OM) ────────────────────
function OfflineSection({ total, generatedTxId, color, label, onOfflineQR, onManualEntry }: {
  total: number; generatedTxId: string; color: 'blue' | 'orange';
  label: string; onOfflineQR: () => void; onManualEntry: () => void;
}) {
  const c = color === 'blue'
    ? { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', sub: 'text-blue-600', btn: 'from-blue-500 to-blue-600' }
    : { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', sub: 'text-orange-600', btn: 'from-orange-500 to-orange-600' };
  return (
    <div className="space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <WifiOff size={14} className="text-red-500" />
          <p className="text-xs font-bold text-red-800">Mode hors-ligne</p>
        </div>
        <p className="text-xs text-red-700">
          Montrez votre autocollant {label}. La transaction sera comptabilisée à la reconnexion.
        </p>
      </div>
      <div className={cn('border-2 border-dashed rounded-2xl p-4 text-center', c.bg, c.border)}>
        <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3', color === 'blue' ? 'bg-blue-100' : 'bg-orange-100')}>
          <Smartphone size={32} className={c.sub} />
        </div>
        <p className={cn('text-sm font-bold', c.text)}>Montrez votre autocollant {label}</p>
        <p className={cn('text-xs mt-1', c.sub)}>Le client scanne le QR code de votre autocollant marchand</p>
        <div className="mt-3 bg-white rounded-xl p-2 border border-slate-200">
          <p className="text-xs text-slate-600">Montant à payer</p>
          <p className={cn('text-xl font-black', c.text)}>{total.toLocaleString()} FCFA</p>
          <p className="text-[10px] text-slate-400 mt-1">Réf: {generatedTxId}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onManualEntry}
          className="py-3 rounded-xl bg-amber-100 text-amber-800 font-medium text-sm flex items-center justify-center gap-1.5">
          <Edit2 size={14} /> Réf. manuelle
        </button>
        <button onClick={onOfflineQR}
          className={cn('py-3 rounded-xl bg-gradient-to-r text-white font-bold text-sm flex items-center justify-center gap-1.5', c.btn)}>
          <Clock size={14} /> Client a payé
        </button>
      </div>
      <p className="text-[10px] text-center text-slate-400">
        💡 Transaction reconciliée automatiquement à la reconnexion
      </p>
    </div>
  );
}
