import React, { useState, useMemo } from 'react';
import { AlignLeft, Trash2, Settings2, Clock, BarChart2 } from 'lucide-react';
import { ToolShell } from '../../components/tool-shell/ToolShell';
import {
  countWordsAndStats,
  formatTimeEstimate,
  defaultCounterSettings,
  type WordCounterSettings,
} from '../../utilities/word-counter';

interface WordCounterToolProps {
  initialText?: string;
}

const SAMPLE_ESSAY = `The greatest glory in living lies not in never falling, but in rising every time we fall. The way to get started is to quit talking and begin doing. Your time is limited, so don't waste it living someone else's life.

If life were predictable it would cease to be life, and be without flavor. In the end, it's not the years in your life that count. It's the life in your years.`;

export const WordCounterTool: React.FC<WordCounterToolProps> = ({ initialText = '' }) => {
  const [text, setText] = useState(initialText || '');
  const [settings, setSettings] = useState<WordCounterSettings>(defaultCounterSettings);
  const [showSettings, setShowSettings] = useState(false);

  const stats = useMemo(() => {
    return countWordsAndStats(text, settings);
  }, [text, settings]);

  return (
    <ToolShell
      toolId="word-counter"
      title="Word & Character Counter"
      description="Live count of words, characters, sentences, reading and speaking times, and keyword density."
      category="text"
      relatedToolIds={['text-cleaner', 'case-converter', 'list-processor']}
      outputToTransfer={text}
    >
      <div className="space-y-6">
        {/* Top Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.words.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
              Words
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.charactersWithSpaces.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
              Characters
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.charactersWithoutSpaces.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
              No Spaces
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.sentences.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
              Sentences
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.paragraphs.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
              Paragraphs
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {stats.lines.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mt-0.5">
              Lines
            </div>
          </div>
        </div>

        {/* Input Text Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="word-counter-input" className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5" />
              Content Area
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setText(SAMPLE_ESSAY)}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
              >
                Load example
              </button>
              {text.length > 0 && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            id="word-counter-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here to see real-time word count, reading estimates, and statistics..."
            rows={8}
            className="w-full p-3 font-sans text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-y"
          />
        </div>

        {/* Reading Time and In-Depth Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Time & Structural Insights */}
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                Reading & Structure
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <Settings2 className="w-3 h-3" />
                {showSettings ? 'Hide speeds' : 'Adjust WPM'}
              </button>
            </div>

            {showSettings && (
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
                <div>
                  <label className="block text-neutral-500 mb-1">Reading WPM</label>
                  <input
                    type="number"
                    min={50}
                    max={600}
                    value={settings.readingWpm}
                    onChange={(e) => setSettings({ ...settings, readingWpm: parseInt(e.target.value, 10) || 200 })}
                    className="w-full px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 mb-1">Speaking WPM</label>
                  <input
                    type="number"
                    min={40}
                    max={400}
                    value={settings.speakingWpm}
                    onChange={(e) => setSettings({ ...settings, speakingWpm: parseInt(e.target.value, 10) || 130 })}
                    className="w-full px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500">Reading Time</div>
                <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {formatTimeEstimate(stats.readingTimeSeconds)}
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  at {settings.readingWpm} wpm
                </div>
              </div>

              <div className="p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500">Speaking Time</div>
                <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {formatTimeEstimate(stats.speakingTimeSeconds)}
                </div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  at {settings.speakingWpm} wpm
                </div>
              </div>

              <div className="p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500">Unique Words</div>
                <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {stats.uniqueWords.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500">Avg Word Length</div>
                <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {stats.averageWordLength} chars
                </div>
              </div>
            </div>

            {stats.longestWord && (
              <div className="text-xs pt-1 text-neutral-600 dark:text-neutral-400">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">Longest Word: </span>
                <span className="font-mono text-neutral-900 dark:text-neutral-100 bg-neutral-200/60 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                  {stats.longestWord} ({stats.longestWord.length} chars)
                </span>
              </div>
            )}
          </div>

          {/* Keyword Frequency Density */}
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-neutral-500" />
                Top Word Frequencies
              </span>
              <span className="text-[11px] text-neutral-400">Top 10</span>
            </div>

            {stats.topWords.length === 0 ? (
              <div className="text-xs text-neutral-400 italic py-6 text-center">
                Enter text above to see word frequency distribution.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {stats.topWords.map((item, idx) => (
                  <div
                    key={item.word}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400 w-4 text-right font-mono text-[10px]">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-neutral-800 dark:text-neutral-200">
                        {item.word}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                        {item.count}×
                      </span>
                      <span className="text-[10px] text-neutral-400 w-10 text-right">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default WordCounterTool;
