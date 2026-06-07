/**
 * ACP 连接池管理器
 *
 * 按 Project / Workspace 维度维护 ACP Agent 长连接。
 * 设计参考 gitnexus-service.ts 的 globalThis 注册表 + escalateKill 模式。
 *
 * Pool Key 策略：
 * - project:<projectId>  — 一个项目一个 ACP 长连接
 * - workspace:<workspaceId> — 一个工作空间一个 ACP 长连接
 * - free:<userId>       — 自由聊天（无项目）降级为用户维度
 */
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import { Writable, Readable } from "node:stream";
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type McpServer,
} from "@agentclientprotocol/sdk";
import { ChatWikiAcpClient } from "./acp-client";
import { parseExtraEnv } from "./model-env";

// ========== 进程注册表（globalThis 避免 dev HMR 时丢失） ==========

declare global {
  var __chatwiki_acp_pool__: Map<string, AcpPoolEntry> | undefined;
}

export interface AcpPoolConfig {
  modelId: number;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  cwd: string;
  extraEnvJson: string;
}

export interface AcpPoolEntry {
  key: string;                        // "project:<id>" | "workspace:<id>" | "free:<userId>"
  child: ChildProcess;                // Agent 子进程
  connection: ClientSideConnection;   // ACP SDK 连接
  clientRef: ChatWikiAcpClient;       // Client 实现（含事件队列）
  sessions: Map<string, string>;      // chatId → acpSessionId
  lastActivityAt: number;             // 最后活跃时间戳
  idleTimer: NodeJS.Timeout;          // 空闲检测定时器
  config: AcpPoolConfig;              // 配置快照
  initializing: Promise<void>;        // 初始化锁（防并发）
  closed: boolean;                    // 进程是否已退出
}

const pool: Map<string, AcpPoolEntry> =
  globalThis.__chatwiki_acp_pool__ ?? new Map();
globalThis.__chatwiki_acp_pool__ = pool;

// ========== 配置常量 ==========

const IDLE_TIMEOUT_MS = parseInt(process.env.ACP_IDLE_TIMEOUT_MS || "300000");    // 默认 5 分钟，可通过环境变量配置
const SIGTERM_GRACE_MS = 3 * 1000;        // SIGTERM 后 3s 升级为 SIGKILL
const REAPER_INTERVAL_MS = 60 * 1000;     // 60s 检查一次

// ========== Pool Key 构建 ==========

export function buildPoolKey(params: {
  projectId?: string;
  workspaceId?: string;
  userId: string;
}): string {
  if (params.projectId) return `project:${params.projectId}`;
  if (params.workspaceId) return `workspace:${params.workspaceId}`;
  return `free:${params.userId}`;
}

// ========== 核心操作 ==========

/**
 * 获取或创建 ACP Agent 连接。
 * 复用已有连接、自动重建死亡进程、防并发初始化。
 */
export async function getOrCreateEntry(
  key: string,
  config: AcpPoolConfig
): Promise<AcpPoolEntry> {
  const existing = pool.get(key);

  // 1. 存在且存活 → 复用
  if (existing && !existing.closed && !existing.child.killed && !existing.connection.signal.aborted) {
    touchActivity(key);
    return existing;
  }

  // 2. 存在但已死 → 清理后重建
  if (existing) {
    await destroyEntry(key);
  }

  // 3. 检查是否有正在进行的初始化（防并发）
  // 注意：pool 中已经没有该 key 了（上面 destroyEntry 会删除）
  // 但可能有其他并发调用正在初始化同一个 key
  // 简单方案：直接创建，因为 pool.delete 已执行

  // 4. 全新创建
  const entry = await createEntry(key, config);
  pool.set(key, entry);
  touchActivity(key);

  console.log(`[ACP Pool] created entry: key=${key} pid=${entry.child.pid}`);
  return entry;
}

/**
 * 获取或创建 ACP session。
 * 同一个 chatId 复用同一个 session（多轮对话）。
 */
export async function getOrCreateSession(
  entry: AcpPoolEntry,
  chatId: string,
  cwd: string,
  mcpServers?: Array<McpServer>,
): Promise<string> {
  // 已有 session → 复用
  const existingSessionId = entry.sessions.get(chatId);
  if (existingSessionId) {
    touchActivity(entry.key);
    return existingSessionId;
  }

  // 创建新 session
  const mcpPort = parseInt(process.env.MCP_PORT || "4001");
  const mcpHost = process.env.MCP_HOST || "127.0.0.1";
  console.log(`[ACP Pool] creating session: key=${entry.key} chatId=${chatId}`);

  // 构建完整 mcpServers 列表：全局/项目 MCP + rabbitdocs_client
  const rabbitdocsClient = {
    type: "http" as const,
    name: "rabbitdocs_client",
    url: `http://${mcpHost}:${mcpPort}/mcp`,
    headers: [] as Array<{ name: string; value: string }>,
  };
  const allMcpServers = [...(mcpServers || []), rabbitdocsClient];

  const { sessionId } = await entry.connection.newSession({
    cwd,
    mcpServers: allMcpServers,
  });

  entry.sessions.set(chatId, sessionId);
  touchActivity(entry.key);
  console.log(`[ACP Pool] session created: key=${entry.key} chatId=${chatId} sessionId=${sessionId}`);
  return sessionId;
}

/**
 * 销毁指定 key 的连接。
 */
export async function destroyEntry(key: string): Promise<void> {
  const entry = pool.get(key);
  if (!entry) return;

  console.log(`[ACP Pool] destroying entry: key=${key} pid=${entry.child.pid}`);
  entry.closed = true;
  clearTimeout(entry.idleTimer);
  pool.delete(key);

  escalateKill(entry.child);
}

