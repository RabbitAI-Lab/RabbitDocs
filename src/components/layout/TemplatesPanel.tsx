"use client";

import { useRouter } from "next/navigation";
import CollapsibleGroup from "@/components/ui/CollapsibleGroup";

interface Template {
  id: number;
  name: string;
  icon: string | null;
}

interface TemplatesPanelProps {
  templates: Template[];
}

export default function TemplatesPanel({ templates }: TemplatesPanelProps) {
  const router = useRouter();

  const handleCreate = async (template: Template) => {
    // Ensure "uncategorized" project exists, get or create it
    const projectsRes = await fetch("/api/fs/projects?type=personal&accountId=default");
    const projects = await projectsRes.json();
    let uncategorized = projects.find((p: { name: string }) => p.name === "uncategorized");

    if (!uncategorized) {
      const createRes = await fetch("/api/fs/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "personal", accountId: "default", name: "uncategorized" }),
      });
      uncategorized = await createRes.json();
    }

    const docPath = `personal/default/projects/${uncategorized.id}/docs/${template.name}`;
    const res = await fetch(`/api/templates/${template.id}`);
    const tmpl = await res.json();

    await fetch("/api/fs/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: docPath, content: tmpl.content || "" }),
    });

    router.push(`/doc/${docPath}`);
  };

  return (
    <CollapsibleGroup title="Templates" defaultOpen={false}>
      <div className="space-y-0.5">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => handleCreate(t)}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-left"
          >
            <span className="w-4 h-4 flex items-center justify-center text-xs shrink-0">
              {t.icon || "📄"}
            </span>
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </CollapsibleGroup>
  );
}
