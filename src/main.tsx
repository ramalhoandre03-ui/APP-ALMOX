import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { DebugProvider } from './context/DebugContext';
import { PresenceProvider } from './context/PresenceContext';

// Safety polyfill for global React properties (e.g. Activity or extensions in vendor chunks)
if (typeof window !== 'undefined') {
  try {
    (window as any).React = (window as any).React || {};
    if (typeof (window as any).React.Activity === 'undefined') {
      (window as any).React.Activity = null;
    }
  } catch (e) {
    console.warn('Could not attach React global safety polyfill:', e);
  }
}

// Register Service Worker for PWA support
const isProd = !!(import.meta as any).env?.PROD;
if ('serviceWorker' in navigator && isProd) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('PWA Service Worker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Register in development as well for easier previewing/testing
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA Service Worker (Dev Mode) registered:', registration.scope);
      })
      .catch((error) => {
        console.warn('PWA Service Worker failed in Dev:', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <DebugProvider>
          <PresenceProvider>
            <App />
          </PresenceProvider>
        </DebugProvider>
      </AuthProvider>
    </StrictMode>,
  );
}
