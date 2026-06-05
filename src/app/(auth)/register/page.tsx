"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { Button, Form, Input, Card, App, Result } from "antd";
import { MailOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";

interface RegistrationStatus {
  openRegistration: boolean;
  requireInviteCode: boolean;
  generalKeyEnabled: boolean;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [regStatus, setRegStatus] = useState<RegistrationStatus | null>(null);
  const [brandName, setBrandName] = useState("RabbitDocs");
  const [devHint, setDevHint] = useState<{
    verificationUrl?: string;
    verificationCode?: string;
    hint?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data?.brandName) setBrandName(data.brandName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/registration-status")
      .then((res) => res.json())
      .then((data) => setRegStatus(data))
      .catch(() =>
        setRegStatus({
          openRegistration: true,
          requireInviteCode: false,
          generalKeyEnabled: false,
        })
      );
  }, []);

  const onFinish = async (values: {
    email: string;
    password: string;
    name?: string;
    inviteCode?: string;
    generalKey?: string;
  }) => {
    setLoading(true);
    try {
      const result = await register(
        values.email,
        values.password,
        values.name,
        values.inviteCode,
        values.generalKey
      );
      setSuccess(true);
      if (result.verificationUrl || result.verificationCode) {
        setDevHint({
          verificationUrl: result.verificationUrl,
          verificationCode: result.verificationCode,
          hint: result.devHint,
        });
      }
      message.success(t('registrationSuccessful'));
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="shadow-lg">
        <Result
          status="success"
          title={t('registrationSuccessfulTitle')}
          subTitle={t('checkEmailToVerify')}
          extra={
            <div className="flex flex-col gap-2 items-center">
              <Button type="primary" onClick={() => router.push("/login")}>
                {t('goToLogin')}
              </Button>
              {devHint?.verificationCode && (
                <Button
                  type="link"
                  onClick={() => router.push(`/verify-email`)}
                >
                  {t('iHaveVerificationCode')}
                </Button>
              )}
            </div>
          }
        />
        {devHint && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-left">
            <div className="text-amber-800 font-medium text-sm mb-2">
              {t('localDevHint')}
            </div>
            <div className="text-amber-700 text-xs mb-3">
              {devHint.hint || t('smtpNotConfigured')}
            </div>
            {devHint.verificationCode && (
              <div className="mb-2">
                <div className="text-xs text-amber-700 mb-1">{t('verificationCode')}</div>
                <div className="text-2xl font-mono font-bold tracking-widest text-amber-900 select-all">
                  {devHint.verificationCode}
                </div>
              </div>
            )}
            {devHint.verificationUrl && (
              <div>
                <div className="text-xs text-amber-700 mb-1">{t('verificationLink')}</div>
                <a
                  href={devHint.verificationUrl}
                  className="text-xs text-blue-600 break-all hover:underline"
                >
                  {devHint.verificationUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  if (regStatus && !regStatus.openRegistration) {
    return (
      <Card className="shadow-lg">
        <Result
          status="warning"
          title={t('registrationClosed')}
          subTitle={t('registrationClosedDesc')}
          extra={
            <Button type="primary" onClick={() => router.push("/login")}>
              {t('backToLogin')}
            </Button>
          }
        />
      </Card>
    );
  }

  const requireInviteCode = regStatus?.requireInviteCode ?? false;
  const generalKeyEnabled = regStatus?.generalKeyEnabled ?? false;
  const prefillCode = searchParams.get("code") || undefined;
  const prefillGeneralKey = searchParams.get("generalKey") || undefined;
  const showGeneralKey = prefillGeneralKey || generalKeyEnabled || requireInviteCode;

  return (
    <Card title={t('registerFor', { brandName })} className="shadow-lg">
      <Form
        onFinish={onFinish}
        layout="vertical"
        size="large"
        initialValues={{
          inviteCode: prefillCode,
          generalKey: prefillGeneralKey,
        }}
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: t('pleaseEnterEmail') },
            { type: "email", message: t('pleaseEnterValidEmail') },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} autoComplete="email" />
        </Form.Item>

        <Form.Item name="name">
          <Input prefix={<UserOutlined />} placeholder={t('displayNamePlaceholder')} />
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
            placeholder={t('passwordPlaceholder')}
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

        {(requireInviteCode || prefillCode) && (
          <Form.Item
            name="inviteCode"
            rules={requireInviteCode ? [{ required: true, message: t('pleaseEnterInviteCode') }] : []}
          >
            <Input placeholder={t('inviteCodePlaceholder')} />
          </Form.Item>
        )}

        {showGeneralKey && (
          <Form.Item name="generalKey">
            <Input
              placeholder={
                prefillGeneralKey
                  ? t('generalKeyPlaceholder')
                  : requireInviteCode
                    ? t('generalKeyCanReplaceInvite')
                    : t('generalKeyOptional')
              }
            />
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('registerButton')}
          </Button>
        </Form.Item>
      </Form>

      <div className="text-center text-sm text-gray-500">
        {t('alreadyHaveAccount')}{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-800">
          {t('logIn')}
        </Link>
      </div>
    </Card>
  );
}
