"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface ShareHtmlButtonProps {
  projectId: string;
  /** File path relative to the project root, e.g. "docs/foo.html" */
  filePath: string;
  onClose: () => void;
}

interface ShareStatus {
  token?: string;
  url?: string;
  createdAt?: string;
  isShared: boolean;
}

export default function ShareHtmlButton({
  projectId,
  filePath,
  onClose,
}: ShareHtmlButtonProps) {
  const t = useTranslations('project');
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = `/api/share-html/${encodeURIComponent(projectId)}/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  useEffect(() => {
    fetch(apiUrl, { method: "GET" })
      .then((res) => {
        if (!res.ok) {
          setStatus({ isShared: false });
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setStatus({
            token: data.token,
            url: data.url,
            createdAt: data.createdAt,
            isShared: !!data.isShared,
          });
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t('shareHtml.queryFailed'));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateOrRotate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || t('shareHtml.shareFailed'));
      }
      const data = await res.json();
      setStatus({
        token: data.token,
        url: data.url,
        createdAt: data.createdAt,
        isShared: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shareHtml.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm(t('shareHtml.confirmCancel'))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(text || t('shareHtml.revokeFailed'));
      }
      setStatus({ isShared: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shareHtml.revokeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!status?.url) return;
    try {
      await navigator.clipboard.writeText(status.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the text inside the input
      const input = document.getElementById("share-html-url") as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.select();
      }
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[90vw] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 h-12 border-b border-gray-100 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-800">{t('shareHtml.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label={t('shareHtml.close')}
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600 mr-2" />
              {t('shareHtml.loading')}
            </div>
          ) : status?.isShared ? (
            <>
              <div>
                <label className="text-xs text-gray-500">{t('shareHtml.linkLabel')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="share-html-url"
                    readOnly
                    value={status.url || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-2 h-8 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 h-8 text-xs bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-hover)] transition-colors"
                  >
                    {copied ? t('shareHtml.copied') : t('shareHtml.copy')}
                  </button>
                </div>
                {status.createdAt && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    {t('shareHtml.createdAt', { date: new Date(status.createdAt).toLocaleString("zh-CN") })}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {t('shareHtml.shareNotice')}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {t('shareHtml.generateDesc')}
              </p>
              <p className="text-xs text-gray-400">
                {t('shareHtml.sandboxNotice')}
              </p>
            </>
          )}

          {error && (
            <div className="px-2.5 py-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 h-12 border-t border-gray-100">
          {status?.isShared ? (
            <>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={busy}
                className="px-3 h-8 text-xs text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              >
                {t('shareHtml.cancelShare')}
              </button>
              <button
                type="button"
                onClick={handleCreateOrRotate}
                disabled={busy}
                className="px-3 h-8 text-xs text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded transition-colors disabled:opacity-50"
              >
                {busy ? t('shareHtml.processing') : t('shareHtml.regenerate')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 h-8 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                {t('shareHtml.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateOrRotate}
                disabled={busy || loading}
                className="px-3 h-8 text-xs text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded transition-colors disabled:opacity-50"
              >
                {busy ? t('shareHtml.generating') : t('shareHtml.generate')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
