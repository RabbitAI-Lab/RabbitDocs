import { readDocument } from "@/lib/fs";
import { notFound } from "next/navigation";
import PublishedView from "@/components/viewer/PublishedView";

export default async function PublishPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: rawPath } = await params;
  const path = rawPath.map(decodeURIComponent);
  const content = readDocument(...path);

  if (content === null) {
    notFound();
  }

  return (
    <PublishedView
      content={content}
      publishPath={path.join("/")}
      segments={path}
    />
  );
}
