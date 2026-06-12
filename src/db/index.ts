import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

// ============ TYPES ============
export interface Charge {
  id: string;
  nom: string;
  categorie: string;
  montantMensuel: number;
  periodicite: string;
  synced: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employe {
  id: string;
  nom: string;
  poste: string;
  salaireBrut: number;
  prime: number;
  avantages: number;
  synced: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Investissement {
  id: string;
  nom: string;
  montant: number;
  type: string;
  amortissementAnnees: number;
  synced: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyStat {
  id?: string;
  date: string;
  ca: number;
  synced: boolean;
  createdAt: Date;
}

export interface Produit {
  id: string;
  nom: string;
  prix: number;
  categorie: string;
  stock: number;
  stockUnit?: string;
  seuilAlerte?: number;
  seuilCritique?: number;
  image?: string;
  color?: string;
  popularite?: number;
  activePriceFormats?: string[];
  prices?: {
    bouteille?: number;
    demi?: number;
    quart?: number;
    verre?: number;
    canette?: number;
  };
  options?: {
    bottleSize?: string;
    supplements?: string[];
    notes?: string;
  };
  synced: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Commande {
  id: string;
  numero: string;
  date: string;
  total: number;
  statut: string;
  items: any;
  synced: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncQueue {
  id?: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'charge' | 'employe' | 'investissement' | 'produit' | 'commande' | 'dailyStat';
  entityId: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}

// ============ BASE DE DONNÉES ============
class BarFlowDatabase extends Dexie {
  charges!: Table<Charge>;
  employes!: Table<Employe>;
  investissements!: Table<Investissement>;
  dailyStats!: Table<DailyStat>;
  produits!: Table<Produit>;
  commandes!: Table<Commande>;
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('BarFlowDB');

    this.version(1).stores({
      charges: 'id, synced, deleted, updatedAt, categorie',
      employes: 'id, synced, deleted, updatedAt, poste',
      investissements: 'id, synced, deleted, updatedAt, type',
      dailyStats: 'id, date, synced',
      produits: 'id, synced, deleted, updatedAt, categorie',
      commandes: 'id, synced, deleted, updatedAt, statut',
      syncQueue: '++id, entity, operation, timestamp'
    });
  }

  // ============ CHARGES ============
  async getActiveCharges() {
    const all = await this.charges.toArray();
    return all.filter(c => !c.deleted);
  }

  async addCharge(data: Omit<Charge, 'id' | 'synced' | 'deleted' | 'createdAt' | 'updatedAt'>) {
    const item: Charge = {
      ...data,
      id: uuidv4(),
      synced: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.charges.add(item);
    await this.addToSyncQueue('CREATE', 'charge', item.id, item);
    return item;
  }

  async updateCharge(id: string, data: Partial<Charge>) {
    const existing = await this.charges.get(id);
    if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.charges.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'charge', id, updated);
  }

  async deleteCharge(id: string) {
    await this.charges.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'charge', id, { id });
  }

  // ============ EMPLOYÉS ============
  async getActiveEmployes() {
    const all = await this.employes.toArray();
    return all.filter(e => !e.deleted);
  }

  async addEmploye(data: Omit<Employe, 'id' | 'synced' | 'deleted' | 'createdAt' | 'updatedAt'>) {
    const item: Employe = {
      ...data,
      id: uuidv4(),
      synced: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.employes.add(item);
    await this.addToSyncQueue('CREATE', 'employe', item.id, item);
    return item;
  }

  async updateEmploye(id: string, data: Partial<Employe>) {
    const existing = await this.employes.get(id);
    if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.employes.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'employe', id, updated);
  }

  async deleteEmploye(id: string) {
    await this.employes.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'employe', id, { id });
  }

  // ============ INVESTISSEMENTS ============
  async getActiveInvestissements() {
    const all = await this.investissements.toArray();
    return all.filter(i => !i.deleted);
  }

  async addInvestissement(data: Omit<Investissement, 'id' | 'synced' | 'deleted' | 'createdAt' | 'updatedAt'>) {
    const item: Investissement = {
      ...data,
      id: uuidv4(),
      synced: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.investissements.add(item);
    await this.addToSyncQueue('CREATE', 'investissement', item.id, item);
    return item;
  }

  async updateInvestissement(id: string, data: Partial<Investissement>) {
    const existing = await this.investissements.get(id);
    if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.investissements.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'investissement', id, updated);
  }

  async deleteInvestissement(id: string) {
    await this.investissements.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'investissement', id, { id });
  }

  // ============ PRODUITS ============
  async getActiveProduits() {
    const all = await this.produits.toArray();
    return all.filter(p => !p.deleted);
  }

  async addProduit(data: any) {
    const item: Produit = {
      id: uuidv4(),
      nom: data.nom || data.name,
      prix: data.prix || data.price || 0,
      categorie: data.categorie || data.category || 'autre',
      stock: data.stock || 0,
      stockUnit: data.stockUnit || 'unités',
      seuilAlerte: data.seuilAlerte || data.seuilAlerte || 10,
      seuilCritique: data.seuilCritique || data.seuilCritique || 5,
      image: data.image || '📦',
      color: data.color || '#8B5CF6',
      popularite: data.popularite || 50,
      activePriceFormats: data.activePriceFormats || ['bouteille'],
      prices: data.prices || {},
      options: data.options || {},
      synced: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.produits.add(item);
    await this.addToSyncQueue('CREATE', 'produit', item.id, item);
    return item;
  }

  async updateProduit(id: string, data: any) {
    const existing = await this.produits.get(id);
    if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.produits.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'produit', id, updated);
  }

  async deleteProduit(id: string) {
    await this.produits.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'produit', id, { id });
  }

