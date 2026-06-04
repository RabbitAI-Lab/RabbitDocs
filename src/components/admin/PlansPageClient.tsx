"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/auth/useAuth";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  App,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

const CURRENCY_OPTIONS = [
  { value: "CNY", label: "CNY (¥)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

function formatPrice(currency: string, amount: string | number): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${amount}`;
}

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanPrice {
  currency: string;
  monthlyPrice: string;
    yearlyPrice: string;
}

interface Plan {
  id: number;
  title: string;
  description: string | null;
  defaultCurrency: string;
  prices: string;
  discountType: "none" | "percentage" | "fixed";
  discountValue: number;
  features: string;
  enabled: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialPlans: Plan[];
}

export default function PlansPageClient({ initialPlans }: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const { authFetch } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form] = Form.useForm();
  const { modal, message } = App.useApp();

  const refreshList = useCallback(async () => {
    const res = await authFetch("/api/plans");
    const data = await res.json();
    setPlans(data);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingPlan(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEdit = useCallback(
    (record: Plan) => {
      setEditingPlan(record);
      let parsedPrices: PlanPrice[] = [];
      try {
        parsedPrices = JSON.parse(record.prices || "[]");
      } catch {
        /* use empty */
      }
      let parsedFeatures: PlanFeature[] = [];
      try {
        parsedFeatures = JSON.parse(record.features || "[]");
      } catch {
        /* use empty */
      }

      form.setFieldsValue({
        title: record.title,
        description: record.description,
        defaultCurrency: record.defaultCurrency,
        priceList: parsedPrices,
        discountType: record.discountType,
        discountValue: record.discountValue,
        enabled: record.enabled,
        sortOrder: record.sortOrder,
        featureList: parsedFeatures,
      });
      setModalOpen(true);
    },
    [form]
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        prices: JSON.stringify(values.priceList || []),
        features: JSON.stringify(values.featureList || []),
      };
      delete submitData.priceList;
      delete submitData.featureList;

      if (editingPlan) {
        await authFetch(`/api/plans/${editingPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        });
        message.success("Plan updated");
      } else {
        await authFetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitData),
        });
        message.success("Plan created");
      }
      setModalOpen(false);
      setEditingPlan(null);
      form.resetFields();
      await refreshList();
    } catch {
      // validation failed
    }
  }, [editingPlan, form, refreshList, message]);

  const handleToggleEnabled = useCallback(
    (record: Plan) => {
      const newEnabled = record.enabled ? 0 : 1;
      authFetch(`/api/plans/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      }).then(() => {
        refreshList();
        message.success(
          newEnabled
            ? `"${record.title}" enabled`
            : `"${record.title}" disabled`
        );
      });
    },
    [refreshList, message]
  );

  const handleDelete = useCallback(
    (id: number, title: string) => {
      modal.confirm({
        title: "Confirm Delete",
        content: `Confirm delete plan "${title}"?`,
        okText: "Delete",
        cancelText: "Cancel",
        okButtonProps: { danger: true },
        onOk: async () => {
          await authFetch(`/api/plans/${id}`, { method: "DELETE" });
          await refreshList();
          message.success("Deleted");
        },
      });
    },
    [modal, refreshList, message]
  );

  const columns: ColumnsType<Plan> = [
    {
      title: "Title",
      dataIndex: "title",
      width: 140,
      render: (title: string) => <Text strong>{title}</Text>,
    },
    {
      title: "Default",
      dataIndex: "defaultCurrency",
      width: 80,
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: "Pricing",
      width: 220,
      render: (_: unknown, record: Plan) => {
        try {
          const priceList = JSON.parse(record.prices || "[]") as PlanPrice[];
          if (priceList.length === 0)
            return <Text type="secondary">-</Text>;
          return (
            <div className="space-y-0.5">
              {priceList.map((p, i) => (
                <div key={i} className="text-xs">
                  <Text type="secondary">{p.currency}:</Text>{" "}
                  <Text>{formatPrice(p.currency, p.monthlyPrice)}/mo</Text>
                  <Text type="secondary"> · </Text>
                  <Text>{formatPrice(p.currency, p.yearlyPrice)}/yr</Text>
                </div>
              ))}
            </div>
          );
        } catch {
          return <Text type="secondary">-</Text>;
        }
      },
    },
    {
      title: "Discount",
      width: 100,
      render: (_: unknown, record: Plan) => {
        if (record.discountType === "none")
          return <Text type="secondary">-</Text>;
        if (record.discountType === "percentage")
          return (
            <Text type="success">
              {(record.discountValue / 10).toFixed(1)}折
            </Text>
          );
        return (
          <Text type="success">
            {formatPrice(record.defaultCurrency, record.discountValue)}
          </Text>
        );
      },
    },
    {
      title: "Features",
      width: 80,
      render: (_: unknown, record: Plan) => {
        try {
          const list = JSON.parse(record.features || "[]") as PlanFeature[];
          const included = list.filter((f) => f.included).length;
          return (
            <Text>
              {included}/{list.length}
            </Text>
          );
        } catch {
          return <Text type="secondary">0</Text>;
        }
      },
    },
    {
      title: "Enabled",
      dataIndex: "enabled",
      width: 80,
      render: (enabled: number, record: Plan) => (
        <Switch
          checked={enabled === 1}
          onChange={() => handleToggleEnabled(record)}
          size="small"
        />
      ),
    },
    {
      title: "Sort",
      dataIndex: "sortOrder",
      width: 70,
    },
    {
      title: "Actions",
      width: 100,
      render: (_: unknown, record: Plan) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.title)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Plans</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage subscription plans and pricing
          </p>
        </div>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>
          Add Plan
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Table
          dataSource={plans}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editingPlan ? "Edit Plan" : "New Plan"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingPlan(null);
          form.resetFields();
        }}
        okText={editingPlan ? "Save" : "Create"}
        cancelText="Cancel"
        mask={{ closable: false }}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            enabled: 1,
            sortOrder: 0,
            defaultCurrency: "CNY",
            discountType: "none",
            discountValue: 0,
            priceList: [],
            featureList: [],
          }}
          className="mt-4"
        >
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: "Please enter plan title" }]}
          >
            <Input placeholder="e.g. Pro Plan" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Plan description" />
          </Form.Item>

          <Form.Item
            label="Default Currency"
            name="defaultCurrency"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>

          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-4 mb-2">
            Pricing by Currency
          </div>

          {/* Dynamic Pricing Editor */}
          <Form.List name="priceList">
            {(fields, { add, remove }) => (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 text-xs font-medium text-gray-400 dark:text-gray-500">
                  <span className="w-28">Currency</span>
                  <span className="flex-1">Monthly Price (¥)</span>
                  <span className="flex-1">Yearly Price (¥)</span>
                  <span className="w-6" />
                </div>
                {fields.map((field) => {
                  const { key: _k, ...fieldProps } = field;
                  return (
                  <div
                    key={field.key}
                    className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg"
                  >
                    <Form.Item
                      {...fieldProps}
                      name={[field.name, "currency"]}
                      rules={[{ required: true, message: "Required" }]}
                      className="w-28 mb-0"
                    >
                      <Select
                        options={CURRENCY_OPTIONS}
                        placeholder="Currency"
                      />
                    </Form.Item>
                    <Form.Item
                      {...fieldProps}
                      name={[field.name, "monthlyPrice"]}
                      rules={[{ required: true, message: "Required" }]}
                      className="flex-1 mb-0"
                    >
                      <Input
                        className="w-full"
                        placeholder="Monthly Price (¥)"
                      />
                    </Form.Item>
                    <Form.Item
                      {...fieldProps}
                      name={[field.name, "yearlyPrice"]}
                      rules={[{ required: true, message: "Required" }]}
                      className="flex-1 mb-0"
                    >
                      <Input
                        className="w-full"
                        placeholder="Yearly Price (¥)"
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                      className="mt-1"
                    />
                  </div>
                )})}
                <Button
                  type="dashed"
                  onClick={() =>
                    add({ currency: "CNY", monthlyPrice: "", yearlyPrice: "" })
                  }
                  icon={<PlusCircleOutlined />}
                  className="w-full"
                >
                  Add Currency Price
                </Button>
              </div>
            )}
          </Form.List>

          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-4 mb-2">
            Discount
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Discount Type" name="discountType">
              <Select
                options={[
                  { value: "none", label: "No Discount" },
                  {
                    value: "percentage",
                    label: "Percentage (e.g. 8.5折)",
                  },
                  { value: "fixed", label: "Fixed Price" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Discount Value" name="discountValue">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>

          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-4 mb-2">
            Settings
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Status" name="enabled">
              <Select
                options={[
                  { value: 1, label: "Enabled" },
                  { value: 0, label: "Disabled" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Sort Order" name="sortOrder">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>

          <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-4 mb-2">
            Features
          </div>

          {/* Dynamic Features Editor */}
          <Form.List name="featureList">
            {(fields, { add, remove }) => (
              <div className="space-y-2">
                {fields.map((field) => {
                  const { key: _k, ...fieldProps } = field;
                  return (
                  <div key={field.key} className="flex items-start gap-2">
                    <Form.Item
                      {...fieldProps}
                      name={[field.name, "name"]}
                      rules={[
                        {
                          required: true,
                          message: "Feature name required",
                        },
                      ]}
                      className="flex-1 mb-0"
                    >
                      <Input placeholder="Feature name" />
                    </Form.Item>
                    <Form.Item
                      {...fieldProps}
                      name={[field.name, "included"]}
                      valuePropName="checked"
                      className="mb-0 mt-1"
                    >
                      <Switch
                        checkedChildren="✓"
                        unCheckedChildren="✗"
                        size="small"
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                      className="mt-1"
                    />
                  </div>
                );})}
                <Button
                  type="dashed"
                  onClick={() => add({ name: "", included: true })}
                  icon={<PlusCircleOutlined />}
                  className="w-full"
                >
                  Add Feature
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
