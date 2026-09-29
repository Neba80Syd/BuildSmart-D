'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function ArchitectEscrowsDirectoryPage() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadEscrows() {
    setLoading(true);
    try {
      const url = filterStatus === 'ALL'
        ? '/api/architect/wallet/escrows'
        : `/api/architect/wallet/escrows?status=${filterStatus}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setEscrows(json.escrows || []);
      }
    } catch (err) {
      console.error('Failed to load escrows', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEscrows();
  }, [filterStatus]);

  const filtered = escrows.filter((e) => {
    const term = search.toLowerCase();
    return (
      (e.projectName && e.projectName.toLowerCase().includes(term)) ||
      (e.clientName && e.clientName.toLowerCase().includes(term)) ||
      (e.id && e.id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Top breadcrumb & title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/architect/wallet"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Wallet</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Design Escrows</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track all funded architectural design escrows, inspection deadlines, and release statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEscrows}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, client, or ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'ESCROWED', 'CLIENT_REVIEW', 'REVISION_REQUESTED', 'RELEASED', 'DISPUTED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === st
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st === 'ALL' ? 'All Escrows' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Escrow List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          <div className="h-48 bg-slate-900 rounded-2xl" />
          <div className="h-48 bg-slate-900 rounded-2xl" />
          <div className="h-48 bg-slate-900 rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">No escrows match your filter</h4>
          <p className="text-xs text-slate-400">Try choosing a different status or clearing your search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((esc: any) => {
            const isDisputed = esc.status === 'DISPUTED';
            const isReleased = esc.status === 'RELEASED';
            return (
              <div
                key={esc.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                      Project #{esc.projectId?.slice(-6)?.toUpperCase() || 'BS-1042'}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5 line-clamp-1">{esc.projectName}</h4>
                    <p className="text-xs text-slate-400">Client: {esc.clientName}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isDisputed
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : isReleased
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {isDisputed ? 'In Dispute' : isReleased ? 'Released' : 'Client Review'}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Net Escrow</span>
                    <span className="font-extrabold text-white text-sm">
                      {Number(esc.amount).toLocaleString()} {esc.currency || 'XAF'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Review Window</span>
                    <span className="font-medium text-amber-300">
                      {isReleased ? 'Completed' : '72h Countdown'}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/architect/wallet/escrows/${esc.id}`}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white text-center flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>View Escrow Timeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
