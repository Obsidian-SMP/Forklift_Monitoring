// ==============================================================================
// File: src/components/InventoryLedger.tsx
// Description: Real-Time Warehouse Stock Ledger & Transaction Audit Component.
// Purpose: Implements Papers 4 & 5 requirements. Manages SKU catalog, displays
//          live inventory balances, and provides complete audit history tracking
//          forklift pickup and drop-off events with verified 2D geospatial coordinates.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, ArrowUpRight, ArrowDownLeft, Clock, MapPin, RefreshCw } from 'lucide-react';
import { InventoryItem, InventoryTransaction } from '../types';
import { api } from '../services/api';

export const InventoryLedger: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'audit'>('catalog');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const [items, txs] = await Promise.all([
        api.getInventory(statusFilter, searchTerm),
        api.getTransactions(40),
      ]);
      setInventory(items);
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [statusFilter]);

  const filteredItems = inventory.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
  });

  return (
    <div className="glass-panel rounded-2xl p-5 border border-gray-800 flex flex-col gap-4 shadow-xl">
      {/* Ledger Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-['Outfit'] font-bold text-lg text-white">
              Warehouse Inventory & Audits
            </h2>
            <p className="text-xs text-gray-400">
              Automated stock synchronization with M/N-K vision state machine
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs">
            <button
              onClick={() => setActiveSubTab('catalog')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'catalog' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Catalog Ledger ({filteredItems.length})
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeSubTab === 'audit' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Geospatial Audits ({transactions.length})
            </button>
          </div>

          <button
            onClick={fetchLedger}
            disabled={isLoading}
            className="p-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Catalog View */}
      {activeSubTab === 'catalog' ? (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search SKU or item description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Status:
              </span>
              {(['', 'in_stock', 'in_transit', 'dispatched'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    statusFilter === st
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {st === '' ? 'All' : st.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800 text-gray-400 font-mono text-[11px] uppercase">
                  <th className="py-3 px-4">SKU Code</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Zone / Shelf</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {item.name}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-mono flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-emerald-400" />
                        {item.current_zone} • {item.current_shelf}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                            item.status === 'in_stock'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : item.status === 'in_transit'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">
                      No matching inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Transaction Audit History View */
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-gray-400 font-mono text-[11px] uppercase">
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Forklift</th>
                <th className="py-3 px-4">Coordinates (X, Y)</th>
                <th className="py-3 px-4">Zone Route</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-4">
                      {tx.event_type === 'PICKUP' ? (
                        <span className="flex items-center gap-1 font-bold text-amber-400">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          PICKUP
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-bold text-emerald-400">
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          DROPOFF
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {tx.sku}
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-mono">
                      {tx.forklift_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-300">
                      {tx.event_type === 'PICKUP'
                        ? `(${tx.pickup_x?.toFixed(2) || '0.00'}m, ${tx.pickup_y?.toFixed(2) || '0.00'}m)`
                        : `(${tx.dropoff_x?.toFixed(2) || '0.00'}m, ${tx.dropoff_y?.toFixed(2) || '0.00'}m)`}
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono">
                      {tx.from_zone || 'Loading'} → {tx.to_zone || 'Storage'}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 font-mono flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-gray-600" />
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 text-xs">
                    No transactions recorded yet. Vision state machine records events on verified picks/drops.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
