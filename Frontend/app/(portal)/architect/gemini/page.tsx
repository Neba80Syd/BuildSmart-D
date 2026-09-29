'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, Spinner, btnPrimary, btnGhost, inputClass, iconBtn } from '@/Frontend/components/architect/ui';

type ChatRole = 'user' | 'assistant';
type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  category?: string;
  model?: string;
  offline?: boolean;
  blocked?: boolean;
  feedback?: 'HELPFUL' | 'NOT_HELPFUL' | null;
};

type Conversation = {
  id: string;
  title: string;
  mode: string;
  projectId: string | null;
  messageCount: number;
  status: string;
  updatedAt: string;
};

type CopilotContext = {
  user: { id: string; name: string; role: string };
  profile: { title: string; location: string; verificationStatus: string } | null;
  project: {
    id: string;
    name: string;
    status: string;
    projectType: string | null;
    floors: number | null;
    rooms: number | null;
    siteArea: number | null;
    budget: number | null;
    location: string | null;
    style: string | null;
    requirements: string;
    progress: number;
  } | null;
  availableProjects: { id: string; name: string; status: string; progress: number }[];
};

const MODES = [
  { id: 'architecture', label: 'Architecture', hint: 'Concepts, plans, spatial design', icon: 'architecture' },
  { id: 'construction', label: 'Construction', hint: 'Methods, site, sequencing', icon: 'construction' },
  { id: 'materials', label: 'Materials', hint: 'Selection, comparison, availability', icon: 'inventory_2' },
  { id: 'estimation', label: 'Estimation', hint: 'Quantities, costs, units', icon: 'calculate' },
  { id: 'boq', label: 'BOQ', hint: 'Bill of quantities prep', icon: 'list_alt' },
  { id: 'project', label: 'Project', hint: 'Planning, deliverables, checklists', icon: 'event_available' },
  { id: 'builds', label: 'BuildSmart', hint: 'Platform help', icon: 'auto_awesome' },
];

const QUICK_ACTIONS: { label: string; icon: string; prompt: string; mode: string }[] = [
  { label: 'Analyze Design', icon: 'architecture', mode: 'architecture', prompt: 'Analyze the current design concept/project requirements for spatial quality, functional zoning, circulation, daylight, ventilation, and buildability. Flag risks and improvements.' },
  { label: 'Generate Space Plan', icon: 'grid_on', mode: 'architecture', prompt: 'Generate a conceptual space plan for the active project, including room functions, adjacencies, circulation, and preferred floor layout logic based on the available requirements. Ask for missing areas if the project data is insufficient.' },
  { label: 'Estimate Materials', icon: 'calculate', mode: 'estimation', prompt: 'Prepare a preliminary material estimate for the active project. State the assumptions clearly, label it preliminary, and recommend verification by a quantity surveyor. Ask for missing dimensions if they are not available.' },
  { label: 'Create BOQ', icon: 'list_alt', mode: 'boq', prompt: 'Create a preliminary BOQ skeleton for the active project, organized by construction sections, with material, description, quantity, unit, reference marketplace cost and notes. Label it as an AI-generated preliminary estimate.' },
  { label: 'Review Project', icon: 'fact_check', mode: 'project', prompt: 'Review the active project for completeness, risks, missing requirements, and next actions. Include a prioritised checklist.' },
  { label: 'Construction Checklist', icon: 'checklist', mode: 'construction', prompt: 'Give a practical construction planning checklist for the active project, from site setup through foundations, structure, envelope, MEP, finishes, and handover.' },
  { label: 'Material Recommendation', icon: 'inventory_2', mode: 'materials', prompt: 'Recommend durable, cost-effective materials for the active project based on its location, type, and requirements. Use authorized project data and marketplace pricing where available.' },
  { label: 'Summarize Project', icon: 'summarize', mode: 'project', prompt: 'Summarize the active project: type, location, scale, status, progress, key requirements, and recommended next steps.' },
];

const SUGGESTED_FOLLOWUPS = [
  'What are the biggest risks in this design?',
  'How should I sequence the construction phases?',
  'Recommend locally available materials for this project.',
  'What should the client confirm before we start the next design phase?',
];

