import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { copyToClipboard } from '../../utilities/clipboard';

export type ToolStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const STATUS_STYLES: Record<ToolStatusTone, string> = {
  neutral:
    'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800',
  info:
    'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  success:
    'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  warning:
    'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  error:
    'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
};

interface ToolStatusProps {
  children: React.ReactNode;
  tone?: ToolStatusTone;
  busy?: boolean;
  className?: string;
}

export const ToolStatus: React.FC<ToolStatusProps> = ({
  children,
  tone = 'neutral',
  busy = false,
  className = '',
}) => {
  const isError = tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-busy={busy || undefined}
      className={`tt-status inline-flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${STATUS_STYLES[tone]} ${className}`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
      <span className="min-w-0">{children}</span>
    </div>
  );
};

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  disabled?: boolean;
  className?: string;
  onCopied?: () => void;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  disabled = false,
  className = '',
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (disabled || !value) return;

    const success = await copyToClipboard(value);
    if (!success) return;

    setCopied(true);
    onCopied?.();
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !value}
      aria-label={copied ? copiedLabel : label}
      className={`tt-copy-button inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800'
      } ${className}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
};

interface ToolActionBarProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'between' | 'end';
}

const ACTION_ALIGNMENT: Record<NonNullable<ToolActionBarProps['align']>, string> = {
  start: 'justify-start',
  between: 'justify-between',
  end: 'justify-end',
};

export const ToolActionBar: React.FC<ToolActionBarProps> = ({
  children,
  className = '',
  align = 'end',
}) => (
  <div
    className={`tt-action-bar flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${ACTION_ALIGNMENT[align]} ${className}`}
  >
    {children}
  </div>
);

interface AccessibleDropZoneProps {
  children: React.ReactNode;
  onActivate: () => void;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export const AccessibleDropZone: React.FC<AccessibleDropZoneProps> = ({
  children,
  onActivate,
  onDrop,
  onDragOver,
  ariaLabel,
  className = '',
  disabled = false,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onActivate();
      }}
      onKeyDown={handleKeyDown}
      onDrop={disabled ? undefined : onDrop}
      onDragOver={disabled ? undefined : onDragOver}
      className={`tt-drop-zone focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${className}`}
    >
      {children}
    </div>
  );
};
