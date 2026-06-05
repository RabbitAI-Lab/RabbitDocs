"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  App,
  Popconfirm,
  Empty,
  Typography,
  Avatar,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  disabled: boolean;
  accountType: string;
  role: "admin" | "user";
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function UsersPageClient() {
  const { user: currentUser, authFetch } = useAuth();
  const { message, modal } = App.useApp();
  const t = useTranslations('admin');

  const STATUS_OPTIONS = [
    { value: "all", label: t('usersPage.statusAll') },
    { value: "active", label: t('usersPage.statusActive') },
    { value: "disabled", label: t('usersPage.statusDisabled') },
    { value: "verified", label: t('usersPage.statusVerified') },
    { value: "unverified", label: t('usersPage.statusUnverified') },
  ];
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pagination.pageSize),
          status,
        });
        if (search) params.set("search", search);
        const res = await authFetch(`/api/auth/admin/users?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t('usersPage.msgFailedToLoad'));
        }
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t('usersPage.msgFailedToLoad');
        message.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, pagination.pageSize, search, status, message]
  );

  useEffect(() => {
    loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const isSelf = (id: string) => currentUser?.id === id;

  const handleToggleVerify = async (record: AdminUser, value: boolean) => {
    try {
      const res = await authFetch(`/api/auth/admin/users/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailVerified: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('usersPage.msgUpdateFailed'));
      }
      message.success(value ? t('usersPage.msgMarkedVerified') : t('usersPage.msgVerificationRemoved'));
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('usersPage.msgUpdateFailed');
      message.error(msg);
    }
  };

  const handleToggleDisabled = async (record: AdminUser, value: boolean) => {
    if (isSelf(record.id)) {
      message.warning(t('usersPage.msgCannotDisableSelf'));
      return;
    }
    try {
      const res = await authFetch(`/api/auth/admin/users/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('usersPage.msgOperationFailed'));
      }
      message.success(value ? t('usersPage.msgAccountDisabled') : t('usersPage.msgAccountEnabled'));
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('usersPage.msgOperationFailed');
      message.error(msg);
    }
  };

  const handleDelete = (record: AdminUser) => {
    if (isSelf(record.id)) {
      message.warning(t('usersPage.msgCannotDisableSelf'));
      return;
    }
    modal.confirm({
      title: t('usersPage.modalDisableTitle'),
      content: t('usersPage.modalDisableContent', { email: record.email }),
      okText: t('usersPage.btnDisable'),
      okButtonProps: { danger: true },
      cancelText: t('usersPage.modalCancel'),
      onOk: async () => {
        try {
          const res = await authFetch(`/api/auth/admin/users/${record.id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || t('usersPage.msgOperationFailed'));
          }
          message.success(t('usersPage.msgDisabled'));
          loadUsers(pagination.page);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : t('usersPage.msgOperationFailed');
          message.error(msg);
        }
      },
    });
  };

  const handleSaveEdit = async (values: { name?: string; role?: "admin" | "user" }) => {
    if (!editing) return;
    try {
      const res = await authFetch(`/api/auth/admin/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('usersPage.msgFailedToSave'));
      }
      message.success(t('usersPage.msgSaved'));
      setEditing(null);
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('usersPage.msgFailedToSave');
      message.error(msg);
    }
  };

  const handleRoleChange = async (record: AdminUser, role: "admin" | "user") => {
    if (isSelf(record.id)) {
      message.warning(t('usersPage.msgCannotChangeOwnRole'));
      return;
    }
    try {
      const res = await authFetch(`/api/auth/admin/users/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('usersPage.msgOperationFailed'));
      }
      message.success(role === "admin" ? t('usersPage.msgSetAsAdmin') : t('usersPage.msgSetAsUser'));
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('usersPage.msgOperationFailed');
      message.error(msg);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('usersPage.title')}</h1>
        <Button icon={<ReloadOutlined />} onClick={() => loadUsers(pagination.page)}>
          {t('usersPage.btnRefresh')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('usersPage.placeholderSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => loadUsers(1)}
          style={{ width: 280 }}
        />
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          style={{ width: 180 }}
        />
        <Button onClick={() => loadUsers(1)}>
          {t('usersPage.btnSearch')}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table<AdminUser>
          rowKey="id"
          loading={loading}
          dataSource={users}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (p) => loadUsers(p),
            onShowSizeChange: (_, size) => {
              setPagination((prev) => ({ ...prev, pageSize: size, page: 1 }));
              setTimeout(() => loadUsers(1), 0);
            },
          }}
          locale={{ emptyText: <Empty description={t('usersPage.emptyText')} /> }}
          columns={[
            {
              title: t('usersPage.columnUser'),
              dataIndex: "email",
              render: (_: string, record: AdminUser) => (
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <div className="flex flex-col">
                    <Text strong>{record.name || "—"}</Text>
                    <Text type="secondary" className="text-xs">
                      {record.email}
                    </Text>
                  </div>
                </Space>
              ),
            },
            {
              title: t('usersPage.columnAccountType'),
              dataIndex: "accountType",
              width: 110,
              render: (v: string) => (
                <Tag color={v === "enterprise" ? "purple" : "blue"}>{v}</Tag>
              ),
            },
            {
              title: t('usersPage.columnRole'),
              dataIndex: "role",
              width: 140,
              render: (v: "admin" | "user", record: AdminUser) => {
                const isAdmin = v === "admin";
                return (
                  <Space size="small">
                    {isAdmin ? (
                      <Tag icon={<SafetyCertificateOutlined />} color="orange">{t('usersPage.tagAdmin')}</Tag>
                    ) : (
                      <Tag>{t('usersPage.tagUser')}</Tag>
                    )}
                    {!isSelf(record.id) && (
                      <Popconfirm
                        title={isAdmin ? t('usersPage.popconfirmRevokeTitle') : t('usersPage.popconfirmGrantTitle')}
                        description={isAdmin ? t('usersPage.popconfirmRevokeDesc') : t('usersPage.popconfirmGrantDesc')}
                        onConfirm={() => handleRoleChange(record, isAdmin ? "user" : "admin")}
                        okText={isAdmin ? t('usersPage.popconfirmRevoke') : t('usersPage.popconfirmGrant')}
                        cancelText={t('usersPage.modalCancel')}
                      >
                        <Button type="text" size="small">
                          {isAdmin ? t('usersPage.popconfirmRevoke') : t('usersPage.popconfirmGrant')}
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                );
              },
            },
            {
              title: t('usersPage.columnEmailVerified'),
              dataIndex: "emailVerified",
              width: 130,
              render: (v: boolean, record: AdminUser) => (
                <Tooltip title={v ? t('usersPage.tooltipClickToUnverify') : t('usersPage.tooltipClickToVerify')}>
                  <Switch
                    size="small"
                    checked={v}
                    onChange={(value) => handleToggleVerify(record, value)}
                  />
                </Tooltip>
              ),
            },
            {
              title: t('usersPage.columnStatus'),
              dataIndex: "disabled",
              width: 110,
              render: (v: boolean, record: AdminUser) =>
                v ? (
                  <Tag color="red" icon={<StopOutlined />}>
                    {t('usersPage.tagDisabled')}
                  </Tag>
                ) : (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    {t('usersPage.tagActive')}
                  </Tag>
                ),
            },
            {
              title: t('usersPage.columnRegistered'),
              dataIndex: "createdAt",
              width: 170,
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: t('usersPage.columnActions'),
              width: 220,
              fixed: "right",
              render: (_: unknown, record: AdminUser) => (
                <Space size="small">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setEditing(record)}
                  >
                    {t('usersPage.btnEdit')}
                  </Button>
                  {!isSelf(record.id) &&
                    (record.disabled ? (
                      <Button
                        type="text"
                        size="small"
                        onClick={() => handleToggleDisabled(record, false)}
                      >
                        {t('usersPage.btnEnable')}
                      </Button>
                    ) : (
                      <Popconfirm
                        title={t('usersPage.popconfirmDisableTitle')}
                        onConfirm={() => handleToggleDisabled(record, true)}
                      >
                        <Button type="text" size="small" danger>
                          {t('usersPage.btnDisable')}
                        </Button>
                      </Popconfirm>
                    ))}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={t('usersPage.modalEditTitle')}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => {
          const formEl = document.getElementById("edit-user-form") as HTMLFormElement | null;
          formEl?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }}
        okText={t('usersPage.modalSave')}
        cancelText={t('usersPage.modalCancel')}
        destroyOnHidden
      >
        {editing && (
          <Form
            id="edit-user-form"
            layout="vertical"
            initialValues={{ name: editing.name || "", role: editing.role }}
            onFinish={handleSaveEdit}
          >
            <Form.Item label={t('usersPage.formEmail')}>
              <Input value={editing.email} disabled />
            </Form.Item>
            <Form.Item label={t('usersPage.formAccountId')}>
              <Input value={editing.id} disabled />
            </Form.Item>
            <Form.Item
              name="name"
              label={t('usersPage.formName')}
              rules={[{ max: 50, message: t('usersPage.formNameMaxMessage') }]}
            >
              <Input placeholder={t('usersPage.formNamePlaceholder')} maxLength={50} />
            </Form.Item>
            <Form.Item name="role" label={t('usersPage.formRole')}>
              <Select
                disabled={isSelf(editing.id)}
                options={[
                  { value: "admin", label: t('usersPage.tagAdmin') },
                  { value: "user", label: t('usersPage.tagUser') },
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
