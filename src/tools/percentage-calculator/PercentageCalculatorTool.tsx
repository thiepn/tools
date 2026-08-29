import React, { useState, useMemo } from 'react';
import { Copy, Check, Percent, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  parseNumberInput,
  calculatePercentOf,
  calculateWhatPercent,
  calculatePercentChange,
  calculateReversePercent,
} from '../../utilities/percentage-calculator';
import { copyToClipboard } from '../../utilities/clipboard';

export const PercentageCalculatorTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<1 | 2 | 3 | 4>(1);

  // Mode 1: What is X% of Y?
  const [m1Percent, setM1Percent] = useState('15');
  const [m1Total, setM1Total] = useState('250');

  // Mode 2: X is what % of Y?
  const [m2Part, setM2Part] = useState('45');
  const [m2Total, setM2Total] = useState('180');

  // Mode 3: % Change from X to Y
  const [m3From, setM3From] = useState('80');
  const [m3To, setM3To] = useState('120');

  // Mode 4: Reverse % (Original before X% increase/decrease yielded Y)
  const [m4Final, setM4Final] = useState('115');
  const [m4Percent, setM4Percent] = useState('15');
  const [m4Type, setM4Type] = useState<'increase' | 'decrease'>('increase');

  const [showFormula, setShowFormula] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calculations
  const r1 = useMemo(() => {
    const x = parseNumberInput(m1Percent);
    const y = parseNumberInput(m1Total);
    if (x === null || y === null) return null;
    return calculatePercentOf(x, y);
  }, [m1Percent, m1Total]);

  const r2 = useMemo(() => {
    const x = parseNumberInput(m2Part);
    const y = parseNumberInput(m2Total);
    if (x === null || y === null) return null;
    return calculateWhatPercent(x, y);
  }, [m2Part, m2Total]);

  const r3 = useMemo(() => {
    const x = parseNumberInput(m3From);
    const y = parseNumberInput(m3To);
    if (x === null || y === null) return null;
    return calculatePercentChange(x, y);
  }, [m3From, m3To]);

  const r4 = useMemo(() => {
    const y = parseNumberInput(m4Final);
    const x = parseNumberInput(m4Percent);
    if (x === null || y === null) return null;
    return calculateReversePercent(y, x, m4Type);
  }, [m4Final, m4Percent, m4Type]);

  const currentResultFormatted = useMemo(() => {
    if (activeMode === 1) return r1?.formatted || '';
    if (activeMode === 2) return r2?.formatted || '';
    if (activeMode === 3) return r3?.formatted || '';
    if (activeMode === 4) return r4?.formatted || '';
    return '';
  }, [activeMode, r1, r2, r3, r4]);

  const currentFormula = useMemo(() => {
    if (activeMode === 1) return r1?.formula || '';
    if (activeMode === 2) return r2?.formula || '';
    if (activeMode === 3) return r3?.formula || '';
    if (activeMode === 4) return r4?.formula || '';
    return '';
  }, [activeMode, r1, r2, r3, r4]);

  const handleCopy = async () => {
    if (!currentResultFormatted) return;
    const success = await copyToClipboard(currentResultFormatted);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="percentage-calculator"
      title="Percentage Calculator"
      description="Quickly calculate percentages, relationships, percentage increase/decrease, and reverse percentages."
      category="math"
      relatedToolIds={['aspect-ratio-calculator', 'unit-converter', 'date-calculator']}
      outputToTransfer={currentResultFormatted}
    >
      <div className="space-y-6">
        {/* Mode Selector Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode(1)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              activeMode === 1
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-normal">Mode 1</div>
            <div>What is X% of Y?</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode(2)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              activeMode === 2
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-normal">Mode 2</div>
            <div>X is what % of Y?</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode(3)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              activeMode === 3
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-normal">Mode 3</div>
            <div>Percentage Change (From X to Y)</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode(4)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              activeMode === 4
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-normal">Mode 4</div>
            <div>Reverse Percentage</div>
          </button>
        </div>

        {/* Active Mode Form & Results */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-6">
          {/* MODE 1 */}
          {activeMode === 1 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-blue-600" />
                <span>Calculate percentage of a number:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>What is</span>
                <input
                  type="text"
                  value={m1Percent}
                  onChange={(e) => setM1Percent(e.target.value)}
                  className="w-24 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="15"
                />
                <span>% of</span>
                <input
                  type="text"
                  value={m1Total}
                  onChange={(e) => setM1Total(e.target.value)}
                  className="w-32 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="250"
                />
                <span>?</span>
              </div>
            </div>
          )}

          {/* MODE 2 */}
          {activeMode === 2 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-blue-600" />
                <span>Calculate what percentage one number is of another:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <input
                  type="text"
                  value={m2Part}
                  onChange={(e) => setM2Part(e.target.value)}
                  className="w-28 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="45"
                />
                <span>is what percentage of</span>
                <input
                  type="text"
                  value={m2Total}
                  onChange={(e) => setM2Total(e.target.value)}
                  className="w-32 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="180"
                />
                <span>?</span>
              </div>

              {r2?.error && <div className="text-xs text-red-600 dark:text-red-400 font-medium">{r2.error}</div>}
            </div>
          )}

          {/* MODE 3 */}
          {activeMode === 3 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-blue-600" />
                <span>Calculate percentage increase or decrease:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>From</span>
                <input
                  type="text"
                  value={m3From}
                  onChange={(e) => setM3From(e.target.value)}
                  className="w-28 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="80"
                />
                <span>to</span>
                <input
                  type="text"
                  value={m3To}
                  onChange={(e) => setM3To(e.target.value)}
                  className="w-28 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="120"
                />
              </div>

              {r3?.error && <div className="text-xs text-red-600 dark:text-red-400 font-medium">{r3.error}</div>}
            </div>
          )}

          {/* MODE 4 */}
          {activeMode === 4 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-blue-600" />
                <span>Find original value before percentage adjustment:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>Final value</span>
                <input
                  type="text"
                  value={m4Final}
                  onChange={(e) => setM4Final(e.target.value)}
                  className="w-28 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="115"
                />
                <span>after a</span>
                <input
                  type="text"
                  value={m4Percent}
                  onChange={(e) => setM4Percent(e.target.value)}
                  className="w-24 px-3 py-1.5 font-mono text-center bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="15"
                />
                <span>%</span>
                <select
                  value={m4Type}
                  onChange={(e) => setM4Type(e.target.value as 'increase' | 'decrease')}
                  className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-xs font-medium"
                >
                  <option value="increase">Increase (+)</option>
                  <option value="decrease">Decrease (-)</option>
                </select>
              </div>

              {r4?.error && <div className="text-xs text-red-600 dark:text-red-400 font-medium">{r4.error}</div>}
            </div>
          )}

          {/* Main Result Display Box */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Calculated Result
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 font-mono mt-1">
                {currentResultFormatted || '—'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!currentResultFormatted}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium border transition-colors ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white border-transparent'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Result'}</span>
              </button>
            </div>
          </div>

          {/* Formula Explanation Accordion */}
          {currentFormula && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowFormula(!showFormula)}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center gap-1 font-medium"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showFormula ? 'Hide Formula' : 'Show Formula & Math Explanation'}</span>
                {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showFormula && (
                <div className="mt-2 p-3 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1">
                  <div className="text-neutral-500 font-medium">Applied Formula:</div>
                  <div className="font-mono text-neutral-800 dark:text-neutral-200">{currentFormula}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
};

export default PercentageCalculatorTool;
