'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Building2,
  ExternalLink,
  RefreshCw,
  Eye,
  CheckCircle2,
  Lock,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { WithdrawalModal } from '@/Frontend/components/architect/WithdrawalModal';
import { DepositModal } from '@/Frontend/components/architect/DepositModal';

export default function ArchitectWalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  async function loadData() {
    try {
      const [walletRes, escrowsRes, txRes] = await Promise.all([
        fetch('/api/architect/wallet'),
        fetch('/api/architect/wallet/escrows'),
        fetch('/api/architect/wallet/transactions?limit=10'),
      ]);

      const [walletJson, escrowsJson, txJson] = await Promise.all([
        walletRes.json(),
        escrowsRes.json(),
        txRes.json(),
      ]);

      if (walletJson.success) setWallet(walletJson.wallet);
      if (escrowsJson.success) setEscrows(escrowsJson.escrows || []);
      if (txJson.success) setTransactions(txJson.transactions || []);
    } catch (err) {
      console.error('Failed to load wallet dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const currency = wallet?.currency || 'XAF';
  const available = Number(wallet?.availableBalance || 0);
  const pendingEscrow = Number(wallet?.escrowBalance || 0);
  const total = Number(wallet?.totalBalance || available + pendingEscrow);
  const isVerified = wallet?.verificationStatus === 'VERIFIED' || wallet?.verificationStatus === 'FULLY_VERIFIED';

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-slate-800/60 rounded-3xl" />
          <div className="h-40 bg-slate-800/60 rounded-3xl" />
          <div className="h-40 bg-slate-800/60 rounded-3xl" />
        </div>
        <div className="h-80 bg-slate-800/40 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Architect Wallet
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Escrow Protected
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Track available balances, secured design escrows, and instant Mobile Money payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh balances"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsDepositOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit Funds</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWithdrawOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdraw Funds</span>
          </button>
        </div>
      </div>

      {/* Verification Warning (if unverified) */}
      {!isVerified && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-200 flex items-start justify-between gap-3 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-white">Architect Verification Required for Withdrawals</span>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Your wallet can receive escrow funds, but withdrawals to MTN MoMo and Orange Money are enabled once your ONIGC / professional credentials are confirmed.
              </p>
            </div>
          </div>
          <Link
            href="/architect/verification"
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
          >
            Verify Account
          </Link>
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Available Balance */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Balance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {available.toLocaleString()} <span className="text-base font-normal text-slate-400">{currency}</span>
            </div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <span>Ready for immediate payout</span>
            </p>
          </div>
        </div>

        {/* Pending Escrow */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Escrow</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
              {pendingEscrow.toLocaleString()} <span className="text-base font-normal text-slate-400">{currency}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Locked in client review window
            </p>
          </div>
        </div>

        {/* Total Balance */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative overflow-hidden shadow-xl sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Portfolio Balance</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {total.toLocaleString()} <span className="text-base font-normal text-slate-400">{currency}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Withdrawn to date: {Number(wallet?.withdrawnAmount || 0).toLocaleString()} {currency}
            </p>
          </div>
        </div>
      </div>

      {/* Active Design Escrows Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Active Design Escrows</h2>
            <p className="text-xs text-slate-400">Funds secured by clients awaiting review completion or acceptance deadline</p>
          </div>
          <Link
            href="/architect/wallet/escrows"
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
          >
            <span>View All ({escrows.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {escrows.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No pending design escrows</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              If you complete an architectural deliverable and a client funds the project, the payment will appear here until released.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {escrows.slice(0, 3).map((esc: any) => {
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
                        {Number(esc.amount).toLocaleString()} {currency}
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
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>View Escrow Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Ledger Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
            <p className="text-xs text-slate-400">Verified immutable financial ledger events</p>
          </div>
          <Link
            href="/architect/wallet/transactions"
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
          >
            <span>Full History</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Wallet className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No wallet transactions yet</h4>
            <p className="text-xs text-slate-400">When designs are funded, approved, or withdrawn, records will be logged here.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {transactions.map((tx: any) => {
                    const isCredit = tx.netAmount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white block">{tx.description}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{tx.reference || tx.id}</span>
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
                          isCredit || tx.transactionType === 'DEPOSIT' ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                          {isCredit || tx.transactionType === 'DEPOSIT' ? '+' : ''}{Number(tx.netAmount || tx.amount).toLocaleString()} {currency}
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

      {/* Withdrawal Methods Info Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-400" />
            <span>Supported Withdrawal Channels</span>
          </h3>
          <p className="text-xs text-slate-400">
            Instant disbursements directly to Cameroon MTN Mobile Money (MoMo) and Orange Money (OM).
          </p>
          <div className="flex items-center gap-3 pt-2">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
              MTN MoMo (Instant)
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
              Orange Money (Instant)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsWithdrawOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
        >
          Manage Payout Method
        </button>
      </div>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        availableBalance={available}
        currency={currency}
        isVerified={isVerified}
        onSuccess={loadData}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        currency={currency}
        currentBalance={available}
        onSuccess={loadData}
      />
    </div>
  );
}
