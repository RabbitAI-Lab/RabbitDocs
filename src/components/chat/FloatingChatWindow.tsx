"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Avatar, Button, Typography, Space, Tooltip, Popover, Input } from "antd";
import {
  RobotOutlined,
  CloseOutlined,
  PlusOutlined,
  ShareAltOutlined,
  CopyOutlined,
  ReloadOutlined,
  StopOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import ChatWorkspace, { ChatWorkspaceRef } from "./ChatWorkspace";
import ChatHistoryPopover from "./ChatHistoryPopover";
import { useFloatingChat } from "./FloatingChatContext";

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 600;
const MIN_WIDTH = 380;
const MIN_HEIGHT = 400;
const EDGE_OFFSET = 24;
const HANDLE_SIZE = 6;
const CORNER_SIZE = 12;

const STORAGE_KEY = "floating-chat-state";

function loadSavedState(): { x: number; y: number; width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: { x: number; y: number; width: number; height: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const CURSOR_MAP: Record<ResizeDir, string> = {
  n: "cursor-n-resize",
  s: "cursor-s-resize",
  e: "cursor-e-resize",
  w: "cursor-w-resize",
  ne: "cursor-ne-resize",
  nw: "cursor-nw-resize",
  se: "cursor-se-resize",
  sw: "cursor-sw-resize",
};

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

export default function FloatingChatWindow() {
  const t = useTranslations("chat");
  const { isOpen, isMinimized, close, minimize, open, projectId, workspaceId, windowKey, mentionFile, setMentionFile } = useFloatingChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<ChatWorkspaceRef>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [mounted, setMounted] = useState(false);

  // Track workspace state via callback instead of reading refs during render
  const [wsState, setWsState] = useState<{ effectiveChatId: number | null; shareOpen: boolean; shareToken: string | null; shareLoading: boolean }>({
    effectiveChatId: null,
    shareOpen: false,
    shareToken: null,
    shareLoading: false,
  });
  const handleRefStateChange = useCallback((state: { effectiveChatId: number | null; shareOpen: boolean; shareToken: string | null; shareLoading: boolean }) => {
    setWsState(state);
  }, []);

  // Initialize position on first open (client-only), restore from localStorage if available
  useEffect(() => {
    if (isOpen && !mounted) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const saved = loadSavedState();

      Promise.resolve().then(() => {
        if (saved) {
          const w = clamp(saved.width, MIN_WIDTH, vw - 16);
          const h = clamp(saved.height, MIN_HEIGHT, vh - 16);
          setSize({ width: w, height: h });
          setPosition({
            x: clamp(saved.x, 0, Math.max(0, vw - w)),
            y: clamp(saved.y, 0, Math.max(0, vh - h)),
          });
        } else {
          const w = vw < 500 ? vw - 16 : DEFAULT_WIDTH;
          const h = vh < 500 ? vh - 16 : DEFAULT_HEIGHT;
          setSize({ width: w, height: h });
          setPosition({
            x: vw < 500 ? 8 : vw - w - EDGE_OFFSET,
            y: vh < 500 ? 8 : vh - h - EDGE_OFFSET,
          });
        }
        setMounted(true);
      });
    }
    if (!isOpen) {
      Promise.resolve().then(() => setMounted(false));
    }
  }, [isOpen, mounted]);

  // Keep window in viewport on browser resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition((prev) => ({
        x: clamp(prev.x, 0, Math.max(0, vw - size.width)),
        y: clamp(prev.y, 0, Math.max(0, vh - size.height)),
      }));
      setSize((prev) => ({
        width: Math.min(prev.width, vw - 16),
        height: Math.min(prev.height, vh - 16),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, size.width, size.height]);

  // Escape to minimize
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") minimize();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMinimized, minimize]);

  // --- Drag ---
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = position.x;
      const startPosY = position.y;
      let lastX = startPosX;
      let lastY = startPosY;

      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const newX = clamp(startPosX + dx, 0, Math.max(0, vw - size.width));
        const newY = clamp(startPosY + dy, 0, Math.max(0, vh - size.height));
        lastX = newX;
        lastY = newY;
        setPosition({ x: newX, y: newY });
      };

      const onUp = () => {
        document.body.style.userSelect = "";
        saveState({ x: lastX, y: lastY, width: size.width, height: size.height });
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [position.x, position.y, size.width, size.height]
  );

  // --- Resize ---
  const handleResizeStart = useCallback(
    (dir: ResizeDir) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...position };
      const startSize = { ...size };
      let lastW = startSize.width;
      let lastH = startSize.height;
      let lastPosX = startPos.x;
      let lastPosY = startPos.y;

      document.body.style.userSelect = "none";
      document.body.style.cursor = CURSOR_MAP[dir].replace("cursor-", "");

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let newW = startSize.width;
        let newH = startSize.height;
        let newX = startPos.x;
        let newY = startPos.y;

        if (dir.includes("e")) newW = clamp(startSize.width + dx, MIN_WIDTH, vw - 16);
        if (dir.includes("s")) newH = clamp(startSize.height + dy, MIN_HEIGHT, vh - 16);
        if (dir.includes("w")) {
          newW = clamp(startSize.width - dx, MIN_WIDTH, vw - 16);
          newX = clamp(startPos.x + (startSize.width - newW), 0, vw - MIN_WIDTH);
        }
        if (dir.includes("n")) {
          newH = clamp(startSize.height - dy, MIN_HEIGHT, vh - 16);
          newY = clamp(startPos.y + (startSize.height - newH), 0, vh - MIN_HEIGHT);
        }

        lastW = newW;
        lastH = newH;
        lastPosX = newX;
        lastPosY = newY;
        setSize({ width: newW, height: newH });
        setPosition({ x: newX, y: newY });
      };

      const onUp = () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        saveState({ x: lastPosX, y: lastPosY, width: lastW, height: lastH });
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [position, size]
  );

  if (!isOpen) return null;

  const portal = (
    <>
      <div
        id="floating-chat-window"
        ref={containerRef}
        className="fixed bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          zIndex: 9999,
          display: isMinimized ? "none" : "flex",
        }}
      >
      {/* Header - draggable */}
      <div
        className="flex items-center gap-2 h-10 px-3 border-b border-gray-100 dark:border-zinc-700 shrink-0 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handleDragStart}
      >
        <Avatar size={24} icon={<RobotOutlined />} style={{ backgroundColor: "#1677ff" }} />
        <Typography.Text strong className="text-sm flex-1">
          {t("floatingChat.chat")}
        </Typography.Text>
        <Space
          size={2}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* New chat */}
          <Tooltip title={t("header.newChat")}>
            <Button
              icon={<PlusOutlined />}
              size="small"
              type="text"
              onClick={() => workspaceRef.current?.handleNewChat()}
            />
          </Tooltip>
          {/* Share - only when chat exists */}
          {wsState.effectiveChatId && (
            <Popover
              open={wsState.shareOpen}
              onOpenChange={(open) => workspaceRef.current?.setShareOpen(open)}
              trigger="click"
              placement="bottomRight"
              title={t("header.shareChat")}
              content={
                <div style={{ width: 280 }}>
                  <Input.TextArea
                    readOnly
                    value={wsState.shareToken ? `${window.location.origin}/share/${wsState.shareToken}` : ""}
                    autoSize={{ minRows: 2, maxRows: 3 }}
                    style={{ fontSize: 12, marginBottom: 12 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <Button
                      icon={<CopyOutlined />}
                      size="small"
                      onClick={() => workspaceRef.current?.handleCopyLink()}
                      block
                    >
                      {t("header.copyLink")}
                    </Button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      icon={<ReloadOutlined />}
                      size="small"
                      danger
                      loading={wsState.shareLoading}
                      onClick={() => workspaceRef.current?.handleRegenerateLink()}
                      block
                    >
                      {t("header.regenerateLink")}
                    </Button>
                    <Button
                      icon={<StopOutlined />}
                      size="small"
                      danger
                      loading={wsState.shareLoading}
                      onClick={() => workspaceRef.current?.handleCancelShare()}
                      block
                    >
                      {t("header.cancelShare")}
                    </Button>
                  </div>
                </div>
              }
            >
              <Tooltip title={t("header.share")}>
                <Button
                  icon={<ShareAltOutlined />}
                  size="small"
                  type="text"
                  loading={wsState.shareLoading}
                  onClick={() => workspaceRef.current?.handleShare()}
                />
              </Tooltip>
            </Popover>
          )}
          {/* History */}
          <ChatHistoryPopover
            currentChatId={wsState.effectiveChatId}
            onSelect={(chatId: number) => workspaceRef.current?.handleHistorySelect(chatId)}
          />
        </Space>
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            minimize();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Body - ChatWorkspace */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatWorkspace
          ref={workspaceRef}
          key={windowKey}
          chatId={null}
          chatTitle={t("floatingChat.newConversation")}
          initialMessages={[]}
          embedded={false}
          floating={true}
          projectId={projectId}
          workspaceId={workspaceId}
          mentionFile={mentionFile}
          onMentionConsumed={() => setMentionFile(null)}
          onRefStateChange={handleRefStateChange}
        />
      </div>

      {/* Resize handles - edges */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: HANDLE_SIZE, cursor: "n-resize" }}
        onPointerDown={handleResizeStart("n")}
      />
      <div
        className="absolute top-0 right-0 bottom-0"
        style={{ width: HANDLE_SIZE, cursor: "e-resize" }}
        onPointerDown={handleResizeStart("e")}
      />
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: HANDLE_SIZE, cursor: "s-resize" }}
        onPointerDown={handleResizeStart("s")}
      />
      <div
        className="absolute top-0 left-0 bottom-0"
        style={{ width: HANDLE_SIZE, cursor: "w-resize" }}
        onPointerDown={handleResizeStart("w")}
      />

      {/* Resize handles - corners */}
      <div
        className="absolute"
        style={{
          top: 0,
          right: 0,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          cursor: "ne-resize",
        }}
        onPointerDown={handleResizeStart("ne")}
      />
      <div
        className="absolute"
        style={{
          top: 0,
          left: 0,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          cursor: "nw-resize",
        }}
        onPointerDown={handleResizeStart("nw")}
      />
      <div
        className="absolute"
        style={{
          bottom: 0,
          right: 0,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          cursor: "se-resize",
        }}
        onPointerDown={handleResizeStart("se")}
      />
      <div
        className="absolute"
        style={{
          bottom: 0,
          left: 0,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          cursor: "sw-resize",
        }}
        onPointerDown={handleResizeStart("sw")}
      />
      </div>

      {/* Minimized restore bubble */}
      {isMinimized && (
        <Tooltip title={t("floatingChat.restoreChat")} placement="left">
          <button
            onClick={() => open()}
            className="fixed flex items-center justify-center border-none cursor-pointer"
            style={{
              bottom: 24,
              right: 24,
              zIndex: 9999,
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "#1677ff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
          >
            <RobotOutlined style={{ color: "white", fontSize: 22 }} />
          </button>
        </Tooltip>
      )}
    </>
  );

  return createPortal(portal, document.body);
}
