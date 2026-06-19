// src/utils/orderStore.ts
// Store persistant des commandes (IndexedDB via Dexie)
// Remplace le state React local de Orders.tsx

import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

// ── Types ─────────────────────────────────────────────────────
export interface PersistedOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  format: string;
  unitPrice: number;
  supplements?: string[];
}

export interface PersistedOrder {
  id: string;
  items: PersistedOrderItem[];
  tableNumber: number;
  server: string;
  status: 'en_attente' | 'en_cours' | 'payé' | 'annulé' | 'ardoise';
  createdAt: string; // ISO string pour IndexedDB
  paidAt?: string;
  total: number;
  paymentMethod?: string;
  comment?: string;
}

// ── Base de données dédiée aux commandes ──────────────────────
class OrderDatabase extends Dexie {
  orders!: Table<PersistedOrder>;

  constructor() {
    super('BarFlowOrders');
    this.version(1).stores({
      orders: 'id, status, tableNumber, createdAt, paidAt',
    });
  }

  // Toutes les commandes actives (non annulées)
  async getActiveOrders(): Promise<PersistedOrder[]> {
    return this.orders
      .where('status')
      .anyOf(['en_attente', 'en_cours', 'ardoise'])
      .toArray();
  }

  // Historique des commandes payées (30 derniers jours)
  async getPaidOrders(limitDays = 30): Promise<PersistedOrder[]> {
    const since = new Date();
    since.setDate(since.getDate() - limitDays);
    const sinceISO = since.toISOString();
    return this.orders
      .where('status')
      .equals('payé')
      .filter(o => o.paidAt != null && o.paidAt >= sinceISO)
      .toArray();
  }

  // Stats du jour pour Finance/Dashboard
  async getTodayStats(): Promise<{ ca: number; clients: number; orders: PersistedOrder[] }> {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = await this.orders
      .where('status')
      .equals('payé')
      .filter(o => o.paidAt != null && o.paidAt.startsWith(today))
      .toArray();

    const ca = todayOrders.reduce((s, o) => s + o.total, 0);
    return { ca, clients: todayOrders.length, orders: todayOrders };
  }

  // Stats par date (pour Finance)
  async getStatsByDate(days = 30): Promise<DayStats[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const paidOrders = await this.orders
      .where('status')
      .equals('payé')
      .filter(o => o.paidAt != null && o.paidAt >= sinceISO)
      .toArray();

    // Grouper par jour
    const byDay: Record<string, PersistedOrder[]> = {};
    paidOrders.forEach(order => {
      const day = (order.paidAt || order.createdAt).split('T')[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(order);
    });

    return Object.entries(byDay).map(([date, dayOrders]) => {
      const ca = dayOrders.reduce((s, o) => s + o.total, 0);
      const clients = dayOrders.length;
      const ticketMoyen = clients > 0 ? Math.round(ca / clients) : 0;
      const marge = Math.round(ca * 0.65); // marge estimée à 65%

      // Produits les plus vendus du jour
      const productSales: Record<string, number> = {};
      dayOrders.forEach(o => {
        o.items.forEach(item => {
          productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
        });
      });
      const produitsPlusVendus = Object.entries(productSales)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Consos par catégorie (à enrichir si on stocke la catégorie)
      const consos: Record<string, number> = {};
      dayOrders.forEach(o => {
        o.items.forEach(item => {
          // On utilisera la catégorie si disponible dans l'avenir
          consos['autres'] = (consos['autres'] || 0) + item.quantity;
        });
      });

      // Paiements
      const paymentBreakdown: Record<string, number> = {};
      dayOrders.forEach(o => {
        if (o.paymentMethod) {
          paymentBreakdown[o.paymentMethod] = (paymentBreakdown[o.paymentMethod] || 0) + o.total;
        }
      });

      return { date, ca, clients, ticketMoyen, marge, produitsPlusVendus, consos, paymentBreakdown };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Stats de paiement
  async getPaymentStats(days = 30): Promise<Record<string, { value: number; transactions: number }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const paidOrders = await this.orders
      .where('status')
      .equals('payé')
      .filter(o => o.paidAt != null && o.paidAt >= sinceISO)
      .toArray();

    const stats: Record<string, { value: number; transactions: number }> = {};
    paidOrders.forEach(o => {
      const method = o.paymentMethod || 'autre';
      if (!stats[method]) stats[method] = { value: 0, transactions: 0 };
      stats[method].value += o.total;
      stats[method].transactions += 1;
    });
    return stats;
  }

  // Ventes par produit
  async getProductSalesStats(days = 30): Promise<ProductSalesStat[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const paidOrders = await this.orders
      .where('status')
      .equals('payé')
      .filter(o => o.paidAt != null && o.paidAt >= sinceISO)
      .toArray();

    const productMap: Record<string, ProductSalesStat> = {};
    paidOrders.forEach(o => {
      o.items.forEach(item => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            quantity: 0,
            ca: 0,
            marge: 0,
          };
        }
        productMap[item.productId].quantity += item.quantity;
        productMap[item.productId].ca += item.quantity * item.unitPrice;
        productMap[item.productId].marge += item.quantity * item.unitPrice * 0.65;
      });
    });

    return Object.values(productMap).sort((a, b) => b.ca - a.ca);
  }
}

