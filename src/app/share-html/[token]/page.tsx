import { db } from "@/db";
import { sharedHtmlFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { readHtmlDocument } from "@/lib/fs";

/**
 * 公开分享页：根据 token 从 shared_html_files 取出 htmlPath，
 * 读取当前 .html 文件内容并用 sandbox iframe 全屏渲染。
 * 不暴露 project 结构、其他文件路径或 token 列表。
 */
export default async function SharedHtmlPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = db
    .select()
    .from(sharedHtmlFiles)
    .where(eq(sharedHtmlFiles.token, token))
    .get();
  if (!share) notFound();

  // htmlPath 是相对项目根的路径，例如 "docs/index.html"
  const segments = share.htmlPath.split("/").filter(Boolean);
  const content = readHtmlDocument(...segments);
  if (content === null) notFound();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        border: 0,
        background: "#ffffff",
      }}
    >
      {/*
        sandbox="" — 最严格隔离：
        - 禁止脚本执行
        - 禁止表单提交
        - 禁止 window.open / 弹窗
        - 禁止 top-level navigation
        - 禁止同源访问（视为 null origin）
      */}
      <iframe
        srcDoc={content}
        sandbox=""
        title="Shared HTML preview"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
        }}
      />
    </div>
  );
}