  // ============ COMMANDES ============
  async getActiveCommandes() {
    const all = await this.commandes.toArray();
    return all.filter(c => !c.deleted);
  }

  async addCommande(data: any) {
    const item: Commande = {
      ...data,
      id: uuidv4(),
      synced: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.commandes.add(item);
    await this.addToSyncQueue('CREATE', 'commande', item.id, item);
    return item;
  }

  async updateCommande(id: string, data: any) {
    const existing = await this.commandes.get(id);
    if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.commandes.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'commande', id, updated);
  }

  async deleteCommande(id: string) {
    await this.commandes.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'commande', id, { id });
  }

  // ============ DAILY STATS ============
  async addDailyStat(date: string, ca: number) {
    const existing = await this.dailyStats.where('date').equals(date).first();
    if (existing) {
      await this.dailyStats.update(existing.id!, { ca, synced: false });
      await this.addToSyncQueue('UPDATE', 'dailyStat', existing.id!, { date, ca });
    } else {
      const item: DailyStat = {
        date,
        ca,
        synced: false,
        createdAt: new Date()
      };
      await this.dailyStats.add(item);
      await this.addToSyncQueue('CREATE', 'dailyStat', item.id!, item);
    }
  }

  async getDailyStats(startDate: Date, endDate: Date) {
    return await this.dailyStats
      .where('date')
      .between(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
      .toArray();
  }

  // ============ SYNC QUEUE ============
  private async addToSyncQueue(
    operation: SyncQueue['operation'],
    entity: SyncQueue['entity'],
    entityId: string,
    data: any
  ) {
    await this.syncQueue.add({
      operation,
      entity,
      entityId,
      data,
      timestamp: new Date(),
      retryCount: 0
    });
  }

  async getPendingSync() {
    return await this.syncQueue.toArray();
  }

  async clearSyncItem(id: number) {
    await this.syncQueue.delete(id);
  }

  // ============ INITIALISATION ============
  async isDataEmpty() {
    const charges = await this.charges.toArray();
    const chargeCount = charges.filter(c => !c.deleted).length;
    
    const employes = await this.employes.toArray();
    const employeCount = employes.filter(e => !e.deleted).length;
    
    const produits = await this.produits.toArray();
    const produitCount = produits.filter(p => !p.deleted).length;
    
    return chargeCount === 0 && employeCount === 0 && produitCount === 0;
  }

  async initDefaultData(productsData: any[]) {
    const isEmpty = await this.isDataEmpty();
    if (!isEmpty) return;

    for (const product of productsData) {
      await this.addProduit({
        nom: product.nom || product.name,
        prix: product.prix || product.price || 0,
        categorie: product.categorie || product.category || 'autre',
        stock: product.stock || 0
      });
    }

    await this.addCharge({
      nom: 'Électricité',
      categorie: 'electricite',
      montantMensuel: 150000,
      periodicite: 'mensuel'
    });
    await this.addCharge({
      nom: 'Eau',
      categorie: 'eau',
      montantMensuel: 75000,
      periodicite: 'mensuel'
    });
    await this.addCharge({
      nom: 'Internet',
      categorie: 'internet',
      montantMensuel: 45000,
      periodicite: 'mensuel'
    });
    await this.addCharge({
      nom: 'Loyer',
      categorie: 'loyer',
      montantMensuel: 500000,
      periodicite: 'mensuel'
    });

    await this.addEmploye({
      nom: 'Jean Diop',
      poste: 'Gérant',
      salaireBrut: 350000,
      prime: 50000,
      avantages: 25000
    });
    await this.addEmploye({
      nom: 'Marie Fall',
      poste: 'Serveuse',
      salaireBrut: 150000,
      prime: 20000,
      avantages: 10000
    });
  }
}

export const db = new BarFlowDatabase();

export async function initializeDefaultData() {
  const allCharges = await db.charges.toArray();
  const chargeCount = allCharges.filter(c => !c.deleted).length;
  
  if (chargeCount === 0) {
    await db.addCharge({
      nom: 'Électricité',
      categorie: 'electricite',
      montantMensuel: 150000,
      periodicite: 'mensuel'
    });
    await db.addCharge({
      nom: 'Eau',
      categorie: 'eau',
      montantMensuel: 75000,
      periodicite: 'mensuel'
    });
    await db.addCharge({
      nom: 'Internet',
      categorie: 'internet',
      montantMensuel: 45000,
      periodicite: 'mensuel'
    });
    await db.addCharge({
      nom: 'Loyer',
      categorie: 'loyer',
      montantMensuel: 500000,
      periodicite: 'mensuel'
    });
  }

  const allEmployes = await db.employes.toArray();
  const employeCount = allEmployes.filter(e => !e.deleted).length;
  
  if (employeCount === 0) {
    await db.addEmploye({
      nom: 'Jean Diop',
      poste: 'Gérant',
      salaireBrut: 350000,
      prime: 50000,
      avantages: 25000
    });
    await db.addEmploye({
      nom: 'Marie Fall',
      poste: 'Serveuse',
      salaireBrut: 150000,
      prime: 20000,
      avantages: 10000
    });
  }
}

// Type Prevision pour le bilan
export interface Prevision {
  annee: number;
  ca: number;
  charges: number;
  salaires: number;
  benefice: number;
  croissance: number;
}

// Ré-exportation pour compatibilité
export { BarFlowDatabase };
export type { Charge, Employe, Investissement, Produit, Commande, DailyStat, SyncQueue };