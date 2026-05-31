import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Override global fetch to automatically inject the Render backend URL when in production
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  let finalInput = input;
  if (typeof input === 'string' && input.startsWith('/api')) {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const sanitizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    finalInput = `${sanitizedBase}${input}`;
  }
  return originalFetch(finalInput, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
