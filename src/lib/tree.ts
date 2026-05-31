/**
 * Tree node types and utilities.
 * This file has NO Node.js dependencies and is safe for client-side imports.
 */

export interface TreeNode {
  name: string;
  type: "directory" | "file";
  children?: TreeNode[];
  path: string; // relative path from DATA_ROOT
}

/**
 * Strip project prefix and .md suffix from tree paths.
 * Converts full paths (e.g. "personal/default/projects/{id}/Root/test.md")
 * to relative paths (e.g. "Root/test").
 */
export function stripTreePrefix(nodes: TreeNode[], prefix: string): TreeNode[] {
  return nodes.map((node) => {
    let relPath = node.path;
    if (relPath.startsWith(prefix + "/")) {
      relPath = relPath.slice(prefix.length + 1);
    } else if (relPath.startsWith(prefix)) {
      relPath = relPath.slice(prefix.length);
    }
    if (node.type === "file" && relPath.endsWith(".md")) {
      relPath = relPath.slice(0, -3);
    }
    return {
      ...node,
      path: relPath,
      ...(node.children
        ? { children: stripTreePrefix(node.children, prefix) }
        : {}),
    };
  });
}