export interface DayStats {
  date: string;
  ca: number;
  clients: number;
  ticketMoyen: number;
  marge: number;
  produitsPlusVendus: { name: string; quantity: number }[];
  consos: Record<string, number>;
  paymentBreakdown: Record<string, number>;
}

export interface ProductSalesStat {
  productId: string;
  productName: string;
  quantity: number;
  ca: number;
  marge: number;
}

// ── Instance unique ───────────────────────────────────────────
export const orderDb = new OrderDatabase();

// ── Fonctions CRUD ────────────────────────────────────────────

// Sauvegarder une commande (ardoise ou en cours)
export async function saveOrder(order: PersistedOrder): Promise<void> {
  await orderDb.orders.put(order);
}

// Marquer une commande comme payée + décrémenter le stock
export async function payOrder(
  orderId: string,
  paymentMethod: string,
  updateStockFn?: (productId: string, delta: number) => Promise<void>
): Promise<PersistedOrder | null> {
  const order = await orderDb.orders.get(orderId);
  if (!order) return null;

  const paid: PersistedOrder = {
    ...order,
    status: 'payé',
    paymentMethod,
    paidAt: new Date().toISOString(),
  };
  await orderDb.orders.put(paid);

  // Décrémenter le stock de chaque produit
  if (updateStockFn) {
    for (const item of order.items) {
      await updateStockFn(item.productId, -item.quantity);
    }
  }

  return paid;
}

// Charger les commandes actives (ardoise + en cours)
export async function loadActiveOrders(): Promise<PersistedOrder[]> {
  return orderDb.getActiveOrders();
}

// Charger l'historique
export async function loadOrderHistory(days = 30): Promise<PersistedOrder[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();
  return orderDb.orders
    .filter(o => o.createdAt >= sinceISO)
    .toArray();
}

// Annuler une commande
export async function cancelOrder(orderId: string): Promise<void> {
  await orderDb.orders.update(orderId, { status: 'annulé' });
}

// ── Hooks React ───────────────────────────────────────────────

export function useActiveOrders() {
  return useLiveQuery(
    () => orderDb.getActiveOrders(),
    [],
    []
  );
}

export function useOrderHistory(days = 30) {
  return useLiveQuery(
    () => loadOrderHistory(days),
    [days],
    []
  );
}

export function useTodayStats() {
  return useLiveQuery(
    () => orderDb.getTodayStats(),
    [],
    { ca: 0, clients: 0, orders: [] }
  );
}

export function useRealDailyStats(days = 30) {
  return useLiveQuery(
    () => orderDb.getStatsByDate(days),
    [days],
    []
  );
}

export function useRealPaymentStats(days = 30) {
  return useLiveQuery(
    () => orderDb.getPaymentStats(days),
    [days],
    {}
  );
}

export function useRealProductSales(days = 30) {
  return useLiveQuery(
    () => orderDb.getProductSalesStats(days),
    [days],
    []
  );
}

// Ardoise : commandes en_attente groupées par table
export function useArdoises() {
  return useLiveQuery(
    () => orderDb.orders
      .where('status')
      .anyOf(['en_attente', 'ardoise'])
      .toArray(),
    [],
    []
  );
}
