// ============================================
// src/components/LicenseGate/index.tsx
// Écran d'activation de licence BarFlow
// ============================================

import { useState } from 'react';
import { ShieldCheck, Key, AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import {
  verifyLicense,
  saveLicense,
  getPlanFeatures,
  getThisMachineId,
  type LicenseInfo,
} from '@/utils/license';

interface Props {
  onActivated: (info: LicenseInfo) => void;
}

export function LicenseGate({ onActivated }: Props) {
  const [key, setKey]         = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const machineId = getThisMachineId();

  function handleCopy() {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleActivate() {
    setError('');
    setSuccess('');
    setLoading(true);

    setTimeout(() => {
      const result = verifyLicense(key);
      if (result.valid) {
        saveLicense(key);
        const features = getPlanFeatures(result.plan);
        setSuccess(`✅ ${features.label} activée ! Bienvenue sur BarFlow.`);
        setTimeout(() => onActivated(result), 1500);
      } else {
        setError(result.message);
      }
      setLoading(false);
    }, 800);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-3xl shadow-2xl mx-auto mb-4">
            B
          </div>
          <h1 className="text-3xl font-bold text-slate-900">BarFlow</h1>
          <p className="text-slate-500 mt-1">Gestion intelligente de bars </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <ShieldCheck size={20} className="text-violet-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Activation de licence</h2>
              <p className="text-xs text-slate-500">Entrez votre clé pour accéder au logiciel</p>
            </div>
          </div>

          {/* ID Machine */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-200">
            <p className="text-xs text-slate-500 mb-2 font-medium">
              🖥️ Identifiant de votre machine
            </p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-bold text-violet-700 tracking-widest">
                {machineId}
              </code>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50"
              >
                <Copy size={12} />
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Communiquez cet identifiant à votre revendeur pour obtenir votre clé
            </p>
          </div>

          {/* Saisie clé */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Clé de licence
            </label>
            <div className="relative">
              <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={key}
                onChange={e => setKey(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                placeholder="PLAN1-20260607-XXXXXX-XXXXXX"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Succès */}
          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          )}

          {/* Bouton */}
          <button
            onClick={handleActivate}
            disabled={!key.trim() || loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Vérification...' : 'Activer la licence'}
          </button>

          {/* Formules */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-3 font-medium">FORMULES DISPONIBLES</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'Starter', plan: 'PLAN1', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { name: 'Pro',     plan: 'PLAN2', color: 'bg-violet-50 text-violet-700 border-violet-100' },
                { name: 'Business',plan: 'PLAN3', color: 'bg-amber-50 text-amber-700 border-amber-100' },
              ].map(f => (
                <div key={f.plan} className={`rounded-xl border p-2 text-center ${f.color}`}>
                  <p className="text-[10px] font-bold">{f.plan}</p>
                  <p className="text-[11px] font-medium">{f.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          BarFlow © 2025 — Tous droits réservés
        </p>
      </div>
    </div>
  );
}