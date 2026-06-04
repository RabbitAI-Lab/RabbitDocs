"use client";

import { useState } from "react";

interface TitleEditorProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
}

export default function TitleEditor({ title, onTitleChange }: TitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  const handleSubmit = () => {
    if (value.trim() && value.trim() !== title) {
      onTitleChange(value.trim());
    } else {
      setValue(title);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-6 py-2 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-700">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setValue(title);
              setEditing(false);
            }
          }}
          onBlur={handleSubmit}
          className="w-full text-xl font-bold text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none"
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-2 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-700">
      <button
        onClick={() => setEditing(true)}
        className="text-xl font-bold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-text text-left"
      >
        {title}
        <svg
          className="inline-block w-4 h-4 ml-2 text-gray-300 dark:text-gray-600 opacity-0 hover:opacity-100 transition-opacity"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  );
}
