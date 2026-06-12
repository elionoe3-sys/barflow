// ============================================
// src/utils/lossStore.ts
// Store partagé des pertes & ajustements
// ============================================
export type LossReason = 'casse' | 'offert' | 'ecart' | 'peremption' | 'inventaire' | 'autre';

export interface LossEntry {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  reason: LossReason;
  stockAvant: number;
  stockReel?: number;
  valeurPerdue: number;
  date: string;
  note?: string;
}

// ── Store global ──────────────────────────────────────────────
let globalLosses: LossEntry[] = [];
let lossListeners: (() => void)[] = [];

function notifyLossListeners() {
  lossListeners.forEach(l => l());
  localStorage.setItem('barflow_losses', JSON.stringify(globalLosses));
}

function initLosses() {
  try {
    const saved = localStorage.getItem('barflow_losses');
    if (saved) globalLosses = JSON.parse(saved);
  } catch { globalLosses = []; }
}
initLosses();

export function addLossEntry(entry: LossEntry): void {
  globalLosses = [entry, ...globalLosses];
  notifyLossListeners();
}

export function getLossEntries(): LossEntry[] {
  return globalLosses;
}

export function getTotalLosses(): number {
  return globalLosses.reduce((s, l) => s + l.valeurPerdue, 0);
}

export function getLossesByReason(): Record<LossReason, number> {
  const result: Record<LossReason, number> = {
    casse: 0, offert: 0, ecart: 0, peremption: 0, inventaire: 0, autre: 0,
  };
  globalLosses.forEach(l => { result[l.reason] += l.valeurPerdue; });
  return result;
}

// ── Hook React ────────────────────────────────────────────────
import { useState, useEffect } from 'react';

export function useLosses() {
  const [losses, setLosses] = useState<LossEntry[]>(globalLosses);

  useEffect(() => {
    const listener = () => setLosses([...globalLosses]);
    lossListeners.push(listener);
    return () => { lossListeners = lossListeners.filter(l => l !== listener); };
  }, []);

  const addLoss = (entry: LossEntry) => addLossEntry(entry);
  const totalLosses = losses.reduce((s, l) => s + l.valeurPerdue, 0);
  const lossesByReason = getLossesByReason();

  return { losses, addLoss, totalLosses, lossesByReason };
}