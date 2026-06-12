import { useLiveQuery } from 'dexie-react-hooks';
import { db, Charge } from '@/db';
import { v4 as uuidv4 } from 'uuid';

export function useOfflineCharges() {
  // Lecture en temps réel - se met à jour automatiquement
  const charges = useLiveQuery(
    () => db.getActiveCharges(),
    []
  );

  const addCharge = async (charge: Omit<Charge, 'id' | 'synced' | 'deleted' | 'createdAt' | 'updatedAt'>) => {
    const newCharge: Charge = {
      ...charge,
      id: uuidv4(),
      synced: false,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.charges.add(newCharge);
    
    // Ajouter à la file de synchronisation
    await db.syncQueue.add({
      operation: 'CREATE',
      entity: 'charge',
      entityId: newCharge.id,
      data: newCharge,
      timestamp: new Date(),
      retryCount: 0
    });
    
    return newCharge;
  };

  const updateCharge = async (id: string, updates: Partial<Charge>) => {
    const charge = await db.charges.get(id);
    if (!charge) return;

    const updatedCharge = {
      ...charge,
      ...updates,
      synced: false,
      updatedAt: new Date()
    };
    
    await db.charges.update(id, updatedCharge);
    
    await db.syncQueue.add({
      operation: 'UPDATE',
      entity: 'charge',
      entityId: id,
      data: updatedCharge,
      timestamp: new Date(),
      retryCount: 0
    });
  };

  const deleteCharge = async (id: string) => {
    await db.charges.update(id, { 
      deleted: true, 
      synced: false,
      updatedAt: new Date()
    });
    
    await db.syncQueue.add({
      operation: 'DELETE',
      entity: 'charge',
      entityId: id,
      data: { id },
      timestamp: new Date(),
      retryCount: 0
    });
  };

  const getCharge = async (id: string) => {
    return await db.charges.get(id);
  };

  const getChargesByCategorie = async (categorie: string) => {
    return await db.charges.where('categorie').equals(categorie).and(c => !c.deleted).toArray();
  };

  return {
    charges: charges || [],
    addCharge,
    updateCharge,
    deleteCharge,
    getCharge,
    getChargesByCategorie,
    isLoading: charges === undefined
  };
}