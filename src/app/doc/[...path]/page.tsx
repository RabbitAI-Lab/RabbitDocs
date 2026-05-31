import { readDocument } from "@/lib/fs";
import { notFound } from "next/navigation";
import DocumentEditor from "@/components/editor/DocumentEditor";

export default async function DocPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: rawPath } = await params;
  const path = rawPath.map(decodeURIComponent);
  const fullPath = path.join("/");
  const content = readDocument(...path);

  if (content === null) {
    notFound();
  }

  const fileName = path[path.length - 1];

  return (
    <DocumentEditor
      docPath={fullPath}
      pathSegments={path}
      initialContent={content}
      fileName={fileName}
    />
  );
}
