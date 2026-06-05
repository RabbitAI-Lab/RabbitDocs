"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          {t('pageLoadFailed')}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {error.message || t('unknownError')}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
