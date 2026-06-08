"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import NavLink from "./NavLink";
import { useAuth } from "@/components/auth/useAuth";

export default function TodoNavLink() {
  const { user, isLoading, authFetch } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const t = useTranslations("sidebar");

  const fetchPendingCount = useCallback(() => {
    if (!user) return;
    return authFetch("/api/todos")
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((todos: Array<{ completed: number }> | undefined) => {
        if (!Array.isArray(todos)) return;
        setPendingCount(todos.filter((t) => t.completed === 0).length);
      })
      .catch(() => {});
  }, [user, authFetch]);

  useEffect(() => {
    if (isLoading || !user) return;
    fetchPendingCount();
    const handler = () => fetchPendingCount();
    window.addEventListener("todos-changed", handler);
    return () => window.removeEventListener("todos-changed", handler);
  }, [isLoading, user, fetchPendingCount]);

  return (
    <NavLink
      href="/todos"
      badgeCount={pendingCount}
      icon={
        <svg
          className="sidebar-icon-blue"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h11" />
        </svg>
      }
    >
      {t('todo')}
    </NavLink>
  );
}
