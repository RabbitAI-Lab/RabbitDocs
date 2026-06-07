/**
 * 用户 BYOK 模型服务
 *
 * 提供用户自有模型的配置解析（含 API Key 解密 + 所有权校验）
 */
import { db } from "@/db";
import { userModelConfigs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { PROVIDERS } from "@/lib/model-constants";
import { decryptApiKey } from "@/lib/crypto";
import { ModelError } from "@/lib/types";

export interface UserModelConfigRow {
  id: number;
  userId: string;
  provider: string;
  protocol: "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string; // 已解密
  modelName: string;
  extraEnvJson: string;
  backend: string;
}

/**
 * 解析用户 BYOK 模型配置（解密 API Key + 校验所有权）
 */
export function resolveUserModelConfig(
  id: number,
  userId: string
): UserModelConfigRow {
  const row = db
    .select()
    .from(userModelConfigs)
    .where(
      and(eq(userModelConfigs.id, id), eq(userModelConfigs.userId, userId))
    )
    .get();

  if (!row) {
    throw new ModelError("BYOK 模型不存在或无权访问", "MODEL_NOT_FOUND");
  }

  // 校验 provider 在预设列表内
  if (!(PROVIDERS as readonly string[]).includes(row.provider)) {
    throw new ModelError(
      `不支持的 Provider: ${row.provider}`,
      "INVALID_CONFIG"
    );
  }

  // 解密 API Key
  let apiKey: string;
  try {
    apiKey = decryptApiKey(row.apiKeyEncrypted);
  } catch {
    throw new ModelError(
      "API Key 解密失败，请重新配置",
      "INVALID_CONFIG"
    );
  }

  if (!apiKey) {
    throw new ModelError("API Key 无效，请检查模型设置", "INVALID_CONFIG");
  }

  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    protocol: "anthropic" as const,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKey,
    modelName: row.modelName,
    extraEnvJson: row.extraEnvJson,
    backend: row.backend,
  };
}
