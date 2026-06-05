"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bubble, Sender, XProvider } from "@ant-design/x";
import { Tag } from "antd";
import type { Message, ChatWorkspaceProps, ChatWorkspaceRef } from "./chat-workspace-ref";
export type { Message, ChatWorkspaceProps, ChatWorkspaceRef } from "./chat-workspace-ref";
import { roles } from "./chat-constants";
import { useChatSelectors } from "./useChatSelectors";
import { useChatShare } from "./useChatShare";
import { useChatNavigation } from "./useChatNavigation";
import { useChatMessages } from "./useChatMessages";
import { mapMessagesToBubbleItems } from "./ChatBubbleItem";
import ChatInputFooter from "./ChatInputFooter";
import ChatHeader from "./ChatHeader";
import SaveToDocumentModal from "./SaveToDocumentModal";

const ChatWorkspace = forwardRef<ChatWorkspaceRef, ChatWorkspaceProps>(function ChatWorkspace({
  chatId,
  chatTitle,
  initialMessages,
  initialModelId,
  initialTemplateId,
  embedded = false,
  projectId: initialProjectId,
  projectName,
  openFileTabs,
  onBack,
  onDocumentSaved,
  mentionFile,
  onMentionConsumed,
  onToolCall,
  onSwitchToChat,
  onChatCreated,
  floating = false,
  showProjectSelector = false,
  workspaceId,
}, ref) {
  const router = useRouter();
  const t = useTranslations("chat");
  const [effectiveChatId, setEffectiveChatId] = useState<number | null>(chatId ?? null);
  const [effectiveChatTitle, setEffectiveChatTitle] = useState<string>(chatTitle);

  // Data loading + selection persistence
  const selectors = useChatSelectors({
    initialModelId,
    initialTemplateId,
    initialProjectId,
    workspaceId,
    effectiveChatId,
  });

  // Share management
  const share = useChatShare({ effectiveChatId });

  // Message state + streaming (handles send, regenerate, cancel, clear)
  const messagesApi = useChatMessages({
    effectiveChatId,
    setEffectiveChatId,
    initialMessages,
    selectedModelId: selectors.selectedModelId,
    selectedProject: selectors.selectedProject,
    selectedWorkspace: selectors.selectedWorkspace,
    workspaceId,
    selectedTemplateId: selectors.selectedTemplateId,
    templates: selectors.templates,
    projectName,
    openFileTabs,
    embedded,
    floating,
    router,
    onChatCreated,
    onToolCall,
    mentionFile,
    onMentionConsumed,
  });

  // Navigation (loadChat, history select, new chat)
  const navigation = useChatNavigation({
    effectiveChatId,
    setEffectiveChatId,
    setEffectiveChatTitle,
    setMessages: messagesApi.setMessages,
    setInputValue: messagesApi.setInputValue,
    selectedProject: selectors.selectedProject,
    selectedWorkspace: selectors.selectedWorkspace,
    setSelectedModelId: selectors.setSelectedModelId,
    setSelectedTemplateId: selectors.setSelectedTemplateId,
    setSelectedProject: selectors.setSelectedProject,
    setSelectedWorkspace: selectors.setSelectedWorkspace,
    embedded,
    floating,
    router,
    onSwitchToChat,
  });

  // Save to document modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalContent, setSaveModalContent] = useState("");

  const handleSaveToDocument = () => {
    const content = messagesApi.messages
      .map((m) => `### ${m.role === "user" ? t("roleLabels.user") : t("roleLabels.assistant")}\n\n${m.content}`)
      .join("\n\n");
    setSaveModalContent(content);
    setSaveModalOpen(true);
  };

  const handleSaveSingleMessage = (msg: Message) => {
    const roleLabel = msg.role === "user" ? t("roleLabels.user") : t("roleLabels.assistant");
    const content = `### ${roleLabel}\n\n${msg.content}`;
    setSaveModalContent(content);
    setSaveModalOpen(true);
  };

  const handleSaved = (docPath: string) => {
    setSaveModalOpen(false);
    onDocumentSaved?.();
  };

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    handleNewChat: navigation.handleNewChat,
    handleClear: messagesApi.handleClear,
    handleHistorySelect: navigation.handleHistorySelect,
    handleShare: share.handleShare,
    get effectiveChatId() { return effectiveChatId; },
    get shareOpen() { return share.shareOpen; },
    setShareOpen: share.setShareOpen,
    get shareToken() { return share.shareToken; },
    get shareLoading() { return share.shareLoading; },
    handleCopyLink: share.handleCopyLink,
    handleRegenerateLink: share.handleRegenerateLink,
    handleCancelShare: share.handleCancelShare,
  }), [floating, selectors.selectedProject, selectors.selectedWorkspace, effectiveChatId, share.shareOpen, share.shareToken, share.shareLoading]);

  // Footer renderer
  const renderFooter = ChatInputFooter({
    floating,
    embedded,
    showProjectSelector,
    models: selectors.models,
    projects: selectors.projects,
    workspaces: selectors.workspaces,
    templates: selectors.templates,
    selectedModelId: selectors.selectedModelId,
    selectedProject: selectors.selectedProject,
    selectedWorkspace: selectors.selectedWorkspace,
    selectedTemplateId: selectors.selectedTemplateId,
    onModelChange: selectors.handleModelChange,
    onProjectChange: selectors.handleProjectChange,
    onWorkspaceChange: selectors.handleWorkspaceChange,
    onTemplateChange: selectors.handleTemplateChange,
  });

  // Build bubble items
  const bubbleItems = mapMessagesToBubbleItems({
    messages: messagesApi.messages,
    loading: messagesApi.loading,
    onRegenerate: messagesApi.handleRegenerate,
    onSaveSingleMessage: handleSaveSingleMessage,
    t,
  });

  return (
    <XProvider>
    <div className="flex flex-col h-full">
      {/* Header - hidden in floating mode, rendered by FloatingChatWindow */}
      {!floating && (
        <ChatHeader
          effectiveChatTitle={effectiveChatTitle}
          effectiveChatId={effectiveChatId}
          embedded={embedded}
          onBack={onBack}
          onNewChat={navigation.handleNewChat}
          shareOpen={share.shareOpen}
          setShareOpen={share.setShareOpen}
          shareToken={share.shareToken}
          shareLoading={share.shareLoading}
          onShare={share.handleShare}
          onCopyLink={share.handleCopyLink}
          onRegenerateLink={share.handleRegenerateLink}
          onCancelShare={share.handleCancelShare}
          onHistorySelect={navigation.handleHistorySelect}
          onClear={messagesApi.handleClear}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Spacer - 空对话时撑开，把输入框推到中间；有消息时收缩 */}
        <div
          style={{
            flex: messagesApi.messages.length === 0 && !floating ? '1 1 0%' : '0 0 0px',
            minHeight: 0,
            transition: 'flex 0.5s ease',
          }}
        />

        {/* Messages area */}
        <div
          style={{
            flex: messagesApi.messages.length === 0 && !floating ? '0 0 0px' : '1 1 0%',
            minHeight: 0,
            overflow: 'hidden',
            transition: 'flex 0.5s ease',
          }}
        >
          <Bubble.List
            style={{ height: "100%", maxWidth: '48rem', margin: '0 auto' }}
            items={bubbleItems}
            role={roles}
            autoScroll
          />
        </div>

        {/* Input */}
        <div className="px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            <Sender
              value={messagesApi.inputValue}
              onChange={messagesApi.setInputValue}
              onSubmit={messagesApi.handleSend}
              loading={messagesApi.loading}
              onCancel={messagesApi.handleCancel}
              placeholder={t('input.placeholder')}
              autoSize={
                messagesApi.messages.length === 0 && !floating
                  ? { minRows: 2, maxRows: 6 }
                  : { minRows: 1, maxRows: 4 }
              }
              suffix={false}
              header={
                messagesApi.mentionedFiles.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 12px" }}>
                    {messagesApi.mentionedFiles.map((filePath) => {
                      const fileName = filePath.split("/").pop() || filePath;
                      return (
                        <Tag
                          key={filePath}
                          closable
                          onClose={() =>
                            messagesApi.setMentionedFiles((prev) =>
                              prev.filter((f) => f !== filePath)
                            )
                          }
                          style={{ margin: 0 }}
                        >
                          @{fileName}
                        </Tag>
                      );
                    })}
                  </div>
                ) : false
              }
              styles={{ root: { backgroundColor: 'var(--sender-bg)' } }}
              footer={renderFooter}
            />
          </div>
        </div>

        {/* Bottom spacer */}
        <div
          style={{
            flex: messagesApi.messages.length === 0 && !floating ? '1 1 0%' : '0 0 0px',
            minHeight: 0,
            transition: 'flex 0.5s ease',
          }}
        />
      </div>
    </div>
    <SaveToDocumentModal
      open={saveModalOpen}
      projectId={selectors.selectedProject}
      content={saveModalContent}
      onClose={() => setSaveModalOpen(false)}
      onSaved={handleSaved}
    />
    </XProvider>
  );
});

export default ChatWorkspace;
