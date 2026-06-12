// utils/categories.ts
import { useState, useEffect } from 'react';

export interface Category {
  name: string;
  emoji: string;
  color: string;
}

// Catégories par défaut
let globalCategories: Category[] = [
  { name: 'bières', emoji: '🍺', color: '#F59E0B' },
  { name: 'cocktails', emoji: '🍹', color: '#EC4899' },
  { name: 'vins', emoji: '🍷', color: '#8B5CF6' },
  { name: 'softs', emoji: '🥤', color: '#06B6D4' },
  { name: 'spiritueux', emoji: '🥃', color: '#B45309' },
  { name: 'autres', emoji: '🍸', color: '#64748B' },
];

let listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(l => l());
}

// Sauvegarder dans localStorage
function saveToStorage() {
  localStorage.setItem('barflow_categories', JSON.stringify(globalCategories));
}

// Charger depuis localStorage
export function loadCategories() {
  try {
    const saved = localStorage.getItem('barflow_categories');
    if (saved) {
      globalCategories = JSON.parse(saved);
    }
  } catch (e) {}
  notifyListeners();
}

// Obtenir toutes les catégories
export function getCategories(): Category[] {
  return [...globalCategories];
}

// Ajouter une catégorie
export function addCategory(name: string, emoji: string = '📦', color: string = '#64748B') {
  const existing = globalCategories.find(c => c.name === name);
  if (!existing) {
    globalCategories.push({ name, emoji, color });
    saveToStorage();
    notifyListeners();
    return true;
  }
  return false;
}

// Modifier une catégorie
export function updateCategory(oldName: string, newName: string, emoji?: string, color?: string) {
  const index = globalCategories.findIndex(c => c.name === oldName);
  if (index !== -1) {
    globalCategories[index] = {
      name: newName,
      emoji: emoji || globalCategories[index].emoji,
      color: color || globalCategories[index].color,
    };
    saveToStorage();
    notifyListeners();
    return true;
  }
  return false;
}

// Supprimer une catégorie
export function deleteCategory(name: string) {
  globalCategories = globalCategories.filter(c => c.name !== name);
  saveToStorage();
  notifyListeners();
}

// Obtenir l'emoji d'une catégorie
export function getCategoryEmoji(categoryName: string): string {
  const cat = globalCategories.find(c => c.name === categoryName);
  return cat?.emoji || '📦';
}

// Obtenir la couleur d'une catégorie
export function getCategoryColor(categoryName: string): string {
  const cat = globalCategories.find(c => c.name === categoryName);
  return cat?.color || '#64748B';
}

// Hook React pour utiliser les catégories
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(globalCategories);

  useEffect(() => {
    loadCategories();
    setCategories([...globalCategories]);
    
    const listener = () => setCategories([...globalCategories]);
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  }, []);

  return { categories, refresh: () => setCategories([...globalCategories]) };
}