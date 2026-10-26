// ==============================================================================
// File: src/components/WarehouseCanvas.tsx
// Description: Interactive 2D Warehouse Spatial Canvas with 60 FPS Lerp Smoothing.
// Purpose: Renders continuous forklift tracking with heading vectors, fixed BLE
//          anchors, historical breadcrumbs, arbitrary polygon danger zones, and
//          supports interactive click-to-draw polygon zone creation.
// ==============================================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ForkliftPosition,
  WarehouseZone,
  GatewayNode,
  ZonePoint,
} from '../types';
import { Plus, Check, X, Eye, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface WarehouseCanvasProps {
  forkliftPos: ForkliftPosition | null;
  zones: WarehouseZone[];
  gateways: GatewayNode[];
  onOpenCreateZoneModal: (points: ZonePoint[]) => void;
  warehouseWidthMeters?: number;
  warehouseHeightMeters?: number;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  forkliftPos,
  zones,
  gateways,
  onOpenCreateZoneModal,
  warehouseWidthMeters = 10.0,
  warehouseHeightMeters = 10.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Smooth interpolated position state for 60 FPS rendering
  const renderPosRef = useRef({ x: 2.5, y: 2.5, angle: 0 });
  const trailHistoryRef = useRef<{ x: number; y: number }[]>([]);

  // Interactive Polygon Creation Mode
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<ZonePoint[]>([]);
  const [cursorPos, setCursorPos] = useState<ZonePoint | null>(null);

  // Canvas View Controls
  const [showTrail, setShowTrail] = useState(true);
  const [showGateways, setShowGateways] = useState(true);
  const [showZones, setShowZones] = useState(true);

  // Update target coordinates & append to trail
  useEffect(() => {
    if (forkliftPos) {
      const last = trailHistoryRef.current[trailHistoryRef.current.length - 1];
      if (!last || Math.hypot(last.x - forkliftPos.x, last.y - forkliftPos.y) > 0.15) {
        trailHistoryRef.current.push({ x: forkliftPos.x, y: forkliftPos.y });
        if (trailHistoryRef.current.length > 80) {
          trailHistoryRef.current.shift();
        }
      }
    }
  }, [forkliftPos]);

  // Main 60 FPS Canvas Rendering Animation Loop with Lerp
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Coordinate transformation helpers: meters -> canvas pixels
      const scaleX = width / warehouseWidthMeters;
      const scaleY = height / warehouseHeightMeters;

      const toCanvasX = (mX: number) => mX * scaleX;
      // Invert Y so (0,0) is bottom-left or top-left standard
      const toCanvasY = (mY: number) => height - mY * scaleY;

      // -----------------------------------------------------------------------
      // 1. Clear & Background Grid
      // -----------------------------------------------------------------------
      ctx.clearRect(0, 0, width, height);

      // Dark floor fill
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);

      // Meter Grid Lines
      ctx.lineWidth = 1;
      for (let m = 0; m <= warehouseWidthMeters; m += 1.0) {
        const cx = toCanvasX(m);
        ctx.strokeStyle = m % 5 === 0 ? 'rgba(75, 85, 99, 0.35)' : 'rgba(55, 65, 81, 0.15)';
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();

        // Meter coordinate labels
        if (m % 2 === 0) {
          ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
          ctx.font = '10px monospace';
          ctx.fillText(`${m}m`, cx + 4, height - 6);
        }
      }

      for (let m = 0; m <= warehouseHeightMeters; m += 1.0) {
        const cy = toCanvasY(m);
        ctx.strokeStyle = m % 5 === 0 ? 'rgba(75, 85, 99, 0.35)' : 'rgba(55, 65, 81, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.stroke();

        if (m % 2 === 0 && m > 0) {
          ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
          ctx.font = '10px monospace';
          ctx.fillText(`${m}m`, 6, cy - 4);
        }
      }

      // -----------------------------------------------------------------------
      // 2. Render Warehouse Zones (Danger, Loading, Storage)
      // -----------------------------------------------------------------------
      if (showZones) {
        zones.forEach((zone) => {
          if (!zone.is_active || zone.points.length < 3) return;

          ctx.save();
          ctx.beginPath();
          const first = zone.points[0];
          ctx.moveTo(toCanvasX(first.x), toCanvasY(first.y));

          for (let i = 1; i < zone.points.length; i++) {
            const p = zone.points[i];
            ctx.lineTo(toCanvasX(p.x), toCanvasY(p.y));
          }
          ctx.closePath();

          // Fill with semi-transparent color
          const hex = zone.color || '#ef4444';
          ctx.fillStyle = hex + '25'; // ~15% opacity fill
          ctx.fill();

          // Stroke border
          ctx.strokeStyle = hex;
          ctx.lineWidth = zone.zone_type === 'danger' ? 2 : 1.5;
          if (zone.zone_type === 'danger') {
            ctx.setLineDash([6, 4]); // Dashed hazard outline
          }
          ctx.stroke();

          // Zone Title Tag
          const centerMeters = {
            x: (zone.bounding_box.min_x + zone.bounding_box.max_x) / 2,
            y: (zone.bounding_box.min_y + zone.bounding_box.max_y) / 2,
          };
          ctx.fillStyle = hex;
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(zone.name.toUpperCase(), toCanvasX(centerMeters.x), toCanvasY(centerMeters.y));

          ctx.restore();
        });
      }

      // -----------------------------------------------------------------------
      // 3. Render Historical Breadcrumb Trail
      // -----------------------------------------------------------------------
      if (showTrail && trailHistoryRef.current.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const trail = trailHistoryRef.current;
        for (let i = 0; i < trail.length; i++) {
          const pt = trail[i];
          const cx = toCanvasX(pt.x);
          const cy = toCanvasY(pt.y);
          if (i === 0) {
            ctx.moveTo(cx, cy);
          } else {
            ctx.lineTo(cx, cy);
          }
        }
        ctx.stroke();

        // Render point dots
        trail.forEach((pt, idx) => {
          const alpha = (idx + 1) / trail.length;
          ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.7})`;
          ctx.beginPath();
          ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // -----------------------------------------------------------------------
      // 4. Render Fixed BLE Gateway Phone Anchors
      // -----------------------------------------------------------------------
      if (showGateways) {
        gateways.forEach((gw) => {
          const gx = toCanvasX(gw.position.x);
          const gy = toCanvasY(gw.position.y);

          ctx.save();
          // Radar ring
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(gx, gy, 18, 0, Math.PI * 2);
          ctx.stroke();

          // Center anchor dot
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(gx, gy, 5, 0, Math.PI * 2);
          ctx.fill();

          // Gateway label
          ctx.fillStyle = '#93c5fd';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(gw.name || gw.gateway_id, gx, gy - 9);
          ctx.restore();
        });
      }

      // -----------------------------------------------------------------------
      // 5. Interpolate & Render Forklift (Lerp Smoothing)
      // -----------------------------------------------------------------------
      const targetX = forkliftPos ? forkliftPos.x : renderPosRef.current.x;
      const targetY = forkliftPos ? forkliftPos.y : renderPosRef.current.y;

      // Lerp factor (0.15 gives fluid motion without lag)
      const lerpSpeed = 0.15;
      const cur = renderPosRef.current;
      const dx = targetX - cur.x;
      const dy = targetY - cur.y;

      cur.x += dx * lerpSpeed;
      cur.y += dy * lerpSpeed;

      // Update orientation heading angle if moving
      if (Math.hypot(dx, dy) > 0.01) {
        cur.angle = Math.atan2(dy, dx);
      }

      const fx = toCanvasX(cur.x);
      const fy = toCanvasY(cur.y);

      ctx.save();
      ctx.translate(fx, fy);

      // Glowing aura
      const auraGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
      auraGrad.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
      auraGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      // Heading direction vector arrow
      ctx.rotate(-cur.angle); // Rotate to heading
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();

      // Arrow tip
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(14, -5);
      ctx.lineTo(14, 5);
      ctx.closePath();
      ctx.fill();

      // Forklift Body Icon / Shape
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-10, -8, 20, 16, 4);
      ctx.fill();
      ctx.stroke();

      // Front Forks
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(10, -6, 6, 2.5);
      ctx.fillRect(10, 3.5, 6, 2.5);

      ctx.restore();

      // Forklift text badge
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const statusText = forkliftPos?.status ? ` [${forkliftPos.status.toUpperCase()}]` : '';
      ctx.fillText(`Forklift #1${statusText}`, fx, fy - 26);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px monospace';
      ctx.fillText(`(${cur.x.toFixed(1)}m, ${cur.y.toFixed(1)}m) | ${forkliftPos?.speed_mps.toFixed(1) || '0.0'} m/s`, fx, fy - 14);

      // -----------------------------------------------------------------------
      // 6. Interactive Polygon Drawing Overlay
      // -----------------------------------------------------------------------
      if (isDrawingZone && drawingPoints.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';

        ctx.beginPath();
        const start = drawingPoints[0];
        ctx.moveTo(toCanvasX(start.x), toCanvasY(start.y));

        for (let i = 1; i < drawingPoints.length; i++) {
          const pt = drawingPoints[i];
          ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }

        // Draw line to current mouse position
        if (cursorPos) {
          ctx.lineTo(toCanvasX(cursorPos.x), toCanvasY(cursorPos.y));
        }

        ctx.stroke();

        // Draw vertex dots
        drawingPoints.forEach((pt, i) => {
          ctx.fillStyle = i === 0 ? '#10b981' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(toCanvasX(pt.x), toCanvasY(pt.y), i === 0 ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        });

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    forkliftPos,
    zones,
    gateways,
    isDrawingZone,
    drawingPoints,
    cursorPos,
    showTrail,
    showGateways,
    showZones,
    warehouseWidthMeters,
    warehouseHeightMeters,
  ]);

  // Click handler on canvas for placing zone vertices
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingZone) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    // Convert pixel coordinates back to warehouse meters
    const meterX = parseFloat(((pixelX / canvas.width) * warehouseWidthMeters).toFixed(2));
    const meterY = parseFloat((((canvas.height - pixelY) / canvas.height) * warehouseHeightMeters).toFixed(2));

    // Check if clicked near the starting point to auto-close polygon
    if (drawingPoints.length >= 3) {
      const first = drawingPoints[0];
      const dist = Math.hypot(first.x - meterX, first.y - meterY);
      if (dist < 0.6) {
        // Complete polygon!
        finishDrawingZone(drawingPoints);
        return;
      }
    }

    setDrawingPoints((prev) => [...prev, { x: meterX, y: meterY }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingZone) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    const meterX = parseFloat(((pixelX / canvas.width) * warehouseWidthMeters).toFixed(2));
    const meterY = parseFloat((((canvas.height - pixelY) / canvas.height) * warehouseHeightMeters).toFixed(2));
    setCursorPos({ x: meterX, y: meterY });
  };

  const finishDrawingZone = (points: ZonePoint[]) => {
    if (points.length < 3) return;
    setIsDrawingZone(false);
    setDrawingPoints([]);
    setCursorPos(null);
    onOpenCreateZoneModal(points);
  };

  const cancelDrawingZone = () => {
    setIsDrawingZone(false);
    setDrawingPoints([]);
    setCursorPos(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Canvas Header & Interactive Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/60 p-3 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-['Outfit'] font-semibold text-sm text-white">
            Warehouse Floor Layout (2D)
          </span>
          <span className="text-xs text-gray-400 font-mono">
            {warehouseWidthMeters}m × {warehouseHeightMeters}m
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isDrawingZone ? (
            <button
              onClick={() => setIsDrawingZone(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Draw Danger Zone
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400 font-medium animate-pulse">
                Click map to add points ({drawingPoints.length} added). Click start to close.
              </span>
              <button
                onClick={() => finishDrawingZone(drawingPoints)}
                disabled={drawingPoints.length < 3}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Complete
              </button>
              <button
                onClick={cancelDrawingZone}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-700 text-gray-300 text-xs font-medium"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          )}

          {/* View Toggles */}
          <div className="flex items-center gap-1 border-l border-gray-800 pl-2">
            <button
              onClick={() => setShowZones(!showZones)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                showZones ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-400'
              }`}
              title="Toggle Zones"
            >
              Zones
            </button>
            <button
              onClick={() => setShowTrail(!showTrail)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                showTrail ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-400'
              }`}
              title="Toggle Trail"
            >
              Trail
            </button>
            <button
              onClick={() => setShowGateways(!showGateways)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                showGateways ? 'bg-gray-800 text-blue-400' : 'text-gray-500 hover:text-gray-400'
              }`}
              title="Toggle Gateways"
            >
              Gateways
            </button>
          </div>
        </div>
      </div>

      {/* HTML5 Canvas Container */}
      <div className="relative w-full aspect-square max-h-[620px] rounded-2xl overflow-hidden border border-gray-800 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          className={`w-full h-full block ${isDrawingZone ? 'cursor-crosshair' : 'cursor-default'}`}
        />

        {/* Corner Coordinates Legend */}
        <div className="absolute bottom-2 left-2 pointer-events-none bg-gray-900/80 backdrop-blur-sm border border-gray-800 px-2 py-1 rounded text-[11px] font-mono text-gray-400">
          Origin: (0, 0) South-West Corner
        </div>
      </div>
    </div>
  );
};
