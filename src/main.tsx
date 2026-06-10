
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ── Dynamsoft Web TWAIN — global config (must run before any DWT usage) ──
import Dynamsoft from 'dwt';
Dynamsoft.DWT.ResourcesPath = '/dwt-resources';
Dynamsoft.DWT.ProductKey = import.meta.env.VITE_DYNAMSOFT_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove dark mode class addition
createRoot(document.getElementById("root")!).render(<App />);
