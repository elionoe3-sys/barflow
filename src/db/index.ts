import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

// ============ TYPES ============
export interface Charge {
  id: string; nom: string; categorie: string;
  montantMensuel: number; periodicite: string;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface Employe {
  id: string; nom: string; poste: string;
  salaireBrut: number; prime: number; avantages: number;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface Investissement {
  id: string; nom: string; montant: number; type: string;
  amortissementAnnees: number;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface DailyStat {
  id?: string; date: string; ca: number; clients: number;
  synced: boolean; createdAt: Date;
}
export interface Produit {
  id: string; nom: string; prix: number; categorie: string; stock: number;
  stockUnit?: string; seuilAlerte?: number; seuilCritique?: number;
  image?: string; photo?: string; color?: string; popularite?: number;
  activePriceFormats?: string[];
  prices?: { bouteille?: number; demi?: number; quart?: number; verre?: number; canette?: number; };
  options?: { bottleSize?: string; supplements?: string[]; notes?: string; };
  // Gestion stock en centilitres (vins/spiritueux/bières) — voir src/types.ts VolumeConfig
  stockCl?: number;
  volumeConfig?: {
    contenanceCl: number;
    clParBouteille?: number;
    clParDemi?: number;
    clParQuart?: number;
    clParVerre?: number;
    clParCanette?: number;
  };
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface Commande {
  id: string; numero: string; date: string; total: number; statut: string;
  items: any; tableNumber?: number; server?: string; paymentMethod?: string; comment?: string;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface Fournisseur {
  id: string; nom: string; telephone?: string; notes?: string; produits: any[];
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface ReapproCommande {
  id: string; fournisseurId?: string; fournisseurNom: string; fournisseurTel?: string;
  items: any[]; totalAmount: number; statut: string; receivedAt?: string;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface Perte {
  id: string; productId: string; productName: string; productPrice: number;
  quantity: number; reason: string; stockAvant: number; stockReel?: number;
  valeurPerdue: number; date: string; note?: string;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface Categorie {
  id: string; nom: string; emoji: string; color: string;
  synced: boolean; deleted: boolean; createdAt: Date; updatedAt: Date;
}
export interface BarSetting {
  key: string; value: any;
  synced: boolean; updatedAt: Date;
}
export interface SyncQueue {
  id?: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'charge' | 'employe' | 'investissement' | 'produit' | 'commande' |
          'dailyStat' | 'fournisseur' | 'reapproCommande' | 'perte' | 'categorie' | 'barSetting';
  entityId: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}
export interface Prevision {
  annee: number; ca: number; charges: number; salaires: number; benefice: number; croissance: number;
}

// ============ BASE DE DONNÉES ============
class BarFlowDatabase extends Dexie {
  charges!: Table<Charge>;
  employes!: Table<Employe>;
  investissements!: Table<Investissement>;
  dailyStats!: Table<DailyStat>;
  produits!: Table<Produit>;
  commandes!: Table<Commande>;
  fournisseurs!: Table<Fournisseur>;
  reapproCommandes!: Table<ReapproCommande>;
  pertes!: Table<Perte>;
  categories!: Table<Categorie>;
  barSettings!: Table<BarSetting>;
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('BarFlowDB');
    this.version(2).stores({
      charges:          'id, synced, deleted, updatedAt, categorie',
      employes:         'id, synced, deleted, updatedAt, poste',
      investissements:  'id, synced, deleted, updatedAt, type',
      dailyStats:       'id, date, synced',
      produits:         'id, synced, deleted, updatedAt, categorie',
      commandes:        'id, synced, deleted, updatedAt, statut',
      fournisseurs:     'id, synced, deleted, updatedAt, nom',
      reapproCommandes: 'id, synced, deleted, updatedAt, statut, fournisseurId',
      pertes:           'id, synced, deleted, updatedAt, productId, date',
      categories:       'id, synced, deleted, updatedAt, nom',
      barSettings:      'key, synced, updatedAt',
      syncQueue:        '++id, entity, operation, timestamp',
    });
  }

  // ── HELPER PRIVÉ ────────────────────────────────────────────
  private async addToSyncQueue(
    operation: SyncQueue['operation'],
    entity: SyncQueue['entity'],
    entityId: string,
    data: any
  ) {
    await this.syncQueue.add({ operation, entity, entityId, data, timestamp: new Date(), retryCount: 0 });
  }

  // ============ CHARGES ============
  async getActiveCharges() { return (await this.charges.toArray()).filter(c => !c.deleted); }
  async addCharge(data: Omit<Charge, 'id'|'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: Charge = { ...data, id: uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.charges.add(item);
    await this.addToSyncQueue('CREATE', 'charge', item.id, item);
    return item;
  }
  async updateCharge(id: string, data: Partial<Charge>) {
    const existing = await this.charges.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.charges.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'charge', id, updated);
  }
  async deleteCharge(id: string) {
    await this.charges.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'charge', id, { id });
  }

  // ============ EMPLOYÉS ============
  async getActiveEmployes() { return (await this.employes.toArray()).filter(e => !e.deleted); }
  async addEmploye(data: Omit<Employe, 'id'|'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: Employe = { ...data, id: uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.employes.add(item);
    await this.addToSyncQueue('CREATE', 'employe', item.id, item);
    return item;
  }
  async updateEmploye(id: string, data: Partial<Employe>) {
    const existing = await this.employes.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.employes.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'employe', id, updated);
  }
  async deleteEmploye(id: string) {
    await this.employes.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'employe', id, { id });
  }

  // ============ INVESTISSEMENTS ============
  async getActiveInvestissements() { return (await this.investissements.toArray()).filter(i => !i.deleted); }
  async addInvestissement(data: Omit<Investissement, 'id'|'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: Investissement = { ...data, id: uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.investissements.add(item);
    await this.addToSyncQueue('CREATE', 'investissement', item.id, item);
    return item;
  }
  async updateInvestissement(id: string, data: Partial<Investissement>) {
    const existing = await this.investissements.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.investissements.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'investissement', id, updated);
  }
  async deleteInvestissement(id: string) {
    await this.investissements.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'investissement', id, { id });
  }

  // ============ PRODUITS ============
  async getActiveProduits() { return (await this.produits.toArray()).filter(p => !p.deleted); }
  async addProduit(data: any) {
    const item: Produit = {
      id: uuidv4(), nom: data.nom || data.name, prix: data.prix || data.price || 0,
      categorie: data.categorie || data.category || 'autre', stock: data.stock || 0,
      stockUnit: data.stockUnit || 'unités', seuilAlerte: data.seuilAlerte || 10,
      seuilCritique: data.seuilCritique || 5, image: data.image || '📦',
      photo: data.photo || undefined,
      color: data.color || '#8B5CF6', popularite: data.popularite || 50,
      activePriceFormats: data.activePriceFormats || ['bouteille'],
      prices: data.prices || {}, options: data.options || {},
      stockCl: data.stockCl, volumeConfig: data.volumeConfig,
      synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date(),
    };
    await this.produits.add(item);
    await this.addToSyncQueue('CREATE', 'produit', item.id, item);
    return item;
  }
  async updateProduit(id: string, data: any) {
    const existing = await this.produits.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.produits.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'produit', id, updated);
  }
  async deleteProduit(id: string) {
    await this.produits.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'produit', id, { id });
  }

  // ============ COMMANDES ============
  async getActiveCommandes() { return (await this.commandes.toArray()).filter(c => !c.deleted); }
  async addCommande(data: any) {
    const item: Commande = { ...data, id: data.id || uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.commandes.add(item);
    await this.addToSyncQueue('CREATE', 'commande', item.id, item);
    return item;
  }
  async updateCommande(id: string, data: any) {
    const existing = await this.commandes.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.commandes.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'commande', id, updated);
  }
  async deleteCommande(id: string) {
    await this.commandes.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'commande', id, { id });
  }

  // ============ FOURNISSEURS ============
  async getActiveFournisseurs() { return (await this.fournisseurs.toArray()).filter(f => !f.deleted); }
  async addFournisseur(data: Omit<Fournisseur, 'id'|'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: Fournisseur = { ...data, id: uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.fournisseurs.add(item);
    await this.addToSyncQueue('CREATE', 'fournisseur', item.id, item);
    return item;
  }
  async updateFournisseur(id: string, data: Partial<Fournisseur>) {
    const existing = await this.fournisseurs.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.fournisseurs.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'fournisseur', id, updated);
  }
  async deleteFournisseur(id: string) {
    await this.fournisseurs.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'fournisseur', id, { id });
  }

  // ============ REAPPRO COMMANDES ============
  async getActiveReapproCommandes() { return (await this.reapproCommandes.toArray()).filter(c => !c.deleted); }
  async addReapproCommande(data: Omit<ReapproCommande, 'id'|'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: ReapproCommande = { ...data, id: uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.reapproCommandes.add(item);
    await this.addToSyncQueue('CREATE', 'reapproCommande', item.id, item);
    return item;
  }
  async updateReapproCommande(id: string, data: Partial<ReapproCommande>) {
    const existing = await this.reapproCommandes.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.reapproCommandes.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'reapproCommande', id, updated);
  }
  async deleteReapproCommande(id: string) {
    await this.reapproCommandes.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'reapproCommande', id, { id });
  }

  // ============ PERTES ============
  async getActivePertes() { return (await this.pertes.toArray()).filter(p => !p.deleted); }
  async addPerte(data: Omit<Perte, 'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: Perte = { ...data, synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.pertes.add(item);
    await this.addToSyncQueue('CREATE', 'perte', item.id, item);
    return item;
  }
  async deletePerte(id: string) {
    await this.pertes.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'perte', id, { id });
  }

  // ============ CATÉGORIES ============
  async getActiveCategories() { return (await this.categories.toArray()).filter(c => !c.deleted); }
  async addCategorie(data: Omit<Categorie, 'id'|'synced'|'deleted'|'createdAt'|'updatedAt'>) {
    const item: Categorie = { ...data, id: uuidv4(), synced: false, deleted: false, createdAt: new Date(), updatedAt: new Date() };
    await this.categories.add(item);
    await this.addToSyncQueue('CREATE', 'categorie', item.id, item);
    return item;
  }
  async updateCategorie(id: string, data: Partial<Categorie>) {
    const existing = await this.categories.get(id); if (!existing) return;
    const updated = { ...existing, ...data, synced: false, updatedAt: new Date() };
    await this.categories.update(id, updated);
    await this.addToSyncQueue('UPDATE', 'categorie', id, updated);
  }
  async deleteCategorie(id: string) {
    await this.categories.update(id, { deleted: true, synced: false, updatedAt: new Date() });
    await this.addToSyncQueue('DELETE', 'categorie', id, { id });
  }

  // ============ BAR SETTINGS ============
  async getSetting(key: string) { return await this.barSettings.get(key); }
  async setSetting(key: string, value: any) {
    const item: BarSetting = { key, value, synced: false, updatedAt: new Date() };
    await this.barSettings.put(item);
    await this.addToSyncQueue('UPDATE', 'barSetting', key, item);
    return item;
  }

  // ============ DAILY STATS ============
  async addDailyStat(date: string, ca: number, clients: number = 0) {
    const existing = await this.dailyStats.where('date').equals(date).first();
    if (existing) {
      await this.dailyStats.update(existing.id!, { ca, clients, synced: false });
      await this.addToSyncQueue('UPDATE', 'dailyStat', existing.id!, { date, ca, clients });
    } else {
      const item: DailyStat = { date, ca, clients, synced: false, createdAt: new Date() };
      await this.dailyStats.add(item);
      await this.addToSyncQueue('CREATE', 'dailyStat', item.id!, item);
    }
  }

  // ============ SYNC QUEUE ============
  async getPendingSync() { return await this.syncQueue.toArray(); }
  async clearSyncItem(id: number) { await this.syncQueue.delete(id); }

  // ============ INIT DATA ============
  async isDataEmpty() {
    const [charges, employes, produits] = await Promise.all([
      this.charges.toArray(), this.employes.toArray(), this.produits.toArray()
    ]);
    return charges.filter(c => !c.deleted).length === 0 &&
           employes.filter(e => !e.deleted).length === 0 &&
           produits.filter(p => !p.deleted).length === 0;
  }

  async initDefaultData(productsData: any[]) {
    // ── Garde-fou global : si des produits existent déjà (avec n'importe
    // quel id), on ne réinjecte rien. Cela évite la duplication en boucle
    // qui se produisait quand addProduit() générait un nouvel uuid à
    // chaque démarrage au lieu de respecter prod.id.
    const alreadyHasProducts = (await this.produits.count()) > 0;
    if (alreadyHasProducts) return;

    for (const prod of productsData) {
      const existing = await this.produits.get(prod.id);
      if (existing) continue;

      // Insertion directe avec l'id d'origine (p1, p2, ...) — on n'utilise
      // pas addProduit() ici car celui-ci génère toujours un nouvel uuid()
      // et ignorerait prod.id, rendant la vérification d'existence inutile
      // au prochain démarrage.
      const item: Produit = {
        id: prod.id,
        nom: prod.nom || prod.name,
        prix: prod.prix ?? prod.price ?? 0,
        categorie: prod.categorie || prod.category || 'autre',
        stock: prod.stock || 0,
        stockUnit: prod.stockUnit || 'unités',
        seuilAlerte: prod.seuilAlerte ?? 10,
        seuilCritique: prod.seuilCritique ?? 5,
        image: prod.image || '📦',
        color: prod.color || '#8B5CF6',
        popularite: prod.popularite ?? 50,
        activePriceFormats: prod.activePriceFormats || ['bouteille'],
        prices: prod.prices || {},
        options: prod.options || {},
        synced: false,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.produits.add(item);
      await this.addToSyncQueue('CREATE', 'produit', item.id, item);
    }
  }

  // ── Nettoyage des doublons créés par l'ancien bug (uuid aléatoire
  // au lieu de l'id du produit statique à chaque démarrage). Garde le
  // produit le plus ancien (createdAt le plus petit) par nom+catégorie
  // et supprime (soft-delete) les autres.
  async dedupeProduits(): Promise<number> {
    const all = (await this.produits.toArray()).filter(p => !p.deleted);
    const groups = new Map<string, Produit[]>();
    for (const p of all) {
      const key = `${(p.nom || '').trim().toLowerCase()}|${p.categorie}`;
      const arr = groups.get(key) || [];
      arr.push(p);
      groups.set(key, arr);
    }
    let removed = 0;
    for (const [, arr] of groups) {
      if (arr.length <= 1) continue;
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const [, ...dupes] = arr;
      for (const dup of dupes) {
        await this.deleteProduit(dup.id);
        removed++;
      }
    }
    return removed;
  }

}

