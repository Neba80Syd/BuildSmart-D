'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: 'CLIENT' | 'ARCHITECT' | 'VENDOR' | 'ADMIN' | string;
  roomId: string;
  content: string;
  read: boolean;
  createdAt: string;
  mine: boolean;
  isOptimistic?: boolean;
};

export type TypingUser = {
  userId: string;
  userName: string;
  roomId: string;
};

export interface UseWebSocketChatOptions {
  userId?: string;
  userName?: string;
  userRole?: string;
  roomId?: string | null;
  onNewMessage?: (msg: ChatMessage) => void;
  onConversationUpdated?: (data: { roomId: string; lastMessage: any }) => void;
}

export function useWebSocketChat(options: UseWebSocketChatOptions) {
  const { userId, userName, userRole, roomId } = options;

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const activeRoomIdRef = useRef<string | null>(roomId ?? null);
  const isMountedRef = useRef<boolean>(true);
  const connectRef = useRef<() => void>(() => {});

  // Keep all dynamic options and callbacks in a ref to prevent connect recreation and infinite loops
  const optionsRef = useRef<UseWebSocketChatOptions>(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    activeRoomIdRef.current = roomId ?? null;
  }, [roomId]);

  // Resolve WS URL
  const getWsUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.hostname}:3001`;
    }
    return 'ws://localhost:3001';
  }, []);

  // Connect to WebSocket Server (stable reference, does NOT change when options/callbacks change)
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      const nextStatus = reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting';
      setStatus((prev) => (prev === nextStatus ? prev : nextStatus));

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus((prev) => (prev === 'connected' ? prev : 'connected'));
        reconnectAttemptsRef.current = 0;

        const current = optionsRef.current;
        // Authenticate socket session
        if (current.userId) {
          ws.send(
            JSON.stringify({
              type: 'auth',
              userId: current.userId,
              userName: current.userName,
              role: current.userRole,
            })
          );
        }

        // Join active room if specified
        if (activeRoomIdRef.current) {
          ws.send(
            JSON.stringify({
              type: 'join_room',
              roomId: activeRoomIdRef.current,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          const current = optionsRef.current;

          switch (payload.type) {
            case 'connected': {
              if (Array.isArray(payload.onlineUsers)) {
                setOnlineUsers(new Set(payload.onlineUsers));
              }
              break;
            }

            case 'authenticated': {
              if (Array.isArray(payload.onlineUsers)) {
                setOnlineUsers(new Set(payload.onlineUsers));
              }
              break;
            }

            case 'presence': {
              const { userId: pUserId, status: pStatus } = payload;
              setOnlineUsers((prev) => {
                const next = new Set(prev);
                if (pStatus === 'online') {
                  next.add(pUserId);
                } else {
                  next.delete(pUserId);
                }
                return next;
              });
              break;
            }

            case 'new_message': {
              const { message, clientTempId } = payload;
              if (!message) break;

              const isMine = message.senderId === current.userId;
              const formatted: ChatMessage = {
                ...message,
                mine: isMine,
                isOptimistic: false,
              };

              // If message belongs to currently active room, append to messages
              if (message.roomId === activeRoomIdRef.current) {
                setMessages((prev) => {
                  if (clientTempId) {
                    const withoutOptimistic = prev.filter((m) => m.id !== clientTempId);
                    if (withoutOptimistic.some((m) => m.id === formatted.id)) return withoutOptimistic;
                    return [...withoutOptimistic, formatted];
                  }
                  if (prev.some((m) => m.id === formatted.id)) return prev;
                  return [...prev, formatted];
                });
              }

              // Notify outside handler
              if (current.onNewMessage) current.onNewMessage(formatted);
              break;
            }

            case 'conversation_updated': {
              if (current.onConversationUpdated) {
                current.onConversationUpdated({
                  roomId: payload.roomId,
                  lastMessage: payload.lastMessage,
                });
              }
              break;
            }

            case 'user_typing': {
              const { roomId: tRoomId, userId: tUserId, userName: tUserName, isTyping } = payload;
              if (tRoomId !== activeRoomIdRef.current || tUserId === current.userId) break;

              // Clear previous auto-expire timer
              const existingTimer = typingTimersRef.current.get(tUserId);
              if (existingTimer) clearTimeout(existingTimer);

              if (isTyping) {
                setTypingUsers((prev) => {
                  if (prev.some((u) => u.userId === tUserId)) return prev;
                  return [...prev, { userId: tUserId, userName: tUserName, roomId: tRoomId }];
                });

                // Auto-clear after 3.5 seconds
                const timer = setTimeout(() => {
                  setTypingUsers((prev) => prev.filter((u) => u.userId !== tUserId));
                  typingTimersRef.current.delete(tUserId);
                }, 3500);
                typingTimersRef.current.set(tUserId, timer);
              } else {
                setTypingUsers((prev) => prev.filter((u) => u.userId !== tUserId));
              }
              break;
            }

            case 'messages_read': {
              if (payload.roomId === activeRoomIdRef.current) {
                setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
              }
              break;
            }

            default:
              break;
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setStatus((prev) => (prev === 'disconnected' ? prev : 'disconnected'));
        wsRef.current = null;

        // Reconnect with exponential backoff (max 10s)
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connectRef.current();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setStatus((prev) => (prev === 'disconnected' ? prev : 'disconnected'));
    }
  }, [getWsUrl]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Main lifecycle: only connects once on mount and cleans up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      for (const timer of typingTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingTimersRef.current.clear();
    };
  }, [connect]);

  // When user credentials change, re-authenticate without reconnecting socket
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auth',
          userId,
          userName,
          role: userRole,
        })
      );
    }
  }, [userId, userName, userRole]);

  // When active room changes, switch rooms on socket
  useEffect(() => {
    activeRoomIdRef.current = roomId ?? null;
    if (wsRef.current?.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join_room',
          roomId,
        })
      );
      // Clear typing indicator for previous room
      setTypingUsers([]);
    }
  }, [roomId]);

  // Send a message over WebSocket
  const sendMessage = useCallback(
    async (content: string, targetRoomId?: string): Promise<boolean> => {
      const destinationRoomId = targetRoomId || activeRoomIdRef.current;
      const trimmed = content.trim();
      if (!destinationRoomId || !trimmed) return false;

      const current = optionsRef.current;
      const senderId = current.userId || 'u_client';
      const senderName = current.userName || 'You';
      const senderRole = current.userRole;

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const optimisticMsg: ChatMessage = {
        id: tempId,
        senderId,
        senderName,
        senderRole,
        roomId: destinationRoomId,
        content: trimmed,
        read: false,
        createdAt: new Date().toISOString(),
        mine: true,
        isOptimistic: true,
      };

      // Optimistic append if targeting current room
      if (destinationRoomId === activeRoomIdRef.current) {
        setMessages((prev) => [...prev, optimisticMsg]);
      }

      // Check if WebSocket is open
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'send_message',
            roomId: destinationRoomId,
            content: trimmed,
            senderId,
            clientTempId: tempId,
          })
        );
        return true;
      }

      // Fallback to HTTP POST if socket is temporarily reconnecting
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: destinationRoomId, content: trimmed }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    []
  );

  // Send typing indicator with debounce
  const sendTyping = useCallback(
    (isTyping: boolean, targetRoomId?: string) => {
      const destinationRoomId = targetRoomId || activeRoomIdRef.current;
      if (!destinationRoomId || wsRef.current?.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          roomId: destinationRoomId,
          isTyping,
        })
      );
    },
    []
  );

  // Mark messages in room as read
  const markRead = useCallback((targetRoomId?: string) => {
    const destinationRoomId = targetRoomId || activeRoomIdRef.current;
    if (!destinationRoomId) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mark_read',
          roomId: destinationRoomId,
        })
      );
    }
  }, []);

  return {
    status,
    isLive: status === 'connected',
    messages,
    setMessages,
    sendMessage,
    sendTyping,
    markRead,
    onlineUsers,
    typingUsers,
  };
}
