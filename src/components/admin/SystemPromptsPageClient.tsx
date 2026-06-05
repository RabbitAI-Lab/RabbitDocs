"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
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
  const t = useTranslations('admin');
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
        message.success(t('systemPromptsPage.msgUpdated'));
      } else {
        await authFetch("/api/system-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        message.success(t('systemPromptsPage.msgCreated'));
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
        message.success(newEnabled ? t('systemPromptsPage.msgEnabled', { name: record.name }) : t('systemPromptsPage.msgDisabled', { name: record.name }));
      });
    },
    [refreshList, message]
  );

  const handleDelete = useCallback(
    (id: number, name: string) => {
      modal.confirm({
        title: t('systemPromptsPage.confirmDeleteTitle'),
        content: t('systemPromptsPage.confirmDeleteContent', { name }),
        okText: t('systemPromptsPage.btnDelete'),
        cancelText: t('modelConfigModal.btnCancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          await authFetch(`/api/system-prompts/${id}`, { method: "DELETE" });
          await refreshList();
          message.success(t('systemPromptsPage.msgDeleted'));
        },
      });
    },
    [modal, refreshList, message]
  );

  const columns: ColumnsType<SystemPrompt> = [
    {
      title: t('systemPromptsPage.columnName'),
      dataIndex: "name",
      width: 180,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('systemPromptsPage.columnStatus'),
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
      title: t('systemPromptsPage.columnSort'),
      dataIndex: "sortOrder",
      width: 80,
    },
    {
      title: t('systemPromptsPage.columnUpdated'),
      dataIndex: "updatedAt",
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('systemPromptsPage.columnActions'),
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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('systemPromptsPage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('systemPromptsPage.subtitle')}
          </p>
        </div>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>
          {t('systemPromptsPage.btnAddPrompt')}
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
        title={editingPrompt ? t('systemPromptsPage.modalTitleEdit') : t('systemPromptsPage.modalTitleCreate')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingPrompt(null);
          form.resetFields();
        }}
        okText={editingPrompt ? t('systemPromptsPage.btnSave') : t('systemPromptsPage.btnCreate')}
        cancelText={t('modelConfigModal.btnCancel')}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ enabled: 1, sortOrder: 0 }}
          className="mt-4"
        >
          <Form.Item
            label={t('systemPromptsPage.formName')}
            name="name"
            rules={[{ required: true, message: t('systemPromptsPage.formNameRule') }]}
          >
            <Input placeholder={t('systemPromptsPage.formNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('systemPromptsPage.formContent')}
            name="content"
            rules={[{ required: true, message: t('systemPromptsPage.formContentRule') }]}
          >
            <Input.TextArea rows={6} placeholder={t('systemPromptsPage.formContentPlaceholder')} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label={t('systemPromptsPage.formStatus')} name="enabled">
              <Select
                options={[
                  { value: 1, label: t('systemPromptsPage.formStatusEnabled') },
                  { value: 0, label: t('systemPromptsPage.formStatusDisabled') },
                ]}
              />
            </Form.Item>
            <Form.Item label={t('systemPromptsPage.formSort')} name="sortOrder">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
