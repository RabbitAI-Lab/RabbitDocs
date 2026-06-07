"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DocsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const lastProjectId = localStorage.getItem("last-selected-project");
      if (lastProjectId) {
        router.replace(`/project/${lastProjectId}?openChat=true`);
        return;
      }
    } catch { /* ignore */ }
    router.replace("/chat/new");
  }, [router]);

  return null;
}
