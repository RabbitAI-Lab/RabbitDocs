"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/useAuth";
import {
  Card,
  Form,
  Input,
  Button,
  App,
  Space,
  Tag,
  Table,
  Empty,
  Typography,
} from "antd";
import {
  LockOutlined,
  PlusOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import PasskeySection from "@/components/auth/PasskeySection";
import CliTokensSection from "@/components/auth/CliTokensSection";
import GeneralRegistrationKeySection from "@/components/auth/GeneralRegistrationKeySection";

const { Text } = Typography;

interface InviteCode {
  id: string;
  code: string;
  used: boolean;
  usedAt: string | null;
  createdAt: string;
}

export default function AccountPage() {
  const { user, authFetch } = useAuth();
  const { message } = App.useApp();
  const [passwordForm] = Form.useForm();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);

  useEffect(() => {
    loadInviteCodes();
  }, []);

  const loadInviteCodes = async () => {
    if (!user) return;
    setLoadingCodes(true);
    try {
      const res = await authFetch("/api/auth/invite-codes");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.codes)) {
          setInviteCodes(data.codes);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleChangePassword = async (values: {
    currentPassword: string;
    newPassword: string;
  }) => {
    setLoadingPassword(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        message.success("Password changed");
        passwordForm.resetFields();
      } else {
        const data = await res.json();
        message.error(data.error || "Failed to change password");
      }
    } catch {
      message.error("Failed to change password");
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleCreateInviteCode = async () => {
    try {
      const res = await authFetch("/api/auth/invite-codes", {
        method: "POST",
      });
      if (res.ok) {
        message.success("Invite code created");
        loadInviteCodes();
      } else {
        const data = await res.json();
        message.error(data.error || "Failed to create invite code");
      }
    } catch {
      message.error("Failed to create invite code");
    }
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/register?code=${code}`;
    navigator.clipboard.writeText(link);
    message.success("Invite link copied");
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account security, credentials and authentication methods
        </p>
      </div>

      <div className="space-y-8">
        {/* ─── Section 1: Password ─── */}
        <section>
          <SectionHeader
            title="Security"
            description="Manage your login methods and authentication devices"
          />
          <Card className="shadow-sm" title="Change Password">
            <Form
              form={passwordForm}
              onFinish={handleChangePassword}
              layout="vertical"
              style={{ maxWidth: 480 }}
            >
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: "Please enter your current password" }]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: "Please enter a new password" },
                  { min: 6, message: "Password must be at least 6 characters" },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "Please confirm your new password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item className="!mb-0">
                <Button htmlType="submit" loading={loadingPassword}>
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </section>

        {/* ─── Section 2: Passkey ─── */}
        <section>
          <SectionHeader
            title="Passkeys"
            description="Use biometrics or hardware keys for passwordless login"
          />
          <Card className="shadow-sm">
            <PasskeySection />
          </Card>
        </section>

        {/* ─── Section 3: Invite Codes ─── */}
        <section>
          <SectionHeader
            title="Invite Codes"
            description="Invite new users to register (max 5 per user)"
          />
          <Card
            className="shadow-sm"
            title={`My Invite Codes (${inviteCodes.length}/5)`}
            extra={
              <Button
                icon={<PlusOutlined />}
                onClick={handleCreateInviteCode}
                disabled={inviteCodes.length >= 5}
              >
                Create Invite Code
              </Button>
            }
          >
            {inviteCodes.length === 0 ? (
              <Empty description="No invite codes yet" />
            ) : (
              <Table
                dataSource={inviteCodes}
                rowKey="id"
                loading={loadingCodes}
                pagination={false}
                size="middle"
                columns={[
                  {
                    title: "Code",
                    dataIndex: "code",
                    render: (code: string) => (
                      <Space>
                        <Text code>{code}</Text>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyInviteLink(code)}
                        />
                      </Space>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "used",
                    render: (used: boolean) =>
                      used ? (
                        <Tag color="red">Used</Tag>
                      ) : (
                        <Tag color="green">Unused</Tag>
                      ),
                  },
                  {
                    title: "Created At",
                    dataIndex: "createdAt",
                    render: (v: string) => new Date(v).toLocaleString(),
                  },
                ]}
              />
            )}
          </Card>
        </section>

        {/* ─── Section 4: General Registration Key ─── */}
        <section>
          <SectionHeader
            title="Registration Key"
            description="Generate a reusable registration key for team members to self-register"
          />
          <Card className="shadow-sm">
            <GeneralRegistrationKeySection />
          </Card>
        </section>

        {/* ─── Section 5: CLI Tokens ─── */}
        <section>
          <SectionHeader
            title="CLI Tokens"
            description="Long-lived access tokens for CLI tools"
          />
          <Card className="shadow-sm">
            <CliTokensSection />
          </Card>
        </section>

      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
}

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}
