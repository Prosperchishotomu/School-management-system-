import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { syncOfflineWrites } from './utils/api'

// Authenticated users select their own theme in TopBar. Synchronize from localStorage
// immediately so initial render has correct dark/light mode and high contrast.
try {
  const savedTheme = localStorage.getItem('schoolbase_theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch (_) {}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

window.addEventListener('online', () => syncOfflineWrites().catch(() => {}));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