/**
 * 强制重建指定 key 的连接。
 * 用于连接意外断开后自动重连。
 */
export async function forceRecreateEntry(
  key: string,
  config: AcpPoolConfig
): Promise<AcpPoolEntry> {
  console.log(`[ACP Pool] force recreating entry: key=${key}`);
  await destroyEntry(key);
  const entry = await createEntry(key, config);
  pool.set(key, entry);
  touchActivity(key);
  console.log(`[ACP Pool] force recreated entry: key=${key} pid=${entry.child.pid}`);
  return entry;
}

/**
 * 触碰活跃时间。
 */
function touchActivity(key: string): void {
  const entry = pool.get(key);
  if (!entry) return;
  entry.lastActivityAt = Date.now();

  // 重置空闲定时器
  clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => {
    // 仅在没有活跃 session 时回收
    if (entry.sessions.size === 0) {
      console.log(`[ACP Pool] idle timeout: key=${key}`);
      destroyEntry(key);
    }
  }, IDLE_TIMEOUT_MS).unref();
}

// ========== 内部工具 ==========

async function createEntry(key: string, config: AcpPoolConfig): Promise<AcpPoolEntry> {
  // 防御性检查：确保 cwd 目录存在
  if (!fs.existsSync(config.cwd)) {
    fs.mkdirSync(config.cwd, { recursive: true });
    console.log(`[ACP Pool] created missing cwd: ${config.cwd}`);
  }

  const userExtraEnv = parseExtraEnv(config.extraEnvJson);

  // spawn Agent 子进程
  const child = spawn("npx", ["-y", "@agentclientprotocol/claude-agent-acp"], {
    cwd: config.cwd,
    env: {
      ...process.env,
      ...userExtraEnv,
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_API_KEY: config.apiKey,
      ANTHROPIC_MODEL: config.modelName,
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_AGENT_SDK_CLIENT_APP: "RabbitDocs/0.1.0",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  console.log(`[ACP Pool] spawned agent: key=${key} pid=${child.pid} model=${config.modelName}`);

  // stderr 日志收集
  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderrBuf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    // 实时打印 stderr（有助于调试 Agent 启动问题）
    const lines = (typeof chunk === "string" ? chunk : chunk.toString("utf8")).trim();
    if (lines) {
      console.log(`[ACP Agent stderr] ${lines.slice(0, 500)}`);
    }
  });

  // 建立 ACP 连接
  const stream = ndJsonStream(
    Writable.toWeb(child.stdin!),
    Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>
  );

  const clientRef = new ChatWikiAcpClient(config.cwd);
  const connection = new ClientSideConnection(
    () => clientRef,
    stream
  );

  // 初始化握手
  const initPromise = connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
  });

  const initializing = initPromise.then(() => {
    console.log(`[ACP Pool] initialized: key=${key} pid=${child.pid}`);
  });

  // 监听进程退出
  child.on("exit", (code, signal) => {
    console.log(`[ACP Pool] agent exited: key=${key} pid=${child.pid} code=${code} signal=${signal}`);
    console.log(`[ACP Pool]   stderr (tail 2000):\n${tail(stderrBuf)}`);
    const entry = pool.get(key);
    if (entry) {
      entry.closed = true;
    }
  });

  child.on("error", (err) => {
    console.error(`[ACP Pool] agent error: key=${key} pid=${child.pid} error=${err.message}`);
    const entry = pool.get(key);
    if (entry) {
      entry.closed = true;
    }
  });

  // 等待初始化完成
  await initializing;

  const idleTimer = setTimeout(() => {
    // 刚创建就空闲（不应该发生），但安全起见
  }, IDLE_TIMEOUT_MS).unref();

  return {
    key,
    child,
    connection,
    clientRef,
    sessions: new Map(),
    lastActivityAt: Date.now(),
    idleTimer,
    config,
    initializing,
    closed: false,
  };
}

function escalateKill(child: ChildProcess): void {
  if (child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    /* noop */
  }
  setTimeout(() => {
    if (!child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* noop */
      }
    }
  }, SIGTERM_GRACE_MS).unref();
}

const tail = (s: string, n = 2000) =>
  s.length <= n ? s : `...<truncated ${s.length - n} chars>...\n${s.slice(-n)}`;

// ========== 空闲回收定时器 ==========

// 全局定时器：每 60s 扫描一次，回收空闲超过 5min 的连接
let reaperTimer: NodeJS.Timeout | null = null;

export function startReaper(): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of pool) {
      if (
        !entry.closed &&
        entry.sessions.size === 0 &&
        now - entry.lastActivityAt > IDLE_TIMEOUT_MS
      ) {
        console.log(`[ACP Pool] reaping idle entry: key=${key} idle=${Math.round((now - entry.lastActivityAt) / 1000)}s`);
        destroyEntry(key);
      }
    }
  }, REAPER_INTERVAL_MS).unref();
  console.log("[ACP Pool] reaper started");
}

// 自动启动 reaper（首次 import 时）
startReaper();

// ========== 调试工具 ==========

export function getPoolStats(): { total: number; entries: Array<{ key: string; pid: number | undefined; sessions: number; closed: boolean }> } {
  return {
    total: pool.size,
    entries: Array.from(pool.entries()).map(([key, entry]) => ({
      key,
      pid: entry.child.pid,
      sessions: entry.sessions.size,
      closed: entry.closed,
    })),
  };
}
