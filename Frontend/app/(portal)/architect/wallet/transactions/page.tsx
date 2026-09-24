'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Wallet,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

export default function ArchitectTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadTransactions() {
    setLoading(true);
    try {
      const url = filterType === 'ALL'
        ? '/api/architect/wallet/transactions?limit=100'
        : `/api/architect/wallet/transactions?type=${filterType}&limit=100`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, [filterType]);

  const filtered = transactions.filter((tx) => {
    const term = search.toLowerCase();
    return (
      (tx.description && tx.description.toLowerCase().includes(term)) ||
      (tx.reference && tx.reference.toLowerCase().includes(term)) ||
      (tx.id && tx.id.toLowerCase().includes(term))
    );
  });

  const exportCSV = () => {
    const headers = ['Transaction ID', 'Date', 'Type', 'Amount', 'Currency', 'Status', 'Reference', 'Description'];
    const rows = filtered.map((tx) => [
      tx.id,
      new Date(tx.createdAt).toISOString(),
      tx.transactionType,
      tx.netAmount || tx.amount,
      tx.currency || 'XAF',
      tx.status,
      tx.reference || '',
      `"${(tx.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `buildsmart_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/architect/wallet"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Wallet</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Wallet Transactions</h1>
          <p className="text-sm text-slate-400 mt-1">
            Auditable double-entry ledger history for escrow holds, releases, and withdrawals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={loadTransactions}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference or description..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'DEPOSIT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'WITHDRAWAL', 'REFUND', 'WITHDRAWAL_REVERSAL'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterType === t
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {t === 'ALL' ? 'All Ledger' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center animate-pulse">
          <div className="h-6 w-32 bg-slate-800 mx-auto rounded mb-4" />
          <div className="h-4 w-48 bg-slate-800 mx-auto rounded" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
            <Wallet className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">No transactions found</h4>
          <p className="text-xs text-slate-400">Try changing your filters or search keywords.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Ledger Type</th>
                  <th className="py-3 px-4 text-right">Net Amount</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filtered.map((tx: any) => {
                  const isCredit = (tx.netAmount || tx.amount) > 0 || tx.transactionType === 'DEPOSIT';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white block">{tx.description}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Ref: {tx.reference || tx.id}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          tx.transactionType === 'DEPOSIT'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap ${
                        isCredit ? 'text-emerald-400' : 'text-slate-300'
                      }`}>
                        {isCredit ? '+' : ''}{Number(tx.netAmount || tx.amount).toLocaleString()} {tx.currency || 'XAF'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
