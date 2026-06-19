// src/utils/reapproStore.ts
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────

// Format de livraison fournisseur
export type FormatLivraison = 'unité' | 'carton12' | 'carton24' | 'caisse' | 'carton';

export interface SupplierProduct {
  productId: string;
  productName: string;
  unitType: 'unité' | 'carton';
  formatLivraison?: FormatLivraison; // format précis de livraison
  qtyParCarton?: number;             // nb bouteilles/unités dans le carton (12, 24, ou custom)
  contenanceClUnite?: number;        // cl par unité (bouteille), pour calcul automatique stock
  pricePerUnit: number;              // prix à l'unité (bouteille)
  pricePerCarton?: number;           // prix au carton complet
  qtyPerCarton?: number;             // alias legacy
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  products: SupplierProduct[];
  createdAt: string;
  notes?: string;
}

export interface ReapproOrderItem {
  productId: string;
  productName: string;
  // Quantité commandée en unités de livraison (cartons ou unités)
  quantity: number;
  formatLivraison: FormatLivraison;
  // Nb de bouteilles/unités dans chaque carton (si carton)
  qtyParCarton: number;
  // Nb total de bouteilles/unités reçues = quantity × qtyParCarton (si carton) ou quantity
  totalUnites: number;
  // Nb total de centilitres reçus = totalUnites × contenanceClUnite (0 si non configuré)
  totalCl: number;
  contenanceClUnite: number; // cl par bouteille/unité
  unitPrice: number;         // prix à l'unité bouteille
  totalPrice: number;
  unit: string;
}

export interface ReapproOrder {
  id: string;
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  items: ReapproOrderItem[];
  totalAmount: number;
  status: 'brouillon' | 'envoyée' | 'reçue' | 'annulée';
  createdAt: string;
  receivedAt?: string;
  notes?: string;
}

// ── Helpers calcul livraison ──────────────────────────────────

// Retourne le nombre de bouteilles/unités pour une quantité commandée
export function calcTotalUnites(qty: number, format: FormatLivraison, qtyParCarton: number): number {
  if (format === 'unité') return qty;
  return qty * qtyParCarton;
}

// Retourne le total en cl
export function calcTotalCl(totalUnites: number, contenanceClUnite: number): number {
  if (!contenanceClUnite) return 0;
  return Math.round(totalUnites * contenanceClUnite * 10) / 10;
}

// Label lisible pour le format de livraison
export function labelFormatLivraison(format: FormatLivraison, qtyParCarton?: number): string {
  switch (format) {
    case 'unité':    return 'Unité(s)';
    case 'carton12': return 'Carton × 12';
    case 'carton24': return 'Carton × 24';
    case 'caisse':   return `Caisse × ${qtyParCarton ?? '?'}`;
    case 'carton':   return `Carton × ${qtyParCarton ?? '?'}`;
    default:         return 'Unité(s)';
  }
}

// Retourne le qtyParCarton standard selon le format
export function qtyDefautParFormat(format: FormatLivraison, custom?: number): number {
  if (format === 'unité') return 1;
  if (format === 'carton12') return 12;
  if (format === 'carton24') return 24;
  return custom ?? 12;
}

// ── Base Dexie ───────────────────────────────────────────────
class ReapproDatabase extends Dexie {
  orders!: Table<ReapproOrder>;
  suppliers!: Table<Supplier>;

  constructor() {
    super('BarFlowReappro');
    this.version(1).stores({
      orders: 'id, status, supplierName, createdAt, receivedAt',
      suppliers: 'id, name, createdAt',
    });
  }

  async getActiveOrders(): Promise<ReapproOrder[]> {
    return this.orders.where('status').anyOf(['envoyée', 'brouillon']).toArray();
  }

  async getReceivedOrders(days = 365): Promise<ReapproOrder[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();
    return this.orders
      .where('status').equals('reçue')
      .filter(o => o.createdAt >= sinceISO)
      .toArray();
  }

