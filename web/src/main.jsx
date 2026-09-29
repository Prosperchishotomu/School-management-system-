import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { syncOfflineWrites } from './utils/api'

// Authenticated users select their own theme in TopBar. Keep the initial shell
// predictable before the auth context has loaded.
document.documentElement.dataset.theme = 'light';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

window.addEventListener('online', () => syncOfflineWrites().catch(() => {}));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
