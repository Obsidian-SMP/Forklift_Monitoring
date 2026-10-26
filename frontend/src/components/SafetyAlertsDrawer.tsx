// ==============================================================================
// File: src/components/SafetyAlertsDrawer.tsx
// Description: Safety Alarms & Incident Management Slide-Over Drawer.
// Purpose: Displays real-time geofence breaches, collision impacts, and climate
//          excursions. Enables safety operators to review incident audit metadata
//          and acknowledge active emergency alarms with a single click.
// ==============================================================================

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Clock,
  Radio,
  MapPin,
  Check,
} from 'lucide-react';
import { SafetyAlert } from '../types';
import { api } from '../services/api';

interface SafetyAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: SafetyAlert[];
  onAlertAcknowledged: (alertId: string) => void;
}

export const SafetyAlertsDrawer: React.FC<SafetyAlertsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  onAlertAcknowledged,
}) => {
  const [unackOnly, setUnackOnly] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAck = async (alertId: string) => {
    setAcknowledgingId(alertId);
    try {
      await api.acknowledgeAlert(alertId);
      onAlertAcknowledged(alertId);
    } catch (e) {
      console.error('Failed to acknowledge alert:', e);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const displayedAlerts = unackOnly ? alerts.filter((a) => !a.is_acknowledged) : alerts;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md glass-panel-elevated border-l border-gray-800 shadow-2xl p-6 flex flex-col justify-between">
          
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-['Outfit'] font-bold text-base text-white">
                  Safety Incident Alarms
                </h3>
                <p className="text-xs text-gray-400">
                  {alerts.filter((a) => !a.is_acknowledged).length} active unacknowledged alerts
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 my-3">
            <button
              onClick={() => setUnackOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !unackOnly
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'
              }`}
            >
              All Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setUnackOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                unackOnly
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-semibold'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800'
              }`}
            >
              Unacknowledged ({alerts.filter((a) => !a.is_acknowledged).length})
            </button>
          </div>

          {/* Alert Feed List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
            {displayedAlerts.length > 0 ? (
              displayedAlerts.map((alt) => {
                const isCrit = alt.severity === 'critical';
                return (
                  <div
                    key={alt.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      !alt.is_acknowledged
                        ? isCrit
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-gray-900/60 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {alt.severity}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-300">
                          {alt.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alt.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-white font-medium my-2 leading-relaxed">
                      {alt.message}
                    </p>

                    {/* Metadata Preview */}
                    {alt.metadata && (
                      <div className="text-[11px] font-mono text-gray-400 bg-black/40 p-2 rounded-lg border border-white/5 space-y-0.5">
                        {alt.metadata.position && (
                          <div className="flex items-center gap-1 text-blue-400">
                            <MapPin className="h-3 w-3" />
                            Location: ({alt.metadata.position.x}m, {alt.metadata.position.y}m)
                          </div>
                        )}
                        {alt.metadata.speed_mps !== undefined && (
                          <div>Speed: {alt.metadata.speed_mps} m/s</div>
                        )}
                        {alt.metadata.acceleration_g && (
                          <div>
                            Impact: {alt.metadata.acceleration_g.magnitude}g (Threshold: {alt.metadata.threshold_g}g)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Acknowledge Button */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-[10px] font-mono text-gray-500">
                        ID: {alt.alert_id}
                      </span>

                      {!alt.is_acknowledged ? (
                        <button
                          onClick={() => handleAck(alt.alert_id)}
                          disabled={acknowledgingId === alt.alert_id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                          {acknowledgingId === alt.alert_id ? 'Acknowledging...' : 'Acknowledge'}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 text-xs text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500/50 mb-2" />
                All safety alarms are currently resolved.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-800">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
