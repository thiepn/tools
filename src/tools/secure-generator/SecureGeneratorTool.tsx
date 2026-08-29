import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  KeyRound,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Hash,
  FileText,
  Sliders,
  Sparkles,
  Lock,
  Binary,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  GeneratorMode,
  PasswordConfig,
  PassphraseConfig,
  PinConfig,
  RandomStringConfig,
  generatePassword,
  generatePassphrase,
  generatePin,
  generateRandomString,
  calculatePasswordEntropy,
  calculatePassphraseEntropy,
  calculatePinEntropy,
  calculateRandomStringEntropy,
  getEntropyStrength,
} from '../../utilities/secure-generator';

interface SecureGeneratorToolProps {
  initialText?: string;
}

export const SecureGeneratorTool: React.FC<SecureGeneratorToolProps> = () => {
  const [mode, setMode] = useState<GeneratorMode>('password');

  // Configs
  const [passwordConfig, setPasswordConfig] = useState<PasswordConfig>({
    length: 16,
    useUpper: true,
    useLower: true,
    useNumbers: true,
    useSymbols: true,
    excludeAmbiguous: false,
    ensureEachType: true,
  });

  const [passphraseConfig, setPassphraseConfig] = useState<PassphraseConfig>({
    wordCount: 4,
    separator: '-',
    capitalization: 'title',
    includeNumber: true,
    includeSymbol: false,
  });

  const [pinConfig, setPinConfig] = useState<PinConfig>({
    length: 6,
    avoidTrivial: true,
  });

  const [randomStringConfig, setRandomStringConfig] = useState<RandomStringConfig>({
    length: 32,
    preset: 'alphanumeric',
    customCharset: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  });

  // Quantity for bulk generation
  const [quantity, setQuantity] = useState<number>(1);
  const [results, setResults] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedBulk, setCopiedBulk] = useState<boolean>(false);

  // Core generator function
  const handleGenerate = useCallback(() => {
    const list: string[] = [];
    for (let i = 0; i < quantity; i++) {
      if (mode === 'password') {
        list.push(generatePassword(passwordConfig));
      } else if (mode === 'passphrase') {
        list.push(generatePassphrase(passphraseConfig));
      } else if (mode === 'pin') {
        list.push(generatePin(pinConfig));
      } else if (mode === 'random-string') {
        list.push(generateRandomString(randomStringConfig));
      }
    }
    setResults(list);
  }, [mode, passwordConfig, passphraseConfig, pinConfig, randomStringConfig, quantity]);

  // Generate on config change or mount
  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  // Calculate Entropy & Strength
  const { entropyBits, strength } = useMemo(() => {
    let bits = 0;
    if (mode === 'password') {
      bits = calculatePasswordEntropy(passwordConfig);
    } else if (mode === 'passphrase') {
      bits = calculatePassphraseEntropy(passphraseConfig);
    } else if (mode === 'pin') {
      bits = calculatePinEntropy(pinConfig.length);
    } else if (mode === 'random-string') {
      bits = calculateRandomStringEntropy(randomStringConfig);
    }
    return {
      entropyBits: bits,
      strength: getEntropyStrength(bits),
    };
  }, [mode, passwordConfig, passphraseConfig, pinConfig, randomStringConfig]);

  // Copy Single
  const handleCopySingle = (text: string, index: number) => {
    copyToClipboard(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Copy All Bulk
  const handleCopyAll = () => {
    copyToClipboard(results.join('\n'));
    setCopiedBulk(true);
    setTimeout(() => setCopiedBulk(false), 2000);
  };

  return (
    <ToolShell
      toolId="secure-generator"
      title="Password & Passphrase Generator"
      description="Generate cryptographically secure passwords, memorable multi-word passphrases, numeric PINs, and random tokens using the Web Crypto API."
      category="everyday"
      relatedToolIds={['hash-generator', 'encoding-tools', 'qr-code-studio']}
      outputToTransfer={results.join('\n')}
    >
      <div className="space-y-6">
        {/* Mode Selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              mode === 'password'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Random Password</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('passphrase')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              mode === 'passphrase'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Memorable Passphrase</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              mode === 'pin'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Numeric PIN</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('random-string')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              mode === 'random-string'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            <Binary className="w-3.5 h-3.5" />
            <span>Random Token / String</span>
          </button>
        </div>

        {/* Primary Generated Result Display (Hero) */}
        {results.length > 0 && (
          <div className="p-5 bg-neutral-900 dark:bg-neutral-950 rounded-xl border border-neutral-800 shadow-sm space-y-3 text-white">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="uppercase font-bold tracking-wider text-[10px]">
                {mode === 'password'
                  ? 'Generated Password'
                  : mode === 'passphrase'
                  ? 'Generated Passphrase'
                  : mode === 'pin'
                  ? 'Generated PIN'
                  : 'Generated Token'}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px]">{entropyBits} bits of entropy</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${strength.color} text-white`}>
                  {strength.label}
                </span>
              </div>
            </div>

            {/* Primary Hero String */}
            <div className="flex items-center justify-between gap-3 bg-neutral-800/80 p-3 rounded-lg border border-neutral-700">
              <span className="font-mono text-base sm:text-xl font-bold tracking-wide break-all select-all text-neutral-100">
                {results[0]}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopySingle(results[0], 0)}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedIndex === 0 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="p-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-md transition-colors"
                  title="Generate new secret"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Entropy Progress Bar */}
            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${strength.color} transition-all duration-300`}
                style={{ width: `${strength.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                Generation Parameters
              </h4>

              {/* Password Mode Options */}
              {mode === 'password' && (
                <div className="space-y-4">
                  {/* Length Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">Password Length</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {passwordConfig.length} characters
                      </span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={64}
                      value={passwordConfig.length}
                      onChange={(e) =>
                        setPasswordConfig({ ...passwordConfig, length: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Character Pool Toggles */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passwordConfig.useUpper}
                        onChange={(e) =>
                          setPasswordConfig({ ...passwordConfig, useUpper: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Uppercase (A-Z)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passwordConfig.useLower}
                        onChange={(e) =>
                          setPasswordConfig({ ...passwordConfig, useLower: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Lowercase (a-z)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passwordConfig.useNumbers}
                        onChange={(e) =>
                          setPasswordConfig({ ...passwordConfig, useNumbers: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Numbers (0-9)</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passwordConfig.useSymbols}
                        onChange={(e) =>
                          setPasswordConfig({ ...passwordConfig, useSymbols: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Symbols (!@#$%)</span>
                    </label>
                  </div>

                  {/* Advanced Rules */}
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passwordConfig.excludeAmbiguous}
                        onChange={(e) =>
                          setPasswordConfig({ ...passwordConfig, excludeAmbiguous: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Exclude confusing characters (<code className="text-neutral-500 font-mono">0, O, 1, l, I, |</code>)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passwordConfig.ensureEachType}
                        onChange={(e) =>
                          setPasswordConfig({ ...passwordConfig, ensureEachType: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Ensure at least one character from each selected set</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Passphrase Mode Options */}
              {mode === 'passphrase' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">Word Count</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {passphraseConfig.wordCount} words
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={8}
                      value={passphraseConfig.wordCount}
                      onChange={(e) =>
                        setPassphraseConfig({ ...passphraseConfig, wordCount: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Separator
                      </label>
                      <select
                        value={passphraseConfig.separator}
                        onChange={(e) =>
                          setPassphraseConfig({ ...passphraseConfig, separator: e.target.value as any })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      >
                        <option value="-">Hyphen (-)</option>
                        <option value=" ">Space ( )</option>
                        <option value="_">Underscore (_)</option>
                        <option value=".">Dot (.)</option>
                        <option value="">None</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Capitalization
                      </label>
                      <select
                        value={passphraseConfig.capitalization}
                        onChange={(e) =>
                          setPassphraseConfig({ ...passphraseConfig, capitalization: e.target.value as any })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                      >
                        <option value="title">Title Case (Apple-Banana)</option>
                        <option value="lower">lowercase (apple-banana)</option>
                        <option value="upper">UPPERCASE (APPLE-BANANA)</option>
                        <option value="camel">camelCase (appleBanana)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passphraseConfig.includeNumber}
                        onChange={(e) =>
                          setPassphraseConfig({ ...passphraseConfig, includeNumber: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Append number (e.g. <code>Banana42</code>)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={passphraseConfig.includeSymbol || false}
                        onChange={(e) =>
                          setPassphraseConfig({ ...passphraseConfig, includeSymbol: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Append symbol (e.g. <code>Banana!</code>)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* PIN Mode Options */}
              {mode === 'pin' && (
                <div className="space-y-4">
                  {/* Preset Length Pills */}
                  <div>
                    <span className="block text-[11px] font-medium text-neutral-500 mb-1.5">
                      PIN Length Preset
                    </span>
                    <div className="flex gap-2">
                      {[4, 6, 8].map((len) => (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setPinConfig({ ...pinConfig, length: len })}
                          className={`px-3 py-1 text-xs font-semibold rounded border ${
                            pinConfig.length === len
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {len}-digit PIN
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">Custom Length</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {pinConfig.length} digits
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={16}
                      value={pinConfig.length}
                      onChange={(e) =>
                        setPinConfig({ ...pinConfig, length: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={pinConfig.avoidTrivial}
                      onChange={(e) =>
                        setPinConfig({ ...pinConfig, avoidTrivial: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Avoid trivial repeats or runs (e.g. <code>1111</code>, <code>1234</code>, <code>4321</code>)</span>
                  </label>
                </div>
              )}

              {/* Random String / Token Mode Options */}
              {mode === 'random-string' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">Token Length</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {randomStringConfig.length} characters
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={128}
                      value={randomStringConfig.length}
                      onChange={(e) =>
                        setRandomStringConfig({ ...randomStringConfig, length: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1.5">
                      Character Set Preset
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'alphanumeric', label: 'Alphanumeric (A-Z, a-z, 0-9)' },
                        { id: 'hex', label: 'Hexadecimal (0-9, a-f)' },
                        { id: 'alphanumeric-symbols', label: 'Alphanumeric + Symbols' },
                        { id: 'custom', label: 'Custom Character Set' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setRandomStringConfig({
                              ...randomStringConfig,
                              preset: item.id as any,
                            })
                          }
                          className={`p-2 text-xs font-semibold rounded border text-left ${
                            randomStringConfig.preset === item.id
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-700 dark:text-blue-300'
                              : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {randomStringConfig.preset === 'custom' && (
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                        Custom Characters Pool
                      </label>
                      <input
                        type="text"
                        value={randomStringConfig.customCharset}
                        onChange={(e) =>
                          setRandomStringConfig({
                            ...randomStringConfig,
                            customCharset: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded"
                        placeholder="e.g. ABCDEF12345!@#"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Bulk Generation Controls */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Generate multiple:
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10, 20].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border ${
                        quantity === q
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900'
                          : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy Guarantee Note */}
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                Generated securely on your device using <code>crypto.getRandomValues</code>. Secrets never leave your browser.
              </span>
            </div>
          </div>

          {/* Bulk Results Column (if quantity > 1) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Generated Batch ({results.length})
                </h4>
                {results.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="px-2 py-1 text-[11px] font-semibold rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1"
                  >
                    {copiedBulk ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBulk ? 'Copied Batch' : 'Copy All'}</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {results.map((res, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 text-xs font-mono"
                  >
                    <span className="truncate select-all text-neutral-800 dark:text-neutral-200">{res}</span>
                    <button
                      type="button"
                      onClick={() => handleCopySingle(res, i)}
                      className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 shrink-0"
                      title="Copy item"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default SecureGeneratorTool;
