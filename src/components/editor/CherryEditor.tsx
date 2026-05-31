"use client";

import { useEffect, useRef } from "react";
import "cherry-markdown/dist/cherry-markdown.css";

const defaultToolbar = [
  "bold", "italic", "strikethrough", "|",
  "header", "list", "quote", "|",
  "image", "table", "code", "link", "|",
  "undo", "redo",
];

interface CherryEditorProps {
  initialValue: string;
  onChange: (markdown: string) => void;
  onSave: () => void;
  editorId?: string;
  defaultModel?: "editOnly" | "previewOnly" | "edit&preview";
  toolbarItems?: string[];
}

export default function CherryEditor({
  initialValue,
  onChange,
  onSave,
  editorId = "cherry-editor",
  defaultModel = "previewOnly",
  toolbarItems = defaultToolbar,
}: CherryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cherryRef = useRef<CherryInstance | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initCherry = async () => {
      const CherryModule = await import("cherry-markdown");
      const Cherry = CherryModule.default;

      if (!containerRef.current || cancelled) return;

      // Create a textarea that CherryMarkdown will find and wrap
      const textarea = document.createElement("textarea");
      textarea.id = editorId;
      textarea.value = initialValue;
      textarea.style.display = "none";
      containerRef.current.appendChild(textarea);

      const cherry = new Cherry({
        id: editorId,
        value: initialValue,
        editor: {
          defaultModel: defaultModel,
          height: "100%",
        },
        toolbars: {
          toolbar: toolbarItems,
          sidebar: false,
          bubble: false,
          float: false,
        },
        callback: {
          afterChange: (text: string) => {
            onChange(text);
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
            }
            saveTimerRef.current = setTimeout(() => {
              onSave();
            }, 2000);
          },
        },
        engine: {
          syntax: {
            table: {
              enableChart: false,
            },
            codeBlock: {
              wrap: true,
              lineNumber: true,
            },
          },
        },
      });

      cherryRef.current = cherry as CherryInstance;

      // Workaround: CherryMarkdown may render the .cherry wrapper inside the hidden
      // textarea, which prevents it from displaying. Move it to the container div.
      // Also apply inline styles to fix layout: toolbar on top, editor below.
      setTimeout(() => {
        if (cancelled || !containerRef.current) return;
        const wrapper = containerRef.current.querySelector(".cherry.clearfix") as HTMLElement | null;
        if (wrapper && wrapper.parentElement?.tagName === "TEXTAREA") {
          containerRef.current.appendChild(wrapper);
        }
        // Force column layout: toolbar on top, editor fills remaining space
        const cherryEl = containerRef.current.querySelector(".cherry") as HTMLElement | null;
        if (cherryEl) {
          cherryEl.style.flexDirection = "column";
          cherryEl.style.flexWrap = "nowrap";
        }
        const toolbarEl = containerRef.current.querySelector(".cherry-toolbar") as HTMLElement | null;
        if (toolbarEl) {
          // Override CherryMarkdown's flex: 0 0 100% which causes toolbar to fill entire height
          toolbarEl.style.flex = "none";
          toolbarEl.style.width = "100%";
          toolbarEl.style.height = "auto";
        }
        const editorEl = containerRef.current.querySelector(".cherry-editor") as HTMLElement | null;
        if (editorEl) {
          editorEl.style.width = "100%";
          editorEl.style.flex = "1";
          editorEl.style.minHeight = "0";
        }
        const previewerEl = containerRef.current.querySelector(".cherry-previewer") as HTMLElement | null;
        if (previewerEl) {
          previewerEl.style.width = "100%";
          previewerEl.style.flex = "1";
          previewerEl.style.minHeight = "0";
        }
      }, 100);
    };

    initCherry();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (cherryRef.current) {
        try {
          (cherryRef.current as { destroy?: () => void }).destroy?.();
        } catch {
          // ignore
        }
        cherryRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="cherry-editor-container"
      style={{ width: "100%", height: "100%", minHeight: 0 }}
    />
  );
}

// Minimal type for Cherry instance
interface CherryInstance {
  destroy?: () => void;
  getMarkdown?: () => string;
  setMarkdown?: (content: string) => void;
}
