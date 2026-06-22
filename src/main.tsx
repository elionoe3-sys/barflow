// ============================================
// src/main.tsx — Version propre BarFlow
// ============================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '@/i18n';
import App from './App';
import '@/index.css';  // ✅ Ça devrait fonctionner maintenant

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);