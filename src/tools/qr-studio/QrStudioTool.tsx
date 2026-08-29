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
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (activeTab === 'create') {
      stopCamera();
    }
  }, [activeTab, stopCamera]);

  // Scan frame processing loop
  const scanVideoFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const parsed = parseScannedQr(code.data);
        setScanResult(parsed);
        stopCamera();
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  }, [stopCamera]);

  // Start Camera
  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setScanError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScanError('Camera access is not supported by your browser.');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
        animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      }

      // Enumerate available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videoInputs);
    } catch (err) {
      console.error('Camera access error:', err);
      setScanError(
        'Camera permission was denied or no camera device is available. You can upload an image file instead.'
      );
      setIsCameraActive(false);
    }
  };

  // Decode from static Image File
  const handleScanImageFile = (file: File) => {
    setScanError(null);
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const parsed = parseScannedQr(code.data);
          setScanResult(parsed);
        } else {
          setScanError('No QR code detected in the selected image. Try another clear image.');
        }
      }
      URL.revokeObjectURL(objectUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setScanError('Failed to load image file.');
    };

    img.src = objectUrl;
  };

  // Contrast check
  const contrastRatio = checkContrast(fgColor, bgColor);
  const isPoorContrast = contrastRatio < 3.0;

  // Download PNG
  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download SVG
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

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setCopiedQr(true);
        setTimeout(() => setCopiedQr(false), 2000);
      }
    } catch {
      // Fallback
      copyToClipboard(getComputedPayload());
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="qr-code-studio"
      title="QR Code Studio"
      description="Generate high-resolution custom QR codes and scan codes via camera or image files locally."
      category="everyday"
      relatedToolIds={['image-optimizer', 'encoding-tools', 'secure-generator']}
      outputToTransfer={activeTab === 'scan' && scanResult ? scanResult.raw : getComputedPayload()}
    >
      <div className="space-y-6">
        {/* Mode Selector Tabs (Create vs Scan) */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
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
            onClick={() => setActiveTab('scan')}
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

        {/* -------------------- CREATE MODE -------------------- */}
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Content Type & Fields */}
            <div className="lg:col-span-7 space-y-5">
              {/* Type Switcher Chips */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Select Content Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'text', label: 'Plain Text', icon: Type },
                    { id: 'url', label: 'Website URL', icon: Globe },
                    { id: 'wifi', label: 'Wi-Fi Network', icon: Wifi },
                    { id: 'email', label: 'Email', icon: Mail },
                    { id: 'phone', label: 'Phone Call', icon: Phone },
                    { id: 'sms', label: 'SMS Message', icon: MessageSquare },
                    { id: 'vcard', label: 'Contact vCard', icon: User },
                  ].map((t) => {
                    const IconC = t.icon;
                    const isSelected = dataType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDataType(t.id as QrDataType)}
                        className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 font-bold'
                            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <IconC className="w-3.5 h-3.5" />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Type Inputs Form */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                {dataType === 'text' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Plain Text Message
                    </label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Type or paste any text..."
                      rows={4}
                      className="w-full p-2.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {dataType === 'url' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={urlContent}
                      onChange={(e) => setUrlContent(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {dataType === 'wifi' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                          Network Name (SSID)
                        </label>
                        <input
                          type="text"
                          value={wifiConfig.ssid}
                          onChange={(e) => setWifiConfig({ ...wifiConfig, ssid: e.target.value })}
                          placeholder="My Home Network"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                          Password
                        </label>
                        <input
                          type="text"
                          value={wifiConfig.password}
                          onChange={(e) => setWifiConfig({ ...wifiConfig, password: e.target.value })}
                          placeholder="Network password"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                          Encryption / Security
                        </label>
                        <select
                          value={wifiConfig.security}
                          onChange={(e) =>
                            setWifiConfig({ ...wifiConfig, security: e.target.value as any })
                          }
                          className="w-full px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                        >
                          <option value="WPA">WPA / WPA2 / WPA3</option>
                          <option value="WEP">WEP</option>
                          <option value="nopass">None (Open)</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer pt-3 sm:pt-4">
                        <input
                          type="checkbox"
                          checked={wifiConfig.hidden}
                          onChange={(e) => setWifiConfig({ ...wifiConfig, hidden: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>Hidden Network SSID</span>
                      </label>
                    </div>
                  </div>
                )}

                {dataType === 'email' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={emailConfig.recipient}
                        onChange={(e) => setEmailConfig({ ...emailConfig, recipient: e.target.value })}
                        placeholder="contact@company.com"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                        Subject (optional)
                      </label>
                      <input
                        type="text"
                        value={emailConfig.subject}
                        onChange={(e) => setEmailConfig({ ...emailConfig, subject: e.target.value })}
                        placeholder="Inquiry"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                        Message Body (optional)
                      </label>
                      <textarea
                        value={emailConfig.body}
                        onChange={(e) => setEmailConfig({ ...emailConfig, body: e.target.value })}
                        rows={2}
                        placeholder="Pre-filled email message..."
                        className="w-full p-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                  </div>
                )}

                {dataType === 'phone' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneContent}
                      onChange={(e) => setPhoneContent(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {dataType === 'sms' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={smsConfig.phoneNumber}
                        onChange={(e) => setSmsConfig({ ...smsConfig, phoneNumber: e.target.value })}
                        placeholder="+1 555 123 4567"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 block mb-1">
                        SMS Text Message
                      </label>
                      <textarea
                        value={smsConfig.message}
                        onChange={(e) => setSmsConfig({ ...smsConfig, message: e.target.value })}
                        rows={2}
                        placeholder="SMS message content..."
                        className="w-full p-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                  </div>
                )}

                {dataType === 'vcard' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">First Name</label>
                        <input
                          type="text"
                          value={vcardConfig.firstName}
                          onChange={(e) => setVcardConfig({ ...vcardConfig, firstName: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">Last Name</label>
                        <input
                          type="text"
                          value={vcardConfig.lastName}
                          onChange={(e) => setVcardConfig({ ...vcardConfig, lastName: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">Phone</label>
                        <input
                          type="tel"
                          value={vcardConfig.phone}
                          onChange={(e) => setVcardConfig({ ...vcardConfig, phone: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-neutral-500 block mb-1">Email</label>
                        <input
                          type="email"
                          value={vcardConfig.email}
                          onChange={(e) => setVcardConfig({ ...vcardConfig, email: e.target.value })}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-500 block mb-1">Company / Organization</label>
                      <input
                        type="text"
                        value={vcardConfig.organization}
                        onChange={(e) => setVcardConfig({ ...vcardConfig, organization: e.target.value })}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* QR Code Appearance & Options */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  QR Appearance & Colors
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Foreground
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{fgColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Background
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-7 h-7 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{bgColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Error Correction
                    </label>
                    <select
                      value={ecLevel}
                      onChange={(e) => setEcLevel(e.target.value as QrErrorCorrectionLevel)}
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                    >
                      <option value="L">L (7% recovery)</option>
                      <option value="M">M (15% standard)</option>
                      <option value="Q">Q (25% high)</option>
                      <option value="H">H (30% best)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Quiet Margin
                    </label>
                    <select
                      value={margin}
                      onChange={(e) => setMargin(Number(e.target.value))}
                      className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                    >
                      <option value={0}>0 (No border)</option>
                      <option value={1}>1 module</option>
                      <option value={2}>2 modules</option>
                      <option value={4}>4 (Standard)</option>
                    </select>
                  </div>
                </div>

                {isPoorContrast && (
                  <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Low contrast warning (Ratio {contrastRatio.toFixed(1)}:1). Darker foreground on lighter background scans much more reliably on phone cameras.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: QR Preview & Export Actions */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-col items-center justify-center space-y-4">
                <div className="p-3 bg-white rounded-xl shadow-xs border border-neutral-200 dark:border-neutral-800">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Generated QR Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded"
                    />
                  ) : (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center text-neutral-400 text-xs italic">
                      Enter content to preview QR code
                    </div>
                  )}
                </div>

                {/* Export Buttons */}
                <div className="w-full space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPng}
                      disabled={!qrDataUrl}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 shadow-xs disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSvg}
                      disabled={!qrSvgString}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download SVG</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyImage}
                    disabled={!qrDataUrl}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    {copiedQr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedQr ? 'Copied to Clipboard!' : 'Copy QR Image'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- SCAN MODE -------------------- */}
        {activeTab === 'scan' && (
          <div className="space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleScanImageFile(e.target.files[0]);
                }
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Camera / Upload Scanner Viewport */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      Camera Scanner
                    </h4>
                    {cameraDevices.length > 1 && isCameraActive && (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          startCamera(e.target.value);
                        }}
                        className="px-2 py-1 text-[11px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      >
                        {cameraDevices.map((d, i) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Video Viewport */}
                  <div className="w-full h-64 sm:h-80 bg-neutral-900 rounded-lg overflow-hidden relative flex items-center justify-center border border-neutral-800">
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                    />

                    {isCameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-blue-500/80 rounded-lg border-dashed animate-pulse" />
                      </div>
                    )}

                    {!isCameraActive && (
                      <div className="text-center p-6 space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                          <Camera className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-neutral-400 max-w-xs">
                          Camera is inactive. Click below to start scanning or upload an image from your device.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Scanner Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {!isCameraActive ? (
                      <button
                        type="button"
                        onClick={() => startCamera(selectedDeviceId)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Start Camera Scan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Stop Camera</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload QR Image</span>
                    </button>
                  </div>
                </div>

                {scanError && (
                  <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    {scanError}
                  </div>
                )}
              </div>

              {/* Right Column: Detected Content & Safe Handlers */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      Scan Result
                    </h4>
                    {scanResult && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {scanResult.type}
                      </span>
                    )}
                  </div>

                  {!scanResult ? (
                    <div className="p-8 text-center text-xs text-neutral-400 italic bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
                      Point your camera at a QR code or upload an image to view parsed content.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Parsed Payload Card */}
                      <div className="p-3 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 space-y-2">
                        {/* URL Type Result */}
                        {scanResult.type === 'url' && scanResult.parsedData?.url && (
                          <div className="space-y-2">
                            <div className="text-xs font-mono break-all text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 p-2 rounded">
                              {scanResult.parsedData.url}
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={scanResult.parsedData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-xs"
                              >
                                <span>Open Link</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Wi-Fi Type Result */}
                        {scanResult.type === 'wifi' && scanResult.parsedData?.wifi && (
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-2 gap-2 text-neutral-700 dark:text-neutral-300">
                              <div>
                                <span className="text-[10px] text-neutral-400 block">Network (SSID)</span>
                                <strong className="font-mono">{scanResult.parsedData.wifi.ssid}</strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-neutral-400 block">Security</span>
                                <strong>{scanResult.parsedData.wifi.security}</strong>
                              </div>
                              {scanResult.parsedData.wifi.password && (
                                <div className="col-span-2">
                                  <span className="text-[10px] text-neutral-400 block">Password</span>
                                  <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded inline-block">
                                    {scanResult.parsedData.wifi.password}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Contact vCard Result */}
                        {scanResult.type === 'vcard' && scanResult.parsedData?.vcard && (
                          <div className="space-y-1.5 text-xs">
                            <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                              {scanResult.parsedData.vcard.name}
                            </div>
                            {scanResult.parsedData.vcard.phone && (
                              <div className="text-neutral-600 dark:text-neutral-400">
                                📞 {scanResult.parsedData.vcard.phone}
                              </div>
                            )}
                            {scanResult.parsedData.vcard.email && (
                              <div className="text-neutral-600 dark:text-neutral-400">
                                ✉️ {scanResult.parsedData.vcard.email}
                              </div>
                            )}
                            {scanResult.parsedData.vcard.org && (
                              <div className="text-neutral-500 text-[11px]">
                                🏢 {scanResult.parsedData.vcard.org}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Raw text fallback */}
                        {scanResult.type === 'text' && (
                          <pre className="font-mono text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-all">
                            {scanResult.raw}
                          </pre>
                        )}
                      </div>

                      {/* Raw Payload & Copy Action */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-neutral-500">Raw QR Payload</label>
                        <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-[11px] break-all text-neutral-700 dark:text-neutral-300">
                          {scanResult.raw}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(scanResult.raw);
                            setCopiedScanned(true);
                            setTimeout(() => setCopiedScanned(false), 2000);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 shadow-xs"
                        >
                          {copiedScanned ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedScanned ? 'Copied Raw Content!' : 'Copy Decoded Text'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default QrStudioTool;
