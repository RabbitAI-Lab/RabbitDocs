"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/useAuth";
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
        message.success("Refreshed");
      } else {
        message.error("Failed to refresh");
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
        message.error(data.error || "Dump failed");
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
      message.success(`${format.toUpperCase()} dump downloaded`);
    } catch {
      message.error("Dump failed");
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
          message.error("Invalid dump file: missing version or tables");
          return;
        }

        setPreviewData(dump);
        setPreviewFileName(rawFile.name);
      } catch {
        message.error("Failed to parse JSON file");
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
      title: "Confirm Restore",
      icon: <WarningOutlined />,
      content: (
        <div>
          <p>
            This operation will <strong>replace all existing data</strong> in the
            database.
          </p>
          <p>
            Source: <strong>{previewFileName}</strong>
          </p>
          <p>
            Tables: <strong>{tableCount}</strong> | Rows:{" "}
            <strong>{totalRows}</strong>
          </p>
          <p style={{ color: "#ff4d4f", fontWeight: 500 }}>
            This action cannot be undone. Make sure you have a backup.
          </p>
        </div>
      ),
      okText: "Confirm Restore",
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
              `Restored ${stats.inserted} rows` +
                (stats.errors.length > 0
                  ? ` (${stats.errors.length} warnings)`
                  : "")
            );
            setPreviewData(null);
            refreshInfo();
          } else {
            message.error(result.error || "Restore failed");
          }
        } catch {
          message.error("Restore failed");
        } finally {
          setRestoring(false);
        }
      },
    });
  };

  // Table columns for the info table
  const tableColumns = [
    {
      title: "Table",
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <Text code className="text-sm">
          {name}
        </Text>
      ),
    },
    {
      title: "Rows",
      dataIndex: "rowCount",
      key: "rowCount",
      render: (count: number) => count.toLocaleString(),
      sorter: (a: TableInfo, b: TableInfo) => a.rowCount - b.rowCount,
    },
    {
      title: "Columns",
      dataIndex: "columnCount",
      key: "columnCount",
    },
  ];

  // Preview table columns for restore
  const previewColumns = [
    {
      title: "Table",
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <Text code className="text-sm">
          {name}
        </Text>
      ),
    },
    {
      title: "Rows",
      dataIndex: "rows",
      key: "rows",
      render: (rows: unknown[]) => rows.length.toLocaleString(),
    },
    {
      title: "Columns",
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
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Database</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Dump, restore, and inspect the database
          </p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={refreshInfo}
        >
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Database Overview */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>Database Overview</span>
              {info.integrityOk ? (
                <Tag
                  icon={<CheckCircleOutlined />}
                  color="success"
                  className="ml-2"
                >
                  Healthy
                </Tag>
              ) : (
                <Tag
                  icon={<WarningOutlined />}
                  color="error"
                  className="ml-2"
                >
                  Integrity Issue
                </Tag>
              )}
            </Space>
          }
          size="small"
        >
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="File Path">
              <Text code className="text-xs">
                {info.filePath}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="File Size">
              {info.fileSizeHuman}
            </Descriptions.Item>
            <Descriptions.Item label="SQLite Version">
              {info.sqliteVersion}
            </Descriptions.Item>
            <Descriptions.Item label="Journal Mode">
              <Tag>{info.journalMode}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Last Modified">
              {new Date(info.lastModified).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Total Rows">
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
        <Card title="Export" size="small">
          <Paragraph type="secondary" className="text-xs mb-3">
            Export the entire database. JSON format is database-agnostic and can
            be restored via the import function below. SQL format generates
            SQLite-compatible INSERT statements.
          </Paragraph>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              loading={dumping}
              onClick={() => handleDump("json")}
            >
              Export JSON
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={dumping}
              onClick={() => handleDump("sql")}
            >
              Export SQL
            </Button>
          </Space>
        </Card>

        {/* Import / Restore */}
        <Card title="Restore" size="small">
          <Paragraph type="secondary" className="text-xs mb-3">
            Import a previously exported JSON dump file. This will{" "}
            <strong>replace all existing data</strong> in the database.
          </Paragraph>

          <Space direction="vertical" className="w-full">
            <Upload
              accept=".json"
              maxCount={1}
              showUploadList={false}
              beforeUpload={handleFileSelect}
            >
              <Button icon={<UploadOutlined />} disabled={restoring}>
                Select JSON Dump File
              </Button>
            </Upload>

            {previewData && (
              <div className="space-y-3">
                <Alert
                  type="warning"
                  showIcon
                  message={
                    <span>
                      Preview: <strong>{previewFileName}</strong> —{" "}
                      {Object.keys(previewData.tables).length} tables,{" "}
                      {Object.values(previewData.tables).reduce(
                        (sum, t) => sum + t.rows.length,
                        0
                      )}{" "}
                      total rows
                      {previewData.timestamp && (
                        <span>
                          {" "}
                          (dumped at{" "}
                          {new Date(previewData.timestamp).toLocaleString()})
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
                  Restore Database
                </Button>
              </div>
            )}

            {restoring && (
              <div className="flex items-center gap-2">
                <Spin size="small" />
                <Text type="secondary">Restoring database...</Text>
              </div>
            )}
          </Space>
        </Card>
      </div>
    </div>
  );
}
