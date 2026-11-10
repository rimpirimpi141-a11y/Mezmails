import React, { useMemo, useState } from 'react';
import { INDEX_JS_SOURCE, WRANGLER_TOML_SOURCE } from '../data/workerSource';
import { Copy, Check, Download, FileCode, Search, Settings } from 'lucide-react';

export const WorkerCodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'index.js' | 'wrangler.toml'>('index.js');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeSource = activeFile === 'index.js' ? INDEX_JS_SOURCE : WRANGLER_TOML_SOURCE;
  const lines = useMemo(() => activeSource.split('\n'), [activeSource]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const mime =
      activeFile === 'index.js' ? 'text/javascript;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([activeSource], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchingLineNumbers = useMemo(() => {
    if (!searchQuery.trim()) return new Set<number>();
    const q = searchQuery.toLowerCase();
    const set = new Set<number>();
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(q)) {
        set.add(idx + 1);
      }
    });
    return set;
  }, [lines, searchQuery]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveFile('index.js');
              setSearchQuery('');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeFile === 'index.js'
                ? 'bg-sky-950 text-sky-300 border border-sky-700'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span>index.js (Pure Serverless Worker)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFile('wrangler.toml');
              setSearchQuery('');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeFile === 'wrangler.toml'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span>wrangler.toml (No Static Assets)</span>
          </button>

          {activeFile === 'index.js' && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 ml-1">
              <span>Jump Filter:</span>
              {[
                { label: '7-Row Admin Keyboard', query: 'getAdminPanelKeyboard' },
                { label: 'Buy Gmail Marketplace', query: '🛒 Buy Gmail' },
                { label: 'Sell Gmail Flow', query: '📤 Sell Gmail' },
                { label: 'Approve & Pay Seller', query: 'sell_approve:' },
                { label: 'Approve & Dispatch Stock', query: 'order_approve:' },
                { label: 'UPI Withdrawals (₹)', query: 'AWAITING_UPI_WITHDRAW_AMOUNT' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSearchQuery(searchQuery === item.query ? '' : item.query)}
                  className={`px-2 py-1 rounded text-xs transition-colors whitespace-nowrap shrink-0 ${
                    searchQuery === item.query
                      ? 'bg-sky-950 text-sky-300 border border-sky-700'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeFile}...`}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44"
            />
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied {activeFile}!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy {activeFile}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {activeFile}</span>
          </button>
        </div>
      </div>

      {searchQuery && (
        <div className="px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Found <strong className="text-sky-400 font-mono">{matchingLineNumbers.size}</strong> matching
            lines for <code className="text-white font-mono">"{searchQuery}"</code>
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-sky-400 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Code Viewport */}
      <div className="max-h-[640px] overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isMatch = matchingLineNumbers.has(lineNum);
              return (
                <tr
                  key={lineNum}
                  className={`${
                    isMatch ? 'bg-sky-950/60 text-sky-100' : 'hover:bg-slate-900/50 text-slate-300'
                  }`}
                >
                  <td className="select-none pr-4 text-right text-slate-600 w-12 align-top tabular-nums">
                    {lineNum}
                  </td>
                  <td className="whitespace-pre overflow-x-auto">{line || ' '}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
