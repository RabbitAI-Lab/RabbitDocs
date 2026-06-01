"use client";

import { useState, useEffect } from "react";
import { Switch, Input, Modal, App } from "antd";
import { EditOutlined, SafetyCertificateOutlined } from "@ant-design/icons";

interface McpPanelProps {
  projectPath: string;
}

const MCP_BASE_URL = "https://open.bigmodel.cn/api/mcp-broker/proxy/web-search/mcp?Authorization=";

export default function McpPanel({ projectPath }: McpPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  const dirSegments = projectPath.split(",");

  const fetchConfig = () => {
    fetch(`/api/fs/project-mcp?dirSegments=${dirSegments.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setEnabled(data.enabled);
          setApiKey(data.apiKey);
          setSavedApiKey(data.apiKey);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fs/project-mcp?dirSegments=${dirSegments.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setEnabled(data.enabled);
          setApiKey(data.apiKey);
          setSavedApiKey(data.apiKey);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dirSegments]);

  const handleToggle = async (checked: boolean) => {
    if (checked && !savedApiKey) {
      message.warning("请先配置 API Key");
      setKeyModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/fs/project-mcp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirSegments, enabled: checked, apiKey: savedApiKey || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
        message.success(checked ? "已启用" : "已禁用");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKey = async () => {
    if (!inputKey.trim()) {
      message.error("请输入 API Key");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/fs/project-mcp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirSegments, enabled: true, apiKey: inputKey.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
        setApiKey(data.apiKey);
        setSavedApiKey(data.apiKey);
        setKeyModalOpen(false);
        setInputKey("");
        message.success("API Key 已保存");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenJsonEditor = () => {
    // Build current JSON from state
    const config: Record<string, unknown> = { mcpServers: {} as Record<string, unknown> };
    if (enabled && apiKey) {
      (config.mcpServers as Record<string, unknown>)["zhipu-web-search-sse"] = {
        url: `${MCP_BASE_URL}${apiKey}`,
      };
    }
    setJsonText(JSON.stringify(config, null, 2));
    setJsonModalOpen(true);
  };

  const handleSaveJson = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null) {
        message.error("JSON 格式无效");
        return;
      }
      setSaving(true);
      // Write raw JSON directly via a dedicated endpoint
      const res = await fetch("/api/fs/project-mcp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirSegments, rawJson: parsed }),
      });
      if (res.ok) {
        setJsonModalOpen(false);
        fetchConfig();
        message.success("MCP 配置已保存");
      }
    } catch {
      message.error("JSON 格式无效");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="w-5 h-5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p className="text-sm text-blue-700">
          启用智谱 WebSearch MCP 后，AI 对话中可以进行网络搜索，获取最新的实时信息。
        </p>
      </div>

      {/* 一行：开关 + 名称 + 状态 + 图标按钮 */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200">
        <Switch
          size="small"
          checked={enabled}
          loading={saving}
          onChange={handleToggle}
        />
        <span className="text-sm font-medium text-gray-700">智谱 WebSearch</span>
        <span className={`text-xs ${enabled ? "text-green-600" : "text-gray-400"}`}>
          {enabled ? "已启用" : "未启用"}
        </span>
        <div className="flex-1" />
        <EditOutlined
          className="text-gray-400 hover:text-blue-500 cursor-pointer text-base"
          title="编辑 JSON"
          onClick={handleOpenJsonEditor}
        />
        <SafetyCertificateOutlined
          className="text-gray-400 hover:text-blue-500 cursor-pointer text-base"
          title="修改 API Key"
          onClick={() => {
            setInputKey("");
            setKeyModalOpen(true);
          }}
        />
      </div>

      {/* API Key 修改 Modal */}
      <Modal
        title="修改 API Key"
        open={keyModalOpen}
        onOk={handleSaveKey}
        onCancel={() => { setKeyModalOpen(false); setInputKey(""); }}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
      >
        <Input.Password
          placeholder="输入智谱 API Key"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* JSON 编辑 Modal */}
      <Modal
        title="编辑 MCP 配置"
        open={jsonModalOpen}
        onOk={handleSaveJson}
        onCancel={() => setJsonModalOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        width={520}
      >
        <Input.TextArea
          rows={10}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="font-mono text-sm"
        />
      </Modal>
    </div>
  );
}
