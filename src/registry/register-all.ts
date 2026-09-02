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
import{registerP12Tools}from'./p12-extension';
import{registerP13Tools}from'./p13-extension';
import{registerP14Tools}from'./p14-extension';
import{registerP15Tools}from'./p15-extension';
const REGISTRARS=[registerPdfPublicTools,registerDeviceDiagnosticTools,registerCalculatorTools,registerFileConversionTools,registerImageMicroTools,registerMediaMicroTools,registerTextStudyTools,registerPrivacyDevTools,registerEverydayTools,registerP11Tools,registerP12Tools,registerP13Tools,registerP14Tools,registerP15Tools];
export function registerAllPublicTools(){for(const register of REGISTRARS)register()}
