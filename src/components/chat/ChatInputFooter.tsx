"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sender } from "@ant-design/x";
import { Dropdown } from "antd";
import { RobotOutlined, FolderOutlined, AppstoreOutlined, ProfileOutlined } from "@ant-design/icons";
import type { ModelItem, UserModelItem, ProjectItem, WorkspaceItem, TemplateItem } from "./useChatSelectors";
import { switchStyles } from "./chat-constants";

interface ChatInputFooterProps {
  floating: boolean;
  embedded: boolean;
  showProjectSelector: boolean;
  models: ModelItem[];
  userModels: UserModelItem[];
  projects: ProjectItem[];
  workspaces: WorkspaceItem[];
  templates: TemplateItem[];
  selectedModelId: number | string | undefined;
  selectedProject: string | undefined;
  selectedWorkspace: string | undefined;
  selectedTemplateId: number | undefined;
  onModelChange: (id: number | string | undefined) => void;
  onProjectChange: (id: string | undefined) => void;
  onWorkspaceChange: (id: string | undefined) => void;
  onTemplateChange: (id: number | undefined) => void;
}

export default function ChatInputFooter({
  floating,
  embedded,
  showProjectSelector,
  models,
  userModels,
  projects,
  workspaces,
  templates,
  selectedModelId,
  selectedProject,
  selectedWorkspace,
  selectedTemplateId,
  onModelChange,
  onProjectChange,
  onWorkspaceChange,
  onTemplateChange,
}: ChatInputFooterProps) {
  const t = useTranslations("chat");
  // eslint-disable-next-line react/display-name
  return (oriNode: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
      <div style={{ display: 'flex' }}>
        {/* Model selector */}
        <Dropdown
          getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
          menu={{
            items: [
              ...(selectedModelId ? [{ key: '__clear_model__', label: t('input.clearSelection') }] : []),
              // 管理员模型组
              ...(models.length > 0
                ? [{ type: 'group' as const, key: 'admin-models', label: t('input.adminModels'), children:
                    models.map((m) => ({ key: String(m.id), label: `${m.provider} / ${m.modelName}` }))
                }]
                : []),
              // 用户 BYOK 模型组
              ...(userModels.length > 0
                ? [{ type: 'group' as const, key: 'user-models', label: t('input.myModels'), children:
                    userModels.map((m) => ({ key: `byok_${m.id}`, label: `${m.provider} / ${m.modelName}` }))
                }]
                : []),
            ],
            onClick: ({ key }) => {
              if (key === '__clear_model__') {
                onModelChange(undefined);
              } else {
                // BYOK 模型 key 格式为 "byok_N"，管理员模型为数字字符串
                onModelChange(key.startsWith('byok_') ? key : Number(key));
              }
            },
            selectedKeys: selectedModelId ? [String(selectedModelId)] : [],
          }}
        >
          <Sender.Switch
            value={!!selectedModelId}
            icon={<RobotOutlined />}
            checkedChildren={models.find((m) => m.id === selectedModelId)?.modelName}
            unCheckedChildren={t('input.model')}
            styles={switchStyles}
          />
        </Dropdown>

        {/* Project/Workspace selector */}
        {((!embedded) || showProjectSelector) && (projects.length > 0 || workspaces.length > 0) && (
          <Dropdown
            getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
            menu={{
              items: [
                ...((selectedProject || selectedWorkspace)
                  ? [{ key: '__clear__', label: t('input.clearSelection') }]
                  : []),
                ...(projects.length > 0
                  ? [{ type: 'group' as const, key: 'project-group', label: t('input.project'), children:
                      projects.map((p) => ({ key: `project:${p.id}`, label: p.name }))
                  }]
                  : []),
                ...(workspaces.length > 0
                  ? [{ type: 'group' as const, key: 'workspace-group', label: t('input.workspace'), children:
                      workspaces.map((w) => ({ key: `workspace:${w.id}`, label: w.name }))
                  }]
                  : []),
              ],
              onClick: ({ key }) => {
                if (key === '__clear__') {
                  onProjectChange(undefined);
                  onWorkspaceChange(undefined);
                } else if (key.startsWith('project:')) {
                  onProjectChange(key.slice('project:'.length));
                } else if (key.startsWith('workspace:')) {
                  onWorkspaceChange(key.slice('workspace:'.length));
                }
              },
              selectedKeys: selectedProject
                ? [`project:${selectedProject}`]
                : selectedWorkspace
                  ? [`workspace:${selectedWorkspace}`]
                  : [],
            }}
          >
            <Sender.Switch
              value={!!(selectedProject || selectedWorkspace)}
              icon={selectedWorkspace ? <AppstoreOutlined /> : <FolderOutlined />}
              checkedChildren={
                selectedProject
                  ? projects.find((p) => p.id === selectedProject)?.name
                  : selectedWorkspace
                    ? workspaces.find((w) => w.id === selectedWorkspace)?.name
                    : undefined
              }
              unCheckedChildren={t('input.projectWorkspace')}
              styles={switchStyles}
            />
          </Dropdown>
        )}

        {/* Template selector */}
        {templates.length > 0 && (
          <Dropdown
            getPopupContainer={floating ? () => document.getElementById('floating-chat-window') || document.body : undefined}
            menu={{
              items: [
                ...(selectedTemplateId ? [{ key: '__clear_template__', label: t('input.clearSelection') }] : []),
                ...templates.map((t) => ({ key: String(t.id), label: t.name })),
              ],
              onClick: ({ key }) => {
                if (key === '__clear_template__') {
                  onTemplateChange(undefined);
                } else {
                  onTemplateChange(Number(key));
                }
              },
              selectedKeys: selectedTemplateId ? [String(selectedTemplateId)] : [],
            }}
          >
            <Sender.Switch
              value={!!selectedTemplateId}
              icon={<ProfileOutlined />}
              checkedChildren={templates.find((t) => t.id === selectedTemplateId)?.name}
              unCheckedChildren={t('input.template')}
              styles={switchStyles}
            />
          </Dropdown>
        )}
      </div>
      {oriNode}
    </div>
  );
}
