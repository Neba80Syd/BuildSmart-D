'use client';

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, btnGhost, btnPrimary } from '@/Frontend/components/admin/shared';

const CHECKLIST_ITEMS = [
  { id: 'identity', label: 'Legal name matches civil and user registry records' },
  { id: 'license', label: 'License / Commercial registration number authenticated' },
  { id: 'seal', label: 'Official governing board seal, signature, and stamp present' },
  { id: 'validity', label: 'Document is active, unexpired, and within validity window' },
  { id: 'legible', label: 'Document resolution is legible without alterations or tampering' },
];

const PRESET_NOTES = [
  'All credentials authenticated against national council registry. Certified for full platform privileges.',
  'Professional license verified valid. Approved.',
  'One or more documents appear illegible or incomplete. Please re-upload clear color scans.',
  'Registration number could not be authenticated. Please submit your active council certificate.',
];

export default function AdminVerificationPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [adminNote, setAdminNote] = useState<string>('');
  const [currentDocNote, setCurrentDocNote] = useState<string>('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    identity: true,
    license: true,
    seal: true,
    validity: true,
    legible: true,
  });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    return p.toString();
  }, [status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/verification${query ? `?${query}` : ''}`);

  const openDetail = (item: any) => {
    setDetail(item);
    setSelectedDocIndex(0);
    setZoomLevel(1);
    setRotation(0);
    setAdminNote('');
    setCurrentDocNote(item?.docs?.[0]?.notes || '');
    // Reset checklist to all true by default
    setChecklist({
      identity: true,
      license: true,
      seal: true,
      validity: true,
      legible: true,
    });
  };

  const activeDoc = detail?.docs?.[selectedDocIndex] || detail?.docs?.[0] || null;

  // Sync doc note when switching active doc
  useEffect(() => {
    if (activeDoc) {
      setCurrentDocNote(activeDoc.notes || '');
      setZoomLevel(1);
      setRotation(0);
    }
  }, [selectedDocIndex, activeDoc?.id, activeDoc?.name]);

  // Keyboard navigation for documents (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (!detail) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
      if (e.key === 'ArrowRight' || e.key === 'j') {
        setSelectedDocIndex((idx) => Math.min((detail.docs?.length ?? 1) - 1, idx + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        setSelectedDocIndex((idx) => Math.max(0, idx - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detail]);

  const decide = async (item: any, action: string) => {
    setBusy(item.userId + action);
    try {
      await api('PATCH', '/api/admin/verification', {
        type: item.type,
        userId: item.userId,
        action,
        note: adminNote || undefined,
      });
      toast.success(`${item.name}: ${action.replace('_', ' ')}`);
      refetch();
      setDetail(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const verifySingleDoc = async (
    doc: any,
    docStatus: 'VERIFIED' | 'REJECTED' | 'INFO_REQUIRED' | 'PENDING',
    noteToSave?: string
  ) => {
    if (!detail) return;
    const note = noteToSave !== undefined ? noteToSave : currentDocNote;
    try {
      await api('PATCH', '/api/admin/verification', {
        type: detail.type,
        userId: detail.userId,
        action: 'verify_doc',
        docId: doc.id,
        docName: doc.name,
        docStatus,
        docNotes: note,
      });
      toast.success(`"${doc.name}" marked as ${docStatus.replace('_', ' ')}`);

      // Update local state in detail immediately
      setDetail((prev: any) => {
        if (!prev) return prev;
        const updatedDocs = prev.docs.map((d: any) =>
          (doc.id && d.id === doc.id) || d.name === doc.name
            ? { ...d, status: docStatus, notes: note, verifiedAt: new Date().toISOString() }
            : d
        );
        return { ...prev, docs: updatedDocs };
      });
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to update document status');
    }
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const queue = (data?.queue ?? []).filter((i: any) =>
    q ? `${i.name} ${i.type} ${i.status} ${i.licenseNumber ?? ''} ${i.taxId ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true
  );

  const totalDocsCount = detail?.docs?.length ?? 0;
  const verifiedDocsCount = detail?.docs?.filter((d: any) => d.status === 'VERIFIED').length ?? 0;
  const rejectedDocsCount = detail?.docs?.filter((d: any) => d.status === 'REJECTED').length ?? 0;
  const flaggedDocsCount = detail?.docs?.filter((d: any) => d.status === 'INFO_REQUIRED').length ?? 0;
  const pendingDocsCount = detail?.docs?.filter((d: any) => !d.status || d.status === 'PENDING').length ?? 0;
  const allVerified = totalDocsCount > 0 && verifiedDocsCount === totalDocsCount;
  const checkedCriteriaCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Verification Center"
        subtitle="Crosscheck credentials, inspect documents, and certify professionals & vendors"
        crumbs={['Admin', 'User Management', 'Verification']}
      />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80">
            <SearchBox value={q} onChange={setQ} placeholder="Search applicant, license, or store…" />
          </div>
          <FilterChips
            options={['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'VERIFIED', 'FULLY_VERIFIED', 'REJECTED', 'SUSPENDED']}
            value={status}
            onChange={setStatus}
            label="Status"
          />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load queue.</p>}
        {loading ? (
          <TableShell>
            <tbody>
              <SkeletonRows cols={6} />
            </tbody>
          </TableShell>
        ) : queue.length === 0 ? (
          <EmptyState
            icon="fact_check"
            title="No applications found"
            body="No verification applications match your search and filter criteria."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Applicant</Th>
                <Th>Type</Th>
                <Th>License / Reference</Th>
                <Th>Credentials Uploaded</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r: any) => {
                const docCount = r.docs?.length ?? 0;
                const vCount = r.docs?.filter((d: any) => d.status === 'VERIFIED').length ?? 0;

                return (
                  <tr
                    key={r.type + r.userId}
                    className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors"
                  >
                    <Td className="font-semibold text-on-surface dark:text-inverse-on-surface">
                      <button
                        onClick={() => openDetail(r)}
                        className="hover:text-primary dark:hover:text-primary-fixed hover:underline text-left flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span>{r.name}</span>
                          <span className="block text-[11px] font-normal text-on-surface-variant">
                            {r.type === 'ARCHITECT' ? 'Architect Profile' : 'Material Vendor'}
                          </span>
                        </div>
                      </button>
                    </Td>
                    <Td>
                      <StatusPill status={r.type} tone={r.type === 'ARCHITECT' ? 'blue' : 'green'} />
                    </Td>
                    <Td className="font-mono text-on-surface-variant dark:text-surface-variant text-body-sm">
                      {r.licenseNumber ?? r.taxId ?? '—'}
                    </Td>
                    <Td>
                      <button
                        onClick={() => openDetail(r)}
                        className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">folder_open</span>
                        <span>
                          {docCount} {docCount === 1 ? 'document' : 'documents'}
                        </span>
                        {docCount > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
                            {vCount}/{docCount}
                          </span>
                        )}
                      </button>
                    </Td>
                    <Td>
                      <StatusPill status={r.status} />
                    </Td>
                    <Td>
                      {['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'DRAFT', 'UNVERIFIED'].includes(r.status) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openDetail(r)}
                            className="btn-primary text-label-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm font-semibold"
                          >
                            <span className="material-symbols-outlined text-[15px]">fact_check</span>
                            Crosscheck
                          </button>
                          <button
                            disabled={busy === r.userId + 'approve'}
                            onClick={() => decide(r, 'approve')}
                            className="text-label-md text-[#2F6B50] dark:text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy === r.userId + 'reject'}
                            onClick={() => decide(r, 'reject')}
                            className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : r.status === 'VERIFIED' || r.status === 'FULLY_VERIFIED' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetail(r)}
                            className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            View Docs
                          </button>
                          <button
                            disabled={busy === r.userId + 'revoke'}
                            onClick={() => decide(r, 'revoke')}
                            className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={busy === r.userId + 'reverify'}
                          onClick={() => decide(r, 'reverify')}
                          className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50"
                        >
                          Re-open
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      {/* Comprehensive Crosscheck & Inspection Modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.name} — ${detail.type} Verification & Document Crosscheck` : ''}
        extraWide
      >
        {detail && (
          <div className="space-y-4">
            {/* Top Applicant Metadata Header */}
            <div className="p-4 rounded-xl bg-surface-container-low dark:bg-surface-variant border border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-primary/20 shrink-0">
                  {detail.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-title-lg font-bold text-on-surface dark:text-inverse-on-surface">
                      {detail.name}
                    </h4>
                    <StatusPill status={detail.type} tone={detail.type === 'ARCHITECT' ? 'blue' : 'green'} />
                    <StatusPill status={detail.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">
                    <span>
                      {detail.type === 'ARCHITECT' ? 'License No:' : 'Commercial Reg (RCCM):'}{' '}
                      <strong className="font-mono text-on-surface dark:text-inverse-on-surface">
                        {detail.licenseNumber ?? detail.taxId ?? 'N/A'}
                      </strong>
                    </span>
                    {detail.taxId && (
                      <span>
                        Tax ID (TIN):{' '}
                        <strong className="font-mono text-on-surface dark:text-inverse-on-surface">{detail.taxId}</strong>
                      </span>
                    )}
                    {detail.experience != null && (
                      <span>
                        Experience:{' '}
                        <strong className="text-on-surface dark:text-inverse-on-surface">{detail.experience} years</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Summary Pill */}
              <div className="flex flex-col sm:items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-body-xs text-on-surface-variant font-medium">Crosscheck Progress:</span>
                  <span className="text-label-md font-bold text-primary dark:text-primary-fixed-dim">
                    {verifiedDocsCount} of {totalDocsCount} Verified
                  </span>
                </div>
                <div className="w-44 h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: totalDocsCount > 0 ? `${(verifiedDocsCount / totalDocsCount) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Main Crosscheck Workspace: Split Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Uploaded Documents List & Verification Checklist */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-title-sm font-bold text-on-surface dark:text-inverse-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[20px]">folder_shared</span>
                    Uploaded Documents ({totalDocsCount})
                  </h5>
                  <span className="text-[11px] text-on-surface-variant">Select to view</span>
                </div>

                {/* Documents List */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {totalDocsCount > 0 ? (
                    detail.docs.map((d: any, idx: number) => {
                      const isSelected = selectedDocIndex === idx;
                      const isImage = d.fileType?.startsWith('image/') || d.name?.match(/\.(png|jpe?g|webp|svg)$/i);
                      const isPdf = d.name?.endsWith('.pdf') || d.fileType === 'application/pdf';

                      return (
                        <div
                          key={d.id || idx}
                          onClick={() => setSelectedDocIndex(idx)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary'
                              : 'border-outline-variant hover:border-primary/40 bg-surface-container-low dark:bg-surface-variant'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Thumbnail or Category Icon */}
                            {isImage && d.fileData ? (
                              <img
                                src={d.fileData}
                                alt={d.name}
                                className="w-12 h-12 object-cover rounded-lg border border-outline-variant shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 text-primary">
                                <span className="material-symbols-outlined text-[24px]">
                                  {isPdf ? 'picture_as_pdf' : 'description'}
                                </span>
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">
                                  {d.name}
                                </p>
                                <span
                                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                    d.status === 'VERIFIED'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : d.status === 'REJECTED'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                                        : d.status === 'INFO_REQUIRED'
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  {d.status ?? 'PENDING'}
                                </span>
                              </div>

                              <p className="text-[11px] text-on-surface-variant dark:text-surface-variant mt-0.5 flex items-center gap-1.5">
                                <span className="uppercase font-medium text-primary">
                                  {d.kind?.replace('_', ' ')}
                                </span>
                                <span>·</span>
                                <span>{d.size ? `${Math.round(d.size / 1024)} KB` : 'Attached'}</span>
                              </p>

                              {/* Per-Document Fast Action Buttons */}
                              <div
                                className="flex items-center gap-1 mt-2 pt-2 border-t border-outline-variant/40"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => verifySingleDoc(d, 'VERIFIED')}
                                  title="Mark this document as authenticated and verified valid"
                                  className={`px-2 py-0.5 rounded text-[10.5px] font-semibold flex items-center gap-1 transition-colors ${
                                    d.status === 'VERIFIED'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">check</span>
                                  Verified
                                </button>
                                <button
                                  type="button"
                                  onClick={() => verifySingleDoc(d, 'INFO_REQUIRED')}
                                  title="Flag document as illegible or requiring correction"
                                  className={`px-2 py-0.5 rounded text-[10.5px] font-semibold flex items-center gap-1 transition-colors ${
                                    d.status === 'INFO_REQUIRED'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">help</span>
                                  Needs Info
                                </button>
                                <button
                                  type="button"
                                  onClick={() => verifySingleDoc(d, 'REJECTED')}
                                  title="Reject document as invalid"
                                  className={`px-2 py-0.5 rounded text-[10.5px] font-semibold flex items-center gap-1 transition-colors ${
                                    d.status === 'REJECTED'
                                      ? 'bg-red-600 text-white'
                                      : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">close</span>
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-5 text-center border border-dashed border-outline-variant rounded-xl">
                      <p className="text-body-sm text-on-surface-variant italic">
                        No documents currently attached to this profile.
                      </p>
                    </div>
                  )}
                </div>

                {/* Verification Crosscheck Audit Checklist */}
                <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low dark:bg-surface-variant text-body-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-on-surface dark:text-inverse-on-surface uppercase text-[11px] tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">fact_check</span>
                      Audit Crosscheck Criteria
                    </p>
                    <span className="text-[10px] text-primary font-bold">
                      {checkedCriteriaCount}/{CHECKLIST_ITEMS.length} Passed
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {CHECKLIST_ITEMS.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 cursor-pointer text-on-surface-variant hover:text-on-surface select-none"
                      >
                        <input
                          type="checkbox"
                          checked={!!checklist[item.id]}
                          onChange={() => toggleChecklist(item.id)}
                          className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span className="text-[11.5px] leading-tight">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Full-Resolution Document Viewer & Crosscheck Inspector */}
              <div className="lg:col-span-8 p-4 rounded-xl border border-outline-variant bg-surface-container-low dark:bg-surface-variant space-y-3">
                {/* Viewer Header & Tools */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-outline-variant">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] uppercase font-bold text-primary tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                        {activeDoc?.kind?.replace('_', ' ') ?? 'Document'}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Doc {totalDocsCount > 0 ? selectedDocIndex + 1 : 0} of {totalDocsCount}
                      </span>
                    </div>
                    <h5 className="font-bold text-title-sm text-on-surface dark:text-inverse-on-surface truncate mt-0.5">
                      {activeDoc?.name || 'No document selected'}
                    </h5>
                  </div>

                  {activeDoc && (
                    <div className="flex items-center gap-1.5">
                      {/* Previous / Next Document buttons */}
                      <button
                        type="button"
                        onClick={() => setSelectedDocIndex((idx) => Math.max(0, idx - 1))}
                        disabled={selectedDocIndex === 0}
                        className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant disabled:opacity-30"
                        title="Previous Document (Left Arrow)"
                      >
                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDocIndex((idx) => Math.min(totalDocsCount - 1, idx + 1))}
                        disabled={selectedDocIndex >= totalDocsCount - 1}
                        className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant disabled:opacity-30"
                        title="Next Document (Right Arrow)"
                      >
                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                      </button>

                      <div className="h-4 w-px bg-outline-variant mx-1" />

                      {/* Zoom Controls */}
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
                        className="p-1 rounded hover:bg-surface-container text-on-surface-variant"
                        title="Zoom out"
                      >
                        <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                      </button>
                      <span className="text-[11px] font-mono font-semibold w-10 text-center">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.2) * 10) / 10))}
                        className="p-1 rounded hover:bg-surface-container text-on-surface-variant"
                        title="Zoom in"
                      >
                        <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                        className="px-1.5 py-0.5 rounded hover:bg-surface-container text-on-surface-variant text-[10.5px]"
                        title="Reset zoom & rotation"
                      >
                        Reset
                      </button>

                      {/* Rotate Button */}
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="p-1 rounded hover:bg-surface-container text-on-surface-variant"
                        title="Rotate 90 degrees clockwise"
                      >
                        <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                      </button>

                      {/* Fullscreen Lightbox Button */}
                      {activeDoc.fileData && (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(activeDoc.fileData)}
                          className="px-2 py-1 rounded bg-surface-container text-primary hover:bg-surface-container-high font-semibold flex items-center gap-1 text-[11px]"
                          title="Open Fullscreen Lightbox"
                        >
                          <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                          Expand
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Viewport Area */}
                <div className="h-[430px] overflow-auto flex items-center justify-center bg-slate-950/5 dark:bg-black/50 rounded-xl p-3 border border-outline-variant/60 relative select-none">
                  {activeDoc?.fileData ? (
                    activeDoc.fileType?.startsWith('image/') ||
                    activeDoc.fileType === 'image/svg+xml' ||
                    activeDoc.name?.match(/\.(png|jpe?g|webp|svg)$/i) ||
                    activeDoc.fileData.startsWith('data:image/') ? (
                      <div
                        className="transition-all duration-150 flex items-center justify-center max-w-full max-h-full"
                        style={{
                          transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                          transformOrigin: 'center center',
                        }}
                      >
                        <img
                          src={activeDoc.fileData}
                          alt={activeDoc.name}
                          className="max-h-[400px] max-w-full object-contain rounded-lg shadow-md cursor-zoom-in bg-white"
                          onClick={() => setLightboxUrl(activeDoc.fileData)}
                          title="Click to view full resolution"
                        />
                      </div>
                    ) : activeDoc.name?.endsWith('.pdf') || activeDoc.fileType === 'application/pdf' ? (
                      activeDoc.fileData.startsWith('data:application/pdf') || activeDoc.fileData.startsWith('http') ? (
                        <object
                          data={activeDoc.fileData}
                          type="application/pdf"
                          className="w-full h-full rounded-lg bg-white"
                        >
                          <div className="p-8 text-center space-y-3">
                            <span className="material-symbols-outlined text-primary text-[52px]">picture_as_pdf</span>
                            <p className="font-bold text-body-md text-on-surface dark:text-inverse-on-surface">
                              {activeDoc.name}
                            </p>
                            <a
                              href={activeDoc.fileData}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary text-label-sm px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                              Open PDF Document in Browser
                            </a>
                          </div>
                        </object>
                      ) : (
                        <div className="p-8 text-center space-y-3">
                          <span className="material-symbols-outlined text-primary text-[52px]">picture_as_pdf</span>
                          <div>
                            <p className="font-bold text-body-md text-on-surface dark:text-inverse-on-surface">
                              {activeDoc.name}
                            </p>
                            <p className="text-body-xs text-on-surface-variant mt-1">
                              PDF Document ({activeDoc.size ? `${Math.round(activeDoc.size / 1024)} KB` : 'Binary File'})
                            </p>
                          </div>
                          <a
                            href={activeDoc.fileData}
                            download={activeDoc.name}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary text-label-sm px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            Download PDF File
                          </a>
                        </div>
                      )
                    ) : (
                      <div className="p-8 text-center space-y-3">
                        <span className="material-symbols-outlined text-primary text-[52px]">description</span>
                        <p className="font-bold text-body-md text-on-surface dark:text-inverse-on-surface">
                          {activeDoc.name}
                        </p>
                        <a
                          href={activeDoc.fileData}
                          download={activeDoc.name}
                          className="btn-primary text-label-sm px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                          Download Document
                        </a>
                      </div>
                    )
                  ) : (
                    <div className="text-center p-8 space-y-2">
                      <span className="material-symbols-outlined text-on-surface-variant text-[44px]">visibility_off</span>
                      <p className="text-body-sm text-on-surface-variant italic">
                        Select a document from the left column to inspect.
                      </p>
                    </div>
                  )}
                </div>

                {/* Active Document Details & Per-Doc Crosscheck Verdict Toolbar */}
                {activeDoc && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-body-xs text-on-surface-variant">
                      <div className="flex items-center gap-3">
                        <span>
                          Status:{' '}
                          <strong
                            className={
                              activeDoc.status === 'VERIFIED'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : activeDoc.status === 'REJECTED'
                                  ? 'text-error dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {activeDoc.status ?? 'PENDING'}
                          </strong>
                        </span>
                        {activeDoc.uploadedAt && (
                          <span>
                            Uploaded:{' '}
                            <strong className="text-on-surface dark:text-inverse-on-surface">
                              {new Date(activeDoc.uploadedAt).toLocaleDateString()}
                            </strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {activeDoc.fileData && (
                          <a
                            href={activeDoc.fileData}
                            download={activeDoc.name}
                            className="text-primary hover:underline flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                            Download File
                          </a>
                        )}
                        {activeDoc.fileData && (
                          <a
                            href={activeDoc.fileData}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-[11px] font-semibold"
                          >
                            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                            Open New Tab
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Per-Document Review Note Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={currentDocNote}
                        onChange={(e) => setCurrentDocNote(e.target.value)}
                        placeholder="Document audit remarks (e.g. Seal authenticated with National Council registry)..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest dark:bg-surface-container text-body-xs text-on-surface dark:text-inverse-on-surface focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => verifySingleDoc(activeDoc, activeDoc.status || 'VERIFIED', currentDocNote)}
                        className="btn-ghost text-label-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                        title="Save note on this document"
                      >
                        Save Note
                      </button>
                    </div>

                    {/* Per-Document Large Verdict Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        Document Verdict:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => verifySingleDoc(activeDoc, 'VERIFIED')}
                          className={`px-3 py-1.5 rounded-lg text-label-xs font-bold flex items-center gap-1.5 transition-colors ${
                            activeDoc.status === 'VERIFIED'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">verified</span>
                          Mark as Verified Valid
                        </button>
                        <button
                          type="button"
                          onClick={() => verifySingleDoc(activeDoc, 'INFO_REQUIRED')}
                          className={`px-3 py-1.5 rounded-lg text-label-xs font-bold flex items-center gap-1.5 transition-colors ${
                            activeDoc.status === 'INFO_REQUIRED'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">help_outline</span>
                          Flag: Needs Info
                        </button>
                        <button
                          type="button"
                          onClick={() => verifySingleDoc(activeDoc, 'REJECTED')}
                          className={`px-3 py-1.5 rounded-lg text-label-xs font-bold flex items-center gap-1.5 transition-colors ${
                            activeDoc.status === 'REJECTED'
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">cancel</span>
                          Reject Document
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Decision & Audit Action Panel */}
            <div className="pt-3 border-t border-outline-variant space-y-3">
              {/* Crosscheck Status Alerts */}
              {allVerified ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-body-sm text-emerald-900 dark:text-emerald-200">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">check_circle</span>
                  <span>
                    <strong>All {totalDocsCount} documents crosschecked and verified valid.</strong> Ready to certify and unlock full dashboard functionality.
                  </span>
                </div>
              ) : flaggedDocsCount > 0 || rejectedDocsCount > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center gap-2 text-body-sm text-amber-900 dark:text-amber-200">
                  <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0">warning</span>
                  <span>
                    <strong>Attention:</strong> {flaggedDocsCount > 0 ? `${flaggedDocsCount} document(s) need clarification` : ''}{' '}
                    {rejectedDocsCount > 0 ? `${rejectedDocsCount} document(s) marked invalid` : ''}. Consider requesting info before approving.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-surface-container-low dark:bg-surface-variant border border-outline-variant flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
                  <span>
                    Crosscheck in progress: {verifiedDocsCount} of {totalDocsCount} documents verified ({pendingDocsCount} pending inspection).
                  </span>
                </div>
              )}

              {/* Admin Overall Notes & Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-body-sm font-bold text-on-surface dark:text-inverse-on-surface">
                    Administrator Review Feedback / Official Notice
                  </label>
                  <span className="text-[11px] text-on-surface-variant">Sent to applicant upon decision</span>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {PRESET_NOTES.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setAdminNote(preset)}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      {preset.slice(0, 48)}…
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Enter administrator remarks or feedback for the applicant..."
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest dark:bg-surface-container text-body-sm text-on-surface dark:text-inverse-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  {['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'DRAFT', 'UNVERIFIED'].includes(detail.status) && (
                    <>
                      <button
                        className="btn-primary px-5 py-2.5 text-label-md rounded-lg flex items-center gap-2 shadow-md font-bold"
                        disabled={busy === detail.userId + 'approve'}
                        onClick={() => decide(detail, 'approve')}
                      >
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        Approve &amp; Certify ({verifiedDocsCount}/{totalDocsCount} Verified)
                      </button>

                      <button
                        className="px-4 py-2.5 rounded-lg text-label-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 hover:bg-amber-100 transition-colors font-semibold"
                        disabled={busy === detail.userId + 'request_info'}
                        onClick={() => decide(detail, 'request_info')}
                      >
                        Request Info / Re-upload
                      </button>

                      <button
                        className="bg-error/10 text-error dark:text-red-300 border border-error/30 hover:bg-error/20 px-4 py-2.5 rounded-lg text-label-md transition-colors font-semibold"
                        disabled={busy === detail.userId + 'reject'}
                        onClick={() => decide(detail, 'reject')}
                      >
                        Reject Application
                      </button>
                    </>
                  )}

                  {detail.status === 'VERIFIED' || detail.status === 'FULLY_VERIFIED' ? (
                    <button
                      className="bg-error/10 text-error dark:text-red-300 border border-error/30 hover:bg-error/20 px-4 py-2 rounded-lg text-label-md transition-colors font-semibold"
                      disabled={busy === detail.userId + 'revoke'}
                      onClick={() => decide(detail, 'revoke')}
                    >
                      Revoke Certification
                    </button>
                  ) : null}
                </div>

                <button type="button" className={btnGhost} onClick={() => setDetail(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Fullscreen Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm select-none"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-[95vw] max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-12 right-0 flex items-center gap-3 text-white">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                className="p-1 rounded hover:bg-white/20"
                title="Zoom out"
              >
                <span className="material-symbols-outlined">zoom_out</span>
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.2))}
                className="p-1 rounded hover:bg-white/20"
                title="Zoom in"
              >
                <span className="material-symbols-outlined">zoom_in</span>
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 rounded hover:bg-white/20"
                title="Rotate"
              >
                <span className="material-symbols-outlined">rotate_right</span>
              </button>
              <button
                onClick={() => setLightboxUrl(null)}
                className="p-1 rounded hover:bg-white/20 flex items-center gap-1 text-label-md font-bold"
              >
                <span className="material-symbols-outlined">close</span> Close
              </button>
            </div>

            <img
              src={lightboxUrl}
              alt="Fullscreen document preview"
              className="max-w-full max-h-[86vh] object-contain rounded-xl shadow-2xl border border-white/20 bg-white"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
