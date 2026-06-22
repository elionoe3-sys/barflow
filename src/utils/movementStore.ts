// src/utils/movementStore.ts
// Store persistant des MOUVEMENTS DE STOCK réels (IndexedDB via Dexie)
// Remplace la liste statique "stockMovements" de data.ts par de vrais flux :
// réceptions (réappro), ventes (paiement commande), pertes/ajustements (inventaire)

import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export type MovementType = 'entrée' | 'sortie' | 'correction';

export interface StockMovementEntry {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;       // toujours positif ; le sens est donné par `type`
  quantityCl?: number;    // en cl si le produit a un volumeConfig (positif)
  date: string;           // ISO string
  supplier?: string;      // pour les entrées (réappro)
  purchasePrice?: number; // prix d'achat unitaire pour les entrées
  reason: string;         // ex: "Réception fournisseur", "Vente", "Casse", "Inventaire"
  orderId?: string;       // lien vers la commande si c'est une vente
}

class MovementDatabase extends Dexie {
  movements!: Table<StockMovementEntry>;

  constructor() {
    super('BarFlowMovements');
    this.version(1).stores({
      movements: 'id, productId, type, date',
    });
  }

  async getRecent(limit = 100): Promise<StockMovementEntry[]> {
    return this.movements.orderBy('date').reverse().limit(limit).toArray();
  }

  async getByProduct(productId: string, limit = 50): Promise<StockMovementEntry[]> {
    return this.movements
      .where('productId').equals(productId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getSince(days = 30): Promise<StockMovementEntry[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();
    return this.movements
      .where('date').aboveOrEqual(sinceISO)
      .reverse()
      .toArray();
  }
}

export const movementDb = new MovementDatabase();

// ── Enregistrement d'un mouvement ─────────────────────────────
export async function addMovement(entry: Omit<StockMovementEntry, 'id' | 'date'> & { date?: string }): Promise<void> {
  const movement: StockMovementEntry = {
    ...entry,
    id: `mvt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: entry.date || new Date().toISOString(),
  };
  await movementDb.movements.add(movement);
}

// ── Helpers spécifiques par type d'évènement ──────────────────

// Réception fournisseur (réappro) → entrée
export async function recordEntree(params: {
  productId: string;
  productName: string;
  quantity: number;
  quantityCl?: number;
  supplier?: string;
  purchasePrice?: number;
  reason?: string;
}): Promise<void> {
  await addMovement({
    productId: params.productId,
    productName: params.productName,
    type: 'entrée',
    quantity: params.quantity,
    quantityCl: params.quantityCl,
    supplier: params.supplier,
    purchasePrice: params.purchasePrice,
    reason: params.reason || 'Réception fournisseur',
  });
}

// Vente (paiement commande) → sortie
export async function recordSortie(params: {
  productId: string;
  productName: string;
  quantity: number;
  quantityCl?: number;
  orderId?: string;
  reason?: string;
}): Promise<void> {
  await addMovement({
    productId: params.productId,
    productName: params.productName,
    type: 'sortie',
    quantity: params.quantity,
    quantityCl: params.quantityCl,
    orderId: params.orderId,
    reason: params.reason || 'Vente',
  });
}

// Perte / ajustement / inventaire → correction
export async function recordCorrection(params: {
  productId: string;
  productName: string;
  quantity: number;
  quantityCl?: number;
  reason: string;
}): Promise<void> {
  await addMovement({
    productId: params.productId,
    productName: params.productName,
    type: 'correction',
    quantity: params.quantity,
    quantityCl: params.quantityCl,
    reason: params.reason,
  });
}

// ── Hooks React (live) ────────────────────────────────────────
export function useRecentMovements(limit = 100) {
  return useLiveQuery(() => movementDb.getRecent(limit), [limit], []);
}

export function useProductMovements(productId: string, limit = 50) {
  return useLiveQuery(
    () => productId ? movementDb.getByProduct(productId, limit) : Promise.resolve([]),
    [productId, limit],
    []
  );
}

export function useMovementsSince(days = 30) {
  return useLiveQuery(() => movementDb.getSince(days), [days], []);
}