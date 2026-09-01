import{lazy}from'react';
import{PUBLIC_DEVICE_TASKS}from'../device/publicDeviceTasks';
import{ensureCategory,registerFamily}from'./register-family';
const DeviceDiagnosticsTool=lazy(()=>import('../tools/device-diagnostics/DeviceDiagnosticsTool'));
export function registerDeviceDiagnosticTools():void{ensureCategory('device','Device Diagnostics','Test microphones, cameras, displays, input devices, controllers, audio output, and browser-exposed hardware status','media');registerFamily(PUBLIC_DEVICE_TASKS,'device','Monitor',DeviceDiagnosticsTool)}
