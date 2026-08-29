import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Scan,
  Download,
  Copy,
  Check,
  Globe,
  Wifi,
  Mail,
  Phone,
  MessageSquare,
  User,
  Type,
  Camera,
  CameraOff,
  Upload,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import jsQR from 'jsqr';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  QrDataType,
  QrErrorCorrectionLevel,
  WifiQrConfig,
  EmailQrConfig,
  SmsQrConfig,
  VCardQrConfig,
  formatWifiPayload,
  formatEmailPayload,
  formatPhonePayload,
  formatSmsPayload,
  formatVCardPayload,
  generateQrDataUrl,
  generateQrSvgString,
  checkContrast,
  parseScannedQr,
  ParsedQrResult,
} from '../../utilities/qr-studio';

interface QrStudioToolProps {
  initialText?: string;
}

export const QrStudioTool: React.FC<QrStudioToolProps> = ({ initialText }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'scan'>('create');

  // CREATE STATE
  const [dataType, setDataType] = useState<QrDataType>('text');
  const [textContent, setTextContent] = useState<string>(initialText || 'https://example.com');
  const [urlContent, setUrlContent] = useState<string>('https://example.com');
  const [wifiConfig, setWifiConfig] = useState<WifiQrConfig>({
    ssid: 'MyHomeWiFi',
    password: '',
    security: 'WPA',
    hidden: false,
  });
  const [emailConfig, setEmailConfig] = useState<EmailQrConfig>({
    recipient: 'hello@example.com',
    subject: '',
    body: '',
  });
  const [phoneContent, setPhoneContent] = useState<string>('+1 555 123 4567');
  const [smsConfig, setSmsConfig] = useState<SmsQrConfig>({
    phoneNumber: '+1 555 123 4567',
    message: 'Hello from QR Code',
  });
  const [vcardConfig, setVcardConfig] = useState<VCardQrConfig>({
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+1 555 019 2831',
    email: 'jane.doe@example.com',
    organization: 'Acme Inc.',
    website: 'https://example.com',
  });

  // QR Customization
  const [fgColor, setFgColor] = useState<string>('#000000');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  const [ecLevel, setEcLevel] = useState<QrErrorCorrectionLevel>('M');
  const [margin, setMargin] = useState<number>(2);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvgString, setQrSvgString] = useState<string>('');
  const [copiedQr, setCopiedQr] = useState<boolean>(false);

  // SCAN STATE
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [scanResult, setScanResult] = useState<ParsedQrResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [copiedScanned, setCopiedScanned] = useState<boolean>(false);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute final payload string
  const getComputedPayload = useCallback((): string => {
    switch (dataType) {
      case 'text':
        return textContent;
      case 'url':
        return urlContent;
      case 'wifi':
        return formatWifiPayload(wifiConfig);
      case 'email':
        return formatEmailPayload(emailConfig);
      case 'phone':
        return formatPhonePayload(phoneContent);
      case 'sms':
        return formatSmsPayload(smsConfig);
      case 'vcard':
        return formatVCardPayload(vcardConfig);
      default:
        return textContent;
    }
  }, [dataType, textContent, urlContent, wifiConfig, emailConfig, phoneContent, smsConfig, vcardConfig]);

  // Generate QR Code when payload or options change
  useEffect(() => {
    const payload = getComputedPayload();
    if (!payload.trim()) {
      setQrDataUrl('');
      setQrSvgString('');
      return;
    }

    let isMounted = true;
    const generate = async () => {
      try {
        const [dataUrl, svgStr] = await Promise.all([
          generateQrDataUrl(payload, {
            width: 400,
            margin,
            errorCorrectionLevel: ecLevel,
            color: { dark: fgColor, light: bgColor },
          }),
          generateQrSvgString(payload, {
            width: 400,
            margin,
            errorCorrectionLevel: ecLevel,
            color: { dark: fgColor, light: bgColor },
          }),
        ]);
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setQrSvgString(svgStr);
        }
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };

    generate();
    return () => {
      isMounted = false;
    };
  }, [getComputedPayload, fgColor, bgColor, ecLevel, margin]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Cleanup on unmount or tab switch
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const scanCanvasFrame = useCallback(() => {
    if (!videoRef.current || !isCameraActive) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code) {
          setScanResult(parseScannedQr(code.data));
          setScanError(null);
          stopCamera();
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanCanvasFrame);
  }, [isCameraActive, stopCamera]);

  useEffect(() => {
    if (isCameraActive) animationFrameRef.current = requestAnimationFrame(scanCanvasFrame);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isCameraActive, scanCanvasFrame]);

  const startCamera = async () => {
    setScanError(null);
    setScanResult(null);
    try {
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: 'environment' } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === 'videoinput');
        setCameraDevices(cameras);
        if (!selectedDeviceId && cameras[0]?.deviceId) setSelectedDeviceId(cameras[0].deviceId);
      } catch {
        // Camera switching remains optional when enumerateDevices is unavailable.
      }
    } catch (err) {
      setScanError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or upload an image instead.'
          : 'Could not start the camera. Check browser permissions and camera availability.'
      );
      stopCamera();
    }
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (!isCameraActive) return;
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      setScanError('Could not switch to the selected camera.');
    }
  };

  const handleImageFile = (file: File) => {
    setScanError(null);
    setScanResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
        if (code) setScanResult(parseScannedQr(code.data));
        else setScanError('No QR code detected in this image. Try a clearer or higher-contrast image.');
      };
      img.onerror = () => setScanError('Could not decode the selected image.');
      img.src = reader.result as string;
    };
    reader.onerror = () => setScanError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImageFile(file);
    event.target.value = '';
  };

  const handleTabChange = (tab: 'create' | 'scan') => {
    if (tab !== 'scan') stopCamera();
    setActiveTab(tab);
  };

  const handleCopyScanned = async () => {
    if (!scanResult) return;
    const success = await copyToClipboard(scanResult.raw);
    if (success) {
      setCopiedScanned(true);
      setTimeout(() => setCopiedScanned(false), 2000);
    }
  };

  const contrastRatio = checkContrast(fgColor, bgColor);
  const isPoorContrast = contrastRatio < 3.0;

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = () => {
    if (!qrSvgString) return;
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qrcode-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedQr(true);
        setTimeout(() => setCopiedQr(false), 2000);
      }
    } catch {
      copyToClipboard(getComputedPayload());
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="qr-studio"
      title="QR Code Studio"
      description="Generate high-resolution custom QR codes and scan codes via camera or image files locally."
      category="everyday"
      relatedToolIds={['image-optimizer', 'encoding-tools', 'secure-generator']}
      outputToTransfer={activeTab === 'scan' && scanResult ? scanResult.raw : getComputedPayload()}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <button
            type="button"
            onClick={() => handleTabChange('create')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Create QR Code</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('scan')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'scan'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  QR Data Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    ['text', Type, 'Text'],
                    ['url', Globe, 'URL'],
                    ['wifi', Wifi, 'Wi-Fi'],
                    ['email', Mail, 'Email'],
                    ['phone', Phone, 'Phone'],
                    ['sms', MessageSquare, 'SMS'],
                    ['vcard', User, 'vCard'],
                  ] as const).map(([type, Icon, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDataType(type)}
                      className={`p-2 rounded-md border flex items-center justify-center gap-1.5 text-xs ${
                        dataType === type
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                          : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {dataType === 'text' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Text content
                  </label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {dataType === 'url' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={urlContent}
                    onChange={(e) => setUrlContent(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {dataType === 'wifi' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={wifiConfig.ssid}
                    onChange={(e) => setWifiConfig({ ...wifiConfig, ssid: e.target.value })}
                    placeholder="Wi-Fi network name"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={wifiConfig.password}
                    onChange={(e) => setWifiConfig({ ...wifiConfig, password: e.target.value })}
                    placeholder="Password"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <select
                    value={wifiConfig.security}
                    onChange={(e) => setWifiConfig({ ...wifiConfig, security: e.target.value as WifiQrConfig['security'] })}
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">No password</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <input
                      type="checkbox"
                      checked={wifiConfig.hidden}
                      onChange={(e) => setWifiConfig({ ...wifiConfig, hidden: e.target.checked })}
                    />
                    Hidden network
                  </label>
                </div>
              )}

              {dataType === 'email' && (
                <div className="space-y-2">
                  <input
                    value={emailConfig.recipient}
                    onChange={(e) => setEmailConfig({ ...emailConfig, recipient: e.target.value })}
                    placeholder="Recipient email"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={emailConfig.subject}
                    onChange={(e) => setEmailConfig({ ...emailConfig, subject: e.target.value })}
                    placeholder="Subject"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <textarea
                    value={emailConfig.body}
                    onChange={(e) => setEmailConfig({ ...emailConfig, body: e.target.value })}
                    placeholder="Message body"
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                </div>
              )}

              {dataType === 'phone' && (
                <input
                  value={phoneContent}
                  onChange={(e) => setPhoneContent(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                />
              )}

              {dataType === 'sms' && (
                <div className="space-y-2">
                  <input
                    value={smsConfig.phoneNumber}
                    onChange={(e) => setSmsConfig({ ...smsConfig, phoneNumber: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <textarea
                    value={smsConfig.message}
                    onChange={(e) => setSmsConfig({ ...smsConfig, message: e.target.value })}
                    placeholder="Message"
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                </div>
              )}

              {dataType === 'vcard' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={vcardConfig.firstName}
                    onChange={(e) => setVcardConfig({ ...vcardConfig, firstName: e.target.value })}
                    placeholder="First name"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={vcardConfig.lastName}
                    onChange={(e) => setVcardConfig({ ...vcardConfig, lastName: e.target.value })}
                    placeholder="Last name"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={vcardConfig.phone}
                    onChange={(e) => setVcardConfig({ ...vcardConfig, phone: e.target.value })}
                    placeholder="Phone"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={vcardConfig.email}
                    onChange={(e) => setVcardConfig({ ...vcardConfig, email: e.target.value })}
                    placeholder="Email"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={vcardConfig.organization}
                    onChange={(e) => setVcardConfig({ ...vcardConfig, organization: e.target.value })}
                    placeholder="Organization"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                  <input
                    value={vcardConfig.website}
                    onChange={(e) => setVcardConfig({ ...vcardConfig, website: e.target.value })}
                    placeholder="Website"
                    className="px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                  />
                </div>
              )}

              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  Style
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-neutral-600 dark:text-neutral-400">
                    Foreground
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="mt-1 block w-full h-9 rounded border border-neutral-300 dark:border-neutral-700"
                    />
                  </label>
                  <label className="text-xs text-neutral-600 dark:text-neutral-400">
                    Background
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="mt-1 block w-full h-9 rounded border border-neutral-300 dark:border-neutral-700"
                    />
                  </label>
                </div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block">
                  Error correction
                  <select
                    value={ecLevel}
                    onChange={(e) => setEcLevel(e.target.value as QrErrorCorrectionLevel)}
                    className="mt-1 w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                  >
                    <option value="L">L — 7%</option>
                    <option value="M">M — 15%</option>
                    <option value="Q">Q — 25%</option>
                    <option value="H">H — 30%</option>
                  </select>
                </label>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block">
                  Quiet-zone margin: {margin}
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full mt-1"
                  />
                </label>
                {isPoorContrast && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Low contrast ({contrastRatio.toFixed(2)}:1) can make QR codes difficult to scan.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="min-h-[320px] bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center p-5">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Generated QR code preview"
                    className="max-w-full w-[320px] rounded-lg bg-white shadow-sm"
                  />
                ) : (
                  <span className="text-xs text-neutral-400">Enter content to generate a QR code.</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={!qrDataUrl}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  PNG
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  disabled={!qrSvgString}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  SVG
                </button>
                <button
                  type="button"
                  onClick={handleCopyImage}
                  disabled={!qrDataUrl}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 disabled:opacity-40"
                >
                  {copiedQr ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedQr ? 'Copied' : 'Copy image'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold">Camera</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  Camera permission is requested only after you choose Start camera.
                </p>

                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold"
                  >
                    <Camera className="w-4 h-4" /> Start camera
                  </button>
                ) : (
                  <div className="space-y-3">
                    <video
                      ref={videoRef}
                      className="w-full max-h-80 rounded-lg bg-black"
                      playsInline
                      muted
                      aria-label="Live camera preview for QR scanning"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-600 text-white text-xs font-semibold"
                      >
                        <CameraOff className="w-4 h-4" /> Stop camera
                      </button>
                      {cameraDevices.length > 1 && (
                        <select
                          value={selectedDeviceId}
                          onChange={(e) => handleDeviceChange(e.target.value)}
                          className="px-2.5 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md"
                          aria-label="Choose camera"
                        >
                          {cameraDevices.map((device, index) => (
                            <option key={device.deviceId || index} value={device.deviceId}>
                              {device.label || `Camera ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold">Image file</h3>
                </div>
                <p className="text-xs text-neutral-500">
                  Choose an image containing a QR code. Processing stays in your browser.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white dark:text-neutral-300 dark:file:bg-neutral-100 dark:file:text-neutral-900"
                />
              </div>
            </div>

            {scanError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {scanResult && (
              <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      QR code detected
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Type: {scanResult.type}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyScanned}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-medium"
                  >
                    {copiedScanned ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScanned ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-words p-3 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200">
                  {scanResult.raw}
                </pre>
                {scanResult.type === 'url' && /^https?:\/\//i.test(scanResult.raw) && (
                  <a
                    href={scanResult.raw}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open URL
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 border-t border-neutral-200 dark:border-neutral-800 pt-3">
              <div className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Scan results are shown as text first; URLs never open automatically.
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  setScanError(null);
                }}
                className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Clear result
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default QrStudioTool;
