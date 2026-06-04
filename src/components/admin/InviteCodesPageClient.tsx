"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Input,
  Select,
  Button,
  Space,
  Tag,
  App,
  Popconfirm,
  Empty,
  Typography,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  CopyOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";

const { Text } = Typography;

interface InviteCode {
  id: string;
  code: string;
  creator: { id: string; email: string; name: string | null } | null;
  used: boolean;
  usedById: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unused", label: "Unused" },
  { value: "used", label: "Used" },
];

export default function InviteCodesPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pagination.pageSize),
          status,
        });
        if (search) params.set("search", search);
        const res = await authFetch(`/api/auth/admin/invite-codes?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load");
        }
        const data = await res.json();
        setCodes(data.codes);
        setPagination(data.pagination);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to load";
        message.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, pagination.pageSize, search, status, message]
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/auth/admin/invite-codes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete");
      }
      message.success("Deleted");
      load(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to delete";
      message.error(msg);
    }
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/register?code=${code}`;
    navigator.clipboard.writeText(link);
    message.success("Invite link copied");
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Invite Code Management</h1>
        <Button icon={<ReloadOutlined />} onClick={() => load(pagination.page)}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search invite code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => load(1)}
          style={{ width: 280 }}
        />
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          style={{ width: 160 }}
        />
        <Button onClick={() => load(1)}>
          Search
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table<InviteCode>
          rowKey="id"
          loading={loading}
          dataSource={codes}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (p) => load(p),
          }}
          locale={{ emptyText: <Empty description="No invite codes found" /> }}
          columns={[
            {
              title: "Code",
              dataIndex: "code",
              render: (code: string) => (
                <Space>
                  <Text code>{code}</Text>
                  <Tooltip title="Copy invite link">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyLink(code)}
                    />
                  </Tooltip>
                </Space>
              ),
            },
            {
              title: "Created By",
              dataIndex: "creator",
              render: (creator: InviteCode["creator"]) =>
                creator ? (
                  <Space orientation="vertical" size={0}>
                    <Text>{creator.name || "—"}</Text>
                    <Text type="secondary" className="text-xs">
                      {creator.email}
                    </Text>
                  </Space>
                ) : (
                  <Tag>System</Tag>
                ),
            },
            {
              title: "Status",
              dataIndex: "used",
              width: 110,
              render: (used: boolean) =>
                used ? <Tag color="red">Used</Tag> : <Tag color="green">Unused</Tag>,
            },
            {
              title: "Used At",
              dataIndex: "usedAt",
              width: 170,
              render: (v: string | null) =>
                v ? new Date(v).toLocaleString() : "—",
            },
            {
              title: "Created At",
              dataIndex: "createdAt",
              width: 170,
              render: (v: string) => new Date(v).toLocaleString(),
            },
            {
              title: "Actions",
              width: 120,
              fixed: "right",
              render: (_: unknown, record: InviteCode) =>
                record.used ? (
                  <Text type="secondary" className="text-xs">
                    Used codes cannot be deleted
                  </Text>
                ) : (
                  <Popconfirm title="Delete this code?" onConfirm={() => handleDelete(record.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                      Delete
                    </Button>
                  </Popconfirm>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
