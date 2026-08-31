import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode as BarcodeIcon,
  Camera,
  Upload,
  Copy,
  Check,
  Download,
  AlertCircle,
  ExternalLink,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import {
  BARCODE_FORMATS,
  BarcodeFormat,
  validateBarcodePayload,
} from '../../utilities/barcode';
import { copyToClipboard } from '../../utilities/clipboard';

const DETECTOR_FORMATS = [
  'code_128',
  'code_39',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
  'codabar',
  'qr_code',
];
const CAMERA_SCAN_INTERVAL_MS = 120;

export const BarcodeStudioTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'scan'>('generate');
  const [format, setFormat] = useState<BarcodeFormat>('CODE128');
  const [value, setValue] = useState('TINY-TOOLS-2026');
  const [height, setHeight] = useState(80);
  const [widthScale, setWidthScale] = useState(2);
  const [displayValue, setDisplayValue] = useState(true);
  const [margin, setMargin] = useState(10);
  const [lineColor, setLineColor] = useState('#0f172a');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [copied, setCopied] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [scanResult, setScanResult] = useState<{ text: string; format?: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'idle' | 'prompting' | 'granted' | 'denied'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const detectionInFlightRef = useRef(false);
  const lastDetectionAtRef = useRef(0);

  const barcodeDetectorSupported =
    typeof window !== 'undefined' && typeof (window as any).BarcodeDetector === 'function';
  const validation = validateBarcodePayload(format, value);

  const getDetector = useCallback(() => {
    if (typeof (window as any).BarcodeDetector !== 'function') return null;
    if (!detectorRef.current) {
      detectorRef.current = new (window as any).BarcodeDetector({ formats: DETECTOR_FORMATS });
    }
    return detectorRef.current;
  }, []);

  useEffect(() => {
    if (activeTab !== 'generate' || !validation.isValid || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, validation.normalizedValue, {
        format: format === 'codabar' ? 'codabar' : format,
        width: widthScale,
        height,
        displayValue,
        margin,
        lineColor,
        background: bgColor,
        font: 'monospace',
        fontSize: 16,
        textMargin: 4,
        valid: () => {},
      });
    } catch {
      // Validation owns user-facing payload errors.
    }
  }, [format, validation.isValid, validation.normalizedValue, height, widthScale, displayValue, margin, lineColor, bgColor, activeTab]);

  const stopCameraStream = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    detectionInFlightRef.current = false;
    lastDetectionAtRef.current = 0;
    setIsScanningCamera(false);
  }, []);

  useEffect(() => () => stopCameraStream(), [stopCameraStream]);

  const handleTabChange = (tab: 'generate' | 'scan') => {
    if (tab !== 'scan') stopCameraStream();
    setActiveTab(tab);
    setScanError(null);
  };

  const handleDownloadPng = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const anchor = document.createElement('a');
        anchor.download = `barcode-${format.toLowerCase()}-${Date.now()}.png`;
        anchor.href = canvas.toDataURL('image/png');
        anchor.click();
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `barcode-${format.toLowerCase()}-${Date.now()}.svg`;
    anchor.href = url;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyImage = async () => {
    if (!svgRef.current) return;
    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        if (ctx) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (blob) => {
            try {
              if (blob && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }
            } catch {
              // Clipboard image writing is optional; downloads remain available.
            }
          }, 'image/png');
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    } catch {
      // Image clipboard writing is optional; downloads remain available.
    }
  };

  const scanVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !mediaStreamRef.current) return;
    const detector = getDetector();
    if (!detector) {
      setScanError('Barcode scanning is not supported in this browser. Barcode generation is still available.');
      stopCameraStream();
      return;
    }

    const now = performance.now();
    if (detectionInFlightRef.current || now - lastDetectionAtRef.current < CAMERA_SCAN_INTERVAL_MS) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (video.readyState !== video.HAVE_ENOUGH_DATA || !ctx || video.videoWidth <= 0 || video.videoHeight <= 0) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    detectionInFlightRef.current = true;
    lastDetectionAtRef.current = now;
    let keepScanning = true;

    Promise.resolve(detector.detect(canvas))
      .then((barcodes: any[]) => {
        if (barcodes?.length) {
          const first = barcodes[0];
          keepScanning = false;
          setScanResult({ text: first.rawValue, format: first.format });
          stopCameraStream();
        }
      })
      .catch(() => {
        // Transient detector failures should not tear down the camera session.
      })
      .finally(() => {
        detectionInFlightRef.current = false;
        if (keepScanning && mediaStreamRef.current) {
          animFrameRef.current = requestAnimationFrame(scanVideoFrame);
        }
      });
  }, [getDetector, stopCameraStream]);

  const startCamera = async () => {
    setScanError(null);
    setScanResult(null);

    if (!barcodeDetectorSupported) {
      setScanError('Barcode scanning is not supported in this browser. Barcode generation is still available.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera access is not supported by your browser. You can still generate barcodes.');
      return;
    }

    setCameraPermission('prompting');
    try {
      getDetector();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      setCameraPermission('granted');
      setIsScanningCamera(true);
    } catch (err: any) {
      setCameraPermission('denied');
      setIsScanningCamera(false);
      setScanError(err?.message || 'Camera access denied or not available.');
    }
  };

  useEffect(() => {
    if (!isScanningCamera || !videoRef.current || !mediaStreamRef.current) return;

    let cancelled = false;
    const video = videoRef.current;
    video.srcObject = mediaStreamRef.current;
    video.setAttribute('playsinline', 'true');

    const startLoop = async () => {
      try {
        await video.play();
        if (!cancelled && mediaStreamRef.current) scanVideoFrame();
      } catch {
        if (!cancelled) {
          setScanError('Unable to start the camera preview in this browser.');
          stopCameraStream();
        }
      }
    };

    void startLoop();
    return () => {
      cancelled = true;
    };
  }, [isScanningCamera, scanVideoFrame, stopCameraStream]);

  const handleScanImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setScanResult(null);

    const detector = getDetector();
    if (!detector) {
      setScanError('Barcode scanning is not supported in this browser. Barcode generation is still available.');
      event.target.value = '';
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const codes = await detector.detect(canvas);
          if (codes?.length) {
            setScanResult({ text: codes[0].rawValue, format: codes[0].format });
          } else {
            setScanError('No barcode recognized in this image. Try another photo with clear contrast.');
          }
        } catch {
          setScanError('Barcode detection failed for this image.');
        }
      }
      URL.revokeObjectURL(url);
      event.target.value = '';
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      event.target.value = '';
      setScanError('Unable to load this image.');
    };
    img.src = url;
  };

  const isUrl = (str: string) => {
    try {
      const parsed = new URL(str);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleCopyScanValue = async () => {
    if (!scanResult) return;
    const ok = await copyToClipboard(scanResult.text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button type="button" aria-pressed={activeTab === 'generate'} onClick={() => handleTabChange('generate')} className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'generate' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          <BarcodeIcon className="w-4 h-4" aria-hidden="true" /> Generate Barcode
        </button>
        <button type="button" aria-pressed={activeTab === 'scan'} onClick={() => handleTabChange('scan')} className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'scan' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          <Camera className="w-4 h-4" aria-hidden="true" /> Scan Barcode
        </button>
      </div>

      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Barcode Symbology Standard</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as BarcodeFormat)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500">
                {BARCODE_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{BARCODE_FORMATS.find((item) => item.id === format)?.description}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Barcode Data / Payload</label>
              <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder={BARCODE_FORMATS.find((item) => item.id === format)?.example} className={`w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 ${validation.isValid ? 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500' : 'border-red-500 focus:ring-red-500'}`} />
              {!validation.isValid ? (
                <div role="alert" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /><span>{validation.error}</span></div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{BARCODE_FORMATS.find((item) => item.id === format)?.patternHelp}</p>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"><Sliders className="w-3.5 h-3.5" aria-hidden="true" /><span>Dimensions & Styling</span></div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Bar Height ({height}px)<input aria-label="Barcode height" type="range" min="30" max="180" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="mt-1 w-full" /></label>
                <label className="block text-xs text-slate-600 dark:text-slate-400">Width Scale ({widthScale}x)<input aria-label="Barcode width scale" type="range" min="1" max="4" step="0.5" value={widthScale} onChange={(e) => setWidthScale(Number(e.target.value))} className="mt-1 w-full" /></label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Bar Color<div className="mt-1 flex items-center gap-2"><input aria-label="Bar color" type="color" value={lineColor} onChange={(e) => setLineColor(e.target.value)} className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer p-0" /><span className="text-xs font-mono text-slate-700 dark:text-slate-300">{lineColor}</span></div></label>
                <label className="block text-xs text-slate-600 dark:text-slate-400">Background Color<div className="mt-1 flex items-center gap-2"><input aria-label="Barcode background color" type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer p-0" /><span className="text-xs font-mono text-slate-700 dark:text-slate-300">{bgColor}</span></div></label>
              </div>
              <label className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">Display human-readable text label<input type="checkbox" checked={displayValue} onChange={(e) => setDisplayValue(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" /></label>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5">
            <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200 max-w-full overflow-x-auto flex justify-center items-center min-h-[160px]">
              {validation.isValid ? <svg ref={svgRef} className="max-w-full" aria-label="Generated barcode" /> : <div className="text-center text-slate-400 py-6"><BarcodeIcon className="w-12 h-12 mx-auto mb-2 opacity-40" aria-hidden="true" /><p className="text-xs">Correct the input error to preview barcode</p></div>}
            </div>
            {validation.isValid && (
              <div className="w-full space-y-3">
                <div className="text-center text-xs font-mono text-slate-600 dark:text-slate-400">Standard: <span className="font-semibold text-slate-900 dark:text-slate-200">{format}</span> • Encoded: <span className="font-semibold text-slate-900 dark:text-slate-200">{validation.normalizedValue}</span></div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={handleDownloadPng} className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"><Download className="w-3.5 h-3.5" aria-hidden="true" />Download PNG</button>
                  <button type="button" onClick={handleDownloadSvg} className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors"><Download className="w-3.5 h-3.5" aria-hidden="true" />Download SVG</button>
                  <button type="button" onClick={handleCopyImage} className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors">{copied ? <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}{copied ? 'Copied!' : 'Copy Image'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'scan' && (
        <div className="space-y-6">
          {!barcodeDetectorSupported && (
            <div role="alert" className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Barcode scanning is not supported in this browser. Barcode generation is still available.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Camera className="w-6 h-6" aria-hidden="true" /></div>
              <div><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live Camera Scanner</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Point your device camera at a 1D barcode or QR code. Detection is throttled and stays on-device.</p></div>
              {!isScanningCamera ? (
                <button type="button" onClick={startCamera} disabled={!barcodeDetectorSupported || cameraPermission === 'prompting'} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"><Camera className="w-3.5 h-3.5" aria-hidden="true" />{cameraPermission === 'prompting' ? 'Requesting Camera…' : 'Start Camera Scan'}</button>
              ) : (
                <div className="w-full space-y-3">
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black aspect-video flex items-center justify-center"><video ref={videoRef} className="w-full h-full object-cover" muted /><canvas ref={canvasRef} className="hidden" /><div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-2 border-dashed border-red-500/80 rounded h-20 pointer-events-none" /></div>
                  <button type="button" onClick={stopCameraStream} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors">Stop Camera</button>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center"><Upload className="w-6 h-6" aria-hidden="true" /></div>
              <div><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Scan Barcode Image</h3><p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Upload an image or photo containing a barcode to decode it using the same cached detector.</p></div>
              <label className={`px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm inline-flex items-center gap-2 ${barcodeDetectorSupported ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700' : 'opacity-45 cursor-not-allowed'}`}>
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />Select Photo
                <input type="file" accept="image/*" onChange={handleScanImageFile} disabled={!barcodeDetectorSupported} className="hidden" />
              </label>
            </div>
          </div>

          {scanError && <div role="alert" className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-3 text-xs text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" /><span>{scanError}</span></div>}

          {scanResult && (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /><span>Barcode Successfully Decoded</span></div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg font-mono text-sm break-all text-slate-900 dark:text-slate-100">{scanResult.text}</div>
              {scanResult.format && <div className="text-xs text-emerald-700 dark:text-emerald-400">Detected Symbology: <span className="font-semibold uppercase">{scanResult.format}</span></div>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={handleCopyScanValue} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">{copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}{copied ? 'Copied' : 'Copy Value'}</button>
                {isUrl(scanResult.text) && <a href={scanResult.text} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors"><ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />Open URL in New Tab</a>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeStudioTool;
