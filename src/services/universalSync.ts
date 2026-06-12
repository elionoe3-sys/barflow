// src/services/universalSync.ts
// CE FICHIER GÈRE TOUTES LES DONNÉES DE L'APPLICATION

import { db } from '@/db';
import * as api from './api';

// État de la connexion
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  synchronizeAll();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

// Synchronisation automatique
async function synchronizeAll() {
  if (!isOnline) return;
  
  const pending = await db.syncQueue.toArray();
  
  for (const item of pending) {
    try {
      switch (item.entity) {
        case 'produit':
          if (item.operation === 'CREATE') await api.createProduit(item.data);
          if (item.operation === 'UPDATE') await api.updateProduit(item.entityId, item.data);
          if (item.operation === 'DELETE') await api.deleteProduit(item.entityId);
          break;
        case 'commande':
          if (item.operation === 'CREATE') await api.createCommande(item.data);
          if (item.operation === 'UPDATE') await api.updateCommande(item.entityId, item.data);
          if (item.operation === 'DELETE') await api.deleteCommande(item.entityId);
          break;
        case 'charge':
          if (item.operation === 'CREATE') await api.createCharge(item.data);
          if (item.operation === 'UPDATE') await api.updateCharge(item.entityId, item.data);
          if (item.operation === 'DELETE') await api.deleteCharge(item.entityId);
          break;
        case 'employe':
          if (item.operation === 'CREATE') await api.createEmploye(item.data);
          if (item.operation === 'UPDATE') await api.updateEmploye(item.entityId, item.data);
          if (item.operation === 'DELETE') await api.deleteEmploye(item.entityId);
          break;
        case 'investissement':
          if (item.operation === 'CREATE') await api.createInvestissement(item.data);
          if (item.operation === 'UPDATE') await api.updateInvestissement(item.entityId, item.data);
          if (item.operation === 'DELETE') await api.deleteInvestissement(item.entityId);
          break;
        case 'dailyStat':
          if (item.operation === 'CREATE' || item.operation === 'UPDATE') {
            await api.updateDailyStats(item.data.date, item.data.ca);
          }
          break;
      }
      await db.syncQueue.delete(item.id!);
    } catch (error) {
      console.error('Sync failed for', item.entity, item.operation, error);
    }
  }
}

// Fonctions universelles pour TOUS les composants
export const universalSync = {
  // Produits
  async getProduits() {
    const produits = await db.getActiveProduits();
    return produits.map(p => ({
      id: p.id,
      name: p.nom,
      price: p.prix,
      category: p.categorie,
      stock: p.stock,
      stockUnit: p.stockUnit,
      seuilAlerte: p.seuilAlerte,
      seuilCritique: p.seuilCritique,
      image: p.image,
      color: p.color,
      popularite: p.popularite,
      activePriceFormats: p.activePriceFormats,
      prices: p.prices,
      options: p.options,
      synced: p.synced,
      deleted: p.deleted,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));
  },
  
  async addProduit(produit: any) {
    const newProduit = await db.addProduit(produit);
    if (isOnline) await api.createProduit(newProduit);
    return newProduit;
  },
  
  async updateProduit(id: string, produit: any) {
    await db.updateProduit(id, produit);
    if (isOnline) await api.updateProduit(id, produit);
  },
  
  async deleteProduit(id: string) {
    await db.deleteProduit(id);
    if (isOnline) await api.deleteProduit(id);
  },
  
  // Commandes
  async getCommandes() {
    return await db.getActiveCommandes();
  },
  
  async addCommande(commande: any) {
    const newCommande = await db.addCommande(commande);
    if (isOnline) await api.createCommande(newCommande);
    return newCommande;
  },
  
  async updateCommande(id: string, commande: any) {
    await db.updateCommande(id, commande);
    if (isOnline) await api.updateCommande(id, commande);
  },
  
  async deleteCommande(id: string) {
    await db.deleteCommande(id);
    if (isOnline) await api.deleteCommande(id);
  },
  
  // Charges
  async getCharges() {
    return await db.getActiveCharges();
  },
  
  async addCharge(charge: any) {
    const newCharge = await db.addCharge(charge);
    if (isOnline) await api.createCharge(newCharge);
    return newCharge;
  },
  
  async updateCharge(id: string, charge: any) {
    await db.updateCharge(id, charge);
    if (isOnline) await api.updateCharge(id, charge);
  },
  
  async deleteCharge(id: string) {
    await db.deleteCharge(id);
    if (isOnline) await api.deleteCharge(id);
  },
  
  // Employés
  async getEmployes() {
    return await db.getActiveEmployes();
  },
  
  async addEmploye(employe: any) {
    const newEmploye = await db.addEmploye(employe);
    if (isOnline) await api.createEmploye(newEmploye);
    return newEmploye;
  },
  
  async updateEmploye(id: string, employe: any) {
    await db.updateEmploye(id, employe);
    if (isOnline) await api.updateEmploye(id, employe);
  },
  
  async deleteEmploye(id: string) {
    await db.deleteEmploye(id);
    if (isOnline) await api.deleteEmploye(id);
  },
  
  // Investissements
  async getInvestissements() {
    return await db.getActiveInvestissements();
  },
  
  async addInvestissement(invest: any) {
    const newInvest = await db.addInvestissement(invest);
    if (isOnline) await api.createInvestissement(newInvest);
    return newInvest;
  },
  
  async updateInvestissement(id: string, invest: any) {
    await db.updateInvestissement(id, invest);
    if (isOnline) await api.updateInvestissement(id, invest);
  },
  
  async deleteInvestissement(id: string) {
    await db.deleteInvestissement(id);
    if (isOnline) await api.deleteInvestissement(id);
  },
  
  // Stats quotidiennes
  async getDailyStats() {
    return await db.dailyStats.toArray();
  },
  
  async addDailyStat(date: string, ca: number) {
    await db.addDailyStat(date, ca);
    if (isOnline) await api.updateDailyStats(date, ca);
  },
  
  // Synchronisation manuelle
  async syncNow() {
    await synchronizeAll();
  }
};