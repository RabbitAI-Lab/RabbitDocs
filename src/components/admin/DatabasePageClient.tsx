"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";
import {
  Button,
  Table,
  Upload,
  App,
  Space,
  Card,
  Typography,
  Spin,
  Alert,
  Tag,
  Descriptions,
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  UploadOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import type { DatabaseDump } from "@/lib/db-dump";

const { Text, Paragraph } = Typography;

interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

interface DatabaseInfo {
  filePath: string;
  fileSizeBytes: number;
  fileSizeHuman: string;
  lastModified: string;
  sqliteVersion: string;
  journalMode: string;
  integrityOk: boolean;
  tables: TableInfo[];
  totalRows: number;
}

interface RestoreStats {
  inserted: number;
  skipped: number;
  errors: Array<{ table: string; error: string }>;
}

interface Props {
  initialInfo: DatabaseInfo;
}

export default function DatabasePageClient({ initialInfo }: Props) {
  const { authFetch } = useAuth();
  const { message, modal } = App.useApp();
  const t = useTranslations('admin');

  const [info, setInfo] = useState<DatabaseInfo>(initialInfo);
  const [dumping, setDumping] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewData, setPreviewData] = useState<DatabaseDump | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>("");

  // Refresh database info
  const refreshInfo = async () => {
    setRefreshing(true);
    try {
      const res = await authFetch("/api/auth/admin/database/info");
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
        message.success(t('databasePage.msgRefreshed'));
      } else {
        message.error(t('databasePage.msgRefreshFailed'));
      }
    } catch {
      message.error("Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  };

  // Dump handler
  const handleDump = async (format: "json" | "sql") => {
    setDumping(true);
    try {
      const res = await authFetch(
        `/api/auth/admin/database/dump?format=${format}`
      );
      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || t('databasePage.msgDumpFailed'));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `rabbitdocs-dump-${timestamp}.${format === "json" ? "json" : "sql"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(t('databasePage.msgDumpDownloaded', { format: format.toUpperCase() }));
    } catch {
      message.error(t('databasePage.msgDumpFailed'));
    } finally {
      setDumping(false);
    }
  };

  // Handle file selection for restore
  const handleFileSelect = (file: UploadFile) => {
    const rawFile = file as unknown as File;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const dump = JSON.parse(content) as DatabaseDump;

        if (!dump.version || !dump.tables) {
          message.error(t('databasePage.msgInvalidDumpFile'));
          return;
        }

        setPreviewData(dump);
        setPreviewFileName(rawFile.name);
      } catch {
        message.error(t('databasePage.msgParseFailed'));
      }
    };
    reader.readAsText(rawFile);
    return false; // prevent upload
  };

  // Execute restore
  const executeRestore = async (dump: DatabaseDump) => {
    // Count total rows for display
    const totalRows = Object.values(dump.tables).reduce(
      (sum, t) => sum + t.rows.length,
      0
    );
    const tableCount = Object.keys(dump.tables).length;

    modal.confirm({
      title: t('databasePage.confirmRestoreTitle'),
      icon: <WarningOutlined />,
      content: (
        <div>
          <p>
            {t('databasePage.confirmRestoreReplaceData')}
          </p>
          <p>
            {t('databasePage.confirmRestoreSource')}<strong>{previewFileName}</strong>
          </p>
          <p>
            {t('databasePage.confirmRestoreTables')}<strong>{tableCount}</strong>{t('databasePage.confirmRestoreRows')}<strong>{totalRows}</strong>
          </p>
          <p style={{ color: "#ff4d4f", fontWeight: 500 }}>
            {t('databasePage.confirmRestoreWarning')}
          </p>
        </div>
      ),
      okText: t('databasePage.btnConfirmRestore'),
      okButtonProps: { danger: true },
      onOk: async () => {
        setRestoring(true);
        try {
          const res = await authFetch("/api/auth/admin/database/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: dump }),
          });
          const result = await res.json();

          if (res.ok && result.success) {
            const stats = result.stats as RestoreStats;
            message.success(
              t('databasePage.msgRestored', { count: stats.inserted }) +
                (stats.errors.length > 0
                  ? t('databasePage.msgRestoredWithWarnings', { count: stats.inserted, warnings: stats.errors.length })
                    .replace(t('databasePage.msgRestored', { count: stats.inserted }), "")
                  : "")
            );
            setPreviewData(null);
            refreshInfo();
          } else {
            message.error(result.error || t('databasePage.msgRestoreFailed'));
          }
        } catch {
          message.error(t('databasePage.msgRestoreFailed'));
        } finally {
          setRestoring(false);
        }
      },
    });
  };

  // Table columns for the info table
  const tableColumns = [
    {
      title: t('databasePage.columnTable'),
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <Text code className="text-sm">
          {name}
        </Text>
      ),
    },
    {
      title: t('databasePage.columnRows'),
      dataIndex: "rowCount",
      key: "rowCount",
      render: (count: number) => count.toLocaleString(),
      sorter: (a: TableInfo, b: TableInfo) => a.rowCount - b.rowCount,
    },
    {
      title: t('databasePage.columnColumns'),
      dataIndex: "columnCount",
      key: "columnCount",
    },
  ];

  // Preview table columns for restore
  const previewColumns = [
    {
      title: t('databasePage.columnTable'),
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <Text code className="text-sm">
          {name}
        </Text>
      ),
    },
    {
      title: t('databasePage.columnRows'),
      dataIndex: "rows",
      key: "rows",
      render: (rows: unknown[]) => rows.length.toLocaleString(),
    },
    {
      title: t('databasePage.columnColumns'),
      dataIndex: "columns",
      key: "columns",
      render: (cols: string[]) => cols.length,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t('databasePage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('databasePage.subtitle')}
          </p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={refreshInfo}
        >
          {t('databasePage.btnRefresh')}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Database Overview */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>{t('databasePage.overviewTitle')}</span>
              {info.integrityOk ? (
                <Tag
                  icon={<CheckCircleOutlined />}
                  color="success"
                  className="ml-2"
                >
                  {t('databasePage.tagHealthy')}
                </Tag>
              ) : (
                <Tag
                  icon={<WarningOutlined />}
                  color="error"
                  className="ml-2"
                >
                  {t('databasePage.tagIntegrityIssue')}
                </Tag>
              )}
            </Space>
          }
          size="small"
        >
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label={t('databasePage.descFilePath')}>
              <Text code className="text-xs">
                {info.filePath}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('databasePage.descFileSize')}>
              {info.fileSizeHuman}
            </Descriptions.Item>
            <Descriptions.Item label={t('databasePage.descSqliteVersion')}>
              {info.sqliteVersion}
            </Descriptions.Item>
            <Descriptions.Item label={t('databasePage.descJournalMode')}>
              <Tag>{info.journalMode}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('databasePage.descLastModified')}>
              {new Date(info.lastModified).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label={t('databasePage.descTotalRows')}>
              {info.totalRows.toLocaleString()}
            </Descriptions.Item>
          </Descriptions>

          <div className="mt-4">
            <Table
              dataSource={info.tables}
              columns={tableColumns}
              rowKey="name"
              size="small"
              pagination={false}
              className="text-sm"
            />
          </div>
        </Card>

        {/* Export */}
        <Card title={t('databasePage.exportTitle')} size="small">
          <Paragraph type="secondary" className="text-xs mb-3">
            {t('databasePage.exportDesc')}
          </Paragraph>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              loading={dumping}
              onClick={() => handleDump("json")}
            >
              {t('databasePage.btnExportJson')}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={dumping}
              onClick={() => handleDump("sql")}
            >
              {t('databasePage.btnExportSql')}
            </Button>
          </Space>
        </Card>

        {/* Import / Restore */}
        <Card title={t('databasePage.restoreTitle')} size="small">
          <Paragraph type="secondary" className="text-xs mb-3">
            {t('databasePage.restoreDesc')}
          </Paragraph>

          <Space orientation="vertical" className="w-full">
            <Upload
              accept=".json"
              maxCount={1}
              showUploadList={false}
              beforeUpload={handleFileSelect}
            >
              <Button icon={<UploadOutlined />} disabled={restoring}>
                {t('databasePage.btnSelectDump')}
              </Button>
            </Upload>

            {previewData && (
              <div className="space-y-3">
                <Alert
                  type="warning"
                  showIcon
                  title={
                    <span>
                      {t('databasePage.previewLabel')}<strong>{previewFileName}</strong>{" "}
                      {Object.keys(previewData.tables).length}{t('databasePage.previewTables')}
                      {Object.values(previewData.tables).reduce(
                        (sum, t) => sum + t.rows.length,
                        0
                      )}{" "}
                      {t('databasePage.previewTotalRows')}
                      {previewData.timestamp && (
                        <span>
                          {" "}
                          {t('databasePage.previewDumpedAt')}{new Date(previewData.timestamp).toLocaleString()})
                        </span>
                      )}
                    </span>
                  }
                />

                <Table
                  dataSource={Object.entries(previewData.tables).map(
                    ([name, data]) => ({
                      name,
                      rows: data.rows,
                      columns: data.columns,
                    })
                  )}
                  columns={previewColumns}
                  rowKey="name"
                  size="small"
                  pagination={false}
                />

                <Button
                  danger
                  loading={restoring}
                  onClick={() => executeRestore(previewData)}
                >
                  {t('databasePage.btnRestoreDatabase')}
                </Button>
              </div>
            )}

            {restoring && (
              <div className="flex items-center gap-2">
                <Spin size="small" />
                <Text type="secondary">{t('databasePage.restoringText')}</Text>
              </div>
            )}
          </Space>
        </Card>
      </div>
    </div>
  );
}
