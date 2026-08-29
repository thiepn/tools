import QRCode from 'qrcode';

export type QrDataType = 'text' | 'url' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard';
export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface WifiQrConfig {
  ssid: string;
  password?: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface EmailQrConfig {
  recipient: string;
  subject?: string;
  body?: string;
}

export interface SmsQrConfig {
  phoneNumber: string;
  message?: string;
}

export interface VCardQrConfig {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  organization?: string;
  website?: string;
}

// Escape special characters in Wi-Fi SSID / password
function escapeWifiString(str: string): string {
  return str.replace(/([\\;,":])/g, '\\$1');
}

export function formatWifiPayload(config: WifiQrConfig): string {
  const t = config.security || 'WPA';
  const s = escapeWifiString(config.ssid || '');
  const p = config.password ? escapeWifiString(config.password) : '';
  const h = config.hidden ? 'true' : 'false';
  return `WIFI:T:${t};S:${s};P:${p};H:${h};;`;
}

export function formatEmailPayload(config: EmailQrConfig): string {
  const params: string[] = [];
  if (config.subject) params.push(`subject=${encodeURIComponent(config.subject)}`);
  if (config.body) params.push(`body=${encodeURIComponent(config.body)}`);
  const query = params.length > 0 ? `?${params.join('&')}` : '';
  return `mailto:${config.recipient}${query}`;
}

export function formatPhonePayload(phoneNumber: string): string {
  return `tel:${phoneNumber.trim()}`;
}

export function formatSmsPayload(config: SmsQrConfig): string {
  const cleanPhone = config.phoneNumber.trim();
  const body = config.message ? `?body=${encodeURIComponent(config.message)}` : '';
  return `sms:${cleanPhone}${body}`;
}

export function formatVCardPayload(config: VCardQrConfig): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${config.lastName || ''};${config.firstName || ''};;;`,
    `FN:${`${config.firstName || ''} ${config.lastName || ''}`.trim()}`,
  ];
  if (config.organization) lines.push(`ORG:${config.organization}`);
  if (config.phone) lines.push(`TEL;TYPE=CELL:${config.phone}`);
  if (config.email) lines.push(`EMAIL:${config.email}`);
  if (config.website) lines.push(`URL:${config.website}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

// Calculate color contrast ratio (WCAG formula)
export function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function checkContrast(fgHex: string, bgHex: string): number {
  const l1 = getLuminance(fgHex);
  const l2 = getLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Generate QR Code as Data URL
export async function generateQrDataUrl(
  text: string,
  options: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: QrErrorCorrectionLevel;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: options.width || 320,
    margin: options.margin !== undefined ? options.margin : 2,
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    color: {
      dark: options.color?.dark || '#000000',
      light: options.color?.light || '#FFFFFF',
    },
  });
}

// Generate QR Code as SVG string
export async function generateQrSvgString(
  text: string,
  options: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: QrErrorCorrectionLevel;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    width: options.width || 320,
    margin: options.margin !== undefined ? options.margin : 2,
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    color: {
      dark: options.color?.dark || '#000000',
      light: options.color?.light || '#FFFFFF',
    },
  });
}

export interface ParsedQrResult {
  raw: string;
  type: 'url' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard' | 'text';
  parsedData?: {
    url?: string;
    wifi?: { ssid: string; password?: string; security: string; hidden: boolean };
    email?: { recipient: string; subject?: string; body?: string };
    phone?: string;
    sms?: { phone: string; message?: string };
    vcard?: { name: string; phone?: string; email?: string; org?: string };
  };
}

export function parseScannedQr(raw: string): ParsedQrResult {
  const trimmed = raw.trim();

  // 1. Wi-Fi: WIFI:T:WPA;S:ssid;P:pass;H:false;;
  if (/^WIFI:/i.test(trimmed)) {
    const tMatch = trimmed.match(/T:([^;]*)/i);
    const sMatch = trimmed.match(/S:([^;]*)/i);
    const pMatch = trimmed.match(/P:([^;]*)/i);
    const hMatch = trimmed.match(/H:([^;]*)/i);

    const unescape = (s?: string) => (s ? s.replace(/\\([\\;,":])/g, '$1') : '');

    return {
      raw,
      type: 'wifi',
      parsedData: {
        wifi: {
          ssid: unescape(sMatch?.[1]) || 'Unknown Network',
          password: unescape(pMatch?.[1]),
          security: tMatch?.[1] || 'WPA',
          hidden: hMatch?.[1]?.toLowerCase() === 'true',
        },
      },
    };
  }

  // 2. URL: https:// or http:// or www.
  if (/^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i.test(trimmed)) {
    const fullUrl = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;
    return {
      raw,
      type: 'url',
      parsedData: { url: fullUrl },
    };
  }

  // 3. Mailto
  if (/^mailto:/i.test(trimmed)) {
    const mailtoBody = trimmed.substring(7);
    const [recipient, query] = mailtoBody.split('?');
    const params = new URLSearchParams(query || '');
    return {
      raw,
      type: 'email',
      parsedData: {
        email: {
          recipient,
          subject: params.get('subject') || undefined,
          body: params.get('body') || undefined,
        },
      },
    };
  }

  // 4. Tel
  if (/^tel:/i.test(trimmed)) {
    return {
      raw,
      type: 'phone',
      parsedData: { phone: trimmed.substring(4) },
    };
  }

  // 5. SMS
  if (/^sms:/i.test(trimmed)) {
    const smsBody = trimmed.substring(4);
    const [phone, query] = smsBody.split('?');
    const params = new URLSearchParams(query || '');
    return {
      raw,
      type: 'sms',
      parsedData: {
        sms: {
          phone,
          message: params.get('body') || undefined,
        },
      },
    };
  }

  // 6. vCard
  if (/^BEGIN:VCARD/i.test(trimmed)) {
    const fnMatch = trimmed.match(/FN:(.*)/i);
    const telMatch = trimmed.match(/TEL(?:;[^:]+)?:(.*)/i);
    const emailMatch = trimmed.match(/EMAIL(?:;[^:]+)?:(.*)/i);
    const orgMatch = trimmed.match(/ORG:(.*)/i);

    return {
      raw,
      type: 'vcard',
      parsedData: {
        vcard: {
          name: fnMatch?.[1]?.trim() || 'Contact',
          phone: telMatch?.[1]?.trim(),
          email: emailMatch?.[1]?.trim(),
          org: orgMatch?.[1]?.trim(),
        },
      },
    };
  }

  // 7. Plain text
  return {
    raw,
    type: 'text',
  };
}
