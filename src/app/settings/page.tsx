"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations('settings');
  const [passwordForm] = Form.useForm();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);

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

  useEffect(() => {
    loadInviteCodes();
  }, [loadInviteCodes]);

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
        message.success(t('passwordChanged'));
        passwordForm.resetFields();
      } else {
        const data = await res.json();
        message.error(data.error || t('failedToChangePassword'));
      }
    } catch {
      message.error(t('failedToChangePassword'));
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
        message.success(t('inviteCodeCreated'));
        loadInviteCodes();
      } else {
        const data = await res.json();
        message.error(data.error || t('failedToCreateCode'));
      }
    } catch {
      message.error("Failed to create invite code");
    }
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/register?code=${code}`;
    navigator.clipboard.writeText(link);
    message.success(t('inviteLinkCopied'));
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('account')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('accountDesc')}
        </p>
      </div>

      <div className="space-y-8">
        {/* ─── Section 1: Password ─── */}
        <section>
          <SectionHeader
            title={t('security')}
            description={t('securityDesc')}
          />
          <Card className="shadow-sm" title={t('changePassword')}>
            <Form
              form={passwordForm}
              onFinish={handleChangePassword}
              layout="vertical"
              style={{ maxWidth: 480 }}
            >
              <Form.Item
                name="currentPassword"
                label={t('currentPassword')}
                rules={[{ required: true, message: t('enterCurrentPassword') }]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label={t('newPassword')}
                rules={[
                  { required: true, message: t('enterNewPassword') },
                  { min: 6, message: t('passwordMinLength') },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label={t('confirmNewPassword')}
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: t('pleaseConfirmPassword') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('passwordsDoNotMatch')));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item className="!mb-0">
                <Button htmlType="submit" loading={loadingPassword}>
                  {t('changePasswordBtn')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </section>

        {/* ─── Section 2: Passkey ─── */}
        <section>
          <SectionHeader
            title={t('passkeysSection')}
            description={t('passkeysDesc')}
          />
          <Card className="shadow-sm">
            <PasskeySection />
          </Card>
        </section>

        {/* ─── Section 3: Invite Codes ─── */}
        <section>
          <SectionHeader
            title={t('inviteCodes')}
            description={t('inviteCodesDesc')}
          />
          <Card
            className="shadow-sm"
            title={t('myInviteCodes', { count: inviteCodes.length })}
            extra={
              <Button
                icon={<PlusOutlined />}
                onClick={handleCreateInviteCode}
                disabled={inviteCodes.length >= 5}
              >
                {t('createInviteCode')}
              </Button>
            }
          >
            {inviteCodes.length === 0 ? (
              <Empty description={t('noInviteCodes')} />
            ) : (
              <Table
                dataSource={inviteCodes}
                rowKey="id"
                loading={loadingCodes}
                pagination={false}
                size="middle"
                columns={[
                  {
                    title: t('code'),
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
                    title: t('status'),
                    dataIndex: "used",
                    render: (used: boolean) =>
                      used ? (
                        <Tag color="red">{t('used')}</Tag>
                      ) : (
                        <Tag color="green">{t('unused')}</Tag>
                      ),
                  },
                  {
                    title: t('columnCreatedAt'),
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
            title={t('regKeySection')}
            description={t('regKeyDesc')}
          />
          <Card className="shadow-sm">
            <GeneralRegistrationKeySection />
          </Card>
        </section>

        {/* ─── Section 5: CLI Tokens ─── */}
        <section>
          <SectionHeader
            title={t('cliTokensSection')}
            description={t('cliTokensDesc')}
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
