// In-process pub/sub used to fan out chat messages to SSE subscribers.
// Stored on globalThis so Next.js dev-mode module duplication cannot split
// the subscriber set. The DB is a normal PostgreSQL server, and this process
// bus is the correct (and simplest) real-time transport for a single server.
type Listener = (message: any) => void;

const g = globalThis as unknown as { __bsChatListeners?: Set<Listener> };

function listeners(): Set<Listener> {
  if (!g.__bsChatListeners) g.__bsChatListeners = new Set<Listener>();
  return g.__bsChatListeners;
}

/** Subscribe to new chat messages. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  const set = listeners();
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Publish a new chat message to all subscribers. */
export function publish(message: any): void {
  for (const l of Array.from(listeners())) {
    try {
      l(message);
    } catch {
      // A misbehaving subscriber must not break delivery to the others.
    }
  }
}
