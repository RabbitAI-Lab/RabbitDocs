"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  Result,
  Spin,
  Input,
  Button,
  App,
  Typography,
  Divider,
} from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import Link from "next/link";

const { Paragraph } = Typography;

type Status = "verifying" | "success" | "error" | "awaiting-code";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const t = useTranslations("auth");
  // 没有 token 时直接进入"输入验证码"模式；有 token 时默认 verifying，由 effect 处理
  const hasToken = typeof window !== "undefined" ? searchParams.get("token") : null;
  const [status, setStatus] = useState<Status>(hasToken ? "verifying" : "awaiting-code");
  const [errorMessage, setErrorMessage] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = searchParams.get("token");
    if (!token) return;

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || t('verificationFailedGeneric'));
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage(t('networkError'));
      });
  }, [searchParams, t]);

  const handleSubmitCode = async () => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      message.warning(t('pleaseEnterSixDigitCode'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setErrorMessage(data.error || t('verificationFailedGeneric'));
        setStatus("error");
      }
    } catch {
      setErrorMessage(t('networkError'));
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "verifying") {
    return (
      <Card className="shadow-lg">
        <div className="text-center py-8">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">{t('verifying')}</p>
        </div>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="shadow-lg">
        <Result
          icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
          title={t('verificationSuccess')}
          subTitle={t('verificationSuccessDesc')}
          extra={
            <Link href="/login">
              <Button type="primary">{t('goToLogin')}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="shadow-lg">
        <Result
          icon={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
          title={t('verificationFailed')}
          subTitle={errorMessage}
          extra={
            <div className="flex flex-col gap-2 items-center">
              <Button
                type="default"
                onClick={() => {
                  setStatus("awaiting-code");
                  setErrorMessage("");
                }}
              >
                {t('reEnterCode')}
              </Button>
              <Link href="/login">
                <Button type="link">{t('backToLogin')}</Button>
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  // awaiting-code
  return (
    <Card title={t('enterEmailCode')} className="shadow-lg">
      <Paragraph type="secondary" className="!mb-4">
        {t('enterCodeDesc')}
      </Paragraph>
      <div className="space-y-3">
        <Input
          size="large"
          maxLength={6}
          placeholder={t('codePlaceholder')}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onPressEnter={handleSubmitCode}
          autoFocus
          style={{
            fontSize: 24,
            letterSpacing: 8,
            textAlign: "center",
            fontFamily: "monospace",
          }}
        />
        <Button
          type="primary"
          size="large"
          block
          loading={submitting}
          disabled={code.length !== 6}
          onClick={handleSubmitCode}
        >
          {t('verify')}
        </Button>
      </div>
      <Divider />
      <div className="text-center text-sm text-gray-500">
        <Link href="/login">{t('backToLogin')}</Link>
      </div>
    </Card>
  );
}
