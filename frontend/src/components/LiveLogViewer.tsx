// ==============================================================================
// File: src/components/LiveLogViewer.tsx
// Description: In-Dashboard Real-Time Log Viewer & Observability Terminal (Option A).
// Purpose: Fulfills Option A requirement. Streams live system events over WebSockets
//          into an interactive dark console. Provides severity filtering (DEBUG,
//          INFO, WARNING, ERROR), text search, auto-scroll lock, buffer clearing,
//          and full log file export without console.log spam.
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Search,
  Filter,
  Trash2,
  Download,
  ArrowDown,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { LogEntry } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';

export const LiveLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [totalInBuffer, setTotalInBuffer] = useState<number>(0);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);

  // Initial fetch of in-memory logs
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await api.getLogs('', '', 300);
        setLogs(res.logs || []);
        setTotalInBuffer(res.total_in_buffer || 0);
      } catch (e) {
        console.error('Failed to load initial logs:', e);
      }
    };
    fetchInitial();
  }, []);

  // Listen for real-time incoming log events over WebSocket
  useEffect(() => {
    const unsubscribe = socketService.onLogEvent((newEntry: LogEntry) => {
      if (isPaused) return;

      setLogs((prev) => {
        const next = [...prev, newEntry];
        if (next.length > 1000) {
          next.shift();
        }
        return next;
      });
      setTotalInBuffer((prev) => Math.min(1000, prev + 1));
    });

    return () => {
      unsubscribe();
    };
  }, [isPaused]);

  // Handle auto-scroll
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleClear = async () => {
    try {
      await api.clearLogs();
      setLogs([]);
      setTotalInBuffer(0);
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  };

  const handleDownload = () => {
    window.open('/api/logs/download', '_blank');
  };

  // Filtering
  const filteredLogs = logs.filter((entry) => {
    if (levelFilter && entry.level !== levelFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const msgMatch = entry.message.toLowerCase().includes(q);
      const modMatch = entry.module.toLowerCase().includes(q);
      if (!msgMatch && !modMatch) return false;
    }
    return true;
  });

  return (
    <div className="glass-panel rounded-2xl p-5 border border-gray-800 flex flex-col gap-4 shadow-2xl h-[700px]">
      {/* Terminal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-['Outfit'] font-bold text-lg text-white flex items-center gap-2">
              In-Dashboard Live Log Viewer
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                Option A Live Stream
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Buffered memory stream: <span className="font-mono text-gray-300 font-semibold">{totalInBuffer}</span> entries in RAM
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pause / Resume Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              autoScroll
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Export Disk Log */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-xs font-medium hover:text-white hover:bg-gray-700 transition-colors"
            title="Download full system.log file"
          >
            <Download className="h-3.5 w-3.5" />
            Download Log
          </button>

          {/* Clear Buffer */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search log messages or module tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Severity Level Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-900/80 p-1 rounded-xl border border-gray-800 text-xs">
          {[
            { label: 'ALL', value: '' },
            { label: 'DEBUG', value: 'DEBUG' },
            { label: 'INFO', value: 'INFO' },
            { label: 'WARNING', value: 'WARNING' },
            { label: 'ERROR', value: 'ERROR' },
          ].map((lvl) => (
            <button
              key={lvl.label}
              onClick={() => setLevelFilter(lvl.value)}
              className={`px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                levelFilter === lvl.value
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Console */}
      <div className="flex-1 bg-black/90 rounded-xl border border-gray-800/90 p-4 font-mono text-xs overflow-y-auto space-y-1.5 selection:bg-purple-900/50">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, index) => {
            const timeStr = log.timestamp
              ? new Date(log.timestamp).toLocaleTimeString()
              : '--:--:--';

            return (
              <div
                key={index}
                className="flex items-start gap-2.5 leading-relaxed hover:bg-white/[0.03] px-2 py-0.5 rounded transition-colors group"
              >
                {/* Timestamp */}
                <span className="text-gray-500 text-[11px] select-none shrink-0 font-mono">
                  [{timeStr}]
                </span>

                {/* Level Tag Badge */}
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider ${
                    log.level === 'ERROR'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : log.level === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : log.level === 'DEBUG'
                      ? 'bg-gray-700/40 text-gray-400 border border-gray-700'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {log.level}
                </span>

                {/* Module Scope */}
                <span className="text-purple-400 font-semibold shrink-0">
                  [{log.module}]
                </span>

                {/* Message */}
                <span
                  className={`flex-1 break-all ${
                    log.level === 'ERROR'
                      ? 'text-rose-300 font-medium'
                      : log.level === 'WARNING'
                      ? 'text-amber-200'
                      : 'text-gray-200'
                  }`}
                >
                  {log.message}
                </span>

                {/* Attached metadata preview */}
                {log.data && Object.keys(log.data).length > 0 && (
                  <span className="text-gray-500 text-[10px] shrink-0 font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                    {JSON.stringify(log.data)}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Terminal className="h-8 w-8 mb-2 text-gray-600" />
            <p>No log records match the current filter.</p>
          </div>
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
};
