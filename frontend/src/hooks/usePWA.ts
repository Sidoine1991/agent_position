import { useState, useEffect } from 'react';

export function usePWA() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Handle online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          setRegistration(reg);
          console.log('Service Worker registered successfully');
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });

      // Listen for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateServiceWorker = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const installPWA = async () => {
    if (registration && registration.waiting) {
      await registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return {
    isOnline,
    updateAvailable,
    updateServiceWorker,
    installPWA,
  };
}
