export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("./db");
    initDb();

    const { startMcpServer } = await import("./mcp-server");
    startMcpServer();
  }
}
