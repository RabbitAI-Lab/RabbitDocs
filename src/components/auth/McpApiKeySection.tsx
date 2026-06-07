"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { App, Button, Space, Typography, Popconfirm } from "antd";
import {
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

const { Text } = Typography;

interface McpKeyData {
  key: string;
  prefix: string;
  createdAt: string;
}

export default function McpApiKeySection() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("settings");
  const [data, setData] = useState<McpKeyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/mcp-key");
      if (res.ok) {
        const json = (await res.json()) as McpKeyData;
        setData(json);
      } else {
        message.error(t("mcpApiKeyError"));
      }
    } catch {
      message.error(t("mcpApiKeyError"));
    } finally {
      setLoading(false);
    }
  }, [authFetch, message, t]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await authFetch("/api/auth/mcp-key", { method: "POST" });
      if (res.ok) {
        const json = (await res.json()) as McpKeyData;
        setData(json);
        setRevealed(true);
        message.success(t("mcpApiKeyRegenerated"));
      } else {
        message.error(t("mcpApiKeyRegenerateFailed"));
      }
    } catch {
      message.error(t("mcpApiKeyRegenerateFailed"));
    } finally {
      setRegenerating(false);
    }
  };

  const copyKey = () => {
    if (data?.key) {
      navigator.clipboard.writeText(data.key);
      message.success(t("mcpApiKeyCopied"));
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return key;
    return key.slice(0, 8) + "****" + key.slice(-4);
  };

  const mcpUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/mcp`;

  if (loading && !data) {
    return <div className="text-sm text-gray-500">{t("mcpApiKeyLoading")}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Usage hint */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t("mcpApiKeyUsage", { url: mcpUrl })}
      </div>

      {/* Key display + actions */}
      <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Space size="middle" align="center">
            <Text code className="!text-base !px-3 !py-1.5 select-all">
              {revealed ? data.key : maskKey(data.key)}
            </Text>
          </Space>
          <Space>
            <Button
              size="small"
              icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? t("mcpApiKeyHide") : t("mcpApiKeyShow")}
            </Button>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={copyKey}
            >
              {t("mcpApiKeyCopy")}
            </Button>
            <Popconfirm
              title={t("mcpApiKeyRegenerateConfirm")}
              description={t("mcpApiKeyRegenerateDesc")}
              onConfirm={handleRegenerate}
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={regenerating}
              >
                {t("mcpApiKeyRegenerate")}
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </div>

      {/* Created time */}
      {data.createdAt && (
        <div className="text-xs text-gray-400">
          {t("mcpApiKeyCreated")}: {new Date(data.createdAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