  async getAllOrders(): Promise<ReapproOrder[]> {
    return this.orders.orderBy('createdAt').reverse().toArray();
  }

  async addOrder(order: Omit<ReapproOrder, 'id'>): Promise<ReapproOrder> {
    const newOrder: ReapproOrder = { ...order, id: `CMD-${uuidv4().slice(0, 8).toUpperCase()}` };
    await this.orders.add(newOrder);
    return newOrder;
  }

  async updateOrderStatus(id: string, status: ReapproOrder['status'], receivedAt?: string): Promise<void> {
    await this.orders.update(id, { status, ...(receivedAt ? { receivedAt } : {}) });
  }

  async getAchatStats(days = 30): Promise<{
    totalAchats: number;
    totalAchatsParMois: number;
    totalAchatsAnnuel: number;
    achatsParFournisseur: Record<string, number>;
    achatsParMois: { month: string; montant: number }[];
  }> {
    const received = await this.getReceivedOrders(365);
    const now = new Date();
    const totalAchats = received.reduce((s, o) => s + o.totalAmount, 0);
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthOrders = received.filter(o => {
      const d = new Date(o.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const totalAchatsParMois = monthOrders.reduce((s, o) => s + o.totalAmount, 0);
    const yearOrders = received.filter(o => new Date(o.createdAt).getFullYear() === thisYear);
    const totalAchatsAnnuel = yearOrders.reduce((s, o) => s + o.totalAmount, 0);
    const achatsParFournisseur: Record<string, number> = {};
    received.forEach(o => {
      achatsParFournisseur[o.supplierName] = (achatsParFournisseur[o.supplierName] || 0) + o.totalAmount;
    });
    const achatsParMois: { month: string; montant: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = date.getMonth();
      const y = date.getFullYear();
      const mOrders = received.filter(o => {
        const d = new Date(o.createdAt);
        return d.getMonth() === m && d.getFullYear() === y;
      });
      achatsParMois.push({
        month: date.toLocaleString('fr-FR', { month: 'short' }),
        montant: mOrders.reduce((s, o) => s + o.totalAmount, 0),
      });
    }
    return { totalAchats, totalAchatsParMois, totalAchatsAnnuel, achatsParFournisseur, achatsParMois };
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return this.suppliers.toArray();
  }

  async addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt'>): Promise<Supplier> {
    const newSupplier: Supplier = { ...supplier, id: uuidv4(), createdAt: new Date().toISOString() };
    await this.suppliers.add(newSupplier);
    return newSupplier;
  }

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<void> {
    await this.suppliers.update(id, data);
  }

  async deleteSupplier(id: string): Promise<void> {
    await this.suppliers.delete(id);
  }
}

export const reapproDB = new ReapproDatabase();

export async function migrateFromLocalStorage(): Promise<void> {
  const existingOrders = await reapproDB.orders.count();
  if (existingOrders > 0) return;
  try {
    const savedOrders = localStorage.getItem('barflow_reappro_orders');
    if (savedOrders) {
      const orders: ReapproOrder[] = JSON.parse(savedOrders);
      const realOrders = orders.filter(o => !o.id.match(/^CMD-0\d{2}$/));
      for (const order of realOrders) await reapproDB.orders.put(order);
    }
    const savedSuppliers = localStorage.getItem('barflow_suppliers');
    if (savedSuppliers) {
      const suppliers: Supplier[] = JSON.parse(savedSuppliers);
      for (const supplier of suppliers) await reapproDB.suppliers.put(supplier);
    }
  } catch (e) {
    console.warn('Migration localStorage → Dexie échouée:', e);
  }
}

export function useReapproOrders() { return useLiveQuery(() => reapproDB.getAllOrders(), [], []); }
export function useActiveReapproOrders() { return useLiveQuery(() => reapproDB.getActiveOrders(), [], []); }
export function useSuppliers() { return useLiveQuery(() => reapproDB.getAllSuppliers(), [], []); }
export function useAchatStats(days = 365) { return useLiveQuery(() => reapproDB.getAchatStats(days), [days], null); }