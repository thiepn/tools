import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {registerPdfPublicTools} from './registry/pdf-extension';
import {registerDeviceDiagnosticTools} from './registry/device-extension';
import {registerCalculatorTools} from './registry/calculator-extension';
import {registerFileConversionTools} from './registry/file-conversion-extension';
import {registerImageMicroTools} from './registry/image-micro-extension';
import {registerMediaMicroTools} from './registry/media-micro-extension';
import {registerTextStudyTools} from './registry/text-study-extension';
import {registerPrivacyDevTools} from './registry/privacy-dev-extension';
import {registerEverydayTools} from './registry/everyday-extension';
import './index.css';

registerPdfPublicTools();
registerDeviceDiagnosticTools();
registerCalculatorTools();
registerFileConversionTools();
registerImageMicroTools();
registerMediaMicroTools();
registerTextStudyTools();
registerPrivacyDevTools();
registerEverydayTools();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
