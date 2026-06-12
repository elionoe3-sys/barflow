// PaymentModal.tsx - Version complète corrigée
import { useState, useRef, useEffect } from 'react';
import { X, Lock, Check, CreditCard, Smartphone, Banknote, Edit2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { QRCodeGenerator, generatePaymentQRData, generateManualTransactionId } from '@/components/QRCodeGenerator';
import { getSetting } from '@/utils/db';

interface PaymentModalProps {
  orderId: string;
  total: number;
  onClose: () => void;
  onConfirm: (method: string) => void;
  allowedMethods?: PaymentMethod[];
}

type PaymentMethod = 'espèces' | 'wave' | 'orange_money' | 'carte';

export function PaymentModal({ orderId, total, onClose, onConfirm, allowedMethods }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState(total.toString());
  const [passwordModal, setPasswordModal] = useState<'manual' | 'admin' | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedTxId] = useState(() => generateManualTransactionId());
  const [waveMerchant, setWaveMerchant] = useState('');
  const [orangeMerchant, setOrangeMerchant] = useState('');

  const passwordRef = useRef<HTMLTextAreaElement>(null);
  const storedPassword = useRef('admin123');

  useEffect(() => {
    const loadMerchantNumbers = async () => {
      const waveStored = await getSetting('wave_merchant_number');
      const orangeStored = await getSetting('orange_merchant_number');
      if (waveStored?.value) setWaveMerchant(waveStored.value as string);
      if (orangeStored?.value) setOrangeMerchant(orangeStored.value as string);
    };
    loadMerchantNumbers();
  }, []);

  const verifyPassword = async () => {
    setPasswordError('');
    const stored = await getSetting('admin_password');
    if (stored) storedPassword.current = stored.value as string;
    if (passwordInput === storedPassword.current) {
      setPasswordModal(null);
      if (passwordModal === 'manual') setShowManualEntry(true);
    } else {
      setPasswordError('Mot de passe incorrect');
    }
  };

  const confirmPayment = () => {
    setPaymentSuccess(true);
    setTimeout(() => onConfirm(selectedMethod || 'espèces'), 1500);
  };

  const allMethods: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
    { id: 'espèces',      label: 'Espèces',      icon: <Banknote size={22} />,   color: 'from-emerald-500 to-emerald-600', desc: 'Paiement en cash' },
    { id: 'wave',         label: 'Wave',          icon: <Smartphone size={22} />, color: 'from-blue-500 to-blue-600',       desc: 'Paiement via Wave' },
    { id: 'orange_money', label: 'Orange Money',  icon: <Smartphone size={22} />, color: 'from-orange-500 to-orange-600',   desc: 'Paiement via OM' },
    { id: 'carte',        label: 'Carte',          icon: <CreditCard size={22} />, color: 'from-violet-500 to-violet-600',   desc: 'CB / Visa / Mastercard' },
  ];
  const methods = allMethods.filter(m => !allowedMethods || allowedMethods.includes(m.id));

  // ── Modal mot de passe ───────────────────────────────────────
  if (passwordModal) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setPasswordModal(null)}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Lock size={24} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Authentification requise</h3>
            <p className="text-sm text-slate-500 mt-1">Saisie manuelle de transaction</p>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                placeholder="Mot de passe administrateur"
                className="w-full p-3 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                autoFocus
              />
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

  // ── Modal saisie manuelle ────────────────────────────────────
  if (showManualEntry) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowManualEntry(false)}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Edit2 size={18} className="text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Saisie manuelle</h3>
            </div>
            <button onClick={() => setShowManualEntry(false)} className="text-slate-400 p-1"><X size={20} /></button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-xs text-amber-800 font-medium">⚠️ Uniquement si le scan QR échoue</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Référence de transaction *</label>
              <textarea
                ref={passwordRef}
                value={manualRef}
                onChange={e => setManualRef(e.target.value)}
                placeholder="Collez ici le code de la transaction Wave ou Orange Money..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Code commande : <span className="font-mono font-bold text-violet-600">{generatedTxId}</span>
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Nom du client</label>
              <input type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                placeholder="Nom du client"
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Montant (FCFA)</label>
              <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
            <button onClick={confirmPayment} disabled={!manualRef.trim()}
              className={cn('w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2',
                manualRef.trim()
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed')}>
              <Check size={18} /> Confirmer le paiement
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Animation succès ─────────────────────────────────────────
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
        </div>
      </div>
    );
  }

  // ── Modal principal ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Paiement</h2>
            <p className="text-xs text-slate-500">Commande {orderId}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
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

          {/* ── WAVE ─────────────────────────────────────────── */}
          {selectedMethod === 'wave' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <Smartphone size={20} className="text-blue-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-blue-800">Paiement Wave</p>
                <p className="text-2xl font-black text-blue-900 mt-1">{total.toLocaleString()} FCFA</p>
                <p className="text-[11px] text-blue-600 mt-1">Scannez ce QR code avec l'application Wave</p>
              </div>

              {waveMerchant ? (
                <div className="flex flex-col items-center bg-white border-2 border-blue-200 rounded-2xl p-4">
                  <QRCodeGenerator
                    text={generatePaymentQRData('wave', total, orderId, waveMerchant)}
                    size={240}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-slate-400 mt-3 font-mono">
                    Réf: {orderId}
                  </p>
                  <p className="text-[10px] text-blue-500 mt-2">
                    Numéro Wave: {waveMerchant}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-800 font-medium">⚠️ Numéro Wave non configuré</p>
                  <p className="text-xs text-amber-600 mt-1">Allez dans Paramètres → Numéros marchands</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setPasswordModal('manual')}
                  className="flex-1 py-3 rounded-xl bg-amber-100 text-amber-800 font-medium text-sm flex items-center justify-center gap-1.5">
                  <Edit2 size={16} /> Saisie manuelle
                </button>
                <button onClick={confirmPayment}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
                  <Check size={16} /> Confirmer
                </button>
              </div>
            </div>
          )}

          {/* ── ORANGE MONEY ─────────────────────────────────── */}
          {selectedMethod === 'orange_money' && (
            <div className="space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <Smartphone size={20} className="text-orange-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-orange-800">Paiement Orange Money</p>
                <p className="text-2xl font-black text-orange-900 mt-1">{total.toLocaleString()} FCFA</p>
                <p className="text-[11px] text-orange-600 mt-1">Scannez ce QR code avec l'application Orange Money</p>
              </div>

              {orangeMerchant ? (
                <div className="flex flex-col items-center bg-white border-2 border-orange-200 rounded-2xl p-4">
                  <QRCodeGenerator
                    text={generatePaymentQRData('orange_money', total, orderId, orangeMerchant)}
                    size={240}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-slate-400 mt-3 font-mono">
                    Réf: {orderId}
                  </p>
                  <p className="text-[10px] text-orange-500 mt-2">
                    Numéro OM: {orangeMerchant}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-800 font-medium">⚠️ Numéro Orange Money non configuré</p>
                  <p className="text-xs text-amber-600 mt-1">Allez dans Paramètres → Numéros marchands</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setPasswordModal('manual')}
                  className="flex-1 py-3 rounded-xl bg-amber-100 text-amber-800 font-medium text-sm flex items-center justify-center gap-1.5">
                  <Edit2 size={16} /> Saisie manuelle
                </button>
                <button onClick={confirmPayment}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
                  <Check size={16} /> Confirmer
                </button>
              </div>
            </div>
          )}

          {/* ── ESPÈCES ──────────────────────────────────────── */}
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

          {/* ── CARTE ────────────────────────────────────────── */}
          {selectedMethod === 'carte' && (
            <div className="space-y-4">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-center">
                <CreditCard size={32} className="text-violet-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-violet-800">Paiement par carte</p>
                <p className="text-[11px] text-violet-600 mt-1">CB / Visa / Mastercard</p>
              </div>
              <button onClick={confirmPayment}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
                <Check size={18} /> Confirmer le paiement
              </button>
            </div>
          )}

          {/* Retour */}
          {selectedMethod && (
            <button onClick={() => setSelectedMethod(null)}
              className="w-full py-2.5 text-sm text-slate-500 font-medium hover:text-slate-700">
              ← Changer de méthode
            </button>
          )}

        </div>
      </div>
    </div>
  );
}