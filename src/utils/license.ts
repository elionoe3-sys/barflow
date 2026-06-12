// ============================================
// src/utils/license.ts
// Système de licence BarFlow - NE PAS MODIFIER
// ============================================

export type Plan = 'PLAN1' | 'PLAN2' | 'PLAN3';

export interface LicenseInfo {
  valid: boolean;
  plan: Plan | null;
  expiresAt: Date | null;
  daysLeft: number;
  message: string;
}

// ⚠️ SECRET : change ces 3 valeurs, ne les montre à personne
const SECRET_SALT = 'BARFLOW_2025_SN';
const SECRET_KEY  = 'XK9_TERANGA_77';
const SECRET_VER  = 'BF_V1';

// Génère une empreinte simple de la machine
function getMachineId(): string {
  const nav = navigator;
  const raw = [
    nav.language,
    nav.platform,
    nav.hardwareConcurrency,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  // Hash simple (djb2)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).toUpperCase().slice(0, 6);
}

// Hash simple pour vérifier la signature
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 6);
}

// ── GÉNÉRATEUR DE CLÉ (pour toi, le vendeur) ──────────────────
// Utilise cette fonction dans la console pour créer des clés
// generateLicenseKey('PLAN1', 30, 'A3F9B2')
export function generateLicenseKey(
  plan: Plan,
  durationDays: number,
  machineId: string
): string {
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + durationDays);
  const expStr = expDate.toISOString().split('T')[0].replace(/-/g, '');
  // ex: 20260607

  const payload = `${plan}-${expStr}-${machineId}`;
  const signature = simpleHash(`${SECRET_SALT}${payload}${SECRET_KEY}${SECRET_VER}`);

  return `${payload}-${signature}`;
  // Résultat: PLAN1-20260607-A3F9B2-X7K2M
}

// ── VÉRIFICATEUR DE CLÉ (dans le logiciel client) ─────────────
export function verifyLicense(key: string): LicenseInfo {
  const invalid: LicenseInfo = {
    valid: false,
    plan: null,
    expiresAt: null,
    daysLeft: 0,
    message: 'Clé invalide',
  };

  try {
    const parts = key.trim().toUpperCase().split('-');
    if (parts.length !== 4) return { ...invalid, message: 'Format de clé incorrect' };

    const [plan, expStr, machineId, signature] = parts;

    // 1. Vérifie le plan
    if (!['PLAN1', 'PLAN2', 'PLAN3'].includes(plan)) {
      return { ...invalid, message: 'Formule invalide' };
    }

    // 2. Vérifie la signature
    const payload = `${plan}-${expStr}-${machineId}`;
    const expectedSig = simpleHash(`${SECRET_SALT}${payload}${SECRET_KEY}${SECRET_VER}`);
    if (signature !== expectedSig) {
      return { ...invalid, message: 'Clé corrompue ou falsifiée' };
    }

    // 3. Vérifie la machine
    const currentMachine = getMachineId();
    if (machineId !== currentMachine) {
      return { ...invalid, message: 'Clé non valide sur cet ordinateur' };
    }

    // 4. Vérifie la date
    const year  = parseInt(expStr.slice(0, 4));
    const month = parseInt(expStr.slice(4, 6)) - 1;
    const day   = parseInt(expStr.slice(6, 8));
    const expiresAt = new Date(year, month, day);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (expiresAt < now) {
      return { ...invalid, message: 'Licence expirée', expiresAt };
    }

    const daysLeft = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      valid: true,
      plan: plan as Plan,
      expiresAt,
      daysLeft,
      message: `Licence active — ${daysLeft} jour(s) restant(s)`,
    };
  } catch {
    return { ...invalid, message: 'Erreur de vérification' };
  }
}

// ── SAUVEGARDE / LECTURE de la clé en local ───────────────────
const STORAGE_KEY = 'barflow_license_v1';

export function saveLicense(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function loadLicense(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearLicense(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── PERMISSIONS PAR FORMULE ────────────────────────────────────
export interface PlanFeatures {
  canAccessDashboard: boolean;
  canAccessOrders: boolean;
  canAccessStocks: boolean;
  canAccessFinance: boolean;
  canAccessSettings: boolean;
  canExportPDF: boolean;
  maxTables: number;
  label: string;
}

export function getPlanFeatures(plan: Plan | null): PlanFeatures {
  switch (plan) {
    case 'PLAN1':
      return {
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessStocks: false,
        canAccessFinance: false,
        canAccessSettings: true,
        canExportPDF: false,
        maxTables: 5,
        label: 'Formule Starter',
      };
    case 'PLAN2':
      return {
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessStocks: true,
        canAccessFinance: false,
        canAccessSettings: true,
        canExportPDF: false,
        maxTables: 15,
        label: 'Formule Pro',
      };
    case 'PLAN3':
      return {
        canAccessDashboard: true,
        canAccessOrders: true,
        canAccessStocks: true,
        canAccessFinance: true,
        canAccessSettings: true,
        canExportPDF: true,
        maxTables: 999,
        label: 'Formule Business',
      };
    default:
      return {
        canAccessDashboard: false,
        canAccessOrders: false,
        canAccessStocks: false,
        canAccessFinance: false,
        canAccessSettings: false,
        canExportPDF: false,
        maxTables: 0,
        label: 'Sans licence',
      };
  }
}

// ── RÉCUPÈRE L'ID DE LA MACHINE (pour générer une clé) ────────
export function getThisMachineId(): string {
  return getMachineId();
}