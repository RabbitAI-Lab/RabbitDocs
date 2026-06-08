"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DocsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const lastLocation = localStorage.getItem("last-selected-location");
      if (lastLocation) {
        // 支持格式: "project/{id}" 或 "workspace/{id}"
        router.replace(`/${lastLocation}?openChat=true`);
        return;
      }
    } catch { /* ignore */ }
    router.replace("/chat/new");
  }, [router]);

  return null;
}
