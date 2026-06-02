"use client";

import { useState, useEffect, useRef } from "react";
import {
  Switch,
  Input,
  Modal,
  App,
  Form,
  Select,
  Popconfirm,
  Tag,
} from "antd";
import {
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

interface McpPanelProps {
  projectPath: string;
}

const MCP_BASE_URL =
  "https://open.bigmodel.cn/api/mcp-broker/proxy/web-search/mcp?Authorization=";

type McpServerType = "stdio" | "http" | "sse";

interface McpServerEntry {
  type?: McpServerType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

interface McpJson {
  mcpServers: Record<string, McpServerEntry>;
  /**
   * 禁用的 server。保留配置但不注入到 Agent SDK。列表中会灰显并显示 "Disabled" Tag。
   * 用户可随时启用 —— 启用时若 _apiKeys 有匹配的 key，会自动重建 zhipu-style url。
   */
  disabled?: Record<string, McpServerEntry>;
  _apiKeys: Record<string, string>;
}

function emptyMcpJson(): McpJson {
  return { mcpServers: {}, disabled: {}, _apiKeys: {} };
}

const NAME_PATTERN = /^[a-zA-Z0-9_\-]+$/;

/** 系统 MCP：由平台注入，不允许删除 */
const SYSTEM_MCP_NAMES = new Set(["gitnexus", "zhipu-web-search-sse"]);

/** 判断是否为系统 MCP */
function isSystemMcp(name: string): boolean {
  return SYSTEM_MCP_NAMES.has(name);
}

function describeServer(entry: McpServerEntry): string {
  if (entry.command) {
    const args = (entry.args || []).join(" ");
    return `${entry.command} ${args}`.trim();
  }
  if (entry.url) {
    // 截断 url 中的 Authorization=xxx 部分以避免泄露
    return entry.url.replace(/Authorization=[^&]+/g, "Authorization=***");
  }
  return "(empty)";
}

function inferType(entry: McpServerEntry): McpServerType {
  if (entry.type === "stdio" || entry.type === "http" || entry.type === "sse") {
    return entry.type;
  }
  if (entry.command) return "stdio";
  if (entry.url) {
    if (entry.url.includes("/sse") || /\.sse(\?|$)/.test(entry.url)) return "sse";
    return "http";
  }
  return "stdio";
}

export default function McpPanel({ projectPath }: McpPanelProps) {
  const [mcpJson, setMcpJson] = useState<McpJson>(emptyMcpJson());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit JSON modal
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Add MCP modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();

  // API Key modal (用于 zhipu 等需要 Authorization 的 server)
  const [keyTarget, setKeyTarget] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  const { message } = App.useApp();

  const dirSegments = projectPath.split(",");

  // 稳定的条目顺序追踪：toggle 时不会改变列表顺序（必须在所有 early return 之前调用）
  const entryOrderRef = useRef<string[]>([]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(
        `/api/fs/project-mcp?dirSegments=${dirSegments.join(",")}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const mcpServers =
        (data.mcpJson?.mcpServers && typeof data.mcpJson.mcpServers === "object"
          ? data.mcpJson.mcpServers
          : {}) as Record<string, McpServerEntry>;
      const disabled =
        (data.mcpJson?.disabled && typeof data.mcpJson.disabled === "object"
          ? data.mcpJson.disabled
          : {}) as Record<string, McpServerEntry>;
      const apiKeys =
        (data.mcpJson?._apiKeys && typeof data.mcpJson._apiKeys === "object"
          ? data.mcpJson._apiKeys
          : {}) as Record<string, string>;
      setMcpJson({ mcpServers, disabled, _apiKeys: apiKeys });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  /**
   * 写回：先乐观更新 UI → PUT → 成功后 refetch 校准
   */
  const writeBack = async (next: McpJson, successMsg?: string) => {
    setMcpJson(next); // 立即更新 UI
    setSaving(true);
    try {
      const res = await fetch("/api/fs/project-mcp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirSegments,
          mcpJson: {
            mcpServers: next.mcpServers,
            disabled: next.disabled || {},
            _apiKeys: next._apiKeys,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.mcpJson) {
        const mcpServers = (data.mcpJson.mcpServers || {}) as Record<
          string,
          McpServerEntry
        >;
        const disabled = (data.mcpJson.disabled || {}) as Record<
          string,
          McpServerEntry
        >;
        const apiKeys = (data.mcpJson._apiKeys || {}) as Record<string, string>;
        setMcpJson({ mcpServers, disabled, _apiKeys: apiKeys });
      }
      if (successMsg) message.success(successMsg);
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`);
      // 回滚
      await fetchConfig();
    } finally {
      setSaving(false);
    }
  };

  // -------- Switch 启用 / 禁用 --------
  // 关键修改：禁用不再删除条目，而是从 mcpServers 移到 disabled。
  // 列表会同时渲染 mcpServers + disabled，禁用行视觉灰显，Switch 状态对应所在 map。
  const handleToggle = async (name: string, checked: boolean) => {
    if (checked) {
      // 启用：从 disabled 移回 mcpServers
      const disabledEntry = mcpJson.disabled?.[name];
      if (!disabledEntry) return; // 已经启用了，忽略
      const storedKey = mcpJson._apiKeys[name];
      let entry = disabledEntry;
      // zhipu-style 特判：若 _apiKeys 有，则重建 url
      if (storedKey) {
        entry = { ...entry, url: `${MCP_BASE_URL}${storedKey}` };
      }
      const nextServers = { ...mcpJson.mcpServers, [name]: entry };
      const nextDisabled = { ...(mcpJson.disabled || {}) };
      delete nextDisabled[name];
      await writeBack(
        {
          mcpServers: nextServers,
          disabled: nextDisabled,
          _apiKeys: mcpJson._apiKeys,
        },
        "Enabled"
      );
    } else {
      // 禁用：从 mcpServers 移到 disabled（保留配置和 apiKey，url 维持原样）
      const entry = mcpJson.mcpServers[name];
      if (!entry) return;
      const nextServers = { ...mcpJson.mcpServers };
      delete nextServers[name];
      const nextDisabled = {
        ...(mcpJson.disabled || {}),
        [name]: entry,
      };
      await writeBack(
        {
          mcpServers: nextServers,
          disabled: nextDisabled,
          _apiKeys: mcpJson._apiKeys,
        },
        "Disabled"
      );
    }
  };

  // -------- API Key 修改 --------
  // Key 保存总是写到 mcpServers（启用状态），同时从 disabled 移除（任何状态下都能调用）
  const handleSaveKey = async () => {
    if (!keyTarget) return;
    const trimmed = keyInput.trim();
    if (!trimmed) {
      message.error("Please enter API Key");
      return;
    }
    const entry =
      mcpJson.mcpServers[keyTarget] || mcpJson.disabled?.[keyTarget] || {};
    const nextServers = {
      ...mcpJson.mcpServers,
      [keyTarget]: { ...entry, url: `${MCP_BASE_URL}${trimmed}` },
    };
    const nextDisabled = { ...(mcpJson.disabled || {}) };
    delete nextDisabled[keyTarget];
    const nextKeys = { ...mcpJson._apiKeys, [keyTarget]: trimmed };
    await writeBack(
      {
        mcpServers: nextServers,
        disabled: nextDisabled,
        _apiKeys: nextKeys,
      },
      "API Key saved"
    );
    setKeyTarget(null);
    setKeyInput("");
  };

  // -------- 编辑单条 JSON --------
  // 从 mcpServers 或 disabled 任一边查找；保存后总是写到 mcpServers（编辑动作隐含启用）
  const openEdit = (name: string) => {
    setEditTarget(name);
    const entry =
      mcpJson.mcpServers[name] ?? mcpJson.disabled?.[name] ?? {};
    setEditText(JSON.stringify(entry, null, 2));
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    let parsed: McpServerEntry;
    try {
      parsed = JSON.parse(editText);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("not an object");
      }
    } catch {
      message.error("Invalid JSON format");
      return;
    }
    const nextServers = { ...mcpJson.mcpServers, [editTarget]: parsed };
    const nextDisabled = { ...(mcpJson.disabled || {}) };
    delete nextDisabled[editTarget];
    await writeBack(
      {
        mcpServers: nextServers,
        disabled: nextDisabled,
        _apiKeys: mcpJson._apiKeys,
      },
      "Saved"
    );
    setEditTarget(null);
  };

  // -------- 删除 --------
  // 从 mcpServers 和 disabled 两边都查
  const handleDelete = async (name: string) => {
    const nextServers = { ...mcpJson.mcpServers };
    delete nextServers[name];
    const nextDisabled = { ...(mcpJson.disabled || {}) };
    delete nextDisabled[name];
    const nextKeys = { ...mcpJson._apiKeys };
    delete nextKeys[name];
    await writeBack(
      {
        mcpServers: nextServers,
        disabled: nextDisabled,
        _apiKeys: nextKeys,
      },
      "Deleted"
    );
  };

  // -------- 新增 MCP --------
  const openAdd = () => {
    addForm.resetFields();
    addForm.setFieldsValue({ type: "stdio", args: "" });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();
      const name = values.name as string;
      if (mcpJson.mcpServers[name] || mcpJson.disabled?.[name]) {
        message.error(`MCP "${name}" 已存在`);
        return;
      }
      const entry: McpServerEntry = { type: values.type };
      if (values.type === "stdio") {
        entry.command = values.command;
        entry.args = (values.args || "")
          .split(/\s+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (values.env?.trim()) {
          entry.env = Object.fromEntries(
            values.env
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((line: string) => {
                const idx = line.indexOf("=");
                return idx > 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : [line, ""];
              })
          );
        }
      } else {
        entry.url = values.url;
        if (values.headers?.trim()) {
          entry.headers = Object.fromEntries(
            values.headers
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((line: string) => {
                const idx = line.indexOf(":");
                return idx > 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : [line, ""];
              })
          );
        }
      }
      const nextServers = { ...mcpJson.mcpServers, [name]: entry };
      await writeBack(
        {
          mcpServers: nextServers,
          disabled: mcpJson.disabled || {},
          _apiKeys: mcpJson._apiKeys,
        },
        "MCP added"
      );
      setAddOpen(false);
    } catch {
      // 表单校验失败
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg
          className="w-5 h-5 animate-spin text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 合并启用 + 禁用的 server 渲染，保持条目的原始出现顺序
  const allEntries: Array<{ name: string; entry: McpServerEntry; isEnabled: boolean }> = (() => {
    const existing = new Set(entryOrderRef.current);
    const disabled = mcpJson.disabled || {};
    // 添加新出现的 key（先 mcpServers 再 disabled）
    Object.keys(mcpJson.mcpServers).forEach(k => {
      if (!existing.has(k)) {
        entryOrderRef.current.push(k);
        existing.add(k);
      }
    });
    Object.keys(disabled).forEach(k => {
      if (!existing.has(k)) {
        entryOrderRef.current.push(k);
        existing.add(k);
      }
    });
    // 移除已删除的 key
    const currentKeys = new Set([
      ...Object.keys(mcpJson.mcpServers),
      ...Object.keys(disabled),
    ]);
    entryOrderRef.current = entryOrderRef.current.filter(k => currentKeys.has(k));
    // 按稳定顺序构建渲染数组
    return entryOrderRef.current.map(name => {
      const isEnabled = !!mcpJson.mcpServers[name];
      const entry = isEnabled ? mcpJson.mcpServers[name] : disabled[name];
      return { name, entry, isEnabled };
    });
  })();
  const enabledCount = Object.keys(mcpJson.mcpServers).length;
  const totalCount = allEntries.length;

  return (
    <div className="space-y-3">
      {/* 提示信息 */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <svg
          className="w-4 h-4 text-blue-500 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p className="text-sm text-blue-700">
          Configure MCP servers for this project. Each entry is available to AI
          chats as <code className="px-1 bg-white/60 rounded">mcp__{"<name>"}__*</code> tools.
        </p>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {enabledCount} enabled / {totalCount} configured
        </span>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <PlusOutlined />
          Add MCP
        </button>
      </div>

      {/* 列表 */}
      {allEntries.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          No MCP servers yet. Click &quot;Add MCP&quot; to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {allEntries.map(({ name, entry, isEnabled }) => {
            const type = inferType(entry);
            const hasAuth = !!(
              entry.url && entry.url.includes("Authorization=")
            );
            return (
              <div
                key={name}
                className={
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors " +
                  (isEnabled
                    ? "border-gray-200 hover:border-gray-300"
                    : "border-gray-100 bg-gray-50 opacity-60")
                }
              >
                <Switch
                  size="small"
                  checked={isEnabled}
                  loading={saving}
                  onChange={(checked) => handleToggle(name, checked)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "text-sm font-medium truncate " +
                        (isEnabled ? "text-gray-700" : "text-gray-400")
                      }
                    >
                      {name}
                    </span>
                    <Tag
                      color={
                        type === "stdio"
                          ? "blue"
                          : type === "sse"
                          ? "purple"
                          : "green"
                      }
                      className="text-[10px] leading-4 m-0"
                    >
                      {type}
                    </Tag>
                    {!isEnabled && (
                      <Tag
                        color="default"
                        className="text-[10px] leading-4 m-0"
                      >
                        Disabled
                      </Tag>
                    )}
                  </div>
                  <div
                    className="text-xs text-gray-400 truncate font-mono mt-0.5"
                    title={describeServer(entry)}
                  >
                    {describeServer(entry)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {hasAuth && (
                    <KeyOutlined
                      className="text-gray-400 hover:text-blue-500 cursor-pointer text-base p-1"
                      title="修改 API Key"
                      onClick={() => {
                        setKeyTarget(name);
                        setKeyInput(mcpJson._apiKeys[name] || "");
                      }}
                    />
                  )}
                  <EditOutlined
                    className={isSystemMcp(name) ? "text-gray-300 cursor-not-allowed text-base p-1" : "text-gray-400 hover:text-blue-500 cursor-pointer text-base p-1"}
                    title="Edit JSON"
                    onClick={() => openEdit(name)}
                  />
                  {!isSystemMcp(name) && (
                  <Popconfirm
                    title={`Delete "${name}"?`}
                    description="This will also remove its saved API Key."
                    okText="Delete"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(name)}
                  >
                    <DeleteOutlined
                      className="text-gray-400 hover:text-red-500 cursor-pointer text-base p-1"
                      title="Delete"
                    />
                  </Popconfirm>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 编辑单条 JSON Modal */}
      <Modal
        title={editTarget ? `Edit "${editTarget}"` : "Edit MCP"}
        open={!!editTarget}
        onOk={handleSaveEdit}
        onCancel={() => setEditTarget(null)}
        okText="Save"
        cancelText="Cancel"
        confirmLoading={saving}
        width={560}
      >
        <Input.TextArea
          rows={12}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="font-mono text-sm"
        />
      </Modal>

      {/* API Key 修改 Modal */}
      <Modal
        title={keyTarget ? `API Key for "${keyTarget}"` : "API Key"}
        open={!!keyTarget}
        onOk={handleSaveKey}
        onCancel={() => {
          setKeyTarget(null);
          setKeyInput("");
        }}
        okText="Save"
        cancelText="Cancel"
        confirmLoading={saving}
      >
        <p className="text-xs text-gray-500 mb-2">
          The key will be stored in <code>_apiKeys</code> and prepended to the
          server URL as <code>?Authorization=&lt;key&gt;</code>.
        </p>
        <Input.Password
          placeholder="Enter API Key"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* 新增 MCP Modal */}
      <Modal
        title="Add MCP Server"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
        okText="Add"
        cancelText="Cancel"
        confirmLoading={saving}
        width={560}
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical" className="mt-2">
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: "Please input a name" },
              {
                pattern: NAME_PATTERN,
                message:
                  "Only letters, digits, underscore and dash are allowed",
              },
            ]}
          >
            <Input placeholder="e.g. gitnexus" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "stdio", label: "stdio (local command)" },
                { value: "http", label: "http (remote endpoint)" },
                { value: "sse", label: "sse (server-sent events)" },
              ]}
              onChange={(val) => {
                // 切换 type 时清空无关字段
                if (val === "stdio") {
                  addForm.setFieldsValue({ url: undefined, headers: undefined });
                } else {
                  addForm.setFieldsValue({ command: undefined, args: undefined, env: undefined });
                }
              }}
            />
          </Form.Item>

          <Form.Item shouldUpdate>
            {() => {
              const type = addForm.getFieldValue("type");
              if (type === "stdio") {
                return (
                  <>
                    <Form.Item
                      name="command"
                      label="Command"
                      rules={[{ required: true, message: "Please input command" }]}
                    >
                      <Input placeholder="e.g. npx" />
                    </Form.Item>
                    <Form.Item name="args" label="Args (space-separated)">
                      <Input placeholder="e.g. -y gitnexus@latest mcp" />
                    </Form.Item>
                    <Form.Item
                      name="env"
                      label="Environment variables (one KEY=VALUE per line, optional)"
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder={"API_KEY=xxx\nDEBUG=1"}
                        className="font-mono text-sm"
                      />
                    </Form.Item>
                  </>
                );
              }
              return (
                <>
                  <Form.Item
                    name="url"
                    label="URL"
                    rules={[
                      { required: true, message: "Please input URL" },
                      { type: "url", message: "Please input a valid URL" },
                    ]}
                  >
                    <Input placeholder="https://example.com/mcp" />
                  </Form.Item>
                  <Form.Item
                    name="headers"
                    label="Headers (one Key: Value per line, optional)"
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder={"Authorization: Bearer xxx"}
                      className="font-mono text-sm"
                    />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
