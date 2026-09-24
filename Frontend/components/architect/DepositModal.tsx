'use client';

import React, { useState } from 'react';
import {
  X,
  Smartphone,
  CreditCard,
  Building2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ArrowDownLeft,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  currentBalance?: number;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

export function DepositModal({
  isOpen,
  onClose,
  currency = 'XAF',
  currentBalance = 0,
  onSuccess,
}: DepositModalProps) {
  const [amount, setAmount] = useState<number | ''>(25000);
  const [method, setMethod] = useState<'MTN_MOMO' | 'ORANGE_MONEY' | 'CARD' | 'BANK_TRANSFER'>('MTN_MOMO');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 500) {
      setError('Minimum deposit amount is 500 XAF');
      return;
    }

    if (numAmount > 10000000) {
      setError('Maximum deposit amount is 10,000,000 XAF');
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
      const res = await fetch('/api/architect/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          method,
          phone: phone.trim(),
          accountName: accountName.trim(),
          idempotencyKey: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Deposit failed');
      }

      setSuccessResult(data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Deposit Funds</h3>
              <p className="text-xs text-slate-400">Add funds instantly to your Architect Available Balance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State Receipt */}
        {successResult ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Deposit Successful!</h4>
              <p className="text-xs text-slate-300 mt-1">{successResult.message}</p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Amount Credited:</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  + {Number(amount).toLocaleString()} {currency}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>New Available Balance:</span>
                <span className="font-bold text-white">
                  {Number(successResult.balanceAfter ?? (currentBalance + Number(amount))).toLocaleString()} {currency}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payment Channel:</span>
                <span className="font-medium text-slate-200">{method.replace(/_/g, ' ')} {phone ? `(${phone})` : ''}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Transaction Ref:</span>
                <span className="font-mono text-slate-300 text-[11px]">{successResult.transaction?.reference || successResult.transaction?.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Status:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> COMPLETED
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeposit} className="space-y-4 pt-4">
            {/* Current Balance Display */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Current Available Balance</span>
                <span className="text-base font-extrabold text-white">
                  {currentBalance.toLocaleString()} {currency}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <Zap className="w-3 h-3" /> Instant Crediting
                </span>
                <span className="text-[11px] text-slate-400">Zero deposit fee</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Amount Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quick Select Amount
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      amount === amt
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Deposit Amount ({currency}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={500}
                  max={10000000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  placeholder="e.g. 50,000"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                  {currency}
                </span>
              </div>
            </div>

            {/* Method selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Deposit Payment Channel *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('MTN_MOMO')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'MTN_MOMO'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                  <span className="text-[11px] font-bold block">MTN MoMo</span>
                  <span className="text-[9px] text-slate-400">Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('ORANGE_MONEY')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'ORANGE_MONEY'
                      ? 'bg-orange-500/15 border-orange-500 text-orange-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1 text-orange-400" />
                  <span className="text-[11px] font-bold block">Orange OM</span>
                  <span className="text-[9px] text-slate-400">Orange Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'CARD'
                      ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  <span className="text-[11px] font-bold block">Debit Card</span>
                  <span className="text-[9px] text-slate-400">Visa / MC</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('BANK_TRANSFER')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'BANK_TRANSFER'
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                  <span className="text-[11px] font-bold block">Bank Wire</span>
                  <span className="text-[9px] text-slate-400">Direct Wire</span>
                </button>
              </div>
            </div>

            {/* Mobile Money Phone Number or Card details */}
            {(method === 'MTN_MOMO' || method === 'ORANGE_MONEY') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {method === 'MTN_MOMO' ? 'MTN Mobile Money Phone Number *' : 'Orange Money Phone Number *'}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder={method === 'MTN_MOMO' ? 'e.g. 677 12 34 56' : 'e.g. 699 12 34 56'}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  A USSD prompt will be sent to this phone to authorize the transaction.
                </p>
              </div>
            )}

            {method === 'CARD' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <span>Encrypted Card Processing</span>
                </div>
                <input
                  type="text"
                  placeholder="Card Number (4000 0000 0000 0000)"
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="MM / YY"
                    className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="CVC"
                    className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {method === 'BANK_TRANSFER' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-white">BuildSmart AI Bank Escrow Account</div>
                <div className="text-[11px] text-slate-400 font-mono">Bank: Afriland First Bank / BICEC</div>
                <div className="text-[11px] text-slate-400 font-mono">RIB: 10005 00001 01234567890 22</div>
                <p className="text-[10px] text-slate-500 pt-1">
                  Reference: Use your Architect ID as the transfer narration.
                </p>
              </div>
            )}

            {/* Account / Depositor Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Account Holder / Depositor Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name as registered on account"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !amount || Number(amount) < 500}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Deposit...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Deposit of {Number(amount || 0).toLocaleString()} {currency}</span>
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
