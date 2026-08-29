import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Shuffle,
  Trophy,
  Users,
  GitMerge,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Dice5,
  Disc,
  UserCheck,
  Gift,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  parseItemsList,
  pickRandomOne,
  pickRandomItems,
  shuffleArraySecure,
  splitIntoTeams,
  generateRandomPairs,
  generateSecretSanta,
  SAMPLE_RANDOM_PRESETS,
  RandomPickerMode,
  getCryptoRandomInt,
  PairResult,
} from '../../utilities/random-picker';
import { copyToClipboard } from '../../utilities/clipboard';

const WHEEL_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // amber
  '#9333ea', // purple
  '#e11d48', // rose
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#059669', // emerald
  '#ea580c', // orange
  '#7c3aed', // violet
];

export const RandomPickerTool: React.FC = () => {
  const [mode, setMode] = useState<RandomPickerMode>('pick-one');
  const [rawInput, setRawInput] = useState<string>(SAMPLE_RANDOM_PRESETS[0].items.join('\n'));

  // Pick options
  const [pickCount, setPickCount] = useState<number>(3);
  const [allowDuplicates, setAllowDuplicates] = useState<boolean>(false);

  // Team options
  const [teamMode, setTeamMode] = useState<'by-count' | 'by-size'>('by-count');
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teamSize, setTeamSize] = useState<number>(3);

  // Pair options
  const [oddHandling, setOddHandling] = useState<'trio' | 'bystander'>('trio');

  // Result state
  const [singleWinner, setSingleWinner] = useState<{ winner: string; remaining: string[] } | null>(null);
  const [pickedWinners, setPickedWinners] = useState<string[]>([]);
  const [shuffledList, setShuffledList] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ name: string; members: string[] }[]>([]);
  const [randomPairs, setRandomPairs] = useState<{ pairs: PairResult[]; bystander?: string }>({ pairs: [] });
  const [santaPairs, setSantaPairs] = useState<{ giver: string; receiver: string }[]>([]);
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);

  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>('');

  const parsedItems = parseItemsList(rawInput);

  // Canvas Wheel state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentAngleRef = useRef<number>(0);
  const animIdRef = useRef<number | null>(null);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, []);

  // Draw wheel on canvas
  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2 - 12;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    if (parsedItems.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Enter items to spin', centerX, centerY);
      return;
    }

    const sliceAngle = (2 * Math.PI) / parsedItems.length;

    // Draw slices
    parsedItems.forEach((item, index) => {
      const startAngle = angle + index * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text label on slice
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textBaseline = 'middle';
      const truncated = item.length > 14 ? item.slice(0, 12) + '…' : item;
      ctx.fillText(truncated, radius - 16, 0);
      ctx.restore();
    });

    // Outer wheel border ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Center hub
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pointer indicator at the right (0 rad)
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 8, centerY);
    ctx.lineTo(centerX + radius - 14, centerY - 10);
    ctx.lineTo(centerX + radius - 14, centerY + 10);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [parsedItems]);

  useEffect(() => {
    if (mode === 'wheel') {
      drawWheel(currentAngleRef.current);
    }
  }, [mode, parsedItems, drawWheel]);

  const spinWheel = () => {
    if (parsedItems.length === 0 || isSpinning) return;

    const winnerIdx = getCryptoRandomInt(parsedItems.length);
    const winnerName = parsedItems[winnerIdx];
    const sliceAngle = (2 * Math.PI) / parsedItems.length;

    // Pointer is at 0 rad (3 o'clock). Slice i spans [angle + i*sliceAngle, angle + (i+1)*sliceAngle].
    const targetSliceAngle = - (winnerIdx + 0.5) * sliceAngle;
    const spins = 5 + getCryptoRandomInt(3); // 5 to 7 full rotations
    const totalRotation = spins * 2 * Math.PI + ((targetSliceAngle - (currentAngleRef.current % (2 * Math.PI))) % (2 * Math.PI));
    const finalAngle = currentAngleRef.current + (totalRotation < 0 ? totalRotation + 2 * Math.PI : totalRotation);

    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      currentAngleRef.current = finalAngle;
      drawWheel(finalAngle);
      setWheelWinner(winnerName);
      setResultText(`Wheel Winner: ${winnerName}`);
      return;
    }

    setIsSpinning(true);
    setWheelWinner(null);

    const startAngle = currentAngleRef.current;
    const delta = finalAngle - startAngle;
    const duration = 3200; // ms
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const angle = startAngle + delta * easeOut;

      currentAngleRef.current = angle;
      drawWheel(angle);

      if (progress < 1) {
        animIdRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        setWheelWinner(winnerName);
        setResultText(`Wheel Winner: ${winnerName}`);
      }
    };

    animIdRef.current = requestAnimationFrame(animate);
  };

  const handleExecute = () => {
    if (parsedItems.length === 0) return;

    if (mode === 'wheel') {
      spinWheel();
      return;
    }

    setIsSpinning(true);
    setTimeout(() => {
      if (mode === 'pick-one') {
        const res = pickRandomOne(parsedItems);
        if (res) {
          setSingleWinner(res);
          setResultText(`Winner: ${res.winner}\n\nRemaining (${res.remaining.length}):\n${res.remaining.join('\n')}`);
        }
      } else if (mode === 'pick-n') {
        const winners = pickRandomItems(parsedItems, pickCount, allowDuplicates);
        setPickedWinners(winners);
        setResultText(`Selected Winners (${winners.length}):\n${winners.map((w, i) => `${i + 1}. ${w}`).join('\n')}`);
      } else if (mode === 'shuffle') {
        const shuffled = shuffleArraySecure(parsedItems);
        setShuffledList(shuffled);
        setResultText(`Shuffled Order (${shuffled.length}):\n${shuffled.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
      } else if (mode === 'teams') {
        const spec = teamMode === 'by-count' ? teamCount : teamSize;
        const generatedTeams = splitIntoTeams(parsedItems, spec, teamMode);
        setTeams(generatedTeams);
        const formatted = generatedTeams
          .map((t) => `${t.name} (${t.members.length} members):\n${t.members.map((m) => `  - ${m}`).join('\n')}`)
          .join('\n\n');
        setResultText(formatted);
      } else if (mode === 'pairs') {
        const res = generateRandomPairs(parsedItems, oddHandling);
        setRandomPairs(res);
        let formatted = res.pairs.map((p) => `${p.groupName}: ${p.members.join(' & ')}`).join('\n');
        if (res.bystander) {
          formatted += `\n\nOdd Person Out / Bystander: ${res.bystander}`;
        }
        setResultText(formatted);
      } else if (mode === 'secret-santa') {
        const santa = generateSecretSanta(parsedItems);
        setSantaPairs(santa);
        const formatted = santa.map((p) => `${p.giver} ➔ ${p.receiver}`).join('\n');
        setResultText(`Secret Santa Gift Exchange:\n${formatted}`);
      }
      setIsSpinning(false);
    }, 200);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = SAMPLE_RANDOM_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setRawInput(preset.items.join('\n'));
      setSingleWinner(null);
      setPickedWinners([]);
      setShuffledList([]);
      setTeams([]);
      setRandomPairs({ pairs: [] });
      setSantaPairs([]);
      setWheelWinner(null);
      setResultText('');
    }
  };

  const handleCopy = async () => {
    if (!resultText) return;
    const ok = await copyToClipboard(resultText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="random-picker"
      title="Random Picker & Team Generator"
      description="Draw raffle winners, spin interactive prize wheel, generate randomized teams, shuffle lists, and build buddy pairs with Web Crypto randomness."
      category="productivity"
      relatedToolIds={['recipe-scaler', 'notepad', 'checklist']}
      outputToTransfer={resultText}
    >
      <div className="space-y-6">
        {/* Mode Selector Ribbon (6 Core Modes + Secret Santa) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {[
              { id: 'pick-one', label: 'Pick One', icon: UserCheck },
              { id: 'pick-n', label: 'Pick N', icon: Trophy },
              { id: 'wheel', label: 'Spin Wheel', icon: Disc },
              { id: 'shuffle', label: 'Shuffle', icon: Shuffle },
              { id: 'teams', label: 'Teams', icon: Users },
              { id: 'pairs', label: 'Pairs', icon: GitMerge },
              { id: 'secret-santa', label: 'Secret Santa', icon: Gift },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMode(m.id as RandomPickerMode);
                    setResultText('');
                  }}
                  className={`px-3 py-1.5 rounded-md border inline-flex items-center gap-1.5 transition-colors ${
                    mode === m.id
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 font-semibold shadow-2xs'
                      : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={parsedItems.length === 0 || isSpinning}
              onClick={handleExecute}
              className="px-4 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Dice5 className="w-3.5 h-3.5" />
              <span>{isSpinning ? 'Spinning...' : mode === 'wheel' ? 'Spin Wheel' : 'Draw / Generate'}</span>
            </button>
          </div>
        </div>

        {/* Input & Configurations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Candidates List & Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Items / Names ({parsedItems.length} entries)
              </span>
              <div className="flex items-center gap-1">
                {SAMPLE_RANDOM_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleLoadPreset(p.id)}
                    className="px-2 py-0.5 text-[10px] rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Enter one item or name per line..."
              rows={9}
              className="w-full p-3 text-xs sm:text-sm font-mono border rounded-lg bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Mode-specific settings */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
              {mode === 'pick-one' && (
                <p className="text-[11px] text-neutral-500">
                  Selects exactly 1 random item with high-entropy cryptographic randomness.
                </p>
              )}

              {mode === 'pick-n' && (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span>Number of Winners:</span>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, parsedItems.length)}
                      value={pickCount}
                      onChange={(e) => setPickCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                    />
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDuplicates}
                      onChange={(e) => setAllowDuplicates(e.target.checked)}
                    />
                    <span>Allow duplicates</span>
                  </label>
                </div>
              )}

              {mode === 'wheel' && (
                <p className="text-[11px] text-neutral-500">
                  Interactive canvas wheel with cryptographic slice targeting and reduced-motion support.
                </p>
              )}

              {mode === 'teams' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="teamMode"
                        checked={teamMode === 'by-count'}
                        onChange={() => setTeamMode('by-count')}
                      />
                      <span>By Number of Teams</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="teamMode"
                        checked={teamMode === 'by-size'}
                        onChange={() => setTeamMode('by-size')}
                      />
                      <span>By Target Team Size</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <span>{teamMode === 'by-count' ? 'Number of Teams:' : 'Target Members per Team:'}</span>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, parsedItems.length)}
                      value={teamMode === 'by-count' ? teamCount : teamSize}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        if (teamMode === 'by-count') setTeamCount(val);
                        else setTeamSize(val);
                      }}
                      className="w-16 px-2 py-1 border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                    />
                  </div>
                </div>
              )}

              {mode === 'pairs' && (
                <div className="flex items-center gap-3">
                  <span>When odd number of people:</span>
                  <select
                    value={oddHandling}
                    onChange={(e) => setOddHandling(e.target.value as 'trio' | 'bystander')}
                    className="px-2 py-1 border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                  >
                    <option value="trio">Form 1 Trio (Group of 3)</option>
                    <option value="bystander">Leave 1 Bystander / Odd Person</option>
                  </select>
                </div>
              )}

              {mode === 'secret-santa' && (
                <p className="text-[11px] text-neutral-500">
                  Builds a circular derangement where each participant gives to someone else without self-pairing.
                </p>
              )}

              {mode === 'shuffle' && (
                <p className="text-[11px] text-neutral-500">
                  Unbiased cryptographic Fisher-Yates permutation across all items.
                </p>
              )}
            </div>
          </div>

          {/* Right: Results Display */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Randomized Output
              </span>
              {resultText && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-neutral-800 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 min-h-[280px] flex flex-col items-center justify-center overflow-y-auto">
              {mode === 'wheel' ? (
                <div className="flex flex-col items-center space-y-4 w-full">
                  <div className="relative flex items-center justify-center">
                    <canvas
                      ref={canvasRef}
                      width={280}
                      height={280}
                      className="rounded-full shadow-md bg-white dark:bg-neutral-900 max-w-full"
                    />
                  </div>
                  {wheelWinner && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-lg text-center w-full max-w-xs shadow-2xs animate-fade-in">
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                        Wheel Winner!
                      </span>
                      <div className="text-base font-extrabold text-emerald-950 dark:text-emerald-100 mt-0.5 truncate">
                        🎉 {wheelWinner}
                      </div>
                    </div>
                  )}
                </div>
              ) : !resultText ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-2 py-8">
                  <Dice5 className="w-8 h-8 opacity-40" />
                  <p className="text-xs">Click "Draw / Generate" to pick winners or build teams.</p>
                </div>
              ) : mode === 'pick-one' && singleWinner ? (
                <div className="w-full space-y-4 text-center">
                  <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-emerald-400 dark:border-emerald-700 shadow-sm">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Selected Winner
                    </span>
                    <div className="text-xl font-black text-neutral-900 dark:text-neutral-100 mt-1">
                      ⭐ {singleWinner.winner}
                    </div>
                  </div>
                  {singleWinner.remaining.length > 0 && (
                    <div className="text-left text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        Remaining ({singleWinner.remaining.length}):
                      </span>
                      <p className="mt-1 line-clamp-3">{singleWinner.remaining.join(', ')}</p>
                    </div>
                  )}
                </div>
              ) : mode === 'pick-n' ? (
                <div className="w-full space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Selected Winners ({pickedWinners.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pickedWinners.map((w, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-emerald-300 dark:border-emerald-800 shadow-2xs flex items-center gap-2.5"
                      >
                        <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm truncate">
                          {w}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : mode === 'teams' ? (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teams.map((t) => (
                    <div
                      key={t.name}
                      className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 shadow-2xs"
                    >
                      <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 border-b pb-1">
                        {t.name} ({t.members.length})
                      </h4>
                      <ul className="space-y-1 text-xs">
                        {t.members.map((m, mi) => (
                          <li key={mi} className="text-neutral-700 dark:text-neutral-300 truncate">
                            • {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : mode === 'pairs' ? (
                <div className="w-full space-y-3">
                  <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Random Pairs ({randomPairs.pairs.length} groups)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {randomPairs.pairs.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1 text-xs"
                      >
                        <span className="font-bold text-neutral-500">{p.groupName}</span>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {p.members.join(' & ')}
                        </div>
                      </div>
                    ))}
                  </div>
                  {randomPairs.bystander && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-800 dark:text-amber-300">
                      <strong>Odd Person Out / Bystander:</strong> {randomPairs.bystander}
                    </div>
                  )}
                </div>
              ) : mode === 'secret-santa' ? (
                <div className="w-full space-y-2">
                  <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    Secret Santa Pairings
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {santaPairs.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">{p.giver}</span>
                        <span className="text-neutral-400 font-bold">➔</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-400">{p.receiver}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Shuffled order */
                <div className="w-full space-y-1.5">
                  <h4 className="text-xs font-bold text-neutral-600 dark:text-neutral-400">Shuffled Sequence</h4>
                  <div className="space-y-1 text-xs">
                    {shuffledList.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2"
                      >
                        <span className="font-mono text-neutral-400 w-5">#{idx + 1}</span>
                        <span className="text-neutral-800 dark:text-neutral-200">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default RandomPickerTool;
