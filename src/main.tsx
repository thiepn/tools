import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  attemptModuleLoadRecovery,
  installVitePreloadErrorRecovery,
  hasModuleLoadRecoveryAttempt,
  isModuleLoadError,
  isModuleLoadRecoveryScheduled,
} from './utilities/module-load-recovery';

installVitePreloadErrorRecovery();

function renderBootstrapFailure(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;

  const message = error instanceof Error ? error.message : String(error ?? 'Unexpected startup error');
  const moduleFailure = isModuleLoadError(error);
  const recoveryAttempted = moduleFailure && hasModuleLoadRecoveryAttempt();

  root.innerHTML = `
    <main style="max-width:42rem;margin:4rem auto;padding:1.5rem;font-family:system-ui,sans-serif;color:#171717">
      <h1 style="font-size:1.25rem;margin:0 0 .75rem">Tiny Tools could not initialize</h1>
      <p style="line-height:1.55;color:#525252">
        ${moduleFailure
          ? recoveryAttempted
            ? 'The application files could not be loaded after one automatic refresh. Tiny Tools will not keep reloading in a loop.'
            : 'The application files could not be loaded and automatic recovery could not run safely.'
          : 'An unexpected startup error prevented Tiny Tools from loading.'}
      </p>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem">
        <button id="tiny-tools-bootstrap-reload" type="button" style="padding:.6rem .9rem;border:1px solid #d4d4d4;border-radius:.5rem;background:#171717;color:white;cursor:pointer">Reload Tiny Tools</button>
        <a href="./#/" style="padding:.6rem .9rem;border:1px solid #d4d4d4;border-radius:.5rem;color:#171717;text-decoration:none">Return to All Tools</a>
      </div>
      <details style="margin-top:1rem">
        <summary style="cursor:pointer;color:#525252">Technical details</summary>
        <pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:.75rem;background:#f5f5f5;border-radius:.5rem">${message.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char))}</pre>
      </details>
    </main>`;

  document.getElementById('tiny-tools-bootstrap-reload')?.addEventListener('click', () => {
    window.location.reload();
  });
}

async function bootstrap() {
  const { registerAllPublicTools } = await import('./registry/register-all');
  registerAllPublicTools();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap().catch((error) => {
  console.error('Tiny Tools failed to initialize.', error);

  if (attemptModuleLoadRecovery(error) || isModuleLoadRecoveryScheduled()) return;
  renderBootstrapFailure(error);
});
