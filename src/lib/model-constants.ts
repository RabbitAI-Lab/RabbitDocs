// 预设厂商列表（仅用于下拉快速选择 + 默认值映射）
export const PROVIDERS = ["GLM", "MiniMax", "Kimi", "阿里云", "DeepSeek"] as const;
export type Provider = (typeof PROVIDERS)[number];

// 协议列表
export const PROTOCOLS = ["openai", "anthropic"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

// 协议显示名
export const PROTOCOL_LABELS: Record<Protocol, string> = {
  openai: "OpenAI 兼容",
  anthropic: "Anthropic 兼容",
};

// 协议 Tag 颜色
export const PROTOCOL_TAG_COLORS: Record<Protocol, string> = {
  openai: "cyan",
  anthropic: "volcano",
};

// 厂商 Tag 颜色（自定义厂商默认 geekblue）
export const PROVIDER_TAG_COLORS: Record<string, string> = {
  GLM: "blue",
  MiniMax: "purple",
  Kimi: "gold",
  阿里云: "orange",
  DeepSeek: "green",
};

// 预设厂商×协议 → 默认值映射（自定义厂商无预设默认值，用户手填）
export const PROVIDER_DEFAULTS: Record<
  Provider,
  Record<Protocol, { baseUrl: string; modelName: string }>
> = {
  GLM: {
    openai: {
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
      modelName: "glm-5.1",
    },
    anthropic: {
      baseUrl: "https://open.bigmodel.cn/api/anthropic",
      modelName: "glm-5.1",
    },
  },
  MiniMax: {
    openai: {
      baseUrl: "https://api.minimaxi.com/v1",
      modelName: "MiniMax-M2.7",
    },
    anthropic: {
      baseUrl: "https://api.minimaxi.com/anthropic",
      modelName: "MiniMax-M2.7",
    },
  },
  Kimi: {
    openai: {
      baseUrl: "https://api.kimi.com/coding/v1",
      modelName: "kimi-for-coding",
    },
    anthropic: {
      baseUrl: "https://api.kimi.com/coding",
      modelName: "kimi-for-coding",
    },
  },
  阿里云: {
    openai: {
      baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
      modelName: "glm-5",
    },
    anthropic: {
      baseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
      modelName: "glm-5",
    },
  },
  DeepSeek: {
    openai: {
      baseUrl: "https://api.deepseek.com",
      modelName: "deepseek-v4-pro",
    },
    anthropic: {
      baseUrl: "https://api.deepseek.com/anthropic",
      modelName: "deepseek-v4-pro",
    },
  },
};

// 辅助函数：获取厂商+协议的默认值（自定义厂商返回 null）
export function getProviderDefaults(provider: string, protocol: string) {
  return (
    PROVIDER_DEFAULTS[provider as Provider]?.[protocol as Protocol] ?? null
  );
}

// 判断是否为预设厂商
export function isPresetProvider(provider: string): provider is Provider {
  return (PROVIDERS as readonly string[]).includes(provider);
}
