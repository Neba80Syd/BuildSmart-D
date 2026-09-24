'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useWebSocketChat } from '@/Frontend/components/chat/use-websocket-chat';
import { NewChatModal } from '@/Frontend/components/chat/new-chat-modal';

type Inquiry = {
  id: string;
  userId: string;
  customerName: string;
  subject: string;
  orderId: string | null;
  productId: string | null;
  status: string;
  messages: { from: string; at: string; text: string }[];
  updatedAt: string;
};

type Conversation = {
  id: string;
  name: string;
  projectId: string | null;
  isDirect: boolean;
  directUser?: { id: string; name: string; role: string } | null;
  lastMessage: any;
  unread: number;
};

export default function VendorMessagesPage() {
  const [activeTab, setActiveTab] = useState<'STAKEHOLDERS' | 'INQUIRIES'>('STAKEHOLDERS');

  // ---- Inquiries State ----
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activeInquiryId, setActiveInquiryId] = useState<string | null>(null);
  const [inquiryReply, setInquiryReply] = useState('');

  // ---- Stakeholder Chat State ----
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Inquiries
  const loadInquiries = async (keepSelection = false) => {
    try {
      const res = await fetch('/api/vendor/inquiries');
      const d = await res.json();
      setInquiries(d.inquiries ?? []);
      if (!keepSelection) setActiveInquiryId(d.inquiries?.[0]?.id ?? null);
    } catch {
      // Ignore
    }
  };

  // Load Stakeholder Conversations
  const loadConversations = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch('/api/chat/rooms?role=VENDOR');
      if (!res.ok) return;
      const data = await res.json();
      const rooms: Conversation[] = data.rooms ?? [];
      setConversations(rooms);

      if (selectId) {
        setActiveRoomId(selectId);
      } else if (rooms.length > 0 && !activeRoomId) {
        setActiveRoomId(rooms[0].id);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingRooms(false);
    }
  }, [activeRoomId]);

  // Load Room History
  const loadRoomHistory = useCallback(async (roomId: string) => {
    try {
      const res = await fetch(`/api/client/messages?roomId=${roomId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleNewMessage = useCallback((msg: any) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === msg.roomId) {
          return {
            ...c,
            lastMessage: { content: msg.content, senderName: msg.senderName, createdAt: msg.createdAt },
            unread: msg.roomId === activeRoomId ? 0 : c.unread + 1,
          };
        }
        return c;
      })
    );
  }, [activeRoomId]);

  const handleConversationUpdated = useCallback((data: any) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === data.roomId && data.lastMessage) {
          return { ...c, lastMessage: data.lastMessage };
        }
        return c;
      })
    );
  }, []);

  // WebSocket Chat hook
  const {
    status,
    isLive,
    messages,
    setMessages,
    sendMessage: wsSendMessage,
    sendTyping,
    markRead,
    typingUsers,
    onlineUsers,
  } = useWebSocketChat({
    userId: 'u_vendor',
    userName: 'Marcus Hale',
    userRole: 'VENDOR',
    roomId: activeRoomId,
    onNewMessage: handleNewMessage,
    onConversationUpdated: handleConversationUpdated,
  });

  useEffect(() => {
    loadInquiries();
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeRoomId) {
      loadRoomHistory(activeRoomId);
      markRead(activeRoomId);
    }
  }, [activeRoomId, loadRoomHistory, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  const activeInquiry = useMemo(
    () => inquiries.find((i) => i.id === activeInquiryId) ?? null,
    [inquiries, activeInquiryId]
  );

  const activeConv = conversations.find((c) => c.id === activeRoomId);

  // Inquiries methods
  const sendInquiryReply = async () => {
    if (!activeInquiry || !inquiryReply.trim()) return;
    const res = await fetch('/api/vendor/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeInquiry.id, reply: inquiryReply }),
    });
    if (res.ok) {
      setInquiryReply('');
      loadInquiries(true);
      toast.success('Reply sent');
    } else toast.error('Could not send reply');
  };

  const markInquiryResolved = async (id: string, s: string) => {
    await fetch('/api/vendor/inquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: s }),
    });
    loadInquiries(true);
  };

  // Stakeholder Chat methods
  const handleDraftChange = (val: string) => {
    setChatDraft(val);
    if (!activeRoomId) return;

    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const sendChat = async () => {
    if (!chatDraft.trim() || !activeRoomId || chatSending) return;
    setChatSending(true);
    sendTyping(false);
    try {
      const sent = await wsSendMessage(chatDraft.trim(), activeRoomId);
      if (sent) setChatDraft('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChatSending(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    if (!role) return null;
    switch (role) {
      case 'ARCHITECT':
        return <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">Architect</span>;
      case 'VENDOR':
        return <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">Vendor</span>;
      case 'ADMIN':
        return <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">Admin</span>;
      default:
        return <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Client</span>;
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-lg font-bold text-on-background dark:text-surface-container-lowest mb-1">
            Vendor Messaging
          </h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
            Coordinate specifications and supply schedules with clients and architects in real time.
          </p>
        </div>

        {/* Live Status & New Chat */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-label-md text-on-surface-variant dark:text-surface-variant bg-surface-container-low dark:bg-surface-variant px-3 py-1.5 rounded-full border border-outline-variant dark:border-outline">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-[#2f6b50] animate-pulse'
                  : status === 'connecting' || status === 'reconnecting'
                  ? 'bg-[#A66A00] animate-ping'
                  : 'bg-red-500'
              }`}
            />
            <span>{status === 'connected' ? 'Live WebSocket' : 'Connecting…'}</span>
          </div>

          <button
            onClick={() => setIsNewChatOpen(true)}
            className="btn-primary px-3.5 py-1.5 text-label-md flex items-center gap-1.5 rounded-lg"
          >
            <span>＋</span> New Message
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-outline-variant dark:border-outline mb-6 gap-6">
        <button
          onClick={() => setActiveTab('STAKEHOLDERS')}
          className={`pb-3 text-label-md font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'STAKEHOLDERS'
              ? 'border-primary text-primary dark:text-primary-fixed-dim'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>💬</span> Direct Stakeholder Chats ({conversations.length})
        </button>
        <button
          onClick={() => setActiveTab('INQUIRIES')}
          className={`pb-3 text-label-md font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'INQUIRIES'
              ? 'border-primary text-primary dark:text-primary-fixed-dim'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>📦</span> Product & Order Inquiries ({inquiries.filter((i) => i.status === 'OPEN').length} open)
        </button>
      </div>

      {/* TAB 1: STAKEHOLDER CHATS */}
      {activeTab === 'STAKEHOLDERS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl overflow-hidden min-h-[540px] shadow-sm">
          {/* Conversation Sidebar */}
          <div className="border-r border-outline-variant dark:border-outline flex flex-col">
            <div className="p-4 border-b border-outline-variant dark:border-outline flex justify-between items-center bg-surface-container-lowest dark:bg-surface-container">
              <span className="text-label-md font-semibold uppercase tracking-wider text-on-surface-variant dark:text-surface-variant">
                Stakeholders
              </span>
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="text-primary text-xs font-semibold hover:underline"
              >
                + New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40 dark:divide-outline/30">
              {loadingRooms ? (
                <div className="p-4 space-y-3 text-center text-on-surface-variant text-body-sm animate-pulse">
                  Loading chats…
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-on-surface-variant text-body-sm">
                  No conversations yet.
                  <button
                    onClick={() => setIsNewChatOpen(true)}
                    className="mt-2 text-primary font-medium block mx-auto underline"
                  >
                    Start a chat
                  </button>
                </div>
              ) : (
                conversations.map((c) => {
                  const isSelected = activeRoomId === c.id;
                  const isOnline = c.directUser?.id ? onlineUsers.has(c.directUser.id) : false;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveRoomId(c.id)}
                      className={`w-full text-left p-4 transition-colors flex items-center gap-3 ${
                        isSelected
                          ? 'bg-primary/10 dark:bg-primary/15 border-l-4 border-l-primary'
                          : 'hover:bg-surface-container-low dark:hover:bg-surface-dim'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-surface-container" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">
                            {c.name}
                          </span>
                          {c.lastMessage && (
                            <span className="text-[11px] text-on-surface-variant dark:text-surface-variant shrink-0 ml-1">
                              {new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {c.directUser && getRoleBadge(c.directUser.role)}
                          {c.lastMessage && (
                            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant truncate">
                              {c.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>

                      {c.unread > 0 && (
                        <span className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Chat Pane */}
          <div className="md:col-span-2 flex flex-col">
            {!activeRoomId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant dark:text-surface-variant">
                <span className="text-5xl mb-3">💬</span>
                <h3 className="text-headline-sm font-semibold mb-1">Select a conversation</h3>
                <p className="text-body-sm max-w-sm">Connect with architects and project owners regarding specifications and bulk delivery.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-outline-variant dark:border-outline flex justify-between items-center bg-surface-container-lowest dark:bg-surface-container">
                  <div className="flex items-center gap-2">
                    <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">
                      {activeConv?.name}
                    </h3>
                    {activeConv?.directUser && getRoleBadge(activeConv.directUser.role)}
                  </div>
                  <span className="text-label-md text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </div>

                <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-[#FAFAF8] dark:bg-[#131e1b]">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-body-sm shadow-xs ${
                          m.mine
                            ? 'bg-[#315C4C] text-white rounded-br-none'
                            : 'bg-white dark:bg-surface-container border border-outline-variant dark:border-outline text-on-surface dark:text-inverse-on-surface rounded-bl-none'
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10px] opacity-75 mb-1">
                          <span className="font-semibold">{m.senderName}</span>
                          {getRoleBadge(m.senderRole)}
                          <span>•</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      </div>
                    </div>
                  ))}

                  {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-label-md text-on-surface-variant italic py-1">
                      <span>{typingUsers.map((u) => u.userName).join(', ')} typing…</span>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                <div className="p-4 border-t border-outline-variant dark:border-outline flex gap-2 bg-white dark:bg-surface-container">
                  <input
                    value={chatDraft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    className="input flex-1"
                    placeholder="Type a message to the stakeholder…"
                  />
                  <button onClick={sendChat} disabled={chatSending || !chatDraft.trim()} className="btn-primary px-5 rounded-lg text-label-md">
                    {chatSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INQUIRIES */}
      {activeTab === 'INQUIRIES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden min-h-[520px]">
          {/* Inbox list */}
          <div className="border-r border-outline-variant dark:border-outline flex flex-col">
            <div className="p-4 border-b border-outline-variant dark:border-outline flex justify-between">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">Inbox</h2>
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{inquiries.filter((i) => i.status === 'OPEN').length} open</span>
            </div>
            <div className="flex-1 overflow-auto">
              {inquiries.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setActiveInquiryId(i.id)}
                  className={`w-full text-left p-4 border-b border-outline-variant dark:border-outline transition-colors ${
                    activeInquiryId === i.id ? 'bg-secondary-container dark:bg-primary-container' : 'hover:bg-surface-container-low dark:hover:bg-surface-dim'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest">{i.customerName}</span>
                    {i.status === 'OPEN' && <span className="w-2 h-2 rounded-full bg-[#A66A00]" />}
                  </div>
                  <div className="text-body-sm text-on-background dark:text-surface-container-lowest truncate">{i.subject}</div>
                  <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(i.updatedAt).toLocaleString()}</div>
                </button>
              ))}
              {inquiries.length === 0 && <p className="p-4 text-body-sm text-on-surface-variant dark:text-surface-variant">No inquiries yet.</p>}
            </div>
          </div>

          {/* Conversation */}
          <div className="md:col-span-2 flex flex-col">
            {activeInquiry ? (
              <>
                <div className="p-4 border-b border-outline-variant dark:border-outline flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{activeInquiry.subject}</h3>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant">From {activeInquiry.customerName}{activeInquiry.orderId ? ` · Order ${activeInquiry.orderId.slice(0, 10).toUpperCase()}` : ''}</p>
                  </div>
                  <button onClick={() => markInquiryResolved(activeInquiry.id, activeInquiry.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">
                    {activeInquiry.status === 'RESOLVED' ? 'Reopen' : 'Mark Resolved'}
                  </button>
                </div>
                <div className="flex-1 p-6 space-y-4 overflow-auto bg-[#FAFAF8] dark:bg-[#131e1b]">
                  {(activeInquiry.messages ?? []).map((m, idx) => (
                    <div key={idx} className={`flex ${m.from === 'vendor' ? 'justify-end' : ''}`}>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-body-sm ${m.from === 'vendor' ? 'bg-[#315C4C] text-white rounded-br-none' : 'bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-bl-none text-on-background dark:text-surface-container-lowest'}`}>
                        <div className="text-[10px] opacity-60 mb-px">{m.from === 'vendor' ? 'You' : activeInquiry.customerName} · {new Date(m.at).toLocaleString()}</div>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-outline-variant dark:border-outline flex gap-2">
                  <input value={inquiryReply} onChange={(e) => setInquiryReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendInquiryReply()} className="input flex-1" placeholder="Type your reply…" />
                  <button onClick={sendInquiryReply} className="btn-primary px-5 rounded-lg text-label-md">Send</button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant dark:text-surface-variant text-body-md">Select a conversation.</div>
            )}
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        currentUserRole="VENDOR"
        onConversationCreated={(roomId) => {
          setActiveTab('STAKEHOLDERS');
          loadConversations(roomId);
        }}
      />
    </div>
  );
}
