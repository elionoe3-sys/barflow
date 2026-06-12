// src/api.ts
const API_URL = 'http://localhost:3001/api';

// ============ CHARGES ============
export async function getCharges() {
  const response = await fetch(`${API_URL}/charges`);
  return response.json();
}

export async function createCharge(charge: any) {
  const response = await fetch(`${API_URL}/charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(charge)
  });
  return response.json();
}

export async function updateCharge(id: string, charge: any) {
  const response = await fetch(`${API_URL}/charges/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(charge)
  });
  return response.json();
}

export async function deleteCharge(id: string) {
  const response = await fetch(`${API_URL}/charges/${id}`, {
    method: 'DELETE'
  });
  return response.json();
}

// ============ EMPLOYÉS ============
export async function getEmployes() {
  const response = await fetch(`${API_URL}/employes`);
  return response.json();
}

export async function createEmploye(employe: any) {
  const response = await fetch(`${API_URL}/employes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employe)
  });
  return response.json();
}

export async function updateEmploye(id: string, employe: any) {
  const response = await fetch(`${API_URL}/employes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(employe)
  });
  return response.json();
}

export async function deleteEmploye(id: string) {
  const response = await fetch(`${API_URL}/employes/${id}`, {
    method: 'DELETE'
  });
  return response.json();
}