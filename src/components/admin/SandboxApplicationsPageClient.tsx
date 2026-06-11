"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Table,
  Select,
  Button,
  Tag,
  Modal,
  App,
  Input,
  Form,
  Space,
  Empty,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface ApplicationItem {
  id: number;
  userId: string;
  status: "pending" | "approved" | "rejected";
  sandboxUrl: string | null;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
}

const STATUS_TAG_MAP: Record<string, { color: string }> = {
  pending: { color: "orange" },
  approved: { color: "green" },
  rejected: { color: "red" },
};

export default function SandboxApplicationsPageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("sandboxApplicationsPage");

  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  // 审批 Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<ApplicationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved");
  const [reviewSandboxUrl, setReviewSandboxUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(
    async (p = page, ps = pageSize, status = statusFilter) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
          status,
        });
        const res = await authFetch(
          `/api/admin/sandbox-applications?${params.toString()}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("msgFailedToLoad"));
        }
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      } catch (error: unknown) {
        const msg =
          error instanceof Error ? error.message : t("msgFailedToLoad");
        message.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, statusFilter, authFetch, message, t]
  );

  useEffect(() => {
    loadItems();
  }, [page, pageSize, statusFilter]);

  const handleReview = (item: ApplicationItem) => {
    setReviewingItem(item);
    setReviewStatus("approved");
    setReviewSandboxUrl("");
    setReviewNote("");
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewingItem) return;
    if (reviewStatus === "approved" && !reviewSandboxUrl.trim()) {
      message.warning(t("sandboxUrlRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch(
        `/api/admin/sandbox-applications/${reviewingItem.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: reviewStatus,
            sandboxUrl: reviewStatus === "approved" ? reviewSandboxUrl.trim() : undefined,
            reviewNote: reviewNote.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("msgFailedToReview"));
      }
      message.success(
        reviewStatus === "approved" ? t("msgApproved") : t("msgRejected")
      );
      setReviewModalOpen(false);
      loadItems();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t("msgFailedToReview");
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: t("colUser"),
      key: "user",
      width: 180,
      render: (_: unknown, record: ApplicationItem) => (
        <div>
          <Text strong>{record.userName || "-"}</Text>
          <br />
          <Text type="secondary" className="text-xs">
            {record.userEmail || "-"}
          </Text>
        </div>
      ),
    },
    {
      title: t("colReason"),
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      render: (text: string | null) => text || "-",
    },
    {
      title: t("colStatus"),
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_TAG_MAP[status]?.color || "default"}>
          {t(`status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
        </Tag>
      ),
    },
    {
      title: t("colSandboxUrl"),
      dataIndex: "sandboxUrl",
      key: "sandboxUrl",
      width: 200,
      ellipsis: true,
      render: (url: string | null) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        ) : (
          "-"
        ),
    },
    {
      title: t("colCreatedAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: t("colActions"),
      key: "actions",
      width: 120,
      render: (_: unknown, record: ApplicationItem) =>
        record.status === "pending" ? (
          <Button type="link" size="small" onClick={() => handleReview(record)}>
            {t("btnReview")}
          </Button>
        ) : (
          <Text type="secondary" className="text-xs">
            {record.reviewedAt
              ? new Date(record.reviewedAt).toLocaleDateString()
              : "-"}
          </Text>
        ),
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[var(--main-bg)] border-b border-gray-200 dark:border-[var(--sidebar-border)]">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t("pageTitle")}
        </h1>
        <Space>
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            style={{ width: 140 }}
            options={[
              { value: "all", label: t("filterStatus") },
              { value: "pending", label: t("statusPending") },
              { value: "approved", label: t("statusApproved") },
              { value: "rejected", label: t("statusRejected") },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadItems()}
            loading={loading}
          >
            {t("btnRefresh")}
          </Button>
        </Space>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description={t("msgFailedToLoad")} /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            showTotal: (total) => t("paginationTotal", { total }),
          }}
        />
      </div>

      {/* Review Modal */}
      <Modal
        title={t("modalTitle")}
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        onOk={handleSubmitReview}
        confirmLoading={submitting}
        okText={reviewStatus === "approved" ? t("btnApprove") : t("btnReject")}
        centered
        styles={{
          container: { border: "1px solid var(--popup-border)" },
          body: { maxHeight: "calc(90vh - 110px)", overflowY: "auto" },
        }}
      >
        {reviewingItem && (
          <div className="space-y-4">
            <div>
              <Text type="secondary">{t("colUser")}:</Text>{" "}
              <Text strong>
                {reviewingItem.userName || "-"} ({reviewingItem.userEmail || "-"})
              </Text>
            </div>
            {reviewingItem.reason && (
              <div>
                <Text type="secondary">{t("colReason")}:</Text>{" "}
                <Text>{reviewingItem.reason}</Text>
              </div>
            )}

            <div>
              <Text type="secondary" className="block mb-2">
                {t("colStatus")}:
              </Text>
              <Space>
                <Button
                  type={reviewStatus === "approved" ? "primary" : "default"}
                  icon={<CheckCircleOutlined />}
                  onClick={() => setReviewStatus("approved")}
                >
                  {t("btnApprove")}
                </Button>
                <Button
                  danger={reviewStatus === "rejected"}
                  type={reviewStatus === "rejected" ? "primary" : "default"}
                  icon={<CloseCircleOutlined />}
                  onClick={() => setReviewStatus("rejected")}
                >
                  {t("btnReject")}
                </Button>
              </Space>
            </div>

            {reviewStatus === "approved" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("labelSandboxUrl")} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={reviewSandboxUrl}
                  onChange={(e) => setReviewSandboxUrl(e.target.value)}
                  placeholder={t("placeholderSandboxUrl")}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("labelReviewNote")}
              </label>
              <Input.TextArea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={t("placeholderReviewNote")}
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
