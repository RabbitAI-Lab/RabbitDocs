"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Input,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  App,
  Empty,
  Typography,
  Avatar,
  Progress,
  Card,
  Row,
  Col,
  Alert,
  Statistic,
  Spin,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  EyeOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/components/auth/useAuth";
import { useTranslations } from "next-intl";

const { Text } = Typography;

// ── Types ──

interface UserSubscription {
  id: string;
  planTitle: string;
  billingCycle: string;
  status: string;
  expiresAt: string;
}

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  disabled: boolean;
  createdAt: string;
  subscription: UserSubscription | null;
}

interface PlanOption {
  id: number;
  title: string;
  enabled: boolean;
}

interface UsageData {
  user: { id: string; email: string; name: string | null };
  subscription: {
    id: string;
    planId: number;
    planTitle: string;
    billingCycle: string;
    startedAt: string;
    expiresAt: string;
  } | null;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    periodStart: string;
    unlimited: boolean;
  } | null;
  breakdown: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  requestCount: number;
  allTimeTokens?: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ── Helpers ──

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Component ──

export default function UserUsagePageClient() {
  const { authFetch } = useAuth();
  const { message } = App.useApp();
  const t = useTranslations("admin");

  // 用户列表
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // 用量详情 Modal
  const [detailUser, setDetailUser] = useState<UserRecord | null>(null);
  const [detailData, setDetailData] = useState<UsageData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 开通套餐 Modal
  const [assignUser, setAssignUser] = useState<UserRecord | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignForm] = Form.useForm();

  // ── 加载用户列表 ──
  const loadUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pagination.pageSize),
        });
        if (search) params.set("search", search);
        const res = await authFetch(
          `/api/admin/user-usage/users?${params.toString()}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("userUsagePage.msgFailedToLoad"));
        }
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : t("userUsagePage.msgFailedToLoad");
        message.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, pagination.pageSize, search, message, t]
  );

  useEffect(() => {
    Promise.resolve().then(() => loadUsers(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 加载用量详情 ──
  const loadUsageDetail = useCallback(
    async (user: UserRecord) => {
      setDetailUser(user);
      setDetailLoading(true);
      try {
        const res = await authFetch(
          `/api/admin/user-usage/${user.id}/usage`
        );
        if (res.ok) {
          const data: UsageData = await res.json();
          setDetailData(data);
        } else {
          message.error(t("userUsagePage.msgFailedToLoad"));
          setDetailData(null);
        }
      } catch {
        message.error(t("userUsagePage.msgFailedToLoad"));
        setDetailData(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [authFetch, message, t]
  );

  // ── 开通套餐 ──
  const openAssignModal = useCallback(
    async (user: UserRecord) => {
      setAssignUser(user);
      assignForm.resetFields();
      try {
        const res = await authFetch("/api/plans");
        if (res.ok) {
          const result = await res.json();
          const plansData: PlanOption[] = result.plans || result;
          setPlans(plansData.filter((p: PlanOption) => p.enabled));
        }
      } catch {
        // ignore
      }
    },
    [authFetch, assignForm]
  );

  const handleAssign = useCallback(async () => {
    if (!assignUser) return;
    try {
      const values = await assignForm.validateFields();
      setAssignLoading(true);
      const res = await authFetch(
        `/api/admin/user-usage/${assignUser.id}/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || t("userUsagePage.msgFailedToSubscribe")
        );
      }
      message.success(t("userUsagePage.msgSubscribed"));
      setAssignUser(null);
      loadUsers(pagination.page);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setAssignLoading(false);
    }
  }, [assignUser, assignForm, authFetch, message, t, loadUsers, pagination.page]);

  // ── 表格列 ──
  const columns = [
    {
      title: t("userUsagePage.columnUser"),
      dataIndex: "email",
      render: (_: string, record: UserRecord) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div className="flex flex-col">
            <Text strong>{record.name || "—"}</Text>
            <Text type="secondary" className="text-xs">
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: t("userUsagePage.columnRole"),
      dataIndex: "role",
      width: 100,
      render: (v: "admin" | "user") => (
        <Tag color={v === "admin" ? "orange" : "blue"}>
          {v === "admin" ? t("userUsagePage.tagAdmin") : t("userUsagePage.tagUser")}
        </Tag>
      ),
    },
    {
      title: t("userUsagePage.columnSubscription"),
      width: 220,
      render: (_: unknown, record: UserRecord) => {
        const sub = record.subscription;
        if (!sub)
          return (
            <Text type="secondary">{t("userUsagePage.noSubscription")}</Text>
          );
        const expired = new Date(sub.expiresAt) < new Date();
        return (
          <Space orientation="vertical" size={0}>
            <Space size={4}>
              <Text>{sub.planTitle}</Text>
              <Tag color={sub.billingCycle === "monthly" ? "blue" : "purple"}>
                {sub.billingCycle === "monthly"
                  ? t("userUsagePage.tagMonthly")
                  : t("userUsagePage.tagYearly")}
              </Tag>
              {expired ? (
                <Tag color="red">{t("userUsagePage.tagExpired")}</Tag>
              ) : (
                <Tag color="green">{t("userUsagePage.tagActive")}</Tag>
              )}
            </Space>
            <Text type="secondary" className="text-xs">
              {new Date(sub.expiresAt).toLocaleDateString()}
            </Text>
          </Space>
        );
      },
    },
    {
      title: t("userUsagePage.columnActions"),
      width: 200,
      fixed: "right" as const,
      render: (_: unknown, record: UserRecord) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => loadUsageDetail(record)}
          >
            {t("userUsagePage.btnViewDetail")}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<CrownOutlined />}
            onClick={() => openAssignModal(record)}
          >
            {record.subscription
              ? t("userUsagePage.btnChangePlan")
              : t("userUsagePage.btnAssignPlan")}
          </Button>
        </Space>
      ),
    },
  ];

  // ── Render ──
  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("userUsagePage.title")}</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => loadUsers(pagination.page)}
        >
          {t("userUsagePage.btnRefresh")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t("userUsagePage.placeholderSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => loadUsers(1)}
          style={{ width: 280 }}
        />
        <Button onClick={() => loadUsers(1)}>
          {t("userUsagePage.btnSearch")}
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table<UserRecord>
          rowKey="id"
          loading={loading}
          dataSource={users}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (p) => loadUsers(p),
            onShowSizeChange: (_, size) => {
              setPagination((prev) => ({ ...prev, pageSize: size, page: 1 }));
              setTimeout(() => loadUsers(1), 0);
            },
          }}
          locale={{
            emptyText: (
              <Empty description={t("userUsagePage.emptyText")} />
            ),
          }}
          columns={columns}
        />
      </div>

      {/* ── Usage Detail Modal ── */}
      <Modal
        title={
          detailUser
            ? t("userUsagePage.modalDetailTitle", {
                name: detailUser.name || detailUser.email,
              })
            : ""
        }
        open={!!detailUser}
        onCancel={() => {
          setDetailUser(null);
          setDetailData(null);
        }}
        footer={null}
        centered
        width={640}
        styles={{
          container: { border: "1px solid var(--popup-border)" },
          body: { maxHeight: "calc(90vh - 110px)", overflowY: "auto" },
        }}
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : detailData ? (
          <div className="space-y-4">
            {/* Subscription info */}
            {detailData.subscription ? (
              <Card size="small" title={t("userUsagePage.modalQuotaInfo")}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Text type="secondary">
                      {t("userUsagePage.modalPeriodInfo")}:
                    </Text>
                    <Text>
                      {new Date(
                        detailData.subscription.startedAt
                      ).toLocaleDateString()}{" "}
                      -{" "}
                      {new Date(
                        detailData.subscription.expiresAt
                      ).toLocaleDateString()}
                    </Text>
                    <Tag
                      color={
                        detailData.subscription.billingCycle === "monthly"
                          ? "blue"
                          : "purple"
                      }
                    >
                      {detailData.subscription.planTitle}
                    </Tag>
                  </div>
                  {detailData.quota && (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <Text type="secondary" className="text-sm">
                          {t("userUsagePage.modalTokensUsed")}
                        </Text>
                        <Text className="text-sm text-gray-600 dark:text-gray-400">
                          {detailData.quota.unlimited
                            ? t("userUsagePage.unlimited")
                            : t("userUsagePage.modalRemaining", {
                                count: formatTokens(detailData.quota.remaining),
                              })}
                        </Text>
                      </div>
                      <Progress
                        percent={
                          detailData.quota!.unlimited
                            ? Math.min(
                                detailData.quota!.used / 100000,
                                100
                              )
                            : detailData.quota!.percentage
                        }
                        status={
                          !detailData.quota!.unlimited &&
                          detailData.quota!.percentage >= 90
                            ? "exception"
                            : "active"
                        }
                        format={() =>
                          detailData.quota!.unlimited
                            ? `${formatTokens(detailData.quota!.used)}`
                            : `${formatTokens(detailData.quota!.used)} / ${formatTokens(detailData.quota!.limit)}`
                        }
                      />
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <Alert
                type="info"
                title={t("userUsagePage.noSubscription")}
                showIcon
              />
            )}

            {/* Breakdown */}
            <Card size="small" title={t("userUsagePage.modalBreakdown")}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title={t("userUsagePage.modalInputTokens")}
                    value={detailData.breakdown.inputTokens}
                    formatter={(v) => formatTokens(v as number)}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={t("userUsagePage.modalOutputTokens")}
                    value={detailData.breakdown.outputTokens}
                    formatter={(v) => formatTokens(v as number)}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={t("userUsagePage.modalCacheCreation")}
                    value={detailData.breakdown.cacheCreationTokens}
                    formatter={(v) => formatTokens(v as number)}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={t("userUsagePage.modalCacheRead")}
                    value={detailData.breakdown.cacheReadTokens}
                    formatter={(v) => formatTokens(v as number)}
                  />
                </Col>
              </Row>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Statistic
                  title={t("userUsagePage.modalRequestCount")}
                  value={detailData.requestCount}
                />
                {!detailData.subscription && detailData.allTimeTokens !== undefined && (
                  <Statistic
                    className="mt-2"
                    title={t("userUsagePage.modalAllTimeTokens")}
                    value={detailData.allTimeTokens}
                    formatter={(v) => formatTokens(v as number)}
                  />
                )}
              </div>
            </Card>
          </div>
        ) : null}
      </Modal>

      {/* ── Assign Plan Modal ── */}
      <Modal
        title={
          assignUser
            ? assignUser.subscription
              ? t("userUsagePage.modalChangeTitle", {
                  name: assignUser.name || assignUser.email,
                })
              : t("userUsagePage.modalAssignTitle", {
                  name: assignUser.name || assignUser.email,
                })
            : ""
        }
        open={!!assignUser}
        onOk={handleAssign}
        onCancel={() => setAssignUser(null)}
        okText={t("userUsagePage.modalOk")}
        cancelText={t("userUsagePage.modalCancel")}
        confirmLoading={assignLoading}
        centered
        styles={{
          container: { border: "1px solid var(--popup-border)" },
          body: { maxHeight: "calc(90vh - 110px)", overflowY: "auto" },
        }}
      >
        {assignUser && (
          <div className="space-y-4">
            {/* Alert if user already has a subscription */}
            {assignUser.subscription && (
              <Alert
                type="warning"
                title={t("userUsagePage.alertExistingPlan", {
                  planTitle: assignUser.subscription.planTitle,
                  cycle:
                    assignUser.subscription.billingCycle === "monthly"
                      ? t("userUsagePage.tagMonthly")
                      : t("userUsagePage.tagYearly"),
                })}
                showIcon
              />
            )}
            <Form
              form={assignForm}
              layout="vertical"
              className="mt-2"
            >
              <Form.Item
                label={t("userUsagePage.formPlan")}
                name="planId"
                rules={[
                  {
                    required: true,
                    message: t("userUsagePage.formPlanRequired"),
                  },
                ]}
              >
                <Select
                  placeholder={t("userUsagePage.formPlanPlaceholder")}
                  options={plans.map((p) => ({
                    value: p.id,
                    label: p.title,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label={t("userUsagePage.formBillingCycle")}
                name="billingCycle"
                rules={[
                  {
                    required: true,
                    message: t("userUsagePage.formBillingCycleRequired"),
                  },
                ]}
                initialValue="monthly"
              >
                <Select
                  options={[
                    {
                      value: "monthly",
                      label: t("userUsagePage.tagMonthly"),
                    },
                    {
                      value: "yearly",
                      label: t("userUsagePage.tagYearly"),
                    },
                  ]}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
