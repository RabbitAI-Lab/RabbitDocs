"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/useAuth";
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Descriptions,
  App,
  Tag,
  Typography,
  Divider,
} from "antd";
import { UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function ProfilePage() {
  const { user, authFetch } = useAuth();
  const { message } = App.useApp();
  const [nameForm] = Form.useForm();
  const [loadingName, setLoadingName] = useState(false);

  useEffect(() => {
    if (user?.name) {
      nameForm.setFieldValue("name", user.name);
    }
  }, [user, nameForm]);

  const handleUpdateName = async (values: { name: string }) => {
    setLoadingName(true);
    try {
      const res = await authFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        message.success("Name updated");
      } else {
        const data = await res.json();
        message.error(data.error || "Update failed");
      }
    } catch {
      message.error("Update failed");
    } finally {
      setLoadingName(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your public profile visible to other users
        </p>
      </div>

      <div className="space-y-8">
        {/* ─── Section: Basic Info ─── */}
        <section>
          <Card className="shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <Avatar size={64} icon={<UserOutlined />} className="bg-blue-100 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {user.name || user.email}
                </h2>
                <Text type="secondary">{user.email}</Text>
                {user.emailVerified && (
                  <Tag color="green" className="ml-2">Verified</Tag>
                )}
              </div>
            </div>
            <Divider className="my-4" />
            <Form
              form={nameForm}
              onFinish={handleUpdateName}
              layout="inline"
              className="mb-4"
            >
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter your name" }]}
                className="flex-1 mr-4"
              >
                <Input placeholder="Name" />
              </Form.Item>
              <Form.Item>
                <Button htmlType="submit" loading={loadingName}>
                  Save
                </Button>
              </Form.Item>
            </Form>
            <Descriptions column={2} size="small" className="!mt-2">
              <Descriptions.Item label="Account Type">{user.accountType}</Descriptions.Item>
              <Descriptions.Item label="User ID">
                <Text copyable className="text-xs">
                  {user.id}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </section>
      </div>
    </div>
  );
}
