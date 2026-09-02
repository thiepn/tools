import{lazy}from'react';
import{PUBLIC_P19_TASKS}from'../expansion/publicP19Tasks';
import{registerFamily}from'./register-family';
const NetworkBrowserDiagnosticsTools=lazy(()=>import('../tools/p19/NetworkBrowserDiagnosticsTools'));
export function registerP19Tools():void{registerFamily(PUBLIC_P19_TASKS,'device','Wifi',NetworkBrowserDiagnosticsTools,t=>({keywords:[...t.keywords,'p19','network diagnostic','browser diagnostic',t.mode,t.networkUse],featured:Boolean(t.featured)}))}
