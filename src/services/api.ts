// src/services/api.ts
// CE FICHIER GÈRE TOUTES LES COMMUNICATIONS AVEC LE SERVEUR

const API_URL = 'http://localhost:3001/api';

// Vérifier si le serveur est accessible
export async function isServerOnline() {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ============ PRODUITS ============
export async function getProduits() {
  const res = await fetch(`${API_URL}/produits`);
  return res.json();
}

export async function createProduit(produit: any) {
  const res = await fetch(`${API_URL}/produits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(produit)
  });
  return res.json();
}

export async function updateProduit(id: string, produit: any) {
  const res = await fetch(`${API_URL}/produits/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(produit)
  });
  return res.json();
}

export async function deleteProduit(id: string) {
  const res = await fetch(`${API_URL}/produits/${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// ============ COMMANDES ============
export async function getCommandes() {
  const res = await fetch(`${API_URL}/commandes`);
  return res.json();
}

export async function createCommande(commande: any) {
  const res = await fetch(`${API_URL}/commandes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commande)
  });
  return res.json();
}

// ============ STATS QUOTIDIENNES ============
export async function getDailyStats() {
  const res = await fetch(`${API_URL}/dailyStats`);
  return res.json();
}

export async function updateDailyStats(date: string, ca: number) {
  const res = await fetch(`${API_URL}/dailyStats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, ca })
  });
  return res.json();
}

// ============ CHARGES ============
export async function getCharges() {
  const res = await fetch(`${API_URL}/charges`);
  return res.json();
}

export async function createCharge(charge: any) {
  const res = await fetch(`${API_URL}/charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(charge)
  });
  return res.json();
}

export async function updateCharge(id: string, charge: any) {
  const res = await fetch(`${API_URL}/charges/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(charge)
  });
  return res.json();
}

export async function deleteCharge(id: string) {
  const res = await fetch(`${API_URL}/charges/${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// ============ EMPLOYÉS ============
export async function getEmployes() {
  const res = await fetch(`${API_URL}/employes`);
  return res.json();
}

export async function createEmploye(employe: any) {
  const res = await fetch(`${API_URL}/employes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employe)
  });
  return res.json();
}

// ============ INVESTISSEMENTS ============
export async function getInvestissements() {
  const res = await fetch(`${API_URL}/investissements`);
  return res.json();
}

// ============ INVESTISSEMENTS (COMPLET) ============
export async function createInvestissement(invest: any) {
  const res = await fetch(`${API_URL}/investissements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invest)
  });
  return res.json();
}

export async function updateInvestissement(id: string, invest: any) {
  const res = await fetch(`${API_URL}/investissements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invest)
  });
  return res.json();
}

export async function deleteInvestissement(id: string) {
  const res = await fetch(`${API_URL}/investissements/${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// ============ EMPLOYÉS (COMPLET) ============
export async function updateEmploye(id: string, employe: any) {
  const res = await fetch(`${API_URL}/employes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employe)
  });
  return res.json();
}

export async function deleteEmploye(id: string) {
  const res = await fetch(`${API_URL}/employes/${id}`, {
    method: 'DELETE'
  });
  return res.json();
}

// ============ COMMANDES (COMPLET) ============
export async function updateCommande(id: string, commande: any) {
  const res = await fetch(`${API_URL}/commandes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commande)
  });
  return res.json();
}

export async function deleteCommande(id: string) {
  const res = await fetch(`${API_URL}/commandes/${id}`, {
    method: 'DELETE'
  });
  return res.json();
}