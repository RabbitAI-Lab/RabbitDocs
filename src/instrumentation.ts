export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMcpServer } = await import("./mcp-server");
    startMcpServer();
  }
}
