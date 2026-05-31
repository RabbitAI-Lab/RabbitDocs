import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "data");

/**
 * 将相对路径字符串解析为路径段数组
 */
export function parsePath(filePath: string): string[] {
  return filePath.split("/").filter(Boolean);
}

/**
 * 构建完整的文件系统路径（用于调试/日志）
 */
export function resolvePath(segments: string[]): string {
  return path.join(DATA_ROOT, ...segments);
}

/**
 * 构建账号级别的路径段
 */
export function getAccountSegments(
  type: "personal" | "enterprise",
  accountId: string,
  orgId?: string
): string[] {
  if (type === "personal") {
    return ["personal", accountId];
  } else if (orgId) {
    return ["enterprise", accountId, orgId];
  } else {
    return ["enterprise", accountId];
  }
}
