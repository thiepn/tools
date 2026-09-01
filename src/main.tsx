import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import App from'./App.tsx';
import'./index.css';
async function bootstrap(){const{registerAllPublicTools}=await import('./registry/register-all');registerAllPublicTools();createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)}
void bootstrap().catch(error=>{console.error('Tiny Tools failed to initialize.',error);const root=document.getElementById('root');if(root)root.textContent='Tiny Tools could not initialize. Reload the page to try again.'});
