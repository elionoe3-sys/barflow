import { useEffect, useState } from 'react';
import { db } from '@/db';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await db.syncQueue.count();
      setPendingSync(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg",
        isOnline ? "bg-green-500 text-white" : "bg-orange-500 text-white"
      )}>
        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
        <span className="text-sm">
          {isOnline ? "En ligne" : "Hors-ligne"}
        </span>
        {pendingSync > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <RefreshCw size={12} className="animate-spin" />
            <span className="text-xs">{pendingSync}</span>
          </div>
        )}
      </div>
    </div>
  );
}