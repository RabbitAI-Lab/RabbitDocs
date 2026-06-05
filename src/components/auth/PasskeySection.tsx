"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "./useAuth";
import {
  Button,
  Table,
  Space,
  Input,
  App,
  Empty,
  Typography,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

const { Text } = Typography;

interface PasskeyInfo {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function PasskeySection() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations('settings');
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    loadPasskeys();
  }, []);

  const loadPasskeys = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/passkey/list");
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      // Step 1: 获取注册选项
      const startRes = await authFetch("/api/passkey/register/start", {
        method: "POST",
      });
      if (!startRes.ok) {
        const data = await startRes.json();
        message.error(data.error || t('registrationFailed'));
        return;
      }
      const options = await startRes.json();

      // Step 2: 浏览器弹出生物识别对话框
      const regResult = await startRegistration({ optionsJSON: options });

      // Step 3: 提交结果
      const finishRes = await authFetch("/api/passkey/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: JSON.stringify(regResult) }),
      });

      if (finishRes.ok) {
        message.success(t('passkeyRegistered'));
        loadPasskeys();
      } else {
        const data = await finishRes.json();
        message.error(data.error || t('registrationFailed'));
      }
    } catch (err) {
      // 用户取消或浏览器不支持
      if (err instanceof Error && err.message.includes("cancelled")) {
        message.info(t('registrationCancelled'));
      } else {
        message.error(t('passkeyRegFailed'));
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRename = async (id: string) => {
    try {
      const res = await authFetch(`/api/passkey/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName: editName }),
      });
      if (res.ok) {
        message.success(t('renamed'));
        setEditingId(null);
        loadPasskeys();
      }
    } catch {
      message.error(t('failedToRename'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/passkey/${id}`, { method: "DELETE" });
      if (res.ok) {
        message.success(t('deleted'));
        loadPasskeys();
      }
    } catch {
      message.error(t('failedToDelete'));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <KeyOutlined />
          <Text strong>{t('passkeys')}</Text>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleRegister}
          loading={registering}
        >
          {t('registerNewPasskey')}
        </Button>
      </div>

      {passkeys.length === 0 ? (
        <Empty description={t('noPasskeys')} />
      ) : (
        <Table
          dataSource={passkeys}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            {
              title: t('columnDeviceName'),
              dataIndex: "deviceName",
              render: (name: string | null, record: PasskeyInfo) =>
                editingId === record.id ? (
                  <Space>
                    <Input
                      size="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onPressEnter={() => handleRename(record.id)}
                      style={{ width: 150 }}
                    />
                    <Button size="small" onClick={() => handleRename(record.id)}>
                      {t('save')}
                    </Button>
                  </Space>
                ) : (
                  name || t('unnamedDevice')
                ),
            },
            {
              title: t('columnCreatedAt'),
              dataIndex: "createdAt",
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: t('columnLastUsed'),
              dataIndex: "lastUsedAt",
              render: (v: string | null) =>
                v ? new Date(v).toLocaleString() : "-",
            },
            {
              title: t('columnActions'),
              render: (_: unknown, record: PasskeyInfo) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingId(record.id);
                      setEditName(record.deviceName || "");
                    }}
                  />
                  <Popconfirm
                    title={t('deletePasskey')}
                    onConfirm={() => handleDelete(record.id)}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