const WELCOME = `Hello! I'm **BuildSmart AI Copilot**, your specialized architectural & construction assistant.

I can help you with:
- **Architecture** — concepts, spatial planning, design review
- **Construction** — methods, foundations, roofing, waterproofing, sequencing
- **Materials** — selection, comparison, local availability
- **Estimation & BOQ** — preliminary quantities and bill of quantities
- **Project planning** — prioritised checklists, summaries, next actions
- **BuildSmart AI platform** — Design Studio, 2D, 3D, estimation, BOQ, marketplace

I only work within the BuildSmart AI domain and use your authorized project data. Choose a quick action or type your question below.`;

const fmtXAF = (n: number) => Math.round(n).toLocaleString();

// Lightweight, safe-by-construction renderer for the small subset of markdown
// the Copilot emits (headings, bold, bullet lists, tables, inline code).
function Markdown({ children }: { children: string }) {
  const result = useMemo(() => renderMiniMarkdown(children), [children]);
  return <div className="space-y-3 text-body-sm leading-relaxed">{result}</div>;
}

function renderMiniMarkdown(src: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = src.split('\n');
  let listBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let i = 0;

  const flushList = (key: string) => {
    if (!listBuffer.length) return;
    blocks.push(
      <ul key={key} className="list-disc pl-5 space-y-1.5">
        {listBuffer.map((item, n) => (
          <li key={`${key}-${n}`}>{inline(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };
  const flushTable = (key: string) => {
    if (!tableBuffer.length || tableBuffer.length < 2) return;
    const rows = tableBuffer
      .filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r))
      .map((r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()));
    if (!rows.length) return;
    blocks.push(
      <div key={key} className="overflow-x-auto rounded-lg border border-outline-variant dark:border-outline">
        <table className="w-full text-body-sm min-w-[480px]">
          <thead>
            <tr className="bg-surface-container-low dark:bg-surface-variant">
              {rows[0].map((c, n) => (
                <th key={n} className="text-left px-3 py-2 font-semibold text-on-surface dark:text-on-surface">{inline(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, n) => (
              <tr key={n} className="border-t border-outline-variant dark:border-outline">
                {row.map((c, m) => (
                  <td key={m} className="px-3 py-2 text-on-surface-variant dark:text-surface-variant">{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const isTable = /^\s*\|.+/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]);

    if (isTable) {
      flushList(`list-${i}`);
      tableBuffer.push(line, lines[i + 1]);
      i += 2;
      while (i < lines.length && /^\s*\|.+/.test(lines[i])) {
        tableBuffer.push(lines[i]);
        i += 1;
      }
      flushTable(`table-${i}`);
      continue;
    }

    if (/^\s*-\s+/.test(trimmed) || /^\s*•\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\s*[-•]\s+/, ''));
      i += 1;
      continue;
    }
    flushList(`list-${i}`);
    flushTable(`table-${i}`);

    if (trimmed.startsWith('### ')) {
      blocks.push(<h4 key={i} className="text-headline-sm text-on-surface dark:text-on-surface mt-2">{inline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('## ')) {
      blocks.push(<h3 key={i} className="text-headline-md text-on-surface dark:text-on-surface mt-2">{inline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('# ')) {
      blocks.push(<h3 key={i} className="text-headline-md text-on-surface dark:text-on-surface mt-2">{inline(trimmed.slice(2))}</h3>);
    } else if (trimmed === '---') {
      blocks.push(<hr key={i} className="border-outline-variant dark:border-outline" />);
    } else if (/^\*\*[^*]+\*\*:\s*$/.test(trimmed)) {
      blocks.push(
        <p key={i} className="font-semibold text-on-surface-variant dark:text-surface-variant">
          {inline(trimmed.replace(/^\*\*|\*\*$/g, ''))}
        </p>,
      );
    } else if (trimmed.startsWith('> ')) {
      blocks.push(
        <p key={i} className="pl-3 border-l-2 border-primary dark:border-primary-fixed-dim text-on-surface-variant dark:text-surface-variant italic">
          {inline(trimmed.slice(2))}
        </p>,
      );
    } else if (trimmed) {
      blocks.push(<p key={i}>{inline(trimmed)}</p>);
    }
    i += 1;
  }
  flushList('list-end');
  flushTable('table-end');
  return blocks;
}

function inline(text: string): React.ReactNode {
  // split on **bold**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, n) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={n} className="font-semibold text-on-surface dark:text-on-surface">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+$/.test(p)) return <code key={n} className="font-mono bg-surface-container-low dark:bg-surface-variant px-1 py-0.5 rounded text-on-surface dark:text-on-surface">{p.slice(1, -1)}</code>;
    return <span key={n}>{p}</span>;
  });
}

function ApiError({ message }: { message: string }) {
  return <div className="text-body-sm text-error dark:text-red-300 bg-error/10 border border-error/30 rounded-lg px-3 py-2">{message}</div>;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('architecture');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [context, setContext] = useState<CopilotContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamCancelledRef = useRef(false);

  const activeContextProject = context?.project ?? null;
  const activeProjectId = activeContextProject?.id ?? null;

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/context');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.context) setContext(data.context);
    } catch {
      // context is optional; the chat still works without it.
    } finally {
      setContextLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.conversations)) setConversations(data.conversations);
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    void loadContext();
    void loadConversations();
  }, [loadContext, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingText]);

  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? 'Architecture';

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  const openConversation = async (id: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load conversation.');
      const loaded: ChatMessage[] = (data.messages ?? [])
        .filter((m: any) => m.role !== 'tool')
        .map((m: any) => ({
          id: m.id,
          role: m.role as ChatRole,
          content: m.content,
          category: m.category ?? undefined,
          model: m.model ?? undefined,
          feedback: (m.feedback as 'HELPFUL' | 'NOT_HELPFUL' | null) ?? null,
        }));
      setMessages(loaded.length ? loaded : [{ id: 'welcome', role: 'assistant', content: WELCOME }]);
      setConversationId(id);
      if (data.conversation?.mode) setMode(data.conversation.mode);
    } catch (e: any) {
      setError(e.message || 'Failed to load conversation.');
    } finally {
      setLoading(false);
      setShowHistory(false);
    }
  };

  const newConversation = () => {
    setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME }]);
    setConversationId(null);
    setInput('');
    setError(null);
    setStreamingText(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = async (text: string, forcedMode?: string) => {
    const clean = text.trim();
    if (!clean || loading) return;

    const nextMode = forcedMode ?? mode;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: clean };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError(null);
    setLoading(true);
    setStreamingText('');
    streamCancelledRef.current = false;
    scrollToBottom();

    // Build history for the model (exclude the local welcome and any pending stream text).
    const history = [...messages]
      .filter((m) => m.id !== 'welcome' && m.content)
      .map((m) => ({ role: m.role, content: m.content }))
      .concat([{ role: 'user' as ChatRole, content: clean }]);

    const payload = {
      conversationId,
      messages: history,
      mode: nextMode,
      projectId: activeProjectId,
      recognizeTools: true,
    };

    const useStream = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    if (useStream) {
      try {
        const streamed: { conversationId?: string; messageId?: string; content: string } = await readStream(payload, (delta) => {
          setStreamingText((prev) => (prev ?? '') + delta);
        });
        if (streamCancelledRef.current) return;
        const assistant: ChatMessage = {
          id: streamed.messageId ?? `a-${Date.now()}`,
          role: 'assistant',
          content: streamed.content,
          model: 'stream',
          offline: false,
        };
        if (streamed.conversationId) setConversationId(streamed.conversationId);
        setMessages((prev) => [...prev, assistant]);
        setStreamingText('');
        setMode(nextMode);
        void loadConversations();
      } catch {
        setStreamingText('');
        // Fall back to the JSON endpoint if SSE fails.
        await sendJson(payload, nextMode);
      } finally {
        setLoading(false);
        setStreamingText('');
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return;
    }

    await sendJson(payload, nextMode);
  };

  const sendJson = async (payload: any, nextMode: string) => {
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The AI Copilot failed to respond.');
      const msg: ChatMessage = {
        id: data.messageId ?? `a-${Date.now()}`,
        role: 'assistant',
        content: data.message?.content ?? data.response?.content ?? '',
        category: data.response?.category ?? undefined,
        model: data.response?.model,
        offline: Boolean(data.response?.offline),
        blocked: Boolean(data.response?.blocked),
      };
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [...prev, msg]);
      setMode(nextMode);
      void loadConversations();
    } catch (e: any) {
      setError(e.message || 'The AI Copilot failed to respond.');
    }
  };

  async function readStream(payload: any, onDelta: (delta: string) => void): Promise<{ conversationId?: string; messageId?: string; content: string }> {
    const res = await fetch('/api/ai/copilot/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      throw new Error('Streaming unavailable');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let conversationId: string | undefined;
    let messageId: string | undefined;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const raw of events) {
        const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        const data = JSON.parse(dataLine.slice(6)) as any;
        if (data.delta) {
          content += data.delta;
          onDelta(data.delta);
        } else if (data.error) {
          throw new Error(data.error);
        } else if (data.content || data.message) {
          content = data.content ?? data.message?.content ?? content;
          conversationId = data.conversationId ?? conversationId;
          messageId = data.messageId ?? messageId;
        }
      }
    }
    return { conversationId, messageId, content };
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const giveFeedback = async (messageId: string, rating: 'HELPFUL' | 'NOT_HELPFUL') => {
    if (!conversationId || feedbackBusy) return;
    setFeedbackBusy(messageId);
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating, reason: rating === 'NOT_HELPFUL' ? 'User reported low quality' : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save feedback.');
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m)));
    } catch (e: any) {
      setError(e.message || 'Failed to save feedback.');
    } finally {
      setFeedbackBusy(null);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (conversationId === id) newConversation();
      }
    } catch {
      setError('Failed to delete conversation.');
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader
        title="BuildSmart AI Copilot"
        subtitle="Architecture & construction assistant — domain-restricted, context-aware, fully server-side."
        crumbs={['Architect', 'AI Copilot']}
        actions={
          <div className="flex items-center gap-2">
            <button className={btnGhost} onClick={() => setShowHistory((v) => !v)}>
              <span className="material-symbols-outlined text-[18px]">history</span>
              Conversations
            </button>
            <button className={btnPrimary} onClick={newConversation}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              New chat
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          {/* Active project */}
          <Card className="p-4">
            <h3 className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wide mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary dark:text-primary-fixed-dim">folder_open</span>
              Active project
            </h3>
            {contextLoading ? (
              <Spinner size={18} />
            ) : activeContextProject ? (
              <div className="space-y-2">
                <p className="text-body-md font-semibold text-on-surface dark:text-on-surface">{activeContextProject.name}</p>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                  {activeContextProject.projectType ?? 'Project'} · {activeContextProject.progress}% · {activeContextProject.status}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeContextProject.floors ? <span className="px-2 py-0.5 rounded-full bg-surface-container-low dark:bg-surface-variant text-label-md">{activeContextProject.floors} floors</span> : null}
                  {activeContextProject.rooms ? <span className="px-2 py-0.5 rounded-full bg-surface-container-low dark:bg-surface-variant text-label-md">{activeContextProject.rooms} rooms</span> : null}
                  {activeContextProject.siteArea ? <span className="px-2 py-0.5 rounded-full bg-surface-container-low dark:bg-surface-variant text-label-md">{activeContextProject.siteArea}m²</span> : null}
                  {activeContextProject.budget ? <span className="px-2 py-0.5 rounded-full bg-surface-container-low dark:bg-surface-variant text-label-md">{fmtXAF(activeContextProject.budget)} XAF</span> : null}
                </div>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                No authorized project is attached. You can still ask general domain questions, or visit{' '}
                <Link href="/architect/projects" className="text-primary dark:text-primary-fixed-dim hover:underline">Projects</Link> to create one.
              </p>
            )}
          </Card>

          {/* Modes */}
          <Card className="p-4">
            <h3 className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wide mb-3">Focus area</h3>
            <div className="space-y-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors border ${
                    mode === m.id
                      ? 'bg-primary-container dark:bg-primary-container text-white dark:text-on-primary-container border-transparent'
                      : 'text-on-surface-variant dark:text-surface-variant border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Quick actions */}
          <Card className="p-4">
            <h3 className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wide mb-3">Quick actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => void send(a.prompt, a.mode)}
                  disabled={loading}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-outline-variant dark:border-outline text-left text-body-sm text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary dark:text-primary-fixed-dim shrink-0">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Conversation history */}
          {showHistory && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wide">History</h3>
                <button className={iconBtn} onClick={() => setShowHistory(false)} aria-label="Close history">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {conversations.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No saved conversations yet.</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => void openConversation(c.id)}
                        className={`flex-1 text-left px-2.5 py-2 rounded-lg border text-body-sm transition-colors ${
                          conversationId === c.id
                            ? 'bg-primary-container dark:bg-primary-container text-white dark:text-on-primary-container border-transparent'
                            : 'text-on-surface-variant dark:text-surface-variant border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-variant'
                        }`}
                      >
                        <span className="block truncate">{c.title}</span>
                        <span className="block text-body-sm opacity-70">{c.messageCount} messages · {new Date(c.updatedAt).toLocaleDateString()}</span>
                      </button>
                      <button
                        onClick={() => void deleteConversation(c.id)}
                        className={`${iconBtn} opacity-0 group-hover:opacity-100 text-error dark:text-red-300`}
                        aria-label="Delete conversation"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Chat panel */}
        <Card pad={false} className="flex flex-col min-h-[680px] overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant dark:border-outline flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-primary dark:bg-primary-fixed-dim animate-pulse shrink-0" />
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wide">Mode:</span>
              <span className="text-label-md font-semibold text-primary dark:text-primary-fixed-dim truncate">{modeLabel}</span>
              {context?.project && (
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-low dark:bg-surface-variant text-label-md text-on-surface-variant dark:text-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">folder_open</span>
                  {context.project.name}
                </span>
              )}
            </div>
            <button className={`${iconBtn} hidden sm:inline-flex`} onClick={() => setShowHistory((v) => !v)} aria-label="Toggle conversation history">
              <span className="material-symbols-outlined">history</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-[#FAFAF8] dark:bg-[#17201e]">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] md:max-w-[78%] rounded-2xl px-4 py-3 text-body-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary-container text-white dark:bg-primary dark:text-on-primary rounded-br-md'
                      : 'bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-bl-md text-on-surface dark:text-on-surface'
                  }`}
                >
                  <Markdown>{m.content}</Markdown>
                  {m.offline && (
                    <p className="mt-2 text-body-sm text-on-surface-variant dark:text-surface-variant">
                      <span className="material-symbols-outlined inline-block text-[14px] align-text-bottom">info</span>
                      Offline preview mode — live Gemini answers are used automatically when the server has internet.
                    </p>
                  )}
                  {m.blocked && (
                    <p className="mt-2 text-body-sm text-[#A66A00] dark:text-yellow-400">
                      <span className="material-symbols-outlined inline-block text-[14px] align-text-bottom">block</span>
                      This response was blocked by the domain guard.
                    </p>
                  )}
                  {m.id !== 'welcome' && m.role === 'assistant' && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <button
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-md text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-surface-variant disabled:opacity-50"
                        disabled={!!feedbackBusy || m.feedback === 'HELPFUL'}
                        onClick={() => void giveFeedback(m.id, 'HELPFUL')}
                        title="Helpful"
                      >
                        <span className="material-symbols-outlined text-[16px]">{m.feedback === 'HELPFUL' ? 'thumb_up' : 'thumb_up_off_alt'}</span>
                      </button>
                      <button
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-md text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-surface-variant disabled:opacity-50"
                        disabled={!!feedbackBusy || m.feedback === 'NOT_HELPFUL'}
                        onClick={() => void giveFeedback(m.id, 'NOT_HELPFUL')}
                        title="Not helpful"
                      >
                        <span className="material-symbols-outlined text-[16px]">{m.feedback === 'NOT_HELPFUL' ? 'thumb_down' : 'thumb_down_off_alt'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-2xl rounded-bl-md px-4 py-3 text-body-sm text-on-surface dark:text-on-surface max-w-[90%] md:max-w-[78%]">
                  {streamingText ? <Markdown>{streamingText}</Markdown> : (
                    <span className="inline-flex items-center gap-2">
                      <Spinner size={18} />
                      BuildSmart AI Copilot is thinking…
                    </span>
                  )}
                </div>
              </div>
            )}

            {!loading && messages.filter((m) => m.id !== 'welcome').length >= 2 && (
              <div className="pt-3">
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-2">Suggested follow-ups</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_FOLLOWUPS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-full text-body-sm text-primary dark:text-primary-fixed-dim border border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-variant disabled:opacity-50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <ApiError message={error} />}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form onSubmit={submit} className="p-3 md:p-4 border-t border-outline-variant dark:border-outline bg-white dark:bg-surface-dim">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={2}
                maxLength={6000}
                placeholder="Ask about your design, materials, BOQ, construction sequence, or a BuildSmart AI feature…"
                className={`${inputClass} resize-none min-h-[56px]`}
                disabled={loading}
              />
              <button type="submit" className={`${btnPrimary} shrink-0`} disabled={loading || !input.trim()}>
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 gap-2">
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                <span className="material-symbols-outlined inline-block text-[14px] align-text-bottom">shield_lock</span>
                Domain-restricted · server-side · Gemini key never exposed
              </p>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant hidden sm:block">
                AI estimates are preliminary — verify with a qualified professional.
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
