"use client";

import { useTranslations } from "next-intl";

export default function SandboxPage() {
  const t = useTranslations("sandboxPage");
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('title')}</h1>
        <button
          disabled
          className="px-4 py-1.5 text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-zinc-700 rounded-lg cursor-not-allowed"
        >
          {t('createSandbox')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-2xl font-medium text-gray-400 dark:text-gray-500 mb-2">{t('comingSoon')}</h2>
          <p className="text-sm text-gray-300 dark:text-gray-600">{t('underDevelopment')}</p>
        </div>
      </div>
    </div>
  );
}
