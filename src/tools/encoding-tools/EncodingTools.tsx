import React, { useState } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Globe,
  Plus,
  Binary,
  ListOrdered,
  AlertTriangle,
} from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  utf8ToBase64,
  base64ToUtf8,
  urlEncodeComponent,
  urlDecodeComponent,
  urlEncodeFull,
  urlDecodeFull,
  parseQueryString,
  buildQueryString,
  type QueryParamItem,
} from '../../utilities/encoding-tools';
import { copyToClipboard } from '../../utilities/clipboard';

interface EncodingToolsProps {
  initialText?: string;
}

export const EncodingTools: React.FC<EncodingToolsProps> = ({ initialText = '' }) => {
  const [activeTab, setActiveTab] = useState<'url' | 'params' | 'base64'>('url');

  // Tab 1: URL Encode / Decode
  const [urlInput, setUrlInput] = useState(initialText || 'https://example.com/search?q=hello world & science=100%');
  const [urlMode, setUrlMode] = useState<'component' | 'full'>('component');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  // Tab 2: Query Params
  const [rawUrlForParams, setRawUrlForParams] = useState(
    'https://api.service.com/v2/items?category=books&tag=featured&tag=new&limit=25&sort=desc'
  );
  const [parsedParams, setParsedParams] = useState<{ baseUrl: string; params: QueryParamItem[] }>(() =>
    parseQueryString('https://api.service.com/v2/items?category=books&tag=featured&tag=new&limit=25&sort=desc')
  );
  const [paramsCopied, setParamsCopied] = useState(false);

  // Tab 3: Base64
  const [b64Input, setB64Input] = useState('Tiny Tools: UTF-8 & Unicode support 🚀 (こんにちは)');
  const [b64Output, setB64Output] = useState('');
  const [b64Error, setB64Error] = useState<string | null>(null);
  const [b64Copied, setB64Copied] = useState(false);

  // Calculate URL Output
  const urlOutput = React.useMemo(() => {
    setUrlError(null);
    if (!urlInput) return '';
    return urlMode === 'component' ? urlEncodeComponent(urlInput) : urlEncodeFull(urlInput);
  }, [urlInput, urlMode]);

  const handleUrlDecode = () => {
    if (!urlInput) return;
    const res = urlMode === 'component' ? urlDecodeComponent(urlInput) : urlDecodeFull(urlInput);
    if (res.error) {
      setUrlError(res.error);
    } else if (res.result !== undefined) {
      setUrlInput(res.result);
      setUrlError(null);
    }
  };

  const handleUrlEncode = () => {
    if (!urlInput) return;
    const res = urlMode === 'component' ? urlEncodeComponent(urlInput) : urlEncodeFull(urlInput);
    setUrlInput(res);
    setUrlError(null);
  };

  const handleParseQueryUrl = (val: string) => {
    setRawUrlForParams(val);
    setParsedParams(parseQueryString(val));
  };

  const handleUpdateParamKey = (id: string, newKey: string) => {
    const updated = parsedParams.params.map((p) => (p.id === id ? { ...p, key: newKey } : p));
    const newParsed = { ...parsedParams, params: updated };
    setParsedParams(newParsed);
    setRawUrlForParams(buildQueryString(newParsed.baseUrl, newParsed.params));
  };

  const handleUpdateParamValue = (id: string, newVal: string) => {
    const updated = parsedParams.params.map((p) => (p.id === id ? { ...p, value: newVal } : p));
    const newParsed = { ...parsedParams, params: updated };
    setParsedParams(newParsed);
    setRawUrlForParams(buildQueryString(newParsed.baseUrl, newParsed.params));
  };

  const handleAddParam = () => {
    const newItem: QueryParamItem = {
      id: `param-${Date.now()}`,
      key: 'key',
      value: 'value',
    };
    const updated = [...parsedParams.params, newItem];
    const newParsed = { ...parsedParams, params: updated };
    setParsedParams(newParsed);
    setRawUrlForParams(buildQueryString(newParsed.baseUrl, newParsed.params));
  };

  const handleRemoveParam = (id: string) => {
    const updated = parsedParams.params.filter((p) => p.id !== id);
    const newParsed = { ...parsedParams, params: updated };
    setParsedParams(newParsed);
    setRawUrlForParams(buildQueryString(newParsed.baseUrl, newParsed.params));
  };

  const handleEncodeBase64 = () => {
    setB64Error(null);
    const res = utf8ToBase64(b64Input);
    if (res.error) {
      setB64Error(res.error);
    } else if (res.result !== undefined) {
      setB64Output(res.result);
    }
  };

  const handleDecodeBase64 = () => {
    setB64Error(null);
    const res = base64ToUtf8(b64Input);
    if (res.error) {
      setB64Error(res.error);
    } else if (res.result !== undefined) {
      setB64Output(res.result);
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(urlOutput || urlInput);
    if (success) {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  };

  const handleCopyParamsUrl = async () => {
    const success = await copyToClipboard(rawUrlForParams);
    if (success) {
      setParamsCopied(true);
      setTimeout(() => setParamsCopied(false), 2000);
    }
  };

  const handleCopyB64 = async () => {
    const success = await copyToClipboard(b64Output);
    if (success) {
      setB64Copied(true);
      setTimeout(() => setB64Copied(false), 2000);
    }
  };

  return (
    <ToolShell
      toolId="encoding-tools"
      title="URL & Base64 Tools"
      description="Encode and decode URLs, inspect and edit query string parameters, and convert UTF-8 text to Base64."
      category="developer"
      relatedToolIds={['json-formatter', 'regex-tester', 'text-cleaner']}
      outputToTransfer={activeTab === 'base64' ? b64Output : activeTab === 'url' ? urlOutput : rawUrlForParams}
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'url'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>URL Encode / Decode</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'params'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Query Parameter Parser</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('base64')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'base64'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Binary className="w-4 h-4" />
            <span>Base64 (UTF-8 Safe)</span>
          </button>
        </div>

        {/* TAB 1: URL Encode / Decode */}
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="urlMode"
                    checked={urlMode === 'component'}
                    onChange={() => setUrlMode('component')}
                    className="text-blue-600"
                  />
                  <span>Component (encodeURIComponent)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="urlMode"
                    checked={urlMode === 'full'}
                    onChange={() => setUrlMode('full')}
                    className="text-blue-600"
                  />
                  <span>Full URI (encodeURI)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUrlEncode}
                  className="px-2.5 py-1 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity"
                >
                  Encode In-Place
                </button>
                <button
                  type="button"
                  onClick={handleUrlDecode}
                  className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Decode In-Place
                </button>
              </div>
            </div>

            {urlError && (
              <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{urlError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Input URL / Text</span>
                  {urlInput && (
                    <button
                      type="button"
                      onClick={() => setUrlInput('')}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  rows={8}
                  placeholder="Enter URL or string to encode/decode..."
                  className="w-full p-3 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Live Encoded Output</span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    disabled={!urlOutput}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                      urlCopied
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    }`}
                  >
                    {urlCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{urlCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  value={urlOutput}
                  readOnly
                  rows={8}
                  className="w-full p-3 font-mono text-sm bg-neutral-100/70 dark:bg-neutral-950/80 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none resize-y text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Query Parameter Parser */}
        {activeTab === 'params' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Full URL or Query String
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rawUrlForParams}
                  onChange={(e) => handleParseQueryUrl(e.target.value)}
                  placeholder="https://example.com/api?key1=value1&key2=value2"
                  className="flex-1 px-3 py-2 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={handleCopyParamsUrl}
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded text-xs font-medium border transition-colors ${
                    paramsCopied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800'
                  }`}
                >
                  {paramsCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{paramsCopied ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>
            </div>

            {/* Parsed Key-Value List */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <span className="font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Parameters ({parsedParams.params.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddParam}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Parameter
                </button>
              </div>

              {parsedParams.params.length === 0 ? (
                <div className="text-xs text-neutral-400 italic py-4 text-center">
                  No query parameters found in the string above.
                </div>
              ) : (
                <div className="space-y-2">
                  {parsedParams.params.map((param) => (
                    <div key={param.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="text"
                        value={param.key}
                        onChange={(e) => handleUpdateParamKey(param.id, e.target.value)}
                        placeholder="Key"
                        className="w-1/3 px-2.5 py-1.5 font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-neutral-400 font-mono">=</span>
                      <input
                        type="text"
                        value={param.value}
                        onChange={(e) => handleUpdateParamValue(param.id, e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-2.5 py-1.5 font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveParam(param.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        title="Delete parameter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Base64 */}
        {activeTab === 'base64' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs">
              <span className="text-neutral-600 dark:text-neutral-400 font-medium">
                Full UTF-8 support (emojis, Japanese, Arabic, and Unicode safe)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEncodeBase64}
                  className="px-3 py-1.5 rounded bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity"
                >
                  Text → Base64
                </button>
                <button
                  type="button"
                  onClick={handleDecodeBase64}
                  className="px-3 py-1.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Base64 → Text
                </button>
              </div>
            </div>

            {b64Error && (
              <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{b64Error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Input String</span>
                  {b64Input && (
                    <button
                      type="button"
                      onClick={() => setB64Input('')}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={b64Input}
                  onChange={(e) => setB64Input(e.target.value)}
                  rows={8}
                  placeholder="Enter text or Base64 string here..."
                  className="w-full p-3 font-mono text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Result</span>
                  <button
                    type="button"
                    onClick={handleCopyB64}
                    disabled={!b64Output}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                      b64Copied
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    }`}
                  >
                    {b64Copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{b64Copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  value={b64Output}
                  readOnly
                  rows={8}
                  placeholder="Converted result will appear here..."
                  className="w-full p-3 font-mono text-sm bg-neutral-100/70 dark:bg-neutral-950/80 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none resize-y text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default EncodingTools;
