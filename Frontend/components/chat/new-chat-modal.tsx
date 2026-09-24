'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export type Stakeholder = {
  id: string;
  name: string;
  email: string;
  role: 'CLIENT' | 'ARCHITECT' | 'VENDOR' | 'ADMIN';
  subtitle: string;
  statusBadge: string;
  initials: string;
};

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  onConversationCreated: (roomId: string) => void;
}

export function NewChatModal({ isOpen, onClose, currentUserRole = 'CLIENT', onConversationCreated }: NewChatModalProps) {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [initialMessage, setInitialMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch(`/api/chat/stakeholders?role=${currentUserRole}`)
      .then((res) => (res.ok ? res.json() : Promise.reject('Failed to load stakeholders')))
      .then((data) => setStakeholders(data.stakeholders ?? []))
      .catch((err) => toast.error(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, currentUserRole]);

  if (!isOpen) return null;

  const filtered = stakeholders.filter((s) => {
    const matchesRole = selectedRole === 'ALL' || s.role === selectedRole;
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.subtitle.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const handleStartChat = async () => {
    if (!selectedStakeholder || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/chat/rooms?role=${currentUserRole}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [selectedStakeholder.id],
          initialMessage: initialMessage.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create conversation');

      toast.success(data.isExisting ? 'Opening existing chat' : 'Conversation started');
      onConversationCreated(data.roomId);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ARCHITECT':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Architect</span>;
      case 'VENDOR':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Vendor</span>;
      case 'ADMIN':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Admin</span>;
      default:
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Client</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant dark:border-outline flex items-center justify-between">
          <div>
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">New Message</h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Connect directly with project stakeholders</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Role Filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {['ALL', 'ARCHITECT', 'VENDOR', 'CLIENT', 'ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`text-label-md px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  selectedRole === r
                    ? 'bg-primary text-white font-medium'
                    : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {r === 'ALL' ? 'All Stakeholders' : r.charAt(0) + r.slice(1).toLowerCase() + 's'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, role, or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-9"
            />
            <span className="absolute left-3 top-2.5 text-on-surface-variant opacity-60 text-sm">🔍</span>
          </div>

          {/* Stakeholder List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-body-sm text-on-surface-variant animate-pulse">Loading stakeholders…</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-body-sm text-on-surface-variant">No stakeholders found matching your search.</div>
            ) : (
              filtered.map((s) => {
                const isSelected = selectedStakeholder?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStakeholder(s)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-outline-variant/60 dark:border-outline/40 hover:bg-surface-container-low dark:hover:bg-surface-variant/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold shrink-0">
                      {s.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">{s.name}</span>
                        {getRoleBadge(s.role)}
                      </div>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant truncate">{s.subtitle}</p>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Initial Message Input */}
          {selectedStakeholder && (
            <div className="pt-2 border-t border-outline-variant dark:border-outline space-y-1.5 animate-in fade-in duration-150">
              <label className="text-label-md font-medium text-on-surface dark:text-inverse-on-surface">
                First Message to {selectedStakeholder.name} (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Hi, I'd like to discuss the Riverside Villa project…"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                className="input w-full resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-outline-variant dark:border-outline flex justify-end gap-2 bg-surface-container-lowest dark:bg-surface-container">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-label-md">
            Cancel
          </button>
          <button
            onClick={handleStartChat}
            disabled={!selectedStakeholder || submitting}
            className="btn-primary px-5 py-2 text-label-md disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? 'Starting…' : 'Start Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}
