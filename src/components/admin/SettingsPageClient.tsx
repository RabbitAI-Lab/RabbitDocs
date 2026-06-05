"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Switch,
  Button,
  App,
  Spin,
  Typography,
  Divider,
  Tag,
  Space,
  Input,
} from "antd";
import {
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface SystemSettings {
  openRegistration: boolean;
  requireInviteCode: boolean;
  requireEmailVerification: boolean;
  passkeyEnabled: boolean;
  passkeyRpId: string;
  passkeyRpName: string;
  siteUrl: string;
}

export default function SettingsPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("admin.authSettingsPage");
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [draft, setDraft] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/admin/system-settings");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('msgLoadFailed'));
      }
      const data = (await res.json()) as SystemSettings;
      setSettings(data);
      setDraft(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('msgLoadFailed');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [authFetch, message]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!settings || !draft) return false;
    if (
      settings.openRegistration !== draft.openRegistration ||
      settings.requireInviteCode !== draft.requireInviteCode ||
      settings.requireEmailVerification !== draft.requireEmailVerification ||
      settings.passkeyEnabled !== draft.passkeyEnabled ||
      settings.passkeyRpId !== draft.passkeyRpId ||
      settings.passkeyRpName !== draft.passkeyRpName ||
      settings.siteUrl !== draft.siteUrl
    ) {
      return true;
    }
    return false;
  }, [settings, draft]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        openRegistration: draft.openRegistration,
        requireInviteCode: draft.requireInviteCode,
        requireEmailVerification: draft.requireEmailVerification,
        passkeyEnabled: draft.passkeyEnabled,
        passkeyRpId: draft.passkeyRpId,
        passkeyRpName: draft.passkeyRpName,
        siteUrl: draft.siteUrl,
      };

      const res = await authFetch("/api/auth/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('msgSaveFailed'));
      }
      const data = await res.json();
      message.success(t('msgSaved', { count: data.updated }));

      setSettings(draft);
      setDraft(draft);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('msgSaveFailed');
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (loading || !settings || !draft) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>
              {t('btnReset')}
            </Button>
            <Button
              icon={<SaveOutlined />}
              disabled={!dirty}
              loading={saving}
              onClick={handleSave}
            >
              {t('btnSave')}
            </Button>
          </Space>
        </div>

        <Card title={t('cardSiteConfig')}>
          <TextFieldRow
            title={t('siteUrlTitle')}
            description={t('siteUrlDesc')}
            value={draft.siteUrl}
            placeholder={t('siteUrlPlaceholder')}
            onChange={(v) => update("siteUrl", v)}
            current={settings.siteUrl || t('siteUrlDefault')}
            currentLabel={t('currentLabel')}
          />
        </Card>

        <Card title={t('cardRegVerification')}>
          <SettingRow
            title={t('openRegTitle')}
            description={t('openRegDesc')}
            value={draft.openRegistration}
            onChange={(v) => update("openRegistration", v)}
            current={settings.openRegistration}
          />
          <Divider className="my-4" />
          <SettingRow
            title={t('inviteCodeTitle')}
            description={t('inviteCodeDesc')}
            value={draft.requireInviteCode}
            onChange={(v) => update("requireInviteCode", v)}
            current={settings.requireInviteCode}
          />
          <Divider className="my-4" />
          <SettingRow
            title={t('emailVerifyTitle')}
            description={t('emailVerifyDesc')}
            value={draft.requireEmailVerification}
            onChange={(v) => update("requireEmailVerification", v)}
            current={settings.requireEmailVerification}
          />
        </Card>

        <Card title={t('cardLoginAuth')}>
          <SettingRow
            title={t('passkeyTitle')}
            description={t('passkeyDesc')}
            value={draft.passkeyEnabled}
            onChange={(v) => update("passkeyEnabled", v)}
            current={settings.passkeyEnabled}
          />
          <Divider className="my-4" />
          <TextFieldRow
            title={t('rpIdTitle')}
            description={t('rpIdDesc')}
            value={draft.passkeyRpId}
            placeholder={t('rpIdPlaceholder')}
            onChange={(v) => update("passkeyRpId", v)}
            current={settings.passkeyRpId || t('rpIdPlaceholder')}
            currentLabel={t('currentLabel')}
          />
          <Divider className="my-4" />
          <TextFieldRow
            title={t('rpNameTitle')}
            description={t('rpNameDesc')}
            value={draft.passkeyRpName}
            placeholder={t('rpNamePlaceholder')}
            onChange={(v) => update("passkeyRpName", v)}
            current={settings.passkeyRpName || t('rpNamePlaceholder')}
            currentLabel={t('currentLabel')}
          />
        </Card>

        <Card title={t('cardCurrentConfig')}>
          <Space orientation="vertical" size="small">
            <div>
              <Text type="secondary">{t('labelRegistration')}</Text>
              {settings.openRegistration ? (
                <Tag color="green">{t('labelOpen')}</Tag>
              ) : (
                <Tag color="red">{t('labelClosed')}</Tag>
              )}
              {settings.requireInviteCode && <Tag color="orange">{t('labelInviteRequired')}</Tag>}
            </div>
            <div>
              <Text type="secondary">{t('labelEmailVerify')}</Text>
              {settings.requireEmailVerification ? (
                <Tag color="orange">{t('labelRequired')}</Tag>
              ) : (
                <Tag>{t('labelOptional')}</Tag>
              )}
            </div>
            <div>
              <Text type="secondary">{t('labelPasskey')}</Text>
              {settings.passkeyEnabled ? (
                <Tag color="green">{t('labelEnabled')}</Tag>
              ) : (
                <Tag>{t('labelDisabled')}</Tag>
              )}
            </div>
            {settings.passkeyEnabled && (
              <div>
                <Text type="secondary">{t('labelRpConfig')}</Text>
                <Tag>ID: {settings.passkeyRpId || t('rpIdPlaceholder')}</Tag>
                <Tag>Name: {settings.passkeyRpName || t('rpNamePlaceholder')}</Tag>
              </div>
            )}
          </Space>
          <Text type="secondary" className="mt-3 text-xs block">
            {t('configNote')}
          </Text>
        </Card>
      </div>
    </div>
  );
}

function SettingRow(props: {
  title: string;
  description: string;
  value: boolean;
  current: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{props.title}</div>
        <Text type="secondary" className="text-xs">
          {props.description}
        </Text>
      </div>
      <Switch checked={props.value} onChange={props.onChange} />
    </div>
  );
}

function TextFieldRow(props: {
  title: string;
  description: string;
  value: string;
  current: string;
  currentLabel?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr,minmax(220px,320px)] sm:items-start">
      <div>
        <div className="font-medium">{props.title}</div>
        <Text type="secondary" className="text-xs">
          {props.description}
        </Text>
      </div>
      <div>
        <Input
          value={props.value}
          placeholder={props.placeholder}
          allowClear
          onChange={(e) => props.onChange(e.target.value)}
        />
        <Text type="secondary" className="mt-1 block text-xs">
          {props.currentLabel || "Current: "}{props.current}
        </Text>
      </div>
    </div>
  );
}