export const db = new BarFlowDatabase();

export async function initializeDefaultData() {
  const chargesCount = (await db.charges.toArray()).filter(c => !c.deleted).length;
  if (chargesCount === 0) {
    await db.addCharge({ nom: 'Électricité', categorie: 'electricite', montantMensuel: 150000, periodicite: 'mensuel' });
    await db.addCharge({ nom: 'Eau', categorie: 'eau', montantMensuel: 75000, periodicite: 'mensuel' });
    await db.addCharge({ nom: 'Internet', categorie: 'internet', montantMensuel: 45000, periodicite: 'mensuel' });
    await db.addCharge({ nom: 'Loyer', categorie: 'loyer', montantMensuel: 500000, periodicite: 'mensuel' });
  }
  const employesCount = (await db.employes.toArray()).filter(e => !e.deleted).length;
  if (employesCount === 0) {
    await db.addEmploye({ nom: 'Jean Diop', poste: 'Gérant', salaireBrut: 350000, prime: 50000, avantages: 25000 });
    await db.addEmploye({ nom: 'Marie Fall', poste: 'Serveuse', salaireBrut: 150000, prime: 20000, avantages: 10000 });
  }
  const catsCount = (await db.categories.toArray()).filter(c => !c.deleted).length;
  if (catsCount === 0) {
    const defaultCats = [
      { nom: 'bières', emoji: '🍺', color: '#F59E0B' },
      { nom: 'cocktails', emoji: '🍹', color: '#EC4899' },
      { nom: 'vins', emoji: '🍷', color: '#8B5CF6' },
      { nom: 'softs', emoji: '🥤', color: '#06B6D4' },
      { nom: 'spiritueux', emoji: '🥃', color: '#B45309' },
      { nom: 'autres', emoji: '🍸', color: '#64748B' },
    ];
    for (const cat of defaultCats) await db.addCategorie(cat);
  }
}

export { BarFlowDatabase };