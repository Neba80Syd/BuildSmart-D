'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, Skeleton, inputClass, btnPrimary } from '@/Frontend/components/architect/ui';
import { useWebSocketChat } from '@/Frontend/components/chat/use-websocket-chat';
import { NewChatModal } from '@/Frontend/components/chat/new-chat-modal';

type Conversation = {
  id: string;
  name: string;
  projectId: string | null;
  isDirect: boolean;
  directUser?: { id: string; name: string; role: string } | null;
  participants?: { userId: string; name: string; role: string }[];
  lastMessage: any;
  unread: number;
};

export default function ClientMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations list
  const loadConversations = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch('/api/chat/rooms?role=CLIENT');
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
      setLoading(false);
    }
  }, [activeRoomId]);

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
    userId: 'u_client',
    userName: 'Jordan Ellis',
    userRole: 'CLIENT',
    roomId: activeRoomId,
    onNewMessage: handleNewMessage,
    onConversationUpdated: handleConversationUpdated,
  });

  // Load message history for active room
  const loadRoomHistory = useCallback(async (roomId: string) => {
    try {
      const res = await fetch(`/api/client/messages?roomId=${roomId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      // Mark as read
      await fetch('/api/client/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  }, [setMessages]);

  useEffect(() => {
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

  const selectRoom = (id: string) => {
    setActiveRoomId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!activeRoomId) return;

    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const send = async () => {
    if (!draft.trim() || !activeRoomId || sending) return;
    setSending(true);
    sendTyping(false);
    try {
      const sent = await wsSendMessage(draft.trim(), activeRoomId);
      if (sent) setDraft('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeRoomId);

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
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader
        title="Messages"
        subtitle="Communicate directly with your architect, material vendors, and project team."
        crumbs={['Client', 'Communication', 'Messages']}
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-label-md text-on-surface-variant dark:text-surface-variant">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'connected'
                    ? 'bg-[#2f6b50] animate-pulse'
                    : status === 'connecting' || status === 'reconnecting'
                    ? 'bg-[#A66A00] animate-ping'
                    : 'bg-red-500'
                }`}
              />
              {status === 'connected'
                ? 'Live WebSocket'
                : status === 'reconnecting'
                ? 'Reconnecting…'
                : status === 'connecting'
                ? 'Connecting…'
                : 'Offline'}
            </span>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="btn-primary px-3.5 py-1.5 text-label-md flex items-center gap-1.5 rounded-lg"
            >
              <span className="text-base leading-none">＋</span> New Message
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: 'calc(100vh - 250px)', minHeight: 480 }}>
        {/* Conversations List */}
        <Card pad={false} className="overflow-hidden flex flex-col shadow-xs">
          <div className="px-5 py-3.5 border-b border-outline-variant dark:border-outline flex items-center justify-between">
            <span className="text-label-md uppercase tracking-wider font-semibold text-on-surface-variant dark:text-surface-variant">
              Conversations ({conversations.length})
            </span>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="text-primary text-xs font-semibold hover:underline"
            >
              + Start Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/40 dark:divide-outline/30">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon="forum"
                  title="No conversations yet"
                  body="Connect with your project architect or suppliers."
                  actionLabel="Start New Message"
                  onAction={() => setIsNewChatOpen(true)}
                />
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = activeRoomId === c.id;
                const isDirectUserOnline = c.directUser?.id ? onlineUsers.has(c.directUser.id) : false;

                return (
                  <button
                    key={c.id}
                    onClick={() => selectRoom(c.id)}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors ${
                      isSelected
                        ? 'bg-primary/10 dark:bg-primary/15 border-l-4 border-l-primary'
                        : 'hover:bg-surface-container-low dark:hover:bg-surface-variant/40'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      {isDirectUserOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-surface-container" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">
                          {c.name}
                        </span>
                        {c.lastMessage && (
                          <span className="text-[11px] text-on-surface-variant dark:text-surface-variant shrink-0 ml-2">
                            {new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.directUser && getRoleBadge(c.directUser.role)}
                        {c.lastMessage ? (
                          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant truncate">
                            {c.lastMessage.senderName ? `${c.lastMessage.senderName}: ` : ''}{c.lastMessage.content}
                          </p>
                        ) : (
                          <p className="text-body-sm text-on-surface-variant/70 italic">No messages yet</p>
                        )}
                      </div>
                    </div>

                    {c.unread > 0 && (
                      <span className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 animate-in zoom-in-75 duration-150">
                        {c.unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Active Conversation Pane */}
        <Card pad={false} className="lg:col-span-2 overflow-hidden flex flex-col shadow-xs">
          {!activeRoomId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant dark:text-surface-variant">
              <span className="text-5xl mb-3">💬</span>
              <h3 className="text-headline-sm font-semibold mb-1">Select a conversation</h3>
              <p className="text-body-sm max-w-sm">Choose an existing conversation from the list or start a new chat with your team.</p>
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="mt-4 btn-primary px-4 py-2 text-label-md"
              >
                Start New Message
              </button>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3.5 border-b border-outline-variant dark:border-outline flex items-center justify-between bg-surface-container-lowest dark:bg-surface-container">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center font-bold shrink-0">
                    {(activeConv?.name ?? 'Chat').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">
                      {activeConv?.name ?? 'Conversation'}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant dark:text-surface-variant">
                      {activeConv?.directUser && getRoleBadge(activeConv.directUser.role)}
                      <span>
                        {activeConv?.directUser && onlineUsers.has(activeConv.directUser.id)
                          ? '● Online'
                          : `${activeConv?.participants?.length || 2} participants`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-label-md text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-surface-container-low/40 dark:bg-surface-variant/20">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-body-sm shadow-xs ${
                        m.mine
                          ? 'bg-primary-container text-white rounded-br-none'
                          : 'bg-white dark:bg-surface-container border border-outline-variant dark:border-outline text-on-surface dark:text-inverse-on-surface rounded-bl-none'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] opacity-75 mb-1">
                        <span className="font-semibold">{m.senderName}</span>
                        {getRoleBadge(m.senderRole)}
                        <span>•</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      {m.isOptimistic && <div className="text-[9px] opacity-60 text-right mt-0.5">Sending…</div>}
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-label-md text-on-surface-variant dark:text-surface-variant italic py-1 animate-in fade-in duration-150">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>
                      {typingUsers.map((u) => u.userName).join(', ')} typing…
                    </span>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-outline-variant dark:border-outline flex gap-2 bg-white dark:bg-surface-container">
                <input
                  className={inputClass}
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                />
                <button className={btnPrimary} onClick={send} disabled={sending || !draft.trim()}>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        currentUserRole="CLIENT"
        onConversationCreated={(roomId) => {
          loadConversations(roomId);
        }}
      />
    </div>
  );
}
