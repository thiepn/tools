import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock, Copy, Regex as RegexIcon, ShieldCheck, Trash2 } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import { copyToClipboard } from '../../utilities/clipboard';
import {
  analyzeRegexFeatures,
  testRegex,
  testRegexWithTimeout,
  type RegexFlags,
  type RegexTestResult,
} from '../../utilities/regex-tester';

interface RegexTesterToolProps { initialText?: string }
const SAMPLE_PATTERN = '(?<protocol>https?)://(?<domain>[a-zA-Z0-9.-]+)(?<path>/[\\w.-]*)*';
const SAMPLE_TEXT = `Welcome to Tiny Tools!\nVisit https://example.com/docs or http://api.service.org/v1/status for documentation.\nAlso check out https://github.com/repository-name.`;
const SAMPLE_REPLACEMENT = '[$<protocol>://$<domain>]';
const DEFAULT_FLAGS: RegexFlags = { global: true, ignoreCase: true, multiline: true, dotAll: false, unicode: true, sticky: false };

export const RegexTesterTool: React.FC<RegexTesterToolProps> = ({ initialText = '' }) => {
  const [pattern, setPattern] = useState(SAMPLE_PATTERN);
  const [flags, setFlags] = useState<RegexFlags>(DEFAULT_FLAGS);
  const [text, setText] = useState(initialText || SAMPLE_TEXT);
  const [replacement, setReplacement] = useState(SAMPLE_REPLACEMENT);
  const [result, setResult] = useState<RegexTestResult>(() => testRegex(SAMPLE_PATTERN, DEFAULT_FLAGS, initialText || SAMPLE_TEXT, SAMPLE_REPLACEMENT));
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const features = useMemo(() => analyzeRegexFeatures(pattern), [pattern]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setRunning(true);
      void testRegexWithTimeout(pattern, flags, text, replacement, 300).then((next) => {
        if (!active) return;
        setResult(next);
        setRunning(false);
      });
    }, 90);
    return () => { active = false; window.clearTimeout(timer); };
  }, [pattern, flags, text, replacement]);

  const toggle = (key: keyof RegexFlags) => setFlags((current) => ({ ...current, [key]: !current[key] }));
  const reset = () => { setPattern(SAMPLE_PATTERN); setFlags(DEFAULT_FLAGS); setText(SAMPLE_TEXT); setReplacement(SAMPLE_REPLACEMENT); };
  const clear = () => { setPattern(''); setText(''); setReplacement(''); };
  const copyReplacement = async () => {
    if (!result.replacementPreview) return;
    if (await copyToClipboard(result.replacementPreview)) { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  };

  return (
    <ToolShell
      toolId="regex-tester"
      title="Regex Tester & Debugger"
      description="Test regular expressions in an isolated worker with a hard execution timeout, captured groups, replacement previews, risk analysis, and engine-feature inspection."
      category="developer"
      relatedToolIds={['json-formatter', 'encoding-tools', 'text-cleaner']}
      outputToTransfer={result.replacementPreview}
    >
      <div className="space-y-5">
        <div className="p-4 border rounded-xl bg-neutral-50 dark:bg-neutral-950 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="regex-pattern-input" className="text-xs font-semibold flex items-center gap-1.5"><RegexIcon className="w-4 h-4" />Regular Expression Pattern</label>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" />Worker-isolated · 300 ms timeout</span>
              <button type="button" onClick={reset} className="underline text-neutral-500">Load example</button>
              <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-red-600"><Trash2 className="w-3 h-3" />Clear</button>
            </div>
          </div>
          <div className="flex items-stretch gap-2">
            <span className="px-3 flex items-center rounded-l-lg border bg-white dark:bg-neutral-900 font-mono text-neutral-400">/</span>
            <input id="regex-pattern-input" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} className="flex-1 min-w-0 p-2.5 border-y bg-white dark:bg-neutral-900 font-mono text-sm" />
            <span className="px-3 flex items-center rounded-r-lg border bg-white dark:bg-neutral-900 font-mono text-neutral-400">/{Object.entries(flags).filter(([,v]) => v).map(([k]) => ({global:'g',ignoreCase:'i',multiline:'m',dotAll:'s',unicode:'u',sticky:'y'}[k])).join('')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {([['global','g'],['ignoreCase','i'],['multiline','m'],['dotAll','s'],['unicode','u'],['sticky','y']] as const).map(([key,label]) => (
              <label key={key} className="px-2 py-1 border rounded text-xs cursor-pointer"><input type="checkbox" checked={flags[key]} onChange={() => toggle(key)} className="mr-1.5" />{label}</label>
            ))}
          </div>
        </div>

        {(result.risk.warnings.length > 0 || Object.values(features).some(Boolean)) && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className={`p-3 border rounded-lg text-xs ${result.risk.level === 'high' ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'}`}>
              <div className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Static risk: {result.risk.level}</div>
              {result.risk.warnings.map((warning) => <div key={warning} className="mt-1">• {warning}</div>)}
            </div>
            <div className="p-3 border rounded-lg text-xs"><strong>Engine features:</strong> {Object.entries(features).filter(([,enabled]) => enabled).map(([name]) => name).join(', ') || 'basic regular expression'}</div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          <label className="space-y-1 text-xs font-semibold">Test text<textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} spellCheck={false} className="w-full mt-1 p-3 border rounded-xl bg-white dark:bg-neutral-900 font-mono text-xs font-normal" /></label>
          <div className="space-y-3">
            <label className="block text-xs font-semibold">Replacement<input value={replacement} onChange={(e) => setReplacement(e.target.value)} className="block w-full mt-1 p-2.5 border rounded-lg bg-white dark:bg-neutral-900 font-mono font-normal" /></label>
            <div className="p-3 border rounded-xl min-h-24 text-xs">
              <div className="flex justify-between"><strong>Execution</strong><span className="font-mono inline-flex gap-1"><Clock className="w-3 h-3" />{running ? 'running…' : `${result.executionTimeMs} ms`}</span></div>
              {result.error ? <div className="text-red-600 mt-2">{result.error}</div> : <div className="mt-2">{result.matchCount} match{result.matchCount === 1 ? '' : 'es'}{result.isTruncated ? ' (truncated)' : ''}</div>}
            </div>
            <div className="max-h-56 overflow-auto border rounded-xl divide-y">
              {result.matches.length ? result.matches.map((match, index) => <div key={`${match.index}-${index}`} className="p-2.5 text-xs"><div className="font-mono font-semibold">{match.index}–{match.endIndex}: {JSON.stringify(match.match)}</div>{match.groups.length > 0 && <div className="text-neutral-500 mt-1">Groups: {match.groups.map((g) => JSON.stringify(g)).join(', ')}</div>}{match.namedGroups && <div className="text-neutral-500">Named: {JSON.stringify(match.namedGroups)}</div>}</div>) : <div className="p-4 text-xs text-neutral-500">No matches.</div>}
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-xl space-y-2">
          <div className="flex justify-between items-center"><strong className="text-xs">Replacement preview</strong><button type="button" onClick={copyReplacement} className="text-xs inline-flex gap-1 items-center">{copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied' : 'Copy'}</button></div>
          <pre className="whitespace-pre-wrap break-words text-xs font-mono bg-neutral-50 dark:bg-neutral-950 p-3 rounded-lg max-h-56 overflow-auto">{result.replacementPreview}</pre>
        </div>
      </div>
    </ToolShell>
  );
};

export default RegexTesterTool;
