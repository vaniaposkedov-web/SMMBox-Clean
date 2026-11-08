import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Сообщает о потере связи. Когда связь вернётся, сайт обновит данные сам.
export default function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(() => navigator.onLine === false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-[300] w-[calc(100vw-24px)] max-w-md flex items-center gap-2.5 bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-4 py-3 shadow-xl">
      <WifiOff size={16} className="shrink-0 text-gray-400" />
      <span>Нет связи с интернетом. Данные обновятся, когда связь появится.</span>
    </div>
  );
}
