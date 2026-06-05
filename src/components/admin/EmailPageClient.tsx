"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  InputNumber,
  Alert,
} from "antd";
import {
  ReloadOutlined,
  SaveOutlined,
  MailOutlined,
  SendOutlined,
  EyeOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  secure: boolean;
  hasPassword: boolean;
}

interface EmailTemplateSettings {
  verifySubject: string;
  verifyHtml: string;
}

const emptySmtpDraft = (): SmtpSettings => ({
  host: "",
  port: 465,
  user: "",
  pass: "",
  fromEmail: "",
  secure: true,
  hasPassword: false,
});

const emptyTemplateDraft = (): EmailTemplateSettings => ({
  verifySubject: "",
  verifyHtml: "",
});

export default function EmailPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [draft, setDraft] = useState<SmtpSettings>(emptySmtpDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Email templates
  const [templates, setTemplates] = useState<EmailTemplateSettings | null>(null);
  const [templateDraft, setTemplateDraft] = useState<EmailTemplateSettings>(emptyTemplateDraft());

  // SMTP test email
  const [testEmail, setTestEmail] = useState("");
  const [testState, setTestState] = useState<{
    testing: boolean;
    result: { success: boolean; message: string } | null;
  }>({ testing: false, result: null });

  // Preview
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/admin/system-settings");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load");
      }
      const data = (await res.json()) as {
        smtp: Omit<SmtpSettings, "pass"> | null;
        brandName: string;
        emailTemplates: EmailTemplateSettings;
      };
      const normalized: SmtpSettings | null = data.smtp
        ? { ...emptySmtpDraft(), ...data.smtp, pass: "" }
        : null;
      setSmtp(normalized);
      setDraft(normalized ?? emptySmtpDraft());

      const tpl = data.emailTemplates || emptyTemplateDraft();
      setTemplates(tpl);
      setTemplateDraft(tpl);

      // Clear preview on reload
      setPreviewHtml(null);
      setPreviewSubject(null);
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
    if (!draft) return false;
    const baseline = smtp ?? emptySmtpDraft();
    if (
      baseline.host !== draft.host ||
      baseline.port !== draft.port ||
      baseline.user !== draft.user ||
      baseline.fromEmail !== draft.fromEmail ||
      baseline.secure !== draft.secure
    ) {
      return true;
    }
    if (draft.pass.length > 0) return true;

    // Email templates dirty
    if (templates) {
      if (templateDraft.verifySubject !== templates.verifySubject) return true;
      if (templateDraft.verifyHtml !== templates.verifyHtml) return true;
    } else {
      if (templateDraft.verifySubject || templateDraft.verifyHtml) return true;
    }

    return false;
  }, [smtp, draft, templates, templateDraft]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const smtpPayload: Record<string, unknown> = {
        host: draft.host,
        port: draft.port,
        user: draft.user,
        fromEmail: draft.fromEmail,
        secure: draft.secure,
      };
      if (draft.pass.length > 0) {
        smtpPayload.pass = draft.pass;
      }

      const payload: Record<string, unknown> = {
        smtp: smtpPayload,
        emailTemplates: {
          verifySubject: templateDraft.verifySubject,
          verifyHtml: templateDraft.verifyHtml,
        },
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

      const next: SmtpSettings = { ...draft, pass: "", hasPassword: true };
      setSmtp(next);
      setDraft(next);
      setTemplates({ ...templateDraft });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to save";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const updateSmtp = <K extends keyof SmtpSettings>(
    key: K,
    value: SmtpSettings[K]
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  };

  const clearSmtp = () => {
    setSmtp(null);
    setDraft(emptySmtpDraft());
  };

  const initSmtp = () => {
    setDraft(emptySmtpDraft());
  };

  const handleTestSmtp = async () => {
    if (!testEmail) {
      message.warning("Please enter a recipient email address");
      return;
    }
    setTestState({ testing: true, result: null });
    try {
      const res = await authFetch(
        "/api/auth/admin/system-settings/test-smtp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmail: testEmail }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }
      const data = (await res.json()) as { success: boolean; message: string };
      setTestState({ testing: false, result: data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Request failed";
      setTestState({
        testing: false,
        result: { success: false, message: msg },
      });
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const payload: Record<string, string> = {};
      if (templateDraft.verifySubject) payload.verifySubject = templateDraft.verifySubject;
      if (templateDraft.verifyHtml) payload.verifyHtml = templateDraft.verifyHtml;

      const res = await authFetch(
        "/api/auth/admin/system-settings/preview-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Preview failed");
      }
      const data = (await res.json()) as {
        preview: { subject: string; html: string };
      };
      setPreviewSubject(data.preview.subject);
      setPreviewHtml(data.preview.html);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Preview failed";
      message.error(msg);
    } finally {
      setPreviewing(false);
    }
  };

  const handleResetTemplate = () => {
    setTemplateDraft(emptyTemplateDraft());
    setPreviewHtml(null);
    setPreviewSubject(null);
  };

  if (loading) {
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
          <h1 className="text-lg font-semibold">Email Service</h1>
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

        <SmtpCard
          smtp={draft}
          currentConfigured={!!smtp}
          dirty={dirty}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          testState={testState}
          onChangeField={updateSmtp}
          onInit={initSmtp}
          onClear={clearSmtp}
          onTest={handleTestSmtp}
        />

        <EmailTemplateCard
          templateDraft={templateDraft}
          setTemplateDraft={setTemplateDraft}
          previewHtml={previewHtml}
          previewSubject={previewSubject}
          previewing={previewing}
          onPreview={handlePreview}
          onResetTemplate={handleResetTemplate}
        />

        <Card title="Current Configuration">
          <Space orientation="vertical" size="small">
            <div>
              <Text type="secondary">SMTP Email Service: </Text>
              {smtp ? (
                <Tag color="green">Configured</Tag>
              ) : (
                <Tag>Not Configured</Tag>
              )}
              {smtp && (
                <Tag>
                  {smtp.host}:{smtp.port}
                </Tag>
              )}
            </div>
          </Space>
          <Paragraph type="secondary" className="mt-3 text-xs">
            Changes take effect after clicking &quot;Save&quot;. Without SMTP configured, verification emails will only be printed to the server console and users will not receive them.
          </Paragraph>
        </Card>
      </div>
    </div>
  );
}

// ─── Email Template Card ────────────────────────────────────────────

function EmailTemplateCard(props: {
  templateDraft: EmailTemplateSettings;
  setTemplateDraft: React.Dispatch<React.SetStateAction<EmailTemplateSettings>>;
  previewHtml: string | null;
  previewSubject: string | null;
  previewing: boolean;
  onPreview: () => void;
  onResetTemplate: () => void;
}) {
  const {
    templateDraft,
    setTemplateDraft,
    previewHtml,
    previewSubject,
    previewing,
    onPreview,
    onResetTemplate,
  } = props;

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write preview HTML into iframe
  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  const isDefault =
    !templateDraft.verifySubject && !templateDraft.verifyHtml;

  return (
    <Card
      title={
        <Space>
          <MailOutlined />
          <span>Email Templates</span>
          {isDefault && <Tag color="blue">Using default</Tag>}
        </Space>
      }
      extra={
        !isDefault ? (
          <Button size="small" icon={<UndoOutlined />} onClick={onResetTemplate}>
            Reset to Default
          </Button>
        ) : null
      }
    >
      <Text type="secondary" className="text-xs block mb-4">
        Customize the verification email content. Leave fields empty to use the default template.
      </Text>

      <div className="space-y-3">
        <FieldRow label="Subject">
          <Input
            value={templateDraft.verifySubject}
            placeholder="{{brandName}} - Verify Your Email"
            allowClear
            onChange={(e) =>
              setTemplateDraft((prev) => ({
                ...prev,
                verifySubject: e.target.value,
              }))
            }
          />
        </FieldRow>
        <FieldRow label="HTML Body">
          <TextArea
            value={templateDraft.verifyHtml}
            placeholder="Leave empty to use the default template"
            rows={12}
            style={{ fontFamily: "monospace", fontSize: 13 }}
            onChange={(e) =>
              setTemplateDraft((prev) => ({
                ...prev,
                verifyHtml: e.target.value,
              }))
            }
          />
        </FieldRow>

        <Alert
          type="info"
          showIcon
          className="!mt-2"
          title={
            <span>
              Available variables:{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{brandName}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{code}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{verifyUrl}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{codeBlock}}"}</code>
            </span>
          }
          description={
            <span className="text-xs">
              <code>{"{{codeBlock}}"}</code> renders a styled verification code
              display block. Leave fields empty to use the default template.
            </span>
          }
        />

        <Space className="!mt-2">
          <Button
            icon={<EyeOutlined />}
            loading={previewing}
            onClick={onPreview}
          >
            Preview
          </Button>
        </Space>

        {previewHtml && (
          <>
            <Divider className="!my-3" />
            <div className="mb-2">
              <Text strong>Subject: </Text>
              <Text>{previewSubject}</Text>
            </div>
            <div
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <iframe
                ref={iframeRef}
                sandbox=""
                srcDoc={previewHtml}
                style={{
                  width: "100%",
                  height: 500,
                  border: "none",
                }}
                title="Email Preview"
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── SMTP Card ──────────────────────────────────────────────────────

function SmtpCard(props: {
  smtp: SmtpSettings;
  currentConfigured: boolean;
  dirty: boolean;
  testEmail: string;
  setTestEmail: (v: string) => void;
  testState: { testing: boolean; result: { success: boolean; message: string } | null };
  onChangeField: <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => void;
  onInit: () => void;
  onClear: () => void;
  onTest: () => void;
}) {
  const {
    smtp,
    currentConfigured,
    dirty,
    testEmail,
    setTestEmail,
    testState,
    onChangeField,
    onInit,
    onClear,
    onTest,
  } = props;

  return (
    <Card
      title={
        <Space>
          <MailOutlined />
          <span>SMTP Configuration</span>
          {currentConfigured ? (
            <Tag color="green">Configured</Tag>
          ) : (
            <Tag>Not Configured</Tag>
          )}
        </Space>
      }
      extra={
        currentConfigured ? (
          <Button danger size="small" onClick={onClear}>
            Clear SMTP Config
          </Button>
        ) : null
      }
    >
      {!currentConfigured && (
        <Alert
          type="warning"
          showIcon
          className="!mb-4"
          title="SMTP email service not configured"
          description="Without SMTP configured, verification emails will only be printed to the server console and users will not receive them."
          action={
            <Button size="small" onClick={onInit}>
              Set Up Now
            </Button>
          }
        />
      )}

      {smtp && (
      <div className="space-y-3">
        <FieldRow label="SMTP Host">
          <Input
            value={smtp.host}
            placeholder="smtp.example.com"
            allowClear
            onChange={(e) => onChangeField("host", e.target.value)}
          />
        </FieldRow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Port">
            <InputNumber
              value={smtp.port}
              min={1}
              max={65535}
              className="!w-full"
              onChange={(v) => onChangeField("port", typeof v === "number" ? v : 465)}
            />
          </FieldRow>
          <FieldRow label="Use SSL/TLS">
            <div className="pt-1">
              <Switch
                checked={smtp.secure}
                onChange={(v) => onChangeField("secure", v)}
              />
              <Text type="secondary" className="ml-2 text-xs">
                Usually enabled for port 465; disabled for 587/25 (uses STARTTLS)
              </Text>
            </div>
          </FieldRow>
        </div>
        <FieldRow label="Username">
          <Input
            value={smtp.user}
            placeholder="user@example.com"
            autoComplete="off"
            onChange={(e) => onChangeField("user", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Password / Authorization Code">
          <Input.Password
            value={smtp.pass}
            placeholder={
              smtp.hasPassword
                ? "Leave empty to keep current password"
                : "SMTP login password or authorization code"
            }
            autoComplete="new-password"
            onChange={(e) => onChangeField("pass", e.target.value)}
          />
          {smtp.hasPassword && !smtp.pass && (
            <Text type="secondary" className="mt-1 block text-xs">
              Password has been set (not displayed). Only fill in when you need to change it.
            </Text>
          )}
        </FieldRow>
        <FieldRow label="Sender Email">
          <Input
            type="email"
            value={smtp.fromEmail}
            placeholder={`noreply@${smtp.host || "example.com"}`}
            allowClear
            onChange={(e) => onChangeField("fromEmail", e.target.value)}
          />
          <Text type="secondary" className="mt-1 block text-xs">
            Leave empty to use noreply@&lt;SMTP Host&gt;
          </Text>
        </FieldRow>

        <Divider className="!my-4" />

        <div>
          <div className="font-medium mb-2">Test Email</div>
          <Text type="secondary" className="text-xs block mb-3">
            Send a test email to verify your SMTP configuration.{" "}
            <span className="text-orange-600">
              The test uses saved settings. Please click &quot;Save&quot; at the top first.
            </span>
            {dirty && " You have unsaved changes. The test will use the saved values."}
          </Text>
          <Space.Compact className="!w-full !flex">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onPressEnter={onTest}
            />
            <Button
              icon={<SendOutlined />}
              loading={testState.testing}
              onClick={onTest}
            >
              Send Test Email
            </Button>
          </Space.Compact>
          {testState.result && (
            <Alert
              className="!mt-3"
              type={testState.result.success ? "success" : "error"}
              showIcon
              title={
                testState.result.success
                  ? "Sent successfully"
                  : "Send failed"
              }
              description={testState.result.message}
            />
          )}
        </div>
      </div>
      )}
    </Card>
  );
}

// ─── Shared Field Row ───────────────────────────────────────────────

function FieldRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px,1fr] sm:items-start gap-1 sm:gap-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-1.5">
        {props.label}
      </label>
      <div>{props.children}</div>
    </div>
  );
}
