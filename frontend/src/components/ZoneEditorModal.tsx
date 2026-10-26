// ==============================================================================
// File: src/components/ZoneEditorModal.tsx
// Description: Polygon Geofence & Danger Zone Configuration Modal.
// Purpose: Allows warehouse operators to configure polygon zone attributes
//          (name, classification, color, entry alarm rules) and commit
//          coordinates directly to the SQLite backend database.
// ==============================================================================

import React, { useState } from 'react';
import { X, ShieldAlert, Save } from 'lucide-react';
import { ZonePoint, WarehouseZone } from '../types';
import { api } from '../services/api';

interface ZoneEditorModalProps {
  points: ZonePoint[];
  isOpen: boolean;
  onClose: () => void;
  onZoneCreated: (zone: WarehouseZone) => void;
}

export const ZoneEditorModal: React.FC<ZoneEditorModalProps> = ({
  points,
  isOpen,
  onClose,
  onZoneCreated,
}) => {
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState<'danger' | 'loading' | 'storage' | 'aisle'>('danger');
  const [color, setColor] = useState('#ef4444');
  const [notifyOnEntry, setNotifyOnEntry] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const colorPresets: Record<string, string> = {
    danger: '#ef4444',
    loading: '#3b82f6',
    storage: '#10b981',
    aisle: '#8b5cf6',
  };

  const handleTypeChange = (type: 'danger' | 'loading' | 'storage' | 'aisle') => {
    setZoneType(type);
    setColor(colorPresets[type]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a descriptive zone name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const zoneId = `zone_${zoneType}_${Date.now().toString().slice(-6)}`;
      const newZone = await api.createZone({
        zone_id: zoneId,
        name: name.trim(),
        zone_type: zoneType,
        color,
        points,
        notify_on_entry: notifyOnEntry,
      });

      onZoneCreated(newZone);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save zone');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-6 border border-gray-700 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-['Outfit'] font-bold text-white text-base">
                Configure Warehouse Zone
              </h3>
              <p className="text-xs text-gray-400">
                {points.length} vertices captured from map
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

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Zone Name */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Zone Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chemical Hazard Vault"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Zone Type */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Zone Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['danger', 'loading', 'storage', 'aisle'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border text-left capitalize transition-all ${
                    zoneType === type
                      ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                  }`}
                >
                  {type === 'danger' && '⚠️ '}
                  {type === 'loading' && '📦 '}
                  {type === 'storage' && '🏭 '}
                  {type === 'aisle' && '🛣️ '}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Display Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded-lg bg-gray-900 border border-gray-700 cursor-pointer p-0.5"
              />
              <span className="text-xs font-mono text-gray-400 uppercase">{color}</span>
            </div>
          </div>

          {/* Notify On Entry Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <span className="text-xs font-medium text-gray-200 block">
                Trigger Breach Alarm on Entry
              </span>
              <span className="text-[11px] text-gray-400">
                Broadcasts critical safety alert when forklift breaches boundary
              </span>
            </div>
            <input
              type="checkbox"
              checked={notifyOnEntry}
              onChange={(e) => setNotifyOnEntry(e.target.checked)}
              className="h-4 w-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-0"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Zone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
