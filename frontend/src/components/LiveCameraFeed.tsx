// ==============================================================================
// File: src/components/LiveCameraFeed.tsx
// Description: Live MJPEG Camera Stream & YOLOv8 ROI Vision Overlay Component.
// Purpose: Renders non-blocking video feed from the laptop camera relay, overlays
//          the Region of Interest (ROI) pallet mask, and displays real-time
//          M/N-K load state machine results (loaded SKU, category, confidence).
// ==============================================================================

import React, { useState } from 'react';
import { Video, Eye, Camera, RefreshCw, Box, ShieldCheck } from 'lucide-react';

interface LiveCameraFeedProps {
  loadedSku?: string | null;
  forkliftStatus?: string;
  streamUrl?: string;
}

export const LiveCameraFeed: React.FC<LiveCameraFeedProps> = ({
  loadedSku,
  forkliftStatus = 'idle',
  streamUrl = '/api/camera/stream?fps=10',
}) => {
  const [showRoi, setShowRoi] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setStreamError(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Feed Controls Header */}
      <div className="flex items-center justify-between bg-gray-900/60 p-3 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-['Outfit'] font-semibold text-sm text-white flex items-center gap-2">
              ESP32-CAM Mast Stream
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                10 FPS RELAY
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              YOLOv8 Pallet & Load Detection Pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRoi(!showRoi)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showRoi
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            ROI Mask: {showRoi ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Reload Video Stream"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-gray-800 bg-black flex items-center justify-center shadow-xl">
        {!streamError ? (
          <img
            key={refreshKey}
            src={streamUrl}
            alt="Live Forklift Video Feed"
            onError={() => setStreamError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center p-6 text-gray-400">
            <Video className="h-10 w-10 text-gray-600 animate-pulse" />
            <p className="text-sm font-medium text-gray-300">
              Camera Stream Waiting or Offline
            </p>
            <p className="text-xs text-gray-500 max-w-xs">
              Verify ESP32-CAM is powered and configured with the laptop's IP address.
            </p>
            <button
              onClick={handleRefresh}
              className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Paper 3: Region of Interest (ROI) Pallet Mask Visual Bounding Box */}
        {showRoi && (
          <div
            className="absolute pointer-events-none border-2 border-emerald-400 bg-emerald-500/10 rounded-lg flex flex-col justify-between p-2 shadow-lg"
            style={{
              top: '35%',
              left: '5%',
              width: '90%',
              height: '60%',
            }}
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300 font-bold bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm self-start">
              <span>FORK REGION OF INTEREST (ROI)</span>
            </div>

            <div className="text-[10px] font-mono text-emerald-400/80 bg-black/50 px-1.5 py-0.5 rounded self-end">
              Paper 3 Masking [Y: 35-95%, X: 5-95%]
            </div>
          </div>
        )}

        {/* Live Detected Pallet / SKU Floating Badge */}
        <div className="absolute top-3 left-3 bg-gray-900/85 backdrop-blur-md border border-gray-700/80 rounded-xl px-3 py-2 flex items-center gap-3 shadow-xl">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            loadedSku ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400'
          }`}>
            <Box className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-medium block">
              M/N-K Load State Machine
            </span>
            <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
              {loadedSku ? (
                <>
                  <span className="text-amber-400">LOADED:</span> {loadedSku}
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  <span className="text-gray-300">FORKS UNLOADED (EMPTY)</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Live Watermark Overlay */}
        <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-mono text-gray-300 border border-white/10">
          REC • YOLOv8n ON-DEVICE
        </div>
      </div>
    </div>
  );
};
