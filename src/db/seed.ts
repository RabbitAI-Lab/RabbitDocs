import { db } from "./index";
import { accounts, templates } from "./schema";

async function seed() {
  console.log("[seed] Seeding database...");

  // 插入默认账号
  const existingAccount = db.select().from(accounts).get();
  if (!existingAccount) {
    db.insert(accounts).values({
      name: "Default",
      type: "personal",
      createdAt: new Date().toISOString(),
    }).run();
    console.log("[seed] Default account created.");
  } else {
    console.log("[seed] Default account already exists.");
  }

  // 插入预制模板
  const existingTemplates = db.select().from(templates).all();
  if (existingTemplates.length === 0) {
    const templateData = [
      {
        name: "会议纪要",
        description: "会议记录标准模板",
        icon: "📋",
        content: `# 会议纪要

## 会议信息
- **日期**：
- **参会人员**：
- **主持人**：

## 会议议程
1. 
2. 
3. 

## 讨论内容

### 议题一
- 

### 议题二
- 

## 决议事项
- 

## 待办事项
- [ ] 待办项
`,
        agentPrompt: "你是一个专业的会议记录助手。请根据用户提供的会议讨论内容，整理成结构清晰的会议纪要。包含：会议信息、议程、讨论要点、决议事项、待办事项。语言简洁正式。使用 Markdown 格式输出。",
      },
      {
        name: "项目提案",
        description: "项目提案文档模板",
        icon: "📄",
        content: `# 项目提案

## 项目概述
-

## 背景与目标
-

## 范围与交付物
-

## 时间线
-

## 资源需求
-

## 风险评估
-
`,
        agentPrompt: "你是一个项目管理顾问。请帮助用户撰写完整的项目提案文档。确保包含项目概述、背景与目标、范围与交付物、时间线、资源需求、风险评估等章节。提供专业建议。使用 Markdown 格式输出。",
      },
      {
        name: "产品需求",
        description: "产品需求文档(PRD)模板",
        icon: "📝",
        content: `# 产品需求文档

## 概述
-

## 用户故事
-

## 功能需求
-

## 非功能需求
-

## 验收标准
-

## 原型/设计稿
-
`,
        agentPrompt: "你是一个产品经理助手。请帮助用户编写产品需求文档(PRD)。确保文档包含概述、用户故事、功能需求、非功能需求、验收标准等部分。以用户价值为导向思考。使用 Markdown 格式输出。",
      },
      {
        name: "技术方案",
        description: "技术方案设计模板",
        icon: "⚙️",
        content: `# 技术方案

## 背景
-

## 架构设计
-

## 技术选型
-

## 接口设计
-

## 数据库设计
-

## 部署方案
-
`,
        agentPrompt: "你是一个资深架构师。请帮助用户撰写技术方案设计文档。确保包含背景分析、架构设计、技术选型理由、接口设计、数据库设计、部署方案等内容。注重可扩展性和可维护性。使用 Markdown 格式输出。",
      },
      {
        name: "博客文章",
        description: "博客文章模板",
        icon: "✍️",
        content: `# 文章标题

## 导语
-

## 正文
-

## 总结
-
`,
        agentPrompt: "你是一个内容创作助手。请帮助用户撰写高质量的博客文章。注重标题吸引力、内容深度、可读性和 SEO 优化。使用清晰的段落结构和适当的 Markdown 格式。",
      },
      {
        name: "发布说明",
        description: "版本发布说明模板",
        icon: "🚀",
        content: `# 发布说明

## 版本号
-

## 发布日期
-

## 新增功能
-

## 修复问题
-

## 已知问题
-

## 升级指南
-
`,
        agentPrompt: "你是一个技术文档编写助手。请帮助用户生成规范的版本发布说明。确保包含版本号、发布日期、新增功能、修复问题、已知问题、升级指南等标准章节。使用 Markdown 格式输出。",
      },
    ];

    for (const t of templateData) {
      const now = new Date().toISOString();
      db.insert(templates).values({ ...t, createdAt: now, updatedAt: now }).run();
    }
    console.log(`[seed] ${templateData.length} templates created.`);
  } else {
    console.log(`[seed] ${existingTemplates.length} templates already exist.`);
  }

  console.log("[seed] Done.");
}

seed().catch(console.error);
