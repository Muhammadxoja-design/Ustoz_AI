import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram: any;
  }
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);

  useEffect(() => {
    const app = window.Telegram?.WebApp;
    
    if (app) {
      app.ready();
      // Enforce the app to expand to full screen to prevent half-screen drag UI issues
      app.expand();
      
      setWebApp(app);
      setUser(app.initDataUnsafe?.user || null);
      setColorScheme(app.colorScheme);

      // Listen for Telegram theme changes dynamically
      app.onEvent('themeChanged', () => {
        setColorScheme(app.colorScheme);
      });

      // Parse the gender passed from the backend during registration.
      // We check both URL search params (if passed securely via webAppUrl) 
      // and start_param (if launched via specific deep link)
      const urlParams = new URLSearchParams(window.location.search);
      const urlGender = urlParams.get('gender');
      const startParamGender = app.initDataUnsafe?.start_param;
      
      const parsedGender = (urlGender || startParamGender)?.toLowerCase();
      
      if (parsedGender === 'male' || parsedGender === 'female') {
        setGender(parsedGender as 'male' | 'female');
      }
    }
  }, []);

  const close = () => {
    webApp?.close();
  };

  return {
    webApp,
    user,
    colorScheme,
    gender,
    close,
    isTelegram: !!window.Telegram?.WebApp?.initData,
  };
}
