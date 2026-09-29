'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const VENDOR_KINDS = [
  { key: 'business_registration', label: 'Business Registration (RCCM)', desc: 'Official commercial registry certificate or incorporation document' },
  { key: 'tax_id', label: 'Tax Identification Number (TIN / NIF)', desc: 'Tax compliance certificate, taxpayer card, or VAT certificate' },
  { key: 'store_permit', label: 'Warehouse / Storefront Permit', desc: 'Operating license, warehouse permit, or commercial facility lease' },
  { key: 'identity', label: 'Director / Representative ID', desc: 'National identity card or passport of the authorized business owner' },
];

export default function VendorVerificationPage() {
  const { data, loading, refetch } = useApi<any>('/api/vendor/verification');
  const [upload, setUpload] = useState<null | { kind: string; label: string }>(null);
  const [submitModal, setSubmitModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Business state
  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [filePreview, setFilePreview] = useState<string>('');
  const [docName, setDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (data) {
      setBusinessName(data.businessName || '');
      setRegistrationNumber(data.registrationNumber || '');
      setTaxId(data.taxId || '');
    }
  }, [data]);

  const docs: any[] = data?.verificationDocs ?? [];
  const status = data?.verificationStatus ?? 'DRAFT';
  const isVerified = status === 'FULLY_VERIFIED' || status === 'VERIFIED';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit. Please select a smaller file.');
      return;
    }

    setSelectedFile(file);
    if (!docName) {
      setDocName(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setFileBase64(res);
      if (file.type.startsWith('image/')) {
        setFilePreview(res);
      } else {
        setFilePreview('');
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upload) return;
    if (!docName.trim()) {
      toast.error('Please provide a title for the document.');
      return;
    }
    if (!selectedFile && !fileBase64) {
      toast.error('Please select a file or image to upload.');
      return;
    }

    setUploading(true);
    try {
      await api('POST', '/api/vendor/verification', {
        name: docName.trim() + (selectedFile ? `.${selectedFile.name.split('.').pop()}` : ''),
        kind: upload.kind,
        fileData: fileBase64,
        fileType: selectedFile?.type || 'application/octet-stream',
        fileSize: selectedFile?.size || 0,
      });
      toast.success('Document uploaded successfully');
      setUpload(null);
      setSelectedFile(null);
      setFileBase64('');
      setFilePreview('');
      setDocName('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (doc: any) => {
    try {
      await api('PATCH', '/api/vendor/verification', {
        action: 'delete',
        id: doc.id,
        name: doc.name,
      });
      toast.success('Document removed');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove document');
    }
  };

  const saveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingDetails(true);
    try {
      await api('PATCH', '/api/vendor/verification', {
        action: 'save_details',
        businessName,
        registrationNumber,
        taxId,
      });
      toast.success('Business details saved');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save details');
    } finally {
      setSavingDetails(false);
    }
  };

  const submitVerification = async () => {
    try {
      await api('PATCH', '/api/vendor/verification', {
        action: 'submit',
        businessName,
        registrationNumber,
        taxId,
      });
      toast.success('Vendor verification submitted for admin review!');
      setSubmitModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit verification');
    }
  };

  const setTestStatus = async (targetStatus: string) => {
    try {
      await api('PATCH', '/api/vendor/verification', {
        action: 'set_status',
        status: targetStatus,
      });
      toast.success(`Vendor verification status set to ${targetStatus}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-margin-desktop space-y-4 max-w-[1100px] mx-auto">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto space-y-6">
      <PageHeader
        title="Store Verification & Business Credentials"
        subtitle="Prove your legal business registration and commercial legitimacy to unlock marketplace selling and payouts."
        crumbs={['Vendor', 'Settings', 'Verification']}
        actions={
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            <div className="hidden sm:flex items-center border border-outline-variant dark:border-outline rounded-lg p-1 bg-surface-container-low dark:bg-surface-variant text-body-xs">
              <span className="text-[11px] text-on-surface-variant dark:text-surface-variant px-2">Preview as:</span>
              <button
                type="button"
                onClick={() => setTestStatus('DRAFT')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${status === 'DRAFT' || status === 'UNVERIFIED' ? 'bg-error/20 text-error' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Unverified
              </button>
              <button
                type="button"
                onClick={() => setTestStatus('PENDING')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${status === 'PENDING' ? 'bg-[#FFF4E5] text-[#A66A00]' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setTestStatus('FULLY_VERIFIED')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${isVerified ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Verified
              </button>
            </div>
          </div>
        }
      />

      {/* Dynamic Status Guidance Banner */}
      {(!isVerified && status !== 'PENDING') && (
        <div className="p-4 rounded-xl bg-[#FFF8F8] dark:bg-red-950/20 border border-error/30 flex items-start gap-4">
          <span className="material-symbols-outlined text-error text-[28px] shrink-0">lock</span>
          <div className="flex-1">
            <h3 className="text-body-md font-bold text-error">Vendor Store Restricted — Verification Required</h3>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1 leading-relaxed">
              Your store is currently restricted. Adding public products to the marketplace, restocking inventory, fulfilling orders, and withdrawing earnings are disabled until your business credentials are submitted and verified by platform administration.
            </p>
          </div>
        </div>
      )}

      {status === 'PENDING' && (
        <div className="p-4 rounded-xl bg-[#FFF4E5] dark:bg-yellow-950/20 border border-[#F5D09D] dark:border-yellow-700 flex items-start gap-4">
          <span className="material-symbols-outlined text-[#A66A00] dark:text-yellow-500 text-[28px] shrink-0">hourglass_top</span>
          <div className="flex-1">
            <h3 className="text-body-md font-bold text-[#A66A00] dark:text-yellow-500">Business Verification Under Review</h3>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1 leading-relaxed">
              Your business documents have been received and are being processed by the administration team. You will receive an official notification once approved, and all store sales and inventory tools will unlock automatically.
            </p>
          </div>
        </div>
      )}

      {isVerified && (
        <div className="p-4 rounded-xl bg-[#Eaf7f1] dark:bg-primary-container/20 border border-[#C0E9D7] dark:border-primary flex items-start gap-4">
          <span className="material-symbols-outlined text-[#2F6B50] dark:text-primary text-[28px] shrink-0">verified</span>
          <div className="flex-1">
            <h3 className="text-body-md font-bold text-[#2F6B50] dark:text-primary">Verified Marketplace Vendor</h3>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1 leading-relaxed">
              Your commercial registration and tax credentials are fully certified. Your products appear with the Verified Supplier trust badge across the materials catalog.
            </p>
          </div>
        </div>
      )}

      {/* Business Details Form */}
      <Card>
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant dark:border-outline pb-3">
          <div>
            <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">Commercial Business Identification</h3>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Provide your registered business details as recorded on your government documents.</p>
          </div>
          <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">storefront</span>
        </div>

        <form onSubmit={saveDetails} className="space-y-4">
          <Field label="Official Registered Business Name" hint="As shown on incorporation documents">
            <input
              className={inputClass}
              placeholder="e.g. Prime Materials Ltd"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Commercial Registration # (RCCM)" hint="Commercial trade registry number">
              <input
                className={inputClass}
                placeholder="e.g. RC/DLA/2020/B/1842"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                required
              />
            </Field>

            <Field label="Tax Identification Number (TIN / NIF)" hint="National tax registry identifier">
              <input
                className={inputClass}
                placeholder="e.g. M042012488102A"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="submit" disabled={savingDetails} className={btnGhost}>
              {savingDetails ? 'Saving...' : 'Save Business Details'}
            </button>
          </div>
        </form>
      </Card>

      {/* Document Categories Grid */}
      <div className="space-y-2">
        <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">Legal Documents & Certificates</h3>
        <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
          Upload clear scanned copies or images of your business permits, commercial registrations, and tax identification cards (Max 5MB).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VENDOR_KINDS.map((k) => {
          const docsInKind = docs.filter((d) => d.kind === k.key);

          return (
            <Card key={k.key} className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
                      {k.label}
                      {docsInKind.length > 0 && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </h4>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5">{k.desc}</p>
                  </div>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      setUpload({ kind: k.key, label: k.label });
                      setSelectedFile(null);
                      setFileBase64('');
                      setFilePreview('');
                      setDocName('');
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    Upload
                  </button>
                </div>

                {docsInKind.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-outline-variant dark:border-outline text-center">
                    <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant text-[24px]">attach_file</span>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant italic mt-1">No documents attached yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docsInKind.map((d: any, i: number) => {
                      const isImage = d.fileType?.startsWith('image/') || d.name?.match(/\.(png|jpe?g|webp)$/i);
                      return (
                        <div key={d.id || i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-low dark:bg-surface-variant border border-outline-variant/50 dark:border-outline/50">
                          {isImage && d.fileData ? (
                            <img
                              src={d.fileData}
                              alt={d.name}
                              className="w-9 h-9 object-cover rounded shrink-0 border border-outline-variant"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim text-[22px] shrink-0">
                              {isImage ? 'image' : 'description'}
                            </span>
                          )}

                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(d)}
                              className="text-left font-medium text-body-sm text-on-surface dark:text-inverse-on-surface hover:text-primary dark:hover:text-primary-fixed hover:underline truncate block w-full"
                            >
                              {d.name}
                            </button>
                            <p className="text-[11px] text-on-surface-variant dark:text-surface-variant">
                              {d.fileSize ? `${Math.round(d.fileSize / 1024)} KB` : 'Uploaded file'}
                            </p>
                          </div>

                          <StatusPill status={d.status ?? 'PENDING'} />

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(d)}
                              className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                              title="Preview document"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            <button
                              type="button"
                              className="p-1 text-on-surface-variant hover:text-error transition-colors"
                              title="Remove document"
                              onClick={() => removeDoc(d)}
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Submission Card */}
      <Card className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface-container-low dark:bg-surface-container">
        <div>
          <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">Submit Store for Review</h3>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">
            Store: <strong className="text-on-surface dark:text-inverse-on-surface">{businessName || 'Not set'}</strong> · RCCM: <strong className="text-on-surface dark:text-inverse-on-surface">{registrationNumber || 'Not set'}</strong> · Tax ID: <strong className="text-on-surface dark:text-inverse-on-surface">{taxId || 'Not set'}</strong> · Documents: <strong className="text-on-surface dark:text-inverse-on-surface">{docs.length} uploaded</strong>
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            if (!businessName.trim() || !registrationNumber.trim() || !taxId.trim()) {
              toast.error('Please enter your business name, registration number, and Tax ID before submitting.');
              return;
            }
            if (docs.length === 0) {
              toast.error('Please upload at least one verification document (e.g. Business Registration or Tax Certificate).');
              return;
            }
            setSubmitModal(true);
          }}
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          Submit Store Verification
        </button>
      </Card>

      {/* Upload Document & Image Modal */}
      {upload && (
        <Modal open title={`Upload ${upload.label}`} onClose={() => setUpload(null)}>
          <form onSubmit={uploadDoc} className="space-y-4">
            <Field label="Document Title / Label" hint="Descriptive name for this document">
              <input
                className={inputClass}
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                required
                placeholder="e.g. Commercial Registry Certificate 2024"
              />
            </Field>

            <Field label="Select File or Image" hint="Accepted formats: PDF, PNG, JPG, WEBP (Max 5MB)">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-outline-variant dark:border-outline hover:border-primary dark:hover:border-primary rounded-xl p-6 text-center transition-colors bg-surface-container-lowest dark:bg-surface-container-low"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {filePreview ? (
                  <div className="space-y-2">
                    <img src={filePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg shadow-sm border border-outline-variant" />
                    <p className="text-body-xs text-primary font-medium">{selectedFile?.name} ({Math.round((selectedFile?.size || 0) / 1024)} KB)</p>
                    <p className="text-body-xs text-on-surface-variant">Click to choose a different file</p>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-2">
                    <span className="material-symbols-outlined text-primary text-[36px]">description</span>
                    <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{selectedFile.name}</p>
                    <p className="text-body-xs text-on-surface-variant">{Math.round(selectedFile.size / 1024)} KB · Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-[36px]">cloud_upload</span>
                    <p className="text-body-sm font-medium text-on-surface dark:text-inverse-on-surface">Click to browse or drag & drop file here</p>
                    <p className="text-body-xs text-on-surface-variant">Scan or photo of your business document</p>
                  </div>
                )}
              </div>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setUpload(null)}>Cancel</button>
              <button type="submit" disabled={uploading || !selectedFile} className={btnPrimary}>
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <Modal open title={previewDoc.name} onClose={() => setPreviewDoc(null)} wide>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-body-sm border-b border-outline-variant dark:border-outline pb-2">
              <span className="text-on-surface-variant dark:text-surface-variant">Category: <strong>{previewDoc.kind}</strong></span>
              <StatusPill status={previewDoc.status ?? 'PENDING'} />
            </div>

            {previewDoc.fileData ? (
              previewDoc.fileType?.startsWith('image/') || previewDoc.name?.match(/\.(png|jpe?g|webp)$/i) ? (
                <div className="max-h-[500px] overflow-auto flex justify-center bg-surface-container-low p-2 rounded-lg">
                  <img src={previewDoc.fileData} alt={previewDoc.name} className="max-h-[480px] object-contain rounded" />
                </div>
              ) : (
                <div className="p-8 text-center bg-surface-container-low rounded-lg space-y-4">
                  <span className="material-symbols-outlined text-primary text-[48px]">picture_as_pdf</span>
                  <div>
                    <h4 className="font-semibold text-body-md text-on-surface dark:text-inverse-on-surface">{previewDoc.name}</h4>
                    <p className="text-body-xs text-on-surface-variant mt-1">PDF / Business Document</p>
                  </div>
                  <a
                    href={previewDoc.fileData}
                    download={previewDoc.name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 btn-primary px-4 py-2 text-label-md rounded-lg"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Download / Open Document
                  </a>
                </div>
              )
            ) : (
              <div className="p-6 text-center text-body-sm text-on-surface-variant italic">
                Document preview is not available for this record.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="button" className={btnGhost} onClick={() => setPreviewDoc(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Submit Verification Confirmation Modal */}
      {submitModal && (
        <Modal open title="Submit Store Application for Review" onClose={() => setSubmitModal(false)}>
          <div className="space-y-4">
            <p className="text-body-sm text-on-surface dark:text-inverse-on-surface leading-relaxed">
              You are about to submit your commercial store credentials for verification by BuildSmart administration.
            </p>
            <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant text-body-sm space-y-1">
              <p><strong>Business Name:</strong> {businessName}</p>
              <p><strong>Registration Number:</strong> {registrationNumber}</p>
              <p><strong>Tax Identification Number:</strong> {taxId}</p>
              <p><strong>Documents Attached:</strong> {docs.length} files</p>
            </div>
            <p className="text-body-xs text-on-surface-variant dark:text-surface-variant">
              Once verified, your store will be certified, allowing you to list building materials and receive customer orders.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setSubmitModal(false)}>Cancel</button>
              <button type="button" className={btnPrimary} onClick={submitVerification}>Confirm & Submit</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
