import { PROVIDERS } from "@/lib/model-constants";
import {
  parseExtraEnv,
  PREDEFINED_ENV_KEYS,
  DEFAULT_THINKING_VALUE,
} from "@/lib/model-env";

export interface ModelConfig {
  id: number;
  provider: string;
  protocol: "openai" | "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  extraEnvJson: string;
  createdAt: string;
  updatedAt: string;
  isDefault: number;
}

export interface ModelConfigSubmitData {
  provider: string;
  protocol: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  extraEnvJson: string;
}

export const CUSTOM_PROVIDER_KEY = "__custom__";

export const PROVIDER_SELECT_OPTIONS = [
  ...PROVIDERS.map((p) => ({ value: p, label: p })),
];

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 3) + "****" + key.slice(-4);
}

/** Collect extra env object from form fields (Switch off / Input empty -> key not included) */
export function collectExtraEnvFromForm(
  disableAdaptive: boolean | undefined,
  defaultThinking: string | undefined,
  customEnvList:
    | Array<{ key?: string; value?: string }>
    | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (disableAdaptive) {
    out[PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE] = "1";
  }
  const thinking = (defaultThinking || "").trim();
  if (thinking) {
    out[PREDEFINED_ENV_KEYS.DEFAULT_THINKING] = thinking;
  }
  if (Array.isArray(customEnvList)) {
    for (const item of customEnvList) {
      const k = (item?.key || "").trim();
      const v = (item?.value || "").trim();
      if (k && v) {
        out[k] = v;
      }
    }
  }
  return out;
}

/** Split extraEnvJson into form field initial values */
export function splitExtraEnvToForm(extraEnvJson: string) {
  const envMap = parseExtraEnv(extraEnvJson);
  const customEnvList: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(envMap)) {
    if (
      k === PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE ||
      k === PREDEFINED_ENV_KEYS.DEFAULT_THINKING
    ) {
      continue;
    }
    customEnvList.push({ key: k, value: v });
  }
  return {
    disableAdaptive: envMap[PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE] === "1",
    defaultThinking: envMap[PREDEFINED_ENV_KEYS.DEFAULT_THINKING] ?? "",
    customEnvList,
  };
}

export const CREATE_FORM_DEFAULTS = {
  provider: "GLM",
  protocol: "openai",
  disableAdaptive: true,
  defaultThinking: DEFAULT_THINKING_VALUE,
  customEnvList: [],
};
