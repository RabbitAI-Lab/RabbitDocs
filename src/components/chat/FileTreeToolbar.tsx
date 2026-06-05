"use client";

import { useTranslations } from "next-intl";

interface FileTreeToolbarProps {
  onCreateFile: () => void;
  onCreateDir: () => void;
  disabled: boolean;
}

export default function FileTreeToolbar({ onCreateFile, onCreateDir, disabled }: FileTreeToolbarProps) {
  const t = useTranslations("chat");
  return (
    <div className="px-2 py-1.5 border-b border-gray-100 flex gap-1">
      <button
        onClick={() => onCreateFile()}
        disabled={disabled}
        className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        {t('document')}
      </button>
      <button
        onClick={() => onCreateDir()}
        disabled={disabled}
        className="flex items-center gap-1.5 flex-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        {t('folder')}
      </button>
    </div>
  );
}
