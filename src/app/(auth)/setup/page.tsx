"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Form, Input, Card, App, Typography, Spin } from "antd";
import { MailOutlined, LockOutlined, RocketOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function SetupPage() {
  const { loginWithTokens } = useAuth();
  const router = useRouter();
  const { message } = App.useApp();
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [alreadyInitialized, setAlreadyInitialized] = useState(false);
  const [brandName, setBrandName] = useState("RabbitDocs");

  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data?.brandName) setBrandName(data.brandName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/init-status")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.initialized) {
          setAlreadyInitialized(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spin size="large" />
      </div>
    );
  }

  if (alreadyInitialized) {
    return (
      <Card className="shadow-lg">
        <div className="text-center py-6">
          <RocketOutlined style={{ fontSize: 48, color: "#52c41a" }} />
          <h2 className="mt-4 text-xl font-semibold">{t('systemAlreadyInitialized')}</h2>
          <p className="text-gray-500 mt-2 mb-4">{t('systemAlreadyInitializedDesc')}</p>
          <Button type="primary" onClick={() => router.push("/login")}>
            {t('goToLogin')}
          </Button>
        </div>
      </Card>
    );
  }


  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || t('setupFailed'));
        return;
      }

      loginWithTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      if (data.inviteCode) {
        setInviteCode(data.inviteCode);
        message.success(
          t('setupSuccessful', { inviteCode: data.inviteCode })
        );
      }

      router.push("/");
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('setupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <div className="text-center mb-6">
        <RocketOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        <h2 className="mt-4 text-xl font-semibold">{t('initialize', { brandName })}</h2>
        <p className="text-gray-500 mt-2">
          {t('createAdminAccount')}
        </p>
      </div>

      <Form onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="email"
          rules={[
            { required: true, message: t('pleaseEnterAdminEmail') },
            { type: "email", message: t('pleaseEnterValidEmail') },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder={t('adminEmailPlaceholder')} autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[
            { required: true, message: t('pleaseEnterPassword') },
            { min: 6, message: t('passwordMinLength') },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('adminPasswordPlaceholder')}
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: t('pleaseConfirmPassword') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('passwordsDoNotMatch')));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('confirmPasswordPlaceholder')}
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('initializeSystem')}
          </Button>
        </Form.Item>
      </Form>

      {inviteCode && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
          <Text type="secondary">{t('initialInviteCode')}</Text>
          <Text strong copyable className="ml-2">
            {inviteCode}
          </Text>
        </div>
      )}
    </Card>
  );
}
