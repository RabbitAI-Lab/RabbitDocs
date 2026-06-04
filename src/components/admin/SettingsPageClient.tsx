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

const { Text } = Typography;

interface SystemSettings {
  openRegistration: boolean;
  requireInviteCode: boolean;
  requireEmailVerification: boolean;
  passkeyEnabled: boolean;
  passkeyRpId: string;
  passkeyRpName: string;
}

export default function SettingsPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
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
        throw new Error(err.error || "Failed to load");
      }
      const data = (await res.json()) as SystemSettings;
      setSettings(data);
      setDraft(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to load";
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
      settings.passkeyRpName !== draft.passkeyRpName
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
      };

      const res = await authFetch("/api/auth/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      const data = await res.json();
      message.success(`Saved (${data.updated} item(s))`);

      setSettings(draft);
      setDraft(draft);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save";
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
          <h1 className="text-lg font-semibold">System Settings</h1>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>
              Reset
            </Button>
            <Button
              icon={<SaveOutlined />}
              disabled={!dirty}
              loading={saving}
              onClick={handleSave}
            >
              Save
            </Button>
          </Space>
        </div>

        <Card title="Registration & Verification">
          <SettingRow
            title="Open Registration"
            description="When disabled, the registration endpoint will reject new users (only admin invites or initial setup can create accounts)"
            value={draft.openRegistration}
            onChange={(v) => update("openRegistration", v)}
            current={settings.openRegistration}
          />
          <Divider className="my-4" />
          <SettingRow
            title="Require Invite Code"
            description="When enabled, a valid invite code is required for registration (depends on open registration)"
            value={draft.requireInviteCode}
            onChange={(v) => update("requireInviteCode", v)}
            current={settings.requireInviteCode}
          />
          <Divider className="my-4" />
          <SettingRow
            title="Require Email Verification"
            description="When enabled, users with unverified emails cannot log in"
            value={draft.requireEmailVerification}
            onChange={(v) => update("requireEmailVerification", v)}
            current={settings.requireEmailVerification}
          />
        </Card>

        <Card title="Login & Authentication">
          <SettingRow
            title="Enable Passkey"
            description="When enabled, users can log in with biometrics or device PIN via WebAuthn on the login page and profile settings"
            value={draft.passkeyEnabled}
            onChange={(v) => update("passkeyEnabled", v)}
            current={settings.passkeyEnabled}
          />
          <Divider className="my-4" />
          <TextFieldRow
            title="Relying Party ID"
            description="The domain name bound to Passkey (e.g., chat.example.com). Leave empty to auto-detect from the request Host header. Must match the browser's domain, otherwise the browser will reject registration."
            value={draft.passkeyRpId}
            placeholder="(Auto-detect)"
            onChange={(v) => update("passkeyRpId", v)}
            current={settings.passkeyRpId || "(Auto-detect)"}
          />
          <Divider className="my-4" />
          <TextFieldRow
            title="Relying Party Name"
            description="A friendly name displayed to users in the browser prompt. Defaults to RabbitDocs when left empty"
            value={draft.passkeyRpName}
            placeholder="RabbitDocs"
            onChange={(v) => update("passkeyRpName", v)}
            current={settings.passkeyRpName || "RabbitDocs"}
          />
        </Card>

        <Card title="Current Configuration">
          <Space orientation="vertical" size="small">
            <div>
              <Text type="secondary">Registration: </Text>
              {settings.openRegistration ? (
                <Tag color="green">Open</Tag>
              ) : (
                <Tag color="red">Closed</Tag>
              )}
              {settings.requireInviteCode && <Tag color="orange">Invite Required</Tag>}
            </div>
            <div>
              <Text type="secondary">Email Verification: </Text>
              {settings.requireEmailVerification ? (
                <Tag color="orange">Required</Tag>
              ) : (
                <Tag>Optional</Tag>
              )}
            </div>
            <div>
              <Text type="secondary">Passkey: </Text>
              {settings.passkeyEnabled ? (
                <Tag color="green">Enabled</Tag>
              ) : (
                <Tag>Disabled</Tag>
              )}
            </div>
            {settings.passkeyEnabled && (
              <div>
                <Text type="secondary">RP Config: </Text>
                <Tag>ID: {settings.passkeyRpId || "(Auto-detect)"}</Tag>
                <Tag>Name: {settings.passkeyRpName || "RabbitDocs"}</Tag>
              </div>
            )}
          </Space>
          <Text type="secondary" className="mt-3 text-xs block">
            Changes take effect after clicking &quot;Save&quot;. The system super admin (first registered account) can always log in regardless of these settings. Configure email service in the &quot;Email&quot; menu.
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
          Current: {props.current}
        </Text>
      </div>
    </div>
  );
}
