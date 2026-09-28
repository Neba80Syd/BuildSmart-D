'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocketChat } from '@/Frontend/components/chat/use-websocket-chat';

type CurrentUser = {
  id: string;
  name: string;
  role: 'CLIENT' | 'ARCHITECT' | 'VENDOR' | 'ADMIN';
};

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    id: 'u_client',
    name: 'Jordan Ellis',
    role: 'CLIENT',
  });
  const [room, setRoom] = useState<{ id: string; name: string } | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebSocket Chat hook
  const {
    status,
    isLive,
    messages,
    setMessages,
    sendMessage: wsSendMessage,
    sendTyping,
    typingUsers,
    onlineUsers,
  } = useWebSocketChat({
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    roomId: room?.id ?? null,
  });

  // Initial HTTP fetch to resolve current preview user and primary room
  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) return;
      const data = await res.json();
      if (data.room) setRoom(data.room);
      if (data.user) setCurrentUser(data.user);
      if (Array.isArray(data.messages)) {
        setMessages(
          data.messages.map((m: any) => ({
            ...m,
            mine: m.senderId === (data.user?.id || 'u_client'),
          }))
        );
      }
    } catch {
      // Fallback
    }
  }, [setMessages]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsers.length]);

  const handleTypingChange = (val: string) => {
    setNewMsg(val);
    if (!room?.id) return;

    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const handleSend = async () => {
    const content = newMsg.trim();
    if (!content || sending || !room?.id) return;

    setSending(true);
    sendTyping(false);
    try {
      const sent = await wsSendMessage(content, room.id);
      if (sent) setNewMsg('');
    } finally {
      setSending(false);
    }
  };

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    <div className="max-w-4xl mx-auto p-margin-mobile md:p-margin-desktop">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-headline-lg font-bold text-on-background dark:text-surface-container-lowest">
              Project Chat
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low dark:bg-surface-variant border border-outline-variant dark:border-outline">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'connected'
                    ? 'bg-[#2f6b50] animate-pulse'
                    : status === 'connecting' || status === 'reconnecting'
                    ? 'bg-[#A66A00] animate-ping'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-[11px] font-medium text-on-surface-variant dark:text-surface-variant">
                {status === 'connected'
                  ? 'Live WebSocket'
                  : status === 'reconnecting'
                  ? 'Reconnecting…'
                  : status === 'connecting'
                  ? 'Connecting…'
                  : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5">
            {room?.name ?? 'Riverside Villa — Project Team'} • Real-time stakeholder channel
          </p>
        </div>

        {/* Stakeholder presence bar */}
        <div className="flex items-center gap-2 text-label-md text-on-surface-variant dark:text-surface-variant">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{Math.max(onlineUsers.size, 1)} stakeholder{onlineUsers.size === 1 ? '' : 's'} online</span>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-2xl h-[540px] flex flex-col overflow-hidden shadow-sm">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-[#FAFAF8] dark:bg-[#131e1b]">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-body-sm shadow-xs transition-all ${
                  m.mine
                    ? 'bg-[#315C4C] text-white rounded-br-none'
                    : 'bg-white dark:bg-surface-container border border-outline-variant/80 dark:border-outline rounded-bl-none text-on-background dark:text-surface-container-lowest'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] opacity-75 mb-1">
                  <span className="font-semibold">{m.senderName}</span>
                  {getRoleBadge(m.senderRole)}
                  <span>•</span>
                  <span>{time(m.createdAt)}</span>
                </div>
                <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
                {m.isOptimistic && (
                  <div className="text-[9px] opacity-60 text-right mt-0.5">Sending…</div>
                )}
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant dark:text-surface-variant">
              <span className="text-4xl mb-2">💬</span>
              <p className="text-body-md font-medium">No messages in this room yet.</p>
              <p className="text-body-sm opacity-80">Start the conversation with your team.</p>
            </div>
          )}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-label-md text-on-surface-variant dark:text-surface-variant italic animate-in fade-in duration-150">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>
                {typingUsers.map((u) => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-outline-variant dark:border-outline flex gap-2 bg-white dark:bg-surface-container">
          <input
            value={newMsg}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="input flex-1"
            placeholder="Type your message to the team…"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMsg.trim()}
            className="btn-primary px-6 rounded-lg text-label-md disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
