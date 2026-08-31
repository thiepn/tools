import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {registerPdfPublicTools} from './registry/pdf-extension';
import {registerDeviceDiagnosticTools} from './registry/device-extension';
import './index.css';

registerPdfPublicTools();
registerDeviceDiagnosticTools();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
