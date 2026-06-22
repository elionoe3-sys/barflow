// src/services/universalSync.ts
// Couche unique de synchronisation : Dexie (hors-ligne) ↔ Serveur Express/Supabase (en ligne)
import { db } from '@/db';
import * as api from './api';

let isOnline = navigator.onLine;

window.addEventListener('online',  () => { isOnline = true;  synchronizeAll(); });
window.addEventListener('offline', () => { isOnline = false; });

// ── Appel API "best effort" ────────────────────────────────────
// Le serveur Express (localhost:3001) n'est pas toujours lancé (usage
// tablette hors-ligne). Si l'appel échoue (réseau, serveur down, timeout),
// on ne doit JAMAIS faire planter l'opération locale qui l'a déclenché :
// l'écriture est déjà sécurisée dans Dexie + la syncQueue la rejouera plus
// tard (via synchronizeAll). Sans ce garde-fou, une simple absence de
// serveur backend bloque silencieusement tous les boutons "Enregistrer".
async function safeApiCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.warn('[universalSync] Appel API serveur échoué (sera resynchronisé plus tard) :', error);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// SYNC MONTANTE : rejoue la syncQueue vers le serveur
// ══════════════════════════════════════════════════════════════
async function synchronizeAll() {
  if (!isOnline) return;
  const pending = await db.syncQueue.toArray();

  for (const item of pending) {
    try {
      switch (item.entity) {

        case 'produit': {
          const p = item.data;
          const d = { id: p.id, nom: p.nom || p.name, prix: p.prix || p.price || 0,
            categorie: p.categorie || p.category || 'autre', stock: p.stock || 0,
            stockUnit: p.stockUnit, seuilAlerte: p.seuilAlerte, seuilCritique: p.seuilCritique,
            image: p.image, photo: p.photo ?? null, color: p.color, popularite: p.popularite,
            activePriceFormats: p.activePriceFormats, prices: p.prices, options: p.options,
            stockCl: p.stockCl ?? null, volumeConfig: p.volumeConfig ?? null };
          if (item.operation === 'CREATE') await api.createProduit(d);
          if (item.operation === 'UPDATE') await api.updateProduit(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteProduit(item.entityId);
          break;
        }

        case 'commande': {
          const c = item.data;
          const d = { id: c.id, numero: c.numero || c.id, date: c.date || new Date().toISOString(),
            total: c.total || 0, statut: c.statut || 'en_cours', items: c.items || [],
            tableNumber: c.tableNumber, server: c.server, paymentMethod: c.paymentMethod, comment: c.comment };
          if (item.operation === 'CREATE') await api.createCommande(d);
          if (item.operation === 'UPDATE') await api.updateCommande(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteCommande(item.entityId);
          break;
        }

        case 'charge': {
          const c = item.data;
          const d = { id: c.id, nom: c.nom, categorie: c.categorie, montantMensuel: c.montantMensuel, periodicite: c.periodicite };
          if (item.operation === 'CREATE') await api.createCharge(d);
          if (item.operation === 'UPDATE') await api.updateCharge(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteCharge(item.entityId);
          break;
        }

        case 'employe': {
          const e = item.data;
          const d = { id: e.id, nom: e.nom, poste: e.poste, salaireBrut: e.salaireBrut, prime: e.prime, avantages: e.avantages };
          if (item.operation === 'CREATE') await api.createEmploye(d);
          if (item.operation === 'UPDATE') await api.updateEmploye(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteEmploye(item.entityId);
          break;
        }

        case 'investissement': {
          const i = item.data;
          const d = { id: i.id, nom: i.nom, type: i.type, montant: i.montant, amortissementAnnees: i.amortissementAnnees };
          if (item.operation === 'CREATE') await api.createInvestissement(d);
          if (item.operation === 'UPDATE') await api.updateInvestissement(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteInvestissement(item.entityId);
          break;
        }

        case 'dailyStat':
          if (item.operation === 'CREATE' || item.operation === 'UPDATE')
            await api.updateDailyStats(item.data.date, item.data.ca, item.data.clients);
          break;

        case 'fournisseur': {
          const f = item.data;
          const d = { id: f.id, nom: f.nom, telephone: f.telephone, notes: f.notes, produits: f.produits };
          if (item.operation === 'CREATE') await api.createFournisseur(d);
          if (item.operation === 'UPDATE') await api.updateFournisseur(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteFournisseur(item.entityId);
          break;
        }

        case 'reapproCommande': {
          const r = item.data;
          const d = { id: r.id, fournisseurId: r.fournisseurId, fournisseurNom: r.fournisseurNom,
            fournisseurTel: r.fournisseurTel, items: r.items, totalAmount: r.totalAmount,
            statut: r.statut, receivedAt: r.receivedAt };
          if (item.operation === 'CREATE') await api.createReapproCommande(d);
          if (item.operation === 'UPDATE') await api.updateReapproCommande(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteReapproCommande(item.entityId);
          break;
        }

        case 'perte': {
          const p = item.data;
          const d = { id: p.id, productId: p.productId, productName: p.productName,
            productPrice: p.productPrice, quantity: p.quantity, reason: p.reason,
            stockAvant: p.stockAvant, stockReel: p.stockReel, valeurPerdue: p.valeurPerdue,
            date: p.date, note: p.note };
          if (item.operation === 'CREATE') await api.createPerte(d);
          if (item.operation === 'DELETE') await api.deletePerte(item.entityId);
          break;
        }

        case 'categorie': {
          const c = item.data;
          const d = { id: c.id, nom: c.nom, emoji: c.emoji, color: c.color };
          if (item.operation === 'CREATE') await api.createCategorie(d);
          if (item.operation === 'UPDATE') await api.updateCategorie(item.entityId, d);
          if (item.operation === 'DELETE') await api.deleteCategorie(item.entityId);
          break;
        }

        case 'barSetting': {
          const s = item.data;
          if (item.operation === 'UPDATE') await api.setSetting(s.key, s.value);
          if (item.operation === 'DELETE') await api.deleteSetting(item.entityId);
          break;
        }
      }

      await db.syncQueue.delete(item.id!);
    } catch (error) {
      console.error('Sync montante échouée pour', item.entity, item.operation, error);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// SYNC DESCENDANTE : récupère le serveur → écrase Dexie
// ══════════════════════════════════════════════════════════════
async function syncFromServer() {
  if (!isOnline) return;
  try {
    // Produits
    const serverProduits = await api.getProduits();
    for (const p of serverProduits) {
      const existing = await db.produits.get(p.id);
      // Ne jamais écraser une photo/stockCl/volumeConfig locale par une valeur
      // vide venant du serveur (cas où le serveur n'a pas encore reçu la donnée
      // la plus récente, p.ex. juste après une modif locale pas encore re-synchronisée).
      const photo = p.photo ?? (existing as any)?.photo;
      const stockCl = p.stockCl ?? (existing as any)?.stockCl;
      const volumeConfig = p.volumeConfig ?? (existing as any)?.volumeConfig;
      const data = { nom: p.nom, prix: p.prix, categorie: p.categorie, stock: p.stock,
        stockUnit: p.stockUnit || 'unités', seuilAlerte: p.seuilAlerte ?? 10, seuilCritique: p.seuilCritique ?? 5,
        image: p.image || '📦', photo, color: p.color || '#8B5CF6', popularite: p.popularite ?? 50,
        activePriceFormats: p.activePriceFormats || ['bouteille'], prices: p.prices || {}, options: p.options || {},
        stockCl, volumeConfig,
        synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.produits.add({ ...data, id: p.id, createdAt: new Date() });
      else await db.produits.update(p.id, data);
    }

    // Charges
    const serverCharges = await api.getCharges();
    for (const c of serverCharges) {
      const existing = await db.charges.get(c.id);
      const data = { nom: c.nom, categorie: c.categorie, montantMensuel: c.montantMensuel,
        periodicite: c.periodicite, synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.charges.add({ ...data, id: c.id, createdAt: new Date() });
      else await db.charges.update(c.id, data);
    }

    // Employés
    const serverEmployes = await api.getEmployes();
    for (const e of serverEmployes) {
      const existing = await db.employes.get(e.id);
      const data = { nom: e.nom, poste: e.poste, salaireBrut: e.salaireBrut, prime: e.prime,
        avantages: e.avantages, synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.employes.add({ ...data, id: e.id, createdAt: new Date() });
      else await db.employes.update(e.id, data);
    }

    // Investissements
    const serverInvests = await api.getInvestissements();
    for (const i of serverInvests) {
      const existing = await db.investissements.get(i.id);
      const data = { nom: i.nom, type: i.type, montant: i.montant, amortissementAnnees: i.amortissementAnnees,
        synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.investissements.add({ ...data, id: i.id, createdAt: new Date() });
      else await db.investissements.update(i.id, data);
    }

    // Fournisseurs
    const serverFournisseurs = await api.getFournisseurs();
    for (const f of serverFournisseurs) {
      const existing = await db.fournisseurs.get(f.id);
      const data = { nom: f.nom, telephone: f.telephone, notes: f.notes, produits: f.produits || [],
        synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.fournisseurs.add({ ...data, id: f.id, createdAt: new Date() });
      else await db.fournisseurs.update(f.id, data);
    }

    // Commandes Réappro
    const serverReappro = await api.getReapproCommandes();
    for (const r of serverReappro) {
      const existing = await db.reapproCommandes.get(r.id);
      const data = { fournisseurId: r.fournisseurId, fournisseurNom: r.fournisseurNom,
        fournisseurTel: r.fournisseurTel, items: r.items, totalAmount: r.totalAmount,
        statut: r.statut, receivedAt: r.receivedAt, synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.reapproCommandes.add({ ...data, id: r.id, createdAt: new Date() });
      else await db.reapproCommandes.update(r.id, data);
    }

    // Pertes
    const serverPertes = await api.getPertes();
    for (const p of serverPertes) {
      const existing = await db.pertes.get(p.id);
      const data = { productId: p.productId, productName: p.productName, productPrice: p.productPrice,
        quantity: p.quantity, reason: p.reason, stockAvant: p.stockAvant, stockReel: p.stockReel,
        valeurPerdue: p.valeurPerdue, date: p.date, note: p.note,
        synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.pertes.add({ ...data, id: p.id, createdAt: new Date() });
      else await db.pertes.update(p.id, data);
    }

    // Catégories
    const serverCategories = await api.getCategories();
    for (const c of serverCategories) {
      const existing = await db.categories.get(c.id);
      const data = { nom: c.nom, emoji: c.emoji || '📦', color: c.color || '#8B5CF6',
        synced: true, deleted: false, updatedAt: new Date() };
      if (!existing) await db.categories.add({ ...data, id: c.id, createdAt: new Date() });
      else await db.categories.update(c.id, data);
    }

    // Settings
    const serverSettings = await api.getSettings();
    for (const s of serverSettings) {
      await db.barSettings.put({ key: s.key, value: s.value, synced: true, updatedAt: new Date() });
    }

    console.log('✅ Sync descendante terminée');
  } catch (error) {
    console.error('❌ Sync descendante échouée:', error);
  }
}

// ══════════════════════════════════════════════════════════════
// API PUBLIQUE
// ══════════════════════════════════════════════════════════════
export const universalSync = {

  // ── PRODUITS ────────────────────────────────────────────────
  async getProduits() {
  const produits = await db.getActiveProduits();
  return produits.map(p => ({
    id: p.id, name: p.nom, price: p.prix, category: p.categorie, stock: p.stock,
    stockUnit: p.stockUnit, seuilAlerte: p.seuilAlerte, seuilCritique: p.seuilCritique,
    image: p.image, photo: (p as any).photo, color: p.color, popularite: p.popularite,
    activePriceFormats: p.activePriceFormats, prices: p.prices, options: p.options,
    stockCl: (p as any).stockCl, volumeConfig: (p as any).volumeConfig,
    synced: p.synced, deleted: p.deleted, createdAt: p.createdAt, updatedAt: p.updatedAt,
  })) as any[];
},
  async addProduit(data: any) {
    const p = await db.addProduit(data);
    if (isOnline) {
      await safeApiCall(() => api.createProduit({ id: p.id, nom: p.nom, prix: p.prix, categorie: p.categorie, stock: p.stock,
        stockUnit: p.stockUnit, seuilAlerte: p.seuilAlerte, seuilCritique: p.seuilCritique,
        image: p.image, photo: (p as any).photo, color: p.color, popularite: p.popularite,
        activePriceFormats: p.activePriceFormats, prices: p.prices, options: p.options,
        stockCl: (p as any).stockCl, volumeConfig: (p as any).volumeConfig }));
    }
    return p;
  },
  async updateProduit(id: string, data: any) {
    await db.updateProduit(id, data);
    if (isOnline) await safeApiCall(() => api.updateProduit(id, data));
  },
  async deleteProduit(id: string) {
    await db.deleteProduit(id);
    if (isOnline) await safeApiCall(() => api.deleteProduit(id));
  },

  // ── COMMANDES ───────────────────────────────────────────────
  async getCommandes() { return await db.getActiveCommandes(); },
  async addCommande(data: any) {
    const c = await db.addCommande(data);
    if (isOnline) await safeApiCall(() => api.createCommande({ id: c.id, numero: c.numero, date: c.date,
      total: c.total, statut: c.statut, items: c.items, tableNumber: c.tableNumber,
      server: c.server, paymentMethod: c.paymentMethod, comment: c.comment }));
    return c;
  },
  async updateCommande(id: string, data: any) {
    await db.updateCommande(id, data);
    if (isOnline) await safeApiCall(() => api.updateCommande(id, data));
  },
  async deleteCommande(id: string) {
    await db.deleteCommande(id);
    if (isOnline) await safeApiCall(() => api.deleteCommande(id));
  },

  // ── CHARGES ─────────────────────────────────────────────────
  async getCharges() { return await db.getActiveCharges(); },
  async addCharge(data: any) {
    const c = await db.addCharge(data);
    if (isOnline) await safeApiCall(() => api.createCharge({ id: c.id, nom: c.nom, categorie: c.categorie, montantMensuel: c.montantMensuel, periodicite: c.periodicite }));
    return c;
  },
  async updateCharge(id: string, data: any) {
    await db.updateCharge(id, data);
    if (isOnline) await safeApiCall(() => api.updateCharge(id, data));
  },
  async deleteCharge(id: string) {
    await db.deleteCharge(id);
    if (isOnline) await safeApiCall(() => api.deleteCharge(id));
  },

  // ── EMPLOYÉS ────────────────────────────────────────────────
  async getEmployes() { return await db.getActiveEmployes(); },
  async addEmploye(data: any) {
    const e = await db.addEmploye(data);
    if (isOnline) await safeApiCall(() => api.createEmploye({ id: e.id, nom: e.nom, poste: e.poste, salaireBrut: e.salaireBrut, prime: e.prime, avantages: e.avantages }));
    return e;
  },
  async updateEmploye(id: string, data: any) {
    await db.updateEmploye(id, data);
    if (isOnline) await safeApiCall(() => api.updateEmploye(id, data));
  },
  async deleteEmploye(id: string) {
    await db.deleteEmploye(id);
    if (isOnline) await safeApiCall(() => api.deleteEmploye(id));
  },

  // ── INVESTISSEMENTS ─────────────────────────────────────────
  async getInvestissements() { return await db.getActiveInvestissements(); },
  async addInvestissement(data: any) {
    const i = await db.addInvestissement(data);
    if (isOnline) await safeApiCall(() => api.createInvestissement({ id: i.id, nom: i.nom, type: i.type, montant: i.montant, amortissementAnnees: i.amortissementAnnees }));
    return i;
  },
  async updateInvestissement(id: string, data: any) {
    await db.updateInvestissement(id, data);
    if (isOnline) await safeApiCall(() => api.updateInvestissement(id, data));
  },
  async deleteInvestissement(id: string) {
    await db.deleteInvestissement(id);
    if (isOnline) await safeApiCall(() => api.deleteInvestissement(id));
  },

  // ── DAILY STATS ─────────────────────────────────────────────
  async getDailyStats() { return await db.dailyStats.toArray(); },
  async addDailyStat(date: string, ca: number, clients: number = 0) {
    await db.addDailyStat(date, ca, clients);
    if (isOnline) await safeApiCall(() => api.updateDailyStats(date, ca, clients));
  },

  // ── FOURNISSEURS ────────────────────────────────────────────
  async getFournisseurs() { return await db.getActiveFournisseurs(); },
  async addFournisseur(data: any) {
    const f = await db.addFournisseur(data);
    if (isOnline) await safeApiCall(() => api.createFournisseur({ id: f.id, nom: f.nom, telephone: f.telephone, notes: f.notes, produits: f.produits }));
    return f;
  },
  async updateFournisseur(id: string, data: any) {
    await db.updateFournisseur(id, data);
    if (isOnline) await safeApiCall(() => api.updateFournisseur(id, data));
  },
  async deleteFournisseur(id: string) {
    await db.deleteFournisseur(id);
    if (isOnline) await safeApiCall(() => api.deleteFournisseur(id));
  },

  // ── REAPPRO COMMANDES ───────────────────────────────────────
  async getReapproCommandes() { return await db.getActiveReapproCommandes(); },
  async addReapproCommande(data: any) {
    const r = await db.addReapproCommande(data);
    if (isOnline) await safeApiCall(() => api.createReapproCommande({ id: r.id, fournisseurId: r.fournisseurId,
      fournisseurNom: r.fournisseurNom, fournisseurTel: r.fournisseurTel, items: r.items,
      totalAmount: r.totalAmount, statut: r.statut, receivedAt: r.receivedAt }));
    return r;
  },
  async updateReapproCommande(id: string, data: any) {
    await db.updateReapproCommande(id, data);
    if (isOnline) await safeApiCall(() => api.updateReapproCommande(id, data));
  },
  async deleteReapproCommande(id: string) {
    await db.deleteReapproCommande(id);
    if (isOnline) await safeApiCall(() => api.deleteReapproCommande(id));
  },

  // ── PERTES ──────────────────────────────────────────────────
  async getPertes() { return await db.getActivePertes(); },
  async addPerte(data: any) {
    const p = await db.addPerte(data);
    if (isOnline) await safeApiCall(() => api.createPerte({ id: p.id, productId: p.productId, productName: p.productName,
      productPrice: p.productPrice, quantity: p.quantity, reason: p.reason, stockAvant: p.stockAvant,
      stockReel: p.stockReel, valeurPerdue: p.valeurPerdue, date: p.date, note: p.note }));
    return p;
  },
  async deletePerte(id: string) {
    await db.deletePerte(id);
    if (isOnline) await safeApiCall(() => api.deletePerte(id));
  },

  // ── CATÉGORIES ──────────────────────────────────────────────
  async getCategories() { return await db.getActiveCategories(); },
  async addCategorie(data: any) {
    const c = await db.addCategorie(data);
    if (isOnline) await safeApiCall(() => api.createCategorie({ id: c.id, nom: c.nom, emoji: c.emoji, color: c.color }));
    return c;
  },
  async updateCategorie(id: string, data: any) {
    await db.updateCategorie(id, data);
    if (isOnline) await safeApiCall(() => api.updateCategorie(id, data));
  },
  async deleteCategorie(id: string) {
    await db.deleteCategorie(id);
    if (isOnline) await safeApiCall(() => api.deleteCategorie(id));
  },

  // ── SETTINGS ────────────────────────────────────────────────
  async getSetting(key: string) { return await db.getSetting(key); },
  async setSetting(key: string, value: any) {
    await db.setSetting(key, value);
    if (isOnline) await safeApiCall(() => api.setSetting(key, value));
  },
  async deleteSetting(key: string) {
    await db.barSettings.delete(key);
    if (isOnline) await safeApiCall(() => api.deleteSetting(key));
  },

  // ── SYNC MANUELLES ──────────────────────────────────────────
  async syncNow() { await synchronizeAll(); },
  async syncFromServer() { await syncFromServer(); },
};

// Au démarrage : sync descendante puis montante
if (isOnline) {
  setTimeout(async () => {
    await syncFromServer();
    await synchronizeAll();
  }, 1500);
}