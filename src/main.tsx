import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import App from'./App.tsx';
import{registerAllPublicTools}from'./registry/register-all';
import'./index.css';
registerAllPublicTools();
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
