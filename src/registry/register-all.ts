import{registerPdfPublicTools}from'./pdf-extension';
import{registerDeviceDiagnosticTools}from'./device-extension';
import{registerCalculatorTools}from'./calculator-extension';
import{registerFileConversionTools}from'./file-conversion-extension';
import{registerImageMicroTools}from'./image-micro-extension';
import{registerMediaMicroTools}from'./media-micro-extension';
import{registerTextStudyTools}from'./text-study-extension';
import{registerPrivacyDevTools}from'./privacy-dev-extension';
import{registerEverydayTools}from'./everyday-extension';
import{registerP11Tools}from'./p11-extension';
const REGISTRARS=[registerPdfPublicTools,registerDeviceDiagnosticTools,registerCalculatorTools,registerFileConversionTools,registerImageMicroTools,registerMediaMicroTools,registerTextStudyTools,registerPrivacyDevTools,registerEverydayTools,registerP11Tools];
export function registerAllPublicTools(){for(const register of REGISTRARS)register()}
