"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "./useAuth";
import {
  Button,
  Table,
  Space,
  App,
  Empty,
  Typography,
  Popconfirm,
} from "antd";
import { DeleteOutlined, CodeOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface CliToken {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function CliTokensSection() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations('settings');
  const [tokens, setTokens] = useState<CliToken[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/auth/cli/tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await authFetch(`/api/auth/cli/tokens/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success(t('revoked'));
        loadTokens();
      }
    } catch {
      message.error(t('revokeFailed'));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <CodeOutlined />
        <Text strong>{t('cliTokens')}</Text>
      </div>

      {tokens.length === 0 ? (
        <Empty description={t('noCliTokens')} />
      ) : (
        <Table
          dataSource={tokens}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            {
              title: t('name'),
              dataIndex: "name",
            },
            {
              title: t('columnPrefix'),
              dataIndex: "prefix",
              render: (v: string) => <Text code>{v}...</Text>,
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
              render: (_: unknown, record: CliToken) => (
                <Popconfirm
                  title={t('revokeToken')}
                  onConfirm={() => handleRevoke(record.id)}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                    {t('revoke')}
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
