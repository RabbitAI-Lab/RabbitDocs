"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/auth/useAuth";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  App,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

interface SystemPrompt {
  id: number;
  name: string;
  content: string;
  enabled: number;
  sortOrder: number;
  isSystem: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialPrompts: SystemPrompt[];
}

export default function SystemPromptsPageClient({ initialPrompts }: Props) {
  const [prompts, setPrompts] = useState<SystemPrompt[]>(initialPrompts);
  const { authFetch } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [form] = Form.useForm();
  const { modal, message } = App.useApp();

  const refreshList = useCallback(async () => {
    const res = await authFetch("/api/system-prompts");
    const data = await res.json();
    setPrompts(data);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingPrompt(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEdit = useCallback(
    (record: SystemPrompt) => {
      setEditingPrompt(record);
      form.setFieldsValue({
        name: record.name,
        content: record.content,
        enabled: record.enabled,
        sortOrder: record.sortOrder,
      });
      setModalOpen(true);
    },
    [form]
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editingPrompt) {
        await authFetch(`/api/system-prompts/${editingPrompt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        message.success("System prompt updated");
      } else {
        await authFetch("/api/system-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        message.success("System prompt created");
      }
      setModalOpen(false);
      setEditingPrompt(null);
      form.resetFields();
      await refreshList();
    } catch {
      // validation failed
    }
  }, [editingPrompt, form, refreshList, message]);

  const handleToggleEnabled = useCallback(
    (record: SystemPrompt) => {
      const newEnabled = record.enabled ? 0 : 1;
      authFetch(`/api/system-prompts/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      }).then(() => {
        refreshList();
        message.success(newEnabled ? `"${record.name}" enabled` : `"${record.name}" disabled`);
      });
    },
    [refreshList, message]
  );

  const handleDelete = useCallback(
    (id: number, name: string) => {
      modal.confirm({
        title: "Confirm Delete",
        content: `Confirm delete system prompt "${name}"?`,
        okText: "Delete",
        cancelText: "Cancel",
        okButtonProps: { danger: true },
        onOk: async () => {
          await authFetch(`/api/system-prompts/${id}`, { method: "DELETE" });
          await refreshList();
          message.success("Deleted");
        },
      });
    },
    [modal, refreshList, message]
  );

  const columns: ColumnsType<SystemPrompt> = [
    {
      title: "Name",
      dataIndex: "name",
      width: 180,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Status",
      dataIndex: "enabled",
      width: 80,
      render: (enabled: number, record: SystemPrompt) => (
        <Switch
          checked={enabled === 1}
          onChange={() => handleToggleEnabled(record)}
          size="small"
        />
      ),
    },
    {
      title: "Sort",
      dataIndex: "sortOrder",
      width: 80,
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Actions",
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          {record.isSystem !== 1 && (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id, record.name)}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">System Prompts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage global system prompts. Enabled prompts will be automatically injected into all chats.
          </p>
        </div>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>
          Add Prompt
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Table
          dataSource={prompts}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editingPrompt ? "Edit System Prompt" : "New System Prompt"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingPrompt(null);
          form.resetFields();
        }}
        okText={editingPrompt ? "Save" : "Create"}
        cancelText="Cancel"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ enabled: 1, sortOrder: 0 }}
          className="mt-4"
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Please enter name" }]}
          >
            <Input placeholder="e.g. Security Rules" />
          </Form.Item>
          <Form.Item
            label="Prompt Content"
            name="content"
            rules={[{ required: true, message: "Please enter prompt content" }]}
          >
            <Input.TextArea rows={6} placeholder="Enter system prompt content" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Status" name="enabled">
              <Select
                options={[
                  { value: 1, label: "Enabled" },
                  { value: 0, label: "Disabled" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Sort" name="sortOrder">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
