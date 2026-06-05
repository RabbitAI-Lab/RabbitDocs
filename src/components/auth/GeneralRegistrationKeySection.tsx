"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { App, Button, Input, Space, Tag, Typography, Alert } from "antd";
import {
  KeyOutlined,
  ReloadOutlined,
  CopyOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

const { Text } = Typography;

interface KeyState {
  enabled: boolean;
  /** The full key — only present immediately after generation/rotation. */
  key: string | null;
  /** Masked preview of the stored key (e.g. "********XXXX"). */
  maskedKey: string | null;
}

export default function GeneralRegistrationKeySection() {
  const { user, authFetch } = useAuth();
  const { message, modal } = App.useApp();
  const t = useTranslations('settings');
  const [state, setState] = useState<KeyState>({
    enabled: false,
    key: null,
    maskedKey: null,
  });
  const [loading, setLoading] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [customKey, setCustomKey] = useState("");

  const isAdmin = !!user?.isAdmin;

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/general-registration-key");
      if (res.ok) {
        const data = (await res.json()) as { enabled: boolean; maskedKey: string | null };
        setState({
          enabled: data.enabled,
          key: null,
          maskedKey: data.maskedKey,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Alert
        type="info"
        showIcon
        title={t('regKeyManagedByAdmin')}
        description={t('regKeyContactAdmin')}
      />
    );
  }

  const generate = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/general-registration-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('generationFailed'));
      }
      const data = (await res.json()) as { enabled: boolean; key: string };
      setState({ enabled: true, key: data.key, maskedKey: null });
      setRevealing(true);
      message.success(t('regKeyGenerated'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('generationFailed');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const applyCustom = async () => {
    const trimmed = customKey.trim();
    if (trimmed.length < 4) {
      message.warning(t('customKeyMinLength'));
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/general-registration-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('failedToSetKey'));
      }
      const data = (await res.json()) as { enabled: boolean; key: string };
      setState({ enabled: true, key: data.key, maskedKey: null });
      setRevealing(true);
      setCustomKey("");
      message.success(t('regKeyUpdated'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('failedToSetKey');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const disable = () => {
    modal.confirm({
      title: t('disableRegKey'),
      content: t('disableRegKeyDesc'),
      okText: t('disable'),
      okButtonProps: { danger: true },
      cancelText: t('cancel'),
      onOk: async () => {
        setLoading(true);
        try {
          const res = await authFetch("/api/auth/general-registration-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: false }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || t('failedToDisable'));
          }
          setState({ enabled: false, key: null, maskedKey: null });
          setRevealing(false);
          message.success(t('regKeyDisabled'));
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : t('failedToDisable');
          message.error(msg);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const copyKey = (value: string) => {
    navigator.clipboard.writeText(value);
    message.success(t('keyCopied'));
  };

  const displayKey = revealing && state.key ? state.key : state.maskedKey;
  const isJustGenerated = revealing && !!state.key;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <KeyOutlined />
        <span>
          {t('regKeyDescription')}
        </span>
        {state.enabled ? (
          <Tag color="green">{t('enabled')}</Tag>
        ) : (
          <Tag>{t('disabled')}</Tag>
        )}
      </div>

      {state.enabled ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Space size="middle" align="center">
              <Text code className="!text-base !px-3 !py-1.5">
                {displayKey || "—"}
              </Text>
              {isJustGenerated && (
                <Tag color="blue">{t('newlyGenerated')}</Tag>
              )}
            </Space>
            <Space>
              {state.key && (
                <Button
                  size="small"
                  icon={revealing ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => setRevealing((v) => !v)}
                >
                  {revealing ? t('hide') : t('show')}
                </Button>
              )}
              <Button
                size="small"
                icon={<CopyOutlined />}
                disabled={!state.key}
                onClick={() => state.key && copyKey(state.key)}
              >
                {t('copy')}
              </Button>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={generate}
              >
                {t('regenerate')}
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={loading}
                onClick={disable}
              >
                {t('disable')}
              </Button>
            </Space>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-4">
          <div className="flex flex-col gap-3">
            <Button
              type="primary"
              icon={<KeyOutlined />}
              loading={loading}
              onClick={generate}
            >
              {t('enableRegKey')}
            </Button>
            <div className="flex items-center gap-2">
              <Text type="secondary" className="text-xs shrink-0">
                {t('orUseCustomKey')}
              </Text>
              <Input
                placeholder={t('atLeast4Chars')}
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                onPressEnter={applyCustom}
                maxLength={64}
                allowClear
              />
              <Button onClick={applyCustom} loading={loading} disabled={!customKey.trim()}>
                {t('set')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
