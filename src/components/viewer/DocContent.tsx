import React from "react";

interface DocContentProps {
  content: string;
}

// Simple markdown-to-HTML renderer for published documents
function renderMarkdown(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Horizontal rules
    .replace(/^---$/gm, "<hr />")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hulbpcdi])/gm, "<p>")
    .replace(/(?<!<\/[hulbpcdi])>$/gm, "</p>");

  // Clean up extra paragraph tags
  html = "<div class='prose-content'>" + html + "</div>";
  return html;
}

export default function DocContent({ content }: DocContentProps) {
  const html = renderMarkdown(content);

  return (
    <div
      className="prose prose-blue max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
