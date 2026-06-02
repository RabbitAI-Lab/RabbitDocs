"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ShareLayoutGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const sidebar = document.querySelector("[data-sidebar]");
    if (sidebar instanceof HTMLElement) {
      sidebar.style.display = pathname.startsWith("/share") ? "none" : "";
    }
  }, [pathname]);

  return null;
}
