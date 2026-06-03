"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Spin } from "antd";
import { useAuth } from "@/components/auth/useAuth";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // 未登录：跳到登录页，登录后回到原路径
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
      return;
    }

    if (!user.isAdmin) {
      // 已登录但非管理员：回首页
      router.replace("/");
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading || !user || !user.isAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
}
