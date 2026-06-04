"use client";

import { useEffect, useState } from "react";

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
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = `/api/share-html/${encodeURIComponent(projectId)}/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl, { method: "GET" });
      if (!res.ok) {
        setStatus({ isShared: false });
        return;
      }
      const data = await res.json();
      setStatus({
        token: data.token,
        url: data.url,
        createdAt: data.createdAt,
        isShared: !!data.isShared,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "查询分享状态失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateOrRotate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "分享失败");
      }
      const data = await res.json();
      setStatus({
        token: data.token,
        url: data.url,
        createdAt: data.createdAt,
        isShared: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "分享失败");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("确定要取消分享吗？链接将立即失效。")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(text || "取消分享失败");
      }
      setStatus({ isShared: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "取消分享失败");
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
          <h3 className="text-sm font-semibold text-gray-800">分享 HTML</h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600 mr-2" />
              加载中...
            </div>
          ) : status?.isShared ? (
            <>
              <div>
                <label className="text-xs text-gray-500">分享链接</label>
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
                    className="px-2.5 h-8 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>
                {status.createdAt && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    创建于 {new Date(status.createdAt).toLocaleString("zh-CN")}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                任何持有此链接的人都可以查看此 HTML。分享始终反映文件的最新内容，删除链接后立即失效。
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                生成一个公开链接，任何人都可以在只读沙箱 iframe 中查看此 HTML。
              </p>
              <p className="text-xs text-gray-400">
                为安全起见，iframe 使用 <code className="bg-gray-100 px-1 rounded">sandbox=&quot;&quot;</code>，脚本、表单和弹窗都会被阻止。
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
                取消分享
              </button>
              <button
                type="button"
                onClick={handleCreateOrRotate}
                disabled={busy}
                className="px-3 h-8 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
              >
                {busy ? "处理中..." : "重新生成"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 h-8 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateOrRotate}
                disabled={busy || loading}
                className="px-3 h-8 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
              >
                {busy ? "生成中..." : "生成分享链接"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
