'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

interface VendorDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  currentBalance?: number;
  onSuccess?: () => void;
}

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 250000];

export function VendorDepositModal({
  isOpen,
  onClose,
  currency = 'XAF',
  currentBalance = 0,
  onSuccess,
}: VendorDepositModalProps) {
  const [amount, setAmount] = useState<number | ''>(50000);
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
      const res = await fetch('/api/vendor/wallet/deposit', {
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
      toast.success(`Successfully deposited ${numAmount.toLocaleString()} ${currency} into your wallet!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process deposit');
      toast.error(err.message || 'Deposit failed');
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-outline-variant/60 dark:border-outline/40 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Deposit Funds to Wallet
              </h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                Top up your Vendor Available Balance via Mobile Money or Bank Wire
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-background p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Success State Receipt */}
        {successResult ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>
            <div>
              <h4 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Deposit Completed!
              </h4>
              <p className="text-body-sm text-on-surface-variant mt-1">{successResult.message}</p>
            </div>

            <div className="p-4 bg-surface-container-low/60 dark:bg-surface-dim rounded-xl border border-outline-variant/60 text-left text-body-sm space-y-2">
              <div className="flex justify-between text-on-surface-variant">
                <span>Amount Credited:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  + {Number(amount).toLocaleString()} {currency}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>New Available Balance:</span>
                <span className="font-semibold text-on-background dark:text-surface-container-lowest">
                  {Number(successResult.balanceAfter ?? (currentBalance + Number(amount))).toLocaleString()} {currency}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Channel:</span>
                <span className="font-medium text-on-background dark:text-surface-container-lowest">
                  {method.replace(/_/g, ' ')} {phone ? `(${phone})` : ''}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Transaction Reference:</span>
                <span className="font-mono text-[11px] text-on-surface-variant">{successResult.transaction?.reference || successResult.transaction?.id}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="btn-primary w-full py-2.5 rounded-xl font-medium cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleDeposit} className="space-y-4">
            {/* Balance Overview */}
            <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-surface-dim border border-outline-variant/60 flex items-center justify-between">
              <div>
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider block">
                  Current Withdrawable Balance
                </span>
                <span className="text-title-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {currentBalance.toLocaleString()} {currency}
                </span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[14px]">bolt</span> Instant
                </span>
                <span className="block text-[11px] text-on-surface-variant mt-0.5">0% deposit fee</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-body-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Preset Amount Chips */}
            <div>
              <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Quick Select Amount
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={`py-1.5 px-2 rounded-lg text-label-md font-medium border transition-colors cursor-pointer text-center ${
                      amount === amt
                        ? 'bg-primary text-white border-primary font-bold'
                        : 'bg-surface-container-low/50 border-outline-variant text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div>
              <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
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
                  className="input w-full font-mono text-title-md py-2.5 px-3 pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm font-medium text-on-surface-variant">
                  {currency}
                </span>
              </div>
            </div>

            {/* Method selection */}
            <div>
              <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Select Deposit Channel *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('MTN_MOMO')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'MTN_MOMO'
                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="text-[12px] font-bold block">MTN MoMo</span>
                  <span className="text-[10px] opacity-75">Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('ORANGE_MONEY')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'ORANGE_MONEY'
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 font-bold'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="text-[12px] font-bold block">Orange OM</span>
                  <span className="text-[10px] opacity-75">Orange Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'CARD'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-bold'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="text-[12px] font-bold block">Debit Card</span>
                  <span className="text-[10px] opacity-75">Visa / MC</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('BANK_TRANSFER')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    method === 'BANK_TRANSFER'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-bold'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="text-[12px] font-bold block">Bank Wire</span>
                  <span className="text-[10px] opacity-75">Direct Wire</span>
                </button>
              </div>
            </div>

            {/* Mobile Money Phone Number or Card details */}
            {(method === 'MTN_MOMO' || method === 'ORANGE_MONEY') && (
              <div>
                <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                  {method === 'MTN_MOMO' ? 'MTN MoMo Phone Number *' : 'Orange Money Phone Number *'}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder={method === 'MTN_MOMO' ? 'e.g. 677 12 34 56' : 'e.g. 699 12 34 56'}
                  className="input w-full font-mono text-body-md"
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  A USSD prompt will be sent to this phone to confirm the deposit.
                </p>
              </div>
            )}

            {method === 'CARD' && (
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2">
                <div className="text-label-md text-on-surface-variant font-medium">Card Information</div>
                <input
                  type="text"
                  placeholder="Card Number (4000 0000 0000 0000)"
                  className="input w-full text-body-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="MM / YY"
                    className="input text-body-sm"
                  />
                  <input
                    type="text"
                    placeholder="CVC"
                    className="input text-body-sm"
                  />
                </div>
              </div>
            )}

            {method === 'BANK_TRANSFER' && (
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-body-sm text-on-surface-variant space-y-1">
                <div className="font-semibold text-on-background dark:text-surface-container-lowest">BuildSmart Vendor Escrow Account</div>
                <div className="text-[11px] font-mono">Bank: Afriland First Bank Cameroon</div>
                <div className="text-[11px] font-mono">RIB: 10005 00001 09876543210 18</div>
                <p className="text-[11px] opacity-75 pt-1">
                  Include your vendor store name in the bank wire reference.
                </p>
              </div>
            )}

            {/* Account / Depositor Name */}
            <div>
              <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                Depositor / Business Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name registered on mobile money or account"
                className="input w-full text-body-md"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !amount || Number(amount) < 500}
                className="btn-primary w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 shadow-elevation cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Processing Deposit...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Confirm Deposit of {Number(amount || 0).toLocaleString()} {currency}</span>
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
