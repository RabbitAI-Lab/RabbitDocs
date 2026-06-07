/**
 * API Key 连通性验证
 *
 * 向 Anthropic 兼容 API 发送一个最小化的 messages 请求，
 * 验证 API Key 是否有效、网络是否通畅。
 */

export interface VerifyResult {
  ok: boolean;
  error?: string;
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
  response?: {
    status: number;
    statusText: string;
    body: string;
  };
}

/**
 * 验证 Anthropic 兼容 API 的连通性
 *
 * 发送 max_tokens=1 的最小请求，检查：
 * - 网络是否可达
 * - API Key 是否有效（401/403 = 无效）
 * - 模型是否可用（404 = 模型不存在）
 * - 其他 HTTP 错误
 */
export async function verifyAnthropicApiKey(params: {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}): Promise<VerifyResult> {
  const { baseUrl, apiKey, modelName } = params;

  // 拼接 messages 端点
  const url = baseUrl.replace(/\/+$/, "") + "/v1/messages";

  const requestBody = {
    model: modelName,
    max_tokens: 1,
    messages: [{ role: "user", content: "hi" }],
  };
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey.slice(0, 6) + "****" + apiKey.slice(-4),
    "anthropic-version": "2023-06-01",
  };

  // 构造用于返回的请求信息（API Key 遮掩）
  const requestInfo: VerifyResult["request"] = {
    url,
    method: "POST",
    headers: requestHeaders,
    body: { ...requestBody },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s 超时

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    // 读取响应体（仅一次）
    const responseText = await res.text();
    let responseBody: string;
    try {
      const json = JSON.parse(responseText);
      responseBody = JSON.stringify(json, null, 2);
    } catch {
      responseBody = responseText;
    }

    const responseInfo: VerifyResult["response"] = {
      status: res.status,
      statusText: res.statusText,
      body: responseBody,
    };

    if (res.ok) {
      return { ok: true, request: requestInfo, response: responseInfo };
    }

    // 解析错误信息
    let errorMessage = "";
    try {
      const json = JSON.parse(responseText);
      errorMessage = json?.error?.message || json?.message || JSON.stringify(json);
    } catch {
      errorMessage = responseText;
    }

    // 根据状态码返回友好提示
    let error: string;
    switch (res.status) {
      case 401:
      case 403:
        error = `API Key 无效或无权限 (${res.status})`;
        break;
      case 404:
        error = `模型 "${modelName}" 不存在或不可用 (404)`;
        break;
      case 429:
        error = "请求频率超限，请稍后再试 (429)";
        break;
      case 500:
      case 502:
      case 503:
      case 529:
        error = `服务端暂时不可用 (${res.status})，请稍后再试`;
        break;
      default:
        error = `验证失败 (${res.status}): ${errorMessage}`;
    }
    return { ok: false, error, request: requestInfo, response: responseInfo };
  } catch (err) {
    let error: string;
    if ((err as Error).name === "AbortError") {
      error = "连接超时，请检查网络或 Base URL 是否正确";
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
        error = `DNS 解析失败，请检查 Base URL: ${baseUrl}`;
      } else if (msg.includes("ECONNREFUSED")) {
        error = `连接被拒绝，请检查 Base URL: ${baseUrl}`;
      } else {
        error = `连接失败: ${msg}`;
      }
    }
    return { ok: false, error, request: requestInfo };
  } finally {
    clearTimeout(timeout);
  }
}
