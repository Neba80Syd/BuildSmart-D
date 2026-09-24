'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, Clock, AlertTriangle, CheckCircle2, Download, FileText, ArrowRight, RotateCcw, MessageSquare } from 'lucide-react';

interface ProtectedDesignViewerProps {
  designId: string;
  projectId?: string;
  projectName?: string;
  clientName?: string;
  architectName?: string;
  amount?: number;
  currency?: string;
  isUnlockedDefault?: boolean;
  acceptanceDeadline?: string | null;
  revisionCount?: number;
  maxRevisions?: number;
  onApprove?: () => Promise<void> | void;
  onRequestRevision?: (notes: string) => Promise<void> | void;
  onDispute?: (reason: string, description: string) => Promise<void> | void;
  onFundEscrow?: () => Promise<void> | void;
  children: React.ReactNode;
}

export function ProtectedDesignViewer({
  designId,
  projectId,
  projectName = 'Modern Architectural Design',
  clientName = 'Valued Client',
  architectName = 'Architectural Specialist',
  amount = 150000,
  currency = 'XAF',
  isUnlockedDefault = false,
  acceptanceDeadline,
  revisionCount = 0,
  maxRevisions = 2,
  onApprove,
  onRequestRevision,
  onDispute,
  onFundEscrow,
  children,
}: ProtectedDesignViewerProps) {
  const [isUnlocked, setIsUnlocked] = useState(isUnlockedDefault);
  const [loading, setLoading] = useState(true);
  const [escrowStatus, setEscrowStatus] = useState<string>('PAYMENT_REQUIRED');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [disputeReason, setDisputeReason] = useState('Design does not match agreed requirements');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch live preview status
  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await fetch(`/api/designs/${designId}/preview`);
        const json = await res.json();
        if (isMounted && json.success) {
          setIsUnlocked(json.isUnlocked);
          setEscrowStatus(json.escrowStatus);
        }
      } catch (err) {
        console.error('Failed to load preview status', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [designId]);

  // Acceptance window countdown timer
  useEffect(() => {
    if (!acceptanceDeadline) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(acceptanceDeadline).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Expired — Auto-releasing');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [acceptanceDeadline]);

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this design deliverable? This will securely release the held escrow funds to the architect.')) {
      return;
    }
    setActionLoading(true);
    try {
      if (onApprove) {
        await onApprove();
      } else {
        const res = await fetch(`/api/designs/${designId}/escrow/approve`, { method: 'POST' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to approve design');
      }
      setIsUnlocked(true);
      setEscrowStatus('RELEASED');
      setToastMessage('Design deliverable approved! Escrow funds released to architect.');
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionNotes.trim()) return;
    setActionLoading(true);
    try {
      if (onRequestRevision) {
        await onRequestRevision(revisionNotes);
      } else {
        const res = await fetch(`/api/designs/${designId}/escrow/revision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'request', requestNotes: revisionNotes }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to submit revision');
      }
      setShowRevisionModal(false);
      setRevisionNotes('');
      setEscrowStatus('REVISION_REQUESTED');
      setToastMessage('Revision request submitted to architect.');
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Revision request failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDescription.trim()) return;
    setActionLoading(true);
    try {
      if (onDispute) {
        await onDispute(disputeReason, disputeDescription);
      } else {
        const res = await fetch(`/api/designs/${designId}/escrow/dispute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: disputeReason, description: disputeDescription }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to submit dispute');
      }
      setShowDisputeModal(false);
      setEscrowStatus('DISPUTED');
      setToastMessage('Problem reported. Escrow payment is paused under dispute review.');
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Dispute submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerFunding = async () => {
    if (onFundEscrow) {
      await onFundEscrow();
    } else {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/designs/${designId}/escrow/fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, paymentMethod: 'MTN_MOMO' }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fund escrow');
        setIsUnlocked(true);
        setEscrowStatus('ESCROWED');
        setToastMessage(`Payment of ${amount.toLocaleString()} ${currency} confirmed! Full design unlocked.`);
        setTimeout(() => setToastMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || 'Payment initiation failed');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const watermarkStamp = `BUILDSMART • PROJECT #${projectId?.slice(-6)?.toUpperCase() || 'BS-1042'} • CLIENT: ${clientName.toUpperCase()} • ARCHITECT: ${architectName.toUpperCase()} • PREVIEW / UNPAID • NOT FINAL DELIVERABLE`;

  return (
    <div className="relative flex flex-col w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-white shadow-xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Protection Banner */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-medium border-b ${
        isUnlocked
          ? 'bg-emerald-950/70 border-emerald-800/40 text-emerald-200'
          : 'bg-amber-950/80 border-amber-800/40 text-amber-200'
      }`}>
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <>
              <Unlock className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-emerald-300 uppercase tracking-wider">Final Deliverable Unlocked</span>
              <span className="text-emerald-400/60 hidden sm:inline">• Escrow Funded & Secured</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-semibold text-amber-300 uppercase tracking-wider">Protected Preview Mode</span>
              <span className="text-amber-400/70 hidden sm:inline">• Watermark Active • Payment Required to Unlock CAD/Exports</span>
            </>
          )}
        </div>

        {/* Countdown / Review Status */}
        {isUnlocked && escrowStatus !== 'RELEASED' && acceptanceDeadline && (
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-300 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto-release in:</span>
            <span className="font-mono font-bold text-amber-300">{timeLeft || '72h remaining'}</span>
          </div>
        )}

        {isUnlocked && escrowStatus === 'RELEASED' && (
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Escrow Released & Approved</span>
          </div>
        )}

        {!isUnlocked && (
          <button
            type="button"
            onClick={handleTriggerFunding}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md active:scale-95 cursor-pointer"
          >
            <span>Fund Escrow ({amount.toLocaleString()} {currency})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Content Area with Protected Overlay */}
      <div
        className="relative w-full min-h-[420px] select-none"
        onContextMenu={(e) => {
          if (!isUnlocked) {
            e.preventDefault();
          }
        }}
      >
        {/* Child Canvas / 3D Viewer */}
        <div className={`w-full h-full ${!isUnlocked ? 'filter blur-[0.4px] pointer-events-auto' : ''}`}>
          {children}
        </div>

        {/* Dynamic Watermark Overlay (Only when unpaid / locked) */}
        {!isUnlocked && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden z-20 flex flex-col justify-around opacity-40 select-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='20' y='100' fill='%23ffffff' fill-opacity='0.22' font-size='12' font-weight='800' font-family='sans-serif' transform='rotate(-25 180 100)'%3EBUILDSMART PREVIEW • UNPAID DELIVERABLE%3C/text%3E%3Ctext x='40' y='140' fill='%23fbbf24' fill-opacity='0.25' font-size='10' font-weight='bold' font-family='sans-serif' transform='rotate(-25 180 100)'%3ENOT FINAL • PAYMENT REQUIRED%3C/text%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
            }}
          >
            {/* High-visibility center watermark stamp */}
            <div className="mx-auto my-auto p-6 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-amber-500/30 text-center max-w-md pointer-events-auto shadow-2xl">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Architectural Draft Preview</h3>
              <p className="text-xs text-amber-300 font-mono mb-2 uppercase tracking-wide">
                Project #{projectId?.slice(-6)?.toUpperCase() || 'BS-1042'} • Unpaid Draft
              </p>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Full dimensioned measurements, 2D CAD/DXF exports, and high-resolution 3D models unlock automatically once escrow is funded.
              </p>
              <button
                type="button"
                onClick={handleTriggerFunding}
                disabled={actionLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Fund Escrow ({amount.toLocaleString()} {currency})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Actions Footer (When Unlocked & In Client Review) */}
      {isUnlocked && escrowStatus !== 'RELEASED' && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Acceptance Window Review</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Client Decision Pending</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Revisions: {revisionCount}/{maxRevisions} used
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowDisputeModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Report Problem</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRevisionModal(true)}
              disabled={revisionCount >= maxRevisions}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Request Revision ({revisionCount}/{maxRevisions})</span>
            </button>

            <button
              type="button"
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Design & Release Escrow</span>
            </button>
          </div>
        </div>
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              <span>Request Design Revision</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Revision #{revisionCount + 1} of {maxRevisions} included with your package. The architect will update the floor plan and models accordingly.
            </p>

            <form onSubmit={handleSubmitRevision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Modification Details / Requirements *
                </label>
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  rows={4}
                  required
                  placeholder="e.g. Please expand the kitchen island by 50cm and add an ensuite bathroom window..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !revisionNotes.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>Submit Revision Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold mb-1 text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Report a Problem / Open Dispute</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Filing a dispute pauses the 72-hour timer and locks the escrow funds in buildsmart custody until reviewed by platform mediators.
            </p>

            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dispute Category *
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Design does not match agreed requirements">Design does not match agreed requirements</option>
                  <option value="Incorrect room dimensions or structural errors">Incorrect room dimensions or structural errors</option>
                  <option value="Missing requested rooms or features">Missing requested rooms or features</option>
                  <option value="Incomplete 2D floor plan or 3D render">Incomplete 2D floor plan or 3D render</option>
                  <option value="Agreed revision was not completed">Agreed revision was not completed</option>
                  <option value="Technical or architectural defect">Technical or architectural defect</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Detailed Explanation *
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  rows={4}
                  required
                  placeholder="Provide precise details of the discrepancies or failure to meet the agreed architectural brief..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !disputeDescription.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>File Dispute & Pause Escrow</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
