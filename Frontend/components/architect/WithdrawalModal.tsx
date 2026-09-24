'use client';

import React, { useState } from 'react';
import { X, Smartphone, Building2, AlertCircle, CheckCircle2, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  currency?: string;
  isVerified?: boolean;
  onSuccess?: () => void;
}

export function WithdrawalModal({
  isOpen,
  onClose,
  availableBalance,
  currency = 'XAF',
  isVerified = true,
  onSuccess,
}: WithdrawalModalProps) {
  const [amount, setAmount] = useState<number | ''>(availableBalance > 0 ? Math.min(availableBalance, 100000) : '');
  const [method, setMethod] = useState<'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK_TRANSFER'>('MTN_MOMO');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1000) {
      setError('Minimum withdrawal amount is 1,000 XAF');
      return;
    }

    if (numAmount > availableBalance) {
      setError(`Cannot withdraw more than your available balance (${availableBalance.toLocaleString()} ${currency}). Funds in pending escrow are locked.`);
      return;
    }

    if (!isVerified) {
      setError('Your architect account must complete verification before withdrawals are enabled.');
      return;
    }

    if (method === 'MTN_MOMO' || method === 'ORANGE_MONEY') {
      const cleanPhone = phone.replace(/\s+/g, '');
      if (cleanPhone.length < 9) {
        setError('Please enter a valid 9-digit mobile money phone number');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/architect/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          method,
          destinationReference: phone,
          accountName,
          idempotencyKey: `wth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Withdrawal failed');
      }

      setSuccessResult(data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Withdraw Funds</h3>
            <p className="text-xs text-slate-400">Transfer available earnings to your mobile money or bank account</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {successResult ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Withdrawal Successful!</h4>
              <p className="text-xs text-slate-300 mt-1">{successResult.message}</p>
            </div>
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Amount:</span>
                <span className="font-bold text-white">{Number(amount).toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Destination:</span>
                <span className="font-medium text-slate-200">{method} • {phone}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Status:</span>
                <span className="text-emerald-400 font-semibold">COMPLETED</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleWithdraw} className="space-y-4 pt-4">
            {/* Balance Badge */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Available for Payout</span>
                <span className="text-base font-extrabold text-emerald-400">
                  {availableBalance.toLocaleString()} {currency}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Processing</span>
                <span className="text-xs font-semibold text-slate-300">Instant — 15 mins</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Withdrawal Amount ({currency}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1000}
                  max={availableBalance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  placeholder="e.g. 50,000"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setAmount(availableBalance)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-400 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Method selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Withdrawal Method *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('MTN_MOMO')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    method === 'MTN_MOMO'
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-white">MTN MoMo</span>
                    <span className="text-[10px] text-slate-400">Mobile Money</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('ORANGE_MONEY')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    method === 'ORANGE_MONEY'
                      ? 'bg-orange-500/10 border-orange-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-white">Orange Money</span>
                    <span className="text-[10px] text-slate-400">OM Wallet</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mobile / Account Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {method === 'BANK_TRANSFER' ? 'Account / IBAN Number *' : 'Mobile Money Phone Number *'}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder={method === 'MTN_MOMO' ? 'e.g. 677 12 34 56' : 'e.g. 699 12 34 56'}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Account holder name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name as registered on mobile money"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || availableBalance < 1000}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payout...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Withdrawal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
