'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
  Wallet,
  Building,
  User,
  ExternalLink,
  Lock,
  Unlock,
} from 'lucide-react';

export default function ArchitectEscrowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');

  async function loadDetail() {
    if (!id) return;
    try {
      const res = await fetch(`/api/architect/wallet/escrows/${id}`);
      const json = await res.json();
      if (json.success) {
        setEscrow(json.escrow);
      }
    } catch (err) {
      console.error('Failed to load escrow detail', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [id]);

  useEffect(() => {
    if (!escrow?.acceptanceDeadline) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(escrow.acceptanceDeadline).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Acceptance period expired (Auto-release eligible)');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [escrow?.acceptanceDeadline]);

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-800 rounded-lg" />
        <div className="h-10 w-64 bg-slate-800 rounded-xl" />
        <div className="h-48 bg-slate-800/60 rounded-3xl" />
        <div className="h-64 bg-slate-800/40 rounded-3xl" />
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="p-10 max-w-xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Escrow Transaction Not Found</h2>
        <p className="text-sm text-slate-400">The requested escrow transaction could not be located.</p>
        <Link
          href="/architect/wallet"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-amber-400 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Wallet</span>
        </Link>
      </div>
    );
  }

  const currency = escrow.currency || 'XAF';
  const gross = Number(escrow.grossAmount || escrow.amount);
  const fee = Number(escrow.platformFee || 0);
  const net = Number(escrow.amount);
  const isReleased = escrow.status === 'RELEASED';
  const isDisputed = escrow.status === 'DISPUTED';

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-8 text-slate-100">
      {/* Header */}
      <div>
        <Link
          href="/architect/wallet"
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Wallet</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
              Escrow ID: {escrow.id}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {escrow.projectName}
            </h1>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${
              isDisputed
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : isReleased
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {isDisputed ? 'In Dispute' : isReleased ? 'Escrow Released' : 'Client Review'}
          </span>
        </div>
      </div>

      {/* Financial Breakdown Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <span className="text-xs text-slate-400 font-medium block">Total Client Payment</span>
          <span className="text-xl sm:text-2xl font-extrabold text-white mt-1 block">
            {gross.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
          </span>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" /> Confirmed via MoMo / Card
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-400 font-medium block">Platform Commission (10%)</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-300 mt-1 block">
            {fee.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            BuildSmart Infrastructure & Escrow
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-400 font-medium block">Net Architect Escrow</span>
          <span className="text-xl sm:text-2xl font-extrabold text-amber-400 mt-1 block">
            {net.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {isReleased ? 'Funds available for withdrawal' : 'Secured in escrow hold'}
          </span>
        </div>
      </div>

      {/* Acceptance Window Notice */}
      {!isReleased && !isDisputed && (
        <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">Acceptance Period Active (72h Guarantee)</span>
              <p className="text-xs text-amber-300/80 mt-0.5">
                If the client does not request a revision or file a dispute before the deadline, funds will automatically release to your available balance.
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Countdown</span>
            <span className="font-mono font-bold text-sm text-amber-300">{timeLeft || '72h remaining'}</span>
          </div>
        </div>
      )}

      {/* Step Timeline */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <h3 className="text-base font-bold text-white">Escrow Progression Timeline</h3>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="w-0.5 h-12 bg-emerald-500/30 my-1" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">1. Design Created & Submitted</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Architect completed draft 2D/3D floor plan. Protected preview with dynamic watermark was generated.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="w-0.5 h-12 bg-emerald-500/30 my-1" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">2. Client Funded Escrow</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Client secured {gross.toLocaleString()} {currency} via Mobile Money / Card. Net {net.toLocaleString()} {currency} locked into pending escrow.
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                Funded: {escrow.fundedAt ? new Date(escrow.fundedAt).toLocaleString() : 'Confirmed'}
              </span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Unlock className="w-4 h-4" />
              </div>
              <div className="w-0.5 h-12 bg-slate-700 my-1" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">3. Final Deliverable Unlocked</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Client received full access to dimensioned measurements, 2D CAD files, and 3D scenes.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isReleased
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse'
              }`}>
                {isReleased ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {isReleased ? '4. Escrow Released' : '4. Client Review & Acceptance Window'}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                {isReleased
                  ? `Funds released to architect available balance. Reason: ${escrow.releaseReason || 'CLIENT_APPROVED'}`
                  : 'Client is reviewing the final deliverable. Funds will release upon approval or automatic window expiry.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revision History Section */}
      {escrow.revisions && escrow.revisions.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <span>Revision History ({escrow.revisions.length}/{escrow.maxRevisions || 2})</span>
          </h3>

          <div className="space-y-3">
            {escrow.revisions.map((rev: any) => (
              <div key={rev.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="font-bold text-white">Revision #{rev.revisionNumber}</span>
                  <span className="font-mono">{new Date(rev.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-slate-300"><span className="text-slate-500">Client Request:</span> {rev.clientRequest}</p>
                {rev.architectResponse && (
                  <p className="text-amber-300/90 pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500">Architect Response:</span> {rev.architectResponse}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
