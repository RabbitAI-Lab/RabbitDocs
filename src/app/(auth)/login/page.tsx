"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import {
  Button,
  Form,
  Input,
  Card,
  App,
  Spin,
  Divider,
} from "antd";
import { MailOutlined, LockOutlined, KeyOutlined } from "@ant-design/icons";
import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";

export default function LoginPage() {
  const { login, loginWithTokens } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [needVerification, setNeedVerification] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [checkingInit, setCheckingInit] = useState(true);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [brandName, setBrandName] = useState("RabbitDocs");

  // Check if system is initialized; redirect to /setup if not
  useEffect(() => {
    fetch("/api/auth/init-status")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.initialized === false) {
          router.replace("/setup");
        } else {
          setCheckingInit(false);
        }
      })
      .catch(() => {
        setCheckingInit(false);
      });
  }, [router]);

  // Fetch brand name
  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data?.brandName) setBrandName(data.brandName);
      })
      .catch(() => {});
  }, []);

  // Check if Passkey is enabled (public endpoint)
  useEffect(() => {
    fetch("/api/passkey/enabled")
      .then((res) => res.json())
      .then((data) => {
        setPasskeyEnabled(data?.enabled === true);
      })
      .catch(() => {
        setPasskeyEnabled(false);
      });
  }, []);

  if (checkingInit) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spin size="large" />
      </div>
    );
  }

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setNeedVerification(false);
    try {
      const result = await login(values.email, values.password);

      if (result.needVerification) {
        setNeedVerification(true);
        setVerifyEmail(values.email);
        message.warning(result.message || t('pleaseVerifyEmail'));
        return;
      }

      message.success(t('loggedInSuccessfully'));
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success(data.message || t('verificationEmailSent'));
      } else {
        message.error(data.error || t('failedToSend'));
      }
    } catch {
      message.error(t('failedToSendPleaseRetry'));
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      // Step 1: 获取认证选项
      const startRes = await fetch("/api/passkey/authenticate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!startRes.ok) {
        const data = await startRes.json().catch(() => ({}));
        throw new Error(data.error || t('unableToStartPasskeyLogin'));
      }
      const options = await startRes.json();
      const challengeKey: string | undefined = options._challengeKey;

      // Step 2: 浏览器弹生物识别 / PIN 验证
      const authResult = await startAuthentication({ optionsJSON: options });

      // Step 3: 提交结果
      const finishRes = await fetch("/api/passkey/authenticate/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: JSON.stringify(authResult),
          _challengeKey: challengeKey,
        }),
      });
      const data = await finishRes.json();
      if (!finishRes.ok) {
        throw new Error(data.error || t('passkeyLoginFailed'));
      }

      // Step 4: 注入会话
      loginWithTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      message.success(t('loggedInSuccessfully'));
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('passkeyLoginFailed');
      // 用户主动取消时不当作错误
      if (/cancel|abort|not allowed/i.test(msg)) {
        message.info(t('cancelled'));
      } else {
        message.error(msg);
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Card title={t('loginTo', { brandName })} className="shadow-lg">
      <Form onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="email"
          rules={[
            { required: true, message: t('pleaseEnterEmail') },
            { type: "email", message: t('pleaseEnterValidEmail') },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: t('pleaseEnterPassword') }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('logIn')}
          </Button>
        </Form.Item>
      </Form>

      {passkeyEnabled && (
        <>
          <Divider plain className="!my-3 !text-xs">
            {t('or')}
          </Divider>
          <Button
            block
            size="large"
            icon={<KeyOutlined />}
            loading={passkeyLoading}
            onClick={handlePasskeyLogin}
          >
            {t('signInWithPasskey')}
          </Button>
        </>
      )}

      {needVerification && (
        <div className="text-center my-4">
          <Button type="link" onClick={handleResendVerification}>
            {t('resendVerificationEmail')}
          </Button>
        </div>
      )}

      <div className="text-center text-sm text-gray-500 mt-4">
        {t('noAccount')}{" "}
        <Link href="/register" className="text-blue-600 hover:text-blue-800">
          {t('signUp')}
        </Link>
      </div>
    </Card>
  );
}
