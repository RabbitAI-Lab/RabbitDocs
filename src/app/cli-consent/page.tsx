"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/useAuth";
import { Card, Button, Typography, Descriptions, App } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

export default function CliConsentPage() {
  const searchParams = useSearchParams();
  const { authFetch, user } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations('cliConsent');
  const [brandName, setBrandName] = useState("RabbitDocs");

  useEffect(() => {
    fetch("/api/brand")
      .then((res) => res.json())
      .then((data) => {
        if (data?.brandName) setBrandName(data.brandName);
      })
      .catch(() => {});
  }, []);

  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");

  if (!codeChallenge || !redirectUri || !state) {
    return (
      <Card className="shadow-lg">
        <Title level={4}>{t('error')}</Title>
        <Text type="danger">{t('missingOAuthParams')}</Text>
      </Card>
    );
  }

  const handleApprove = async () => {
    try {
      // 服务端会返回 302 重定向到 CLI 回调
      const res = await authFetch("/api/auth/cli/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          redirect_uri: redirectUri,
          state,
        }),
        redirect: "manual",
      });

      // 手动处理重定向
      if (res.status === 302 || res.type === "opaqueredirect") {
        message.success(t('authorizedReturn'));
        return;
      }

      // 如果没有重定向，可能直接返回了结果
      if (res.ok) {
        message.success(t('authorized'));
      }
    } catch {
      message.error(t('authorizationFailed'));
    }
  };

  const handleDeny = () => {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    denyUrl.searchParams.set("state", state);
    window.location.href = denyUrl.toString();
  };

  return (
    <Card className="shadow-lg">
      <div className="text-center mb-6">
        <SafetyCertificateOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        <Title level={4} className="mt-4">
          {t('cliAuthRequest')}
        </Title>
        <p className="text-gray-500">
          {t('cliRequesting', { brandName })}
        </p>
      </div>

      <Descriptions column={1} bordered size="small" className="mb-6">
        <Descriptions.Item label={t('currentUser')}>{user?.email}</Descriptions.Item>
        <Descriptions.Item label={t('callbackUrl')}>
          <Text code className="text-xs">{redirectUri}</Text>
        </Descriptions.Item>
      </Descriptions>

      <div className="mb-6">
        <Text type="secondary">{t('afterAuthCan')}</Text>
        <ul className="mt-2 text-sm text-gray-600 list-disc pl-5">
          <li>{t('accessProfile')}</li>
          <li>{t('manageProjects')}</li>
          <li>{t('executeCommands')}</li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <Button size="large" onClick={handleDeny}>
          {t('deny')}
        </Button>
        <Button type="primary" size="large" onClick={handleApprove}>
          {t('authorize')}
        </Button>
      </div>
    </Card>
  );
}
