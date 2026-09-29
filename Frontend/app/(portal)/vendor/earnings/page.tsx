'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { StatusPill } from '@/Frontend/components/vendor/charts';
import { VendorDepositModal } from '@/Frontend/components/vendor/DepositModal';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();

type Withdrawal = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  destinationType?: string;
  destinationReference?: string;
  status: string;
  failureReason?: string;
  requestedAt: string;
  completedAt?: string;
  account: Record<string, any>;
};

type WalletTx = {
  id: string;
  transactionType: string;
  amount: number;
  currency: string;
  status: string;
  reference?: string;
  description?: string;
  orderId?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  createdAt: string;
};

type FinanceData = {
  currency: string;
  commissionRate: number;
  availableBalance: number;
  escrowBalance: number;
  pendingWithdrawals: number;
  withdrawnAmount: number;
  totalBalance: number;
  gross: number;
  net: number;
  commissions: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
  withdrawals: Withdrawal[];
  transactions: WalletTx[];
  taxSettings: { vatRate: number; collectVat: boolean; taxNumber: string; annualStatementReady: boolean };
};

export default function VendorEarningsPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK'>('MTN_MOMO');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [txFilter, setTxFilter] = useState('ALL');
  const [tax, setTax] = useState({ vatRate: '19.25', collectVat: true, taxNumber: '' });

  const load = async () => {
    try {
      const res = await fetch('/api/vendor/finance');
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Failed to load wallet data');
      }
      const d = await res.json();
      setData(d);
      setTax({
        vatRate: String(d.taxSettings?.vatRate ?? 0),
        collectVat: d.taxSettings?.collectVat ?? false,
        taxNumber: d.taxSettings?.taxNumber ?? '',
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop">
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading vendor wallet &amp; ledger…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop space-y-3">
        <p className="text-body-md text-error font-medium">Failed to load wallet data</p>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const handleWithdrawalSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    if (amt < (data.minWithdrawalAmount ?? 1000)) {
      return toast.error(`Minimum withdrawal is ${fmt(data.minWithdrawalAmount ?? 1000)} ${data.currency}`);
    }
    if (amt > data.availableBalance) {
      return toast.error(`Amount exceeds your available balance of ${fmt(data.availableBalance)} ${data.currency}`);
    }

    if (method === 'MTN_MOMO' || method === 'ORANGE_MONEY') {
      if (!phone.trim()) return toast.error('Please enter a valid Mobile Money phone number');
    } else {
      if (!bankName.trim() || !accountNumber.trim()) return toast.error('Please enter complete bank account details');
    }

    setSubmittingWithdrawal(true);
    const idempotencyKey = `wth_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      const res = await fetch('/api/vendor/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          method,
          phone: method !== 'BANK' ? phone : undefined,
          accountName: accountName || 'Vendor',
          account: method === 'BANK' ? { bank: bankName, accountNumber, accountName } : { phone, accountName },
          idempotencyKey,
        }),
      });
      const resData = await res.json();
      if (res.ok) {
        toast.success(`Withdrawal request of ${fmt(amt)} ${data.currency} placed successfully!`);
        setShowWithdrawModal(false);
        setAmount('');
        setPhone('');
        setAccountNumber('');
        load();
      } else {
        toast.error(resData.error ?? 'Withdrawal failed');
      }
    } catch {
      toast.error('Network error requesting withdrawal');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const saveTax = async () => {
    const res = await fetch('/api/vendor/finance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vatRate: parseFloat(tax.vatRate) || 0, collectVat: tax.collectVat, taxNumber: tax.taxNumber }),
    });
    if (res.ok) {
      toast.success('Tax settings saved');
      load();
    } else toast.error('Could not save tax settings');
  };

  const filteredTransactions = (data.transactions ?? []).filter((tx) => {
    if (txFilter === 'ALL') return true;
    if (txFilter === 'DEPOSITS') return tx.transactionType === 'DEPOSIT';
    if (txFilter === 'ESCROW') return tx.transactionType.includes('ESCROW');
    if (txFilter === 'WITHDRAWALS') return tx.transactionType.includes('WITHDRAWAL');
    if (txFilter === 'DISPUTES') return tx.transactionType.includes('DISPUTE') || tx.transactionType.includes('REFUND');
    return true;
  });

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">
            Vendor Wallet &amp; Escrow Ledger
          </h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
            Manage your withdrawable balance, escrowed client payments, and payout ledger.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowDepositModal(true)}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-elevation bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Deposit Funds
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={data.availableBalance <= 0}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-elevation disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">payments</span>
            Request Withdrawal
          </button>
        </div>
      </div>

      {/* Escrow Transparency Banner */}
      <div className="bg-primary/5 dark:bg-surface-container border border-primary/20 rounded-2xl p-5 mb-8 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px]">verified_user</span>
        </div>
        <div className="text-body-sm flex-1">
          <p className="font-semibold text-on-background dark:text-surface-container-lowest mb-1">
            BuildSmart 100% Escrow Protection
          </p>
          <p className="text-on-surface-variant dark:text-surface-variant leading-relaxed">
            Client payments are secured in your <span className="font-medium text-amber-700 dark:text-amber-400">Escrow Balance</span> upon order checkout. Once you deliver the goods, the client has a 72-hour inspection window to confirm receipt. After confirmation (or automatically after 72 hours if no dispute is opened), the funds automatically transfer into your <span className="font-medium text-emerald-700 dark:text-emerald-400">Available Balance</span> for immediate withdrawal.
          </p>
        </div>
      </div>

      {/* 4 Core Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Available Balance */}
        <div className="bg-white dark:bg-surface-container border-2 border-primary/40 dark:border-primary/50 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider font-semibold">
              Available to Withdraw
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              READY
            </span>
          </div>
          <div className="text-display font-semibold text-emerald-700 dark:text-emerald-400">
            {fmt(data.availableBalance)} <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.currency}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-2">
            Net earnings released from escrow, withdrawable to Mobile Money / OM.
          </p>
        </div>

        {/* Escrow Balance */}
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-label-md text-amber-800 dark:text-amber-300 uppercase tracking-wider font-semibold">
              Funds in Escrow
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              LOCKED
            </span>
          </div>
          <div className="text-display font-semibold text-amber-700 dark:text-amber-400">
            {fmt(data.escrowBalance)} <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.currency}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-2">
            Temporarily protected pending delivery and client confirmation.
          </p>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-label-md text-blue-800 dark:text-blue-300 uppercase tracking-wider font-semibold">
              Pending Payouts
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              PROCESSING
            </span>
          </div>
          <div className="text-display font-semibold text-blue-700 dark:text-blue-400">
            {fmt(data.pendingWithdrawals)} <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.currency}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-2">
            Withdrawal requests currently being processed by Mobile Money / Bank.
          </p>
        </div>

        {/* Total Earnings */}
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider font-semibold">
              Total Earnings
            </span>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">trending_up</span>
          </div>
          <div className="text-display font-semibold text-on-background dark:text-surface-container-lowest">
            {fmt(data.gross)} <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.currency}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-2">
            All-time gross marketplace sales before platform commissions.
          </p>
        </div>
      </div>

      {/* Main Ledger and Withdrawals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Immutable Wallet Ledger Transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-outline-variant dark:border-outline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Wallet Ledger History
              </h2>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5">
                Immutable record of every financial transaction on your wallet.
              </p>
            </div>
            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'DEPOSITS', label: 'Deposits' },
                { id: 'ESCROW', label: 'Escrow' },
                { id: 'WITHDRAWALS', label: 'Payouts' },
                { id: 'DISPUTES', label: 'Disputes' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTxFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-colors ${
                    txFilter === f.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-low dark:bg-surface-dim text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                  <th className="py-3.5 px-6 text-label-md text-on-surface-variant uppercase">Date</th>
                  <th className="py-3.5 px-6 text-label-md text-on-surface-variant uppercase">Transaction Type</th>
                  <th className="py-3.5 px-6 text-label-md text-on-surface-variant uppercase">Description</th>
                  <th className="py-3.5 px-6 text-label-md text-on-surface-variant uppercase text-right">Amount</th>
                  <th className="py-3.5 px-6 text-label-md text-on-surface-variant uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-body-sm divide-y divide-outline-variant/60 dark:divide-outline/40">
                {filteredTransactions.map((tx) => {
                  const isPositive = (tx.amount > 0 && !tx.transactionType.includes('WITHDRAWAL')) || tx.transactionType === 'DEPOSIT';
                  return (
                    <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-6 text-on-surface-variant whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString()} <span className="text-[11px] opacity-70">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide ${
                          tx.transactionType === 'DEPOSIT'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : tx.transactionType === 'ESCROW_LOCKED'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : tx.transactionType === 'ESCROW_RELEASED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : tx.transactionType.includes('WITHDRAWAL')
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : tx.transactionType.includes('DISPUTE')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}>
                          {tx.transactionType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 max-w-xs">
                        <div className="text-on-background dark:text-surface-container-lowest font-medium truncate">
                          {tx.description}
                        </div>
                        {tx.orderId && (
                          <div className="text-[11px] text-on-surface-variant font-mono">
                            Ref: {tx.orderId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono-technical font-semibold whitespace-nowrap">
                        <span className={isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-on-background dark:text-surface-container-lowest'}>
                          {isPositive ? `+ ${fmt(tx.amount)}` : `${fmt(Math.abs(tx.amount))}`} {data.currency}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <StatusPill status={tx.status} />
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant dark:text-surface-variant">
                      No ledger transactions found matching this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Withdrawal Payouts History */}
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Withdrawal Requests
              </h2>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="text-label-md text-primary hover:underline"
              >
                + New
              </button>
            </div>
            <div className="space-y-3">
              {(data.withdrawals ?? []).slice(0, 8).map((w) => (
                <div key={w.id} className="p-3.5 rounded-xl border border-outline-variant/60 dark:border-outline/40 bg-surface-container-low/40 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-on-background dark:text-surface-container-lowest">
                      {fmt(w.amount)} {data.currency}
                    </div>
                    <div className="text-body-sm text-on-surface-variant">
                      {w.destinationType ?? w.method} · {w.destinationReference ?? w.account?.phone ?? w.account?.bank ?? '—'}
                    </div>
                    <div className="text-[11px] text-on-surface-variant opacity-70">
                      {new Date(w.requestedAt).toLocaleDateString()}
                    </div>
                    {w.failureReason && (
                      <div className="text-[11px] text-error mt-0.5">
                        Reason: {w.failureReason}
                      </div>
                    )}
                  </div>
                  <div>
                    <StatusPill status={w.status} />
                  </div>
                </div>
              ))}
              {(data.withdrawals ?? []).length === 0 && (
                <p className="text-body-sm text-on-surface-variant py-8 text-center">
                  No withdrawal requests made yet.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-outline-variant dark:border-outline">
            <div className="text-body-sm text-on-surface-variant">
              Supported channels:
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-label-sm font-semibold border border-amber-200 dark:border-amber-800">
                MTN MoMo
              </span>
              <span className="px-2.5 py-1 rounded bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-200 text-label-sm font-semibold border border-orange-200 dark:border-orange-800">
                Orange Money
              </span>
              <span className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-label-sm font-semibold border border-blue-200 dark:border-blue-800">
                Bank Wire
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Documentation Section */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap justify-between items-start gap-6">
          <div>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-1">
              Tax &amp; Regulatory Settings
            </h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">
              Configure VAT collection and business registration tax identification.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="block">
                <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">VAT Rate (%)</span>
                <input
                  type="number"
                  step="0.01"
                  className="input w-32 mt-1"
                  value={tax.vatRate}
                  onChange={(e) => setTax({ ...tax, vatRate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Tax ID Number</span>
                <input
                  className="input w-64 mt-1"
                  placeholder="e.g. M041812345678"
                  value={tax.taxNumber}
                  onChange={(e) => setTax({ ...tax, taxNumber: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-body-sm text-on-background dark:text-surface-container-lowest self-end pb-2">
                <input
                  type="checkbox"
                  checked={tax.collectVat}
                  onChange={(e) => setTax({ ...tax, collectVat: e.target.checked })}
                />
                Collect VAT on product orders
              </label>
              <button onClick={saveTax} className="btn-primary px-5 py-2.5 rounded-lg text-label-md self-end">
                Save Tax Settings
              </button>
            </div>
          </div>
          <div className="border border-outline-variant dark:border-outline rounded-xl p-4 min-w-[240px] bg-surface-container-low/50">
            <div className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2 font-semibold">
              Annual Financial Statement
            </div>
            <div className="text-body-sm text-on-background dark:text-surface-container-lowest">
              {data.taxSettings.annualStatementReady ? '2025 Statement ready' : 'Generated at calendar year-end'}
            </div>
            <button className="text-label-md text-primary hover:underline mt-2 font-medium">
              Export Annual PDF
            </button>
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWithdrawModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div 
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl max-w-lg w-full shadow-2xl relative my-auto max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant/60 dark:border-outline/40 shrink-0 bg-white dark:bg-surface-container">
              <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Withdrawal to Mobile Money / Bank
              </h3>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="text-on-surface-variant hover:text-on-background p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer shrink-0 ml-2"
                aria-label="Close withdrawal dialog"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 overscroll-contain modal-scrollbar space-y-4">
              {/* Payment Channel Selector */}
              <div>
                <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-2">
                  Select Payout Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'MTN_MOMO', label: 'MTN MoMo' },
                    { id: 'ORANGE_MONEY', label: 'Orange OM' },
                    { id: 'BANK', label: 'Bank Wire' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setMethod(ch.id as any)}
                      className={`py-2.5 px-3 rounded-xl text-label-md font-medium border text-center transition-all ${
                        method === ch.id
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-outline-variant dark:border-outline text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
                    Amount ({data.currency})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAmount(String(data.availableBalance))}
                    className="text-label-sm text-primary font-semibold hover:underline"
                  >
                    Max ({fmt(data.availableBalance)} {data.currency})
                  </button>
                </div>
                <input
                  type="number"
                  className="input w-full text-lg font-mono-technical font-semibold"
                  placeholder={`Min ${fmt(data.minWithdrawalAmount ?? 1000)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              {/* Account Details */}
              {method !== 'BANK' ? (
                <>
                  <div>
                    <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                      {method === 'MTN_MOMO' ? 'MTN Mobile Money Phone Number' : 'Orange Money Phone Number'}
                    </label>
                    <input
                      type="tel"
                      className="input w-full"
                      placeholder="e.g. 670 00 00 00 / 690 00 00 00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                      Account Registered Name
                    </label>
                    <input
                      className="input w-full"
                      placeholder="Name on SIM account"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                      Bank Name
                    </label>
                    <input
                      className="input w-full"
                      placeholder="e.g. Afriland First Bank, UBA, SGBC"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                      Account Number / IBAN
                    </label>
                    <input
                      className="input w-full"
                      placeholder="Account or RIB number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                      Beneficiary Account Name
                    </label>
                    <input
                      className="input w-full"
                      placeholder="Name as it appears on bank statement"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="bg-surface-container-low dark:bg-surface-dim p-3.5 rounded-xl text-body-sm text-on-surface-variant">
                Withdrawals are debited from your Available Balance and processed instantly or within 1 business day for bank transfers.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="w-1/2 py-3 rounded-xl border border-outline-variant font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingWithdrawal || !amount || parseFloat(amount) <= 0}
                  onClick={handleWithdrawalSubmit}
                  className="w-1/2 btn-primary py-3 rounded-xl font-medium disabled:opacity-50"
                >
                  {submittingWithdrawal ? 'Submitting…' : 'Confirm Payout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Deposit Modal */}
      <VendorDepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        currency={data.currency}
        currentBalance={data.availableBalance}
        onSuccess={load}
      />
    </div>
  );
}
