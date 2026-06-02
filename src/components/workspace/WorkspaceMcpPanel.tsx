"use client";

import { useState, useEffect } from "react";
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

interface WorkspaceMcpPanelProps {
  workspacePath: string;
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
  _apiKeys: Record<string, string>;
}

const NAME_PATTERN = /^[a-zA-Z0-9_\-]+$/;

function describeServer(entry: McpServerEntry): string {
  if (entry.command) {
    const args = (entry.args || []).join(" ");
    return `${entry.command} ${args}`.trim();
  }
  if (entry.url) {
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
    if (entry.url.includes("/sse") || /\.sse(\?|$)/.test(entry.url))
      return "sse";
    return "http";
  }
  return "stdio";
}

export default function WorkspaceMcpPanel({
  workspacePath,
}: WorkspaceMcpPanelProps) {
  const [mcpJson, setMcpJson] = useState<McpJson>({
    mcpServers: {},
    _apiKeys: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();

  const [keyTarget, setKeyTarget] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  const { message } = App.useApp();

  // 修复 bug: 实际是 "/" 分隔
  const dirSegments = workspacePath.split("/").filter(Boolean);

  const fetchConfig = async () => {
    try {
      const res = await fetch(
        `/api/fs/workspace-mcp?dirSegments=${dirSegments.join(",")}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const mcpServers =
        (data.mcpJson?.mcpServers &&
        typeof data.mcpJson.mcpServers === "object"
          ? data.mcpJson.mcpServers
          : {}) as Record<string, McpServerEntry>;
      const apiKeys =
        (data.mcpJson?._apiKeys && typeof data.mcpJson._apiKeys === "object"
          ? data.mcpJson._apiKeys
          : {}) as Record<string, string>;
      setMcpJson({ mcpServers, _apiKeys: apiKeys });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);

  const writeBack = async (next: McpJson, successMsg?: string) => {
    setMcpJson(next);
    setSaving(true);
    try {
      const res = await fetch("/api/fs/workspace-mcp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirSegments, mcpJson: next }),
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
        const apiKeys = (data.mcpJson._apiKeys || {}) as Record<string, string>;
        setMcpJson({ mcpServers, _apiKeys: apiKeys });
      }
      if (successMsg) message.success(successMsg);
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`);
      await fetchConfig();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (name: string, checked: boolean) => {
    const entry = mcpJson.mcpServers[name];
    if (!entry) return;

    if (checked) {
      const storedKey = mcpJson._apiKeys[name];
      if (storedKey) {
        const nextServers = {
          ...mcpJson.mcpServers,
          [name]: { ...entry, url: `${MCP_BASE_URL}${storedKey}` },
        };
        await writeBack(
          { mcpServers: nextServers, _apiKeys: mcpJson._apiKeys },
          "Enabled",
        );
        return;
      }
      message.warning("Please configure API Key first");
      setKeyTarget(name);
      return;
    }

    const nextServers = { ...mcpJson.mcpServers };
    delete nextServers[name];
    await writeBack(
      { mcpServers: nextServers, _apiKeys: mcpJson._apiKeys },
      "Disabled",
    );
  };

  const handleSaveKey = async () => {
    if (!keyTarget) return;
    const trimmed = keyInput.trim();
    if (!trimmed) {
      message.error("Please enter API Key");
      return;
    }
    const entry = mcpJson.mcpServers[keyTarget] || {};
    const nextServers = {
      ...mcpJson.mcpServers,
      [keyTarget]: { ...entry, url: `${MCP_BASE_URL}${trimmed}` },
    };
    const nextKeys = { ...mcpJson._apiKeys, [keyTarget]: trimmed };
    await writeBack(
      { mcpServers: nextServers, _apiKeys: nextKeys },
      "API Key saved",
    );
    setKeyTarget(null);
    setKeyInput("");
  };

  const openEdit = (name: string) => {
    setEditTarget(name);
    setEditText(JSON.stringify(mcpJson.mcpServers[name] ?? {}, null, 2));
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
    await writeBack(
      { mcpServers: nextServers, _apiKeys: mcpJson._apiKeys },
      "Saved",
    );
    setEditTarget(null);
  };

  const handleDelete = async (name: string) => {
    const nextServers = { ...mcpJson.mcpServers };
    delete nextServers[name];
    const nextKeys = { ...mcpJson._apiKeys };
    delete nextKeys[name];
    await writeBack(
      { mcpServers: nextServers, _apiKeys: nextKeys },
      "Deleted",
    );
  };

  const openAdd = () => {
    addForm.resetFields();
    addForm.setFieldsValue({ type: "stdio", args: "" });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();
      const name = values.name as string;
      if (mcpJson.mcpServers[name]) {
        message.error(`MCP "${name}" already exists`);
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
                return idx > 0
                  ? [
                      line.slice(0, idx).trim(),
                      line.slice(idx + 1).trim(),
                    ]
                  : [line, ""];
              }),
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
                return idx > 0
                  ? [
                      line.slice(0, idx).trim(),
                      line.slice(idx + 1).trim(),
                    ]
                  : [line, ""];
              }),
          );
        }
      }
      const nextServers = { ...mcpJson.mcpServers, [name]: entry };
      await writeBack(
        { mcpServers: nextServers, _apiKeys: mcpJson._apiKeys },
        "MCP added",
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

  const entries = Object.entries(mcpJson.mcpServers);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <svg
          className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p className="text-sm text-indigo-700">
          Configure MCP servers at the workspace level. Each entry is available
          to AI chats in all projects of this workspace as{" "}
          <code className="px-1 bg-white/60 rounded">mcp__{"<name>"}__*</code>{" "}
          tools.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {entries.length} server{entries.length === 1 ? "" : "s"} configured
        </span>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <PlusOutlined />
          Add MCP
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          No MCP servers yet. Click &quot;Add MCP&quot; to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(([name, entry]) => {
            const type = inferType(entry);
            const hasAuth = !!(
              entry.url && entry.url.includes("Authorization=")
            );
            return (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <Switch
                  size="small"
                  checked={true}
                  loading={saving}
                  onChange={(checked) => handleToggle(name, checked)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 truncate">
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
                      title="Edit API Key"
                      onClick={() => {
                        setKeyTarget(name);
                        setKeyInput(mcpJson._apiKeys[name] || "");
                      }}
                    />
                  )}
                  <EditOutlined
                    className="text-gray-400 hover:text-blue-500 cursor-pointer text-base p-1"
                    title="Edit JSON"
                    onClick={() => openEdit(name)}
                  />
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
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                if (val === "stdio") {
                  addForm.setFieldsValue({ url: undefined, headers: undefined });
                } else {
                  addForm.setFieldsValue({
                    command: undefined,
                    args: undefined,
                    env: undefined,
                  });
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
                      rules={[
                        { required: true, message: "Please input command" },
                      ]}
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
