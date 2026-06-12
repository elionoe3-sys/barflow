import { useState, useEffect } from 'react';
import { getSetting } from '@/utils/db';

export interface BarInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
}

export function useBarInfo() {
  const [barInfo, setBarInfo] = useState<BarInfo>({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxNumber: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBarInfo = async () => {
      try {
        const saved = await getSetting('restaurant_info');
        if (saved && saved.value) {
          setBarInfo(saved.value as BarInfo);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des infos du bar:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadBarInfo();
  }, []);

  return { barInfo, isLoading };
}