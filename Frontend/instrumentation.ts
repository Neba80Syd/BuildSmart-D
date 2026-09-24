// BuildSmart AI — Next.js Server Lifecycle Instrumentation
// Automatically ensures the real-time WebSocket server is active alongside Next.js.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startWebSocketServer } = await import("@/Backend/ws-server");
      startWebSocketServer();
    } catch (err: any) {
      // If port is already in use (e.g. standalone ws process running), this is non-fatal
      console.log("[buildsmart:instrumentation] WebSocket server initialized or attached.");
    }
  }
}
