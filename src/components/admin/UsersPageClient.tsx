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

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "verified", label: "Email Verified" },
  { value: "unverified", label: "Email Unverified" },
];

export default function UsersPageClient() {
  const { user: currentUser, authFetch } = useAuth();
  const { message, modal } = App.useApp();
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
          throw new Error(err.error || "Failed to load");
        }
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to load";
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
        throw new Error(err.error || "Update failed");
      }
      message.success(value ? "Marked as verified" : "Verification removed");
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Update failed";
      message.error(msg);
    }
  };

  const handleToggleDisabled = async (record: AdminUser, value: boolean) => {
    if (isSelf(record.id)) {
      message.warning("Cannot disable your own account");
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
        throw new Error(err.error || "Operation failed");
      }
      message.success(value ? "Account disabled" : "Account enabled");
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Operation failed";
      message.error(msg);
    }
  };

  const handleDelete = (record: AdminUser) => {
    if (isSelf(record.id)) {
      message.warning("Cannot disable your own account");
      return;
    }
    modal.confirm({
      title: "Disable this user?",
      content: `Account ${record.email} will be disabled and the user will not be able to log in.`,
      okText: "Disable",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          const res = await authFetch(`/api/auth/admin/users/${record.id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Operation failed");
          }
          message.success("Disabled");
          loadUsers(pagination.page);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : "Operation failed";
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
        throw new Error(err.error || "Failed to save");
      }
      message.success("Saved");
      setEditing(null);
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save";
      message.error(msg);
    }
  };

  const handleRoleChange = async (record: AdminUser, role: "admin" | "user") => {
    if (isSelf(record.id)) {
      message.warning("Cannot change your own role");
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
        throw new Error(err.error || "Operation failed");
      }
      message.success(role === "admin" ? "Set as admin" : "Set as user");
      loadUsers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Operation failed";
      message.error(msg);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">User Management</h1>
        <Button icon={<ReloadOutlined />} onClick={() => loadUsers(pagination.page)}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search email / name"
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
          Search
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
          locale={{ emptyText: <Empty description="No users found" /> }}
          columns={[
            {
              title: "User",
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
              title: "Account Type",
              dataIndex: "accountType",
              width: 110,
              render: (v: string) => (
                <Tag color={v === "enterprise" ? "purple" : "blue"}>{v}</Tag>
              ),
            },
            {
              title: "Role",
              dataIndex: "role",
              width: 140,
              render: (v: "admin" | "user", record: AdminUser) => {
                const isAdmin = v === "admin";
                return (
                  <Space size="small">
                    {isAdmin ? (
                      <Tag icon={<SafetyCertificateOutlined />} color="orange">Admin</Tag>
                    ) : (
                      <Tag>User</Tag>
                    )}
                    {!isSelf(record.id) && (
                      <Popconfirm
                        title={isAdmin ? "Revoke admin role?" : "Grant admin role?"}
                        description={isAdmin ? "This user will lose admin access." : "This user will gain full admin access."}
                        onConfirm={() => handleRoleChange(record, isAdmin ? "user" : "admin")}
                        okText={isAdmin ? "Revoke" : "Grant"}
                        cancelText="Cancel"
                      >
                        <Button type="text" size="small">
                          {isAdmin ? "Revoke" : "Grant"}
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                );
              },
            },
            {
              title: "Email Verified",
              dataIndex: "emailVerified",
              width: 130,
              render: (v: boolean, record: AdminUser) => (
                <Tooltip title={v ? "Click to unverify" : "Click to mark as verified"}>
                  <Switch
                    size="small"
                    checked={v}
                    onChange={(value) => handleToggleVerify(record, value)}
                  />
                </Tooltip>
              ),
            },
            {
              title: "Status",
              dataIndex: "disabled",
              width: 110,
              render: (v: boolean, record: AdminUser) =>
                v ? (
                  <Tag color="red" icon={<StopOutlined />}>
                    Disabled
                  </Tag>
                ) : (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    Active
                  </Tag>
                ),
            },
            {
              title: "Registered",
              dataIndex: "createdAt",
              width: 170,
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: "Actions",
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
                    Edit
                  </Button>
                  {!isSelf(record.id) &&
                    (record.disabled ? (
                      <Button
                        type="text"
                        size="small"
                        onClick={() => handleToggleDisabled(record, false)}
                      >
                        Enable
                      </Button>
                    ) : (
                      <Popconfirm
                        title="Disable this user?"
                        onConfirm={() => handleToggleDisabled(record, true)}
                      >
                        <Button type="text" size="small" danger>
                          Disable
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
        title="Edit User"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => {
          const formEl = document.getElementById("edit-user-form") as HTMLFormElement | null;
          formEl?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        {editing && (
          <Form
            id="edit-user-form"
            layout="vertical"
            initialValues={{ name: editing.name || "", role: editing.role }}
            onFinish={handleSaveEdit}
          >
            <Form.Item label="Email">
              <Input value={editing.email} disabled />
            </Form.Item>
            <Form.Item label="Account ID">
              <Input value={editing.id} disabled />
            </Form.Item>
            <Form.Item
              name="name"
              label="Name"
              rules={[{ max: 50, message: "Name must be at most 50 characters" }]}
            >
              <Input placeholder="User name" maxLength={50} />
            </Form.Item>
            <Form.Item name="role" label="Role">
              <Select
                disabled={isSelf(editing.id)}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "user", label: "User" },
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
