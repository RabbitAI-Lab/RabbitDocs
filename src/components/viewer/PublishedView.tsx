import DocContent from "./DocContent";

interface PublishedViewProps {
  content: string;
  publishPath: string;
  segments: string[];
}

export default function PublishedView({ content, publishPath, segments }: PublishedViewProps) {
  const fileName = segments[segments.length - 1] || "Untitled";
  const fileTitle = fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{fileTitle}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Published
            </span>
            <span>{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
        </div>

        {/* Content */}
        <DocContent content={content} />
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-6 py-8 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Path: {publishPath} &nbsp;|&nbsp; Powered by ChatWiki
        </p>
      </div>
    </div>
  );
}
