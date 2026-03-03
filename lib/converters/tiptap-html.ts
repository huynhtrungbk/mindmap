/**
 * Convert Tiptap JSON → HTML string and back.
 * Lightweight client-safe converter without importing full Tiptap.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TiptapNode {
    type: string;
    attrs?: Record<string, any>;
    content?: TiptapNode[];
    text?: string;
    marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

/**
 * Convert Tiptap JSON doc → HTML string
 */
export function tiptapJsonToHtml(doc: unknown): string {
    if (!doc || typeof doc !== "object") return "";
    const root = doc as TiptapNode;
    if (!root.content) return "";
    return root.content.map(renderNode).join("");
}

function renderNode(node: TiptapNode): string {
    if (node.type === "text") {
        let text = escapeHtml(node.text || "");
        if (node.marks) {
            for (const mark of node.marks) {
                text = wrapMark(mark, text);
            }
        }
        return text;
    }

    const children = (node.content || []).map(renderNode).join("");

    switch (node.type) {
        case "paragraph":
            return `<p>${children || ""}</p>`;
        case "heading": {
            const level = node.attrs?.level ?? 2;
            return `<h${level}>${children}</h${level}>`;
        }
        case "bulletList":
            return `<ul>${children}</ul>`;
        case "orderedList":
            return `<ol>${children}</ol>`;
        case "listItem":
            return `<li>${children}</li>`;
        case "taskList":
            return `<ul class="task-list">${children}</ul>`;
        case "taskItem": {
            const checked = node.attrs?.checked ? "checked" : "";
            return `<li class="task-item"><input type="checkbox" ${checked} disabled />${children}</li>`;
        }
        case "blockquote":
            return `<blockquote>${children}</blockquote>`;
        case "codeBlock": {
            const lang = node.attrs?.language || "";
            return `<pre><code class="lang-${lang}">${children}</code></pre>`;
        }
        case "code":
            return `<code>${children}</code>`;
        case "horizontalRule":
            return "<hr />";
        case "hardBreak":
            return "<br />";
        case "table":
            return `<table>${children}</table>`;
        case "tableRow":
            return `<tr>${children}</tr>`;
        case "tableCell":
            return `<td>${children}</td>`;
        case "tableHeader":
            return `<th>${children}</th>`;
        default:
            return children;
    }
}

function wrapMark(mark: { type: string; attrs?: Record<string, any> }, text: string): string {
    switch (mark.type) {
        case "bold":
        case "strong":
            return `<strong>${text}</strong>`;
        case "italic":
        case "em":
            return `<em>${text}</em>`;
        case "underline":
            return `<u>${text}</u>`;
        case "strike":
            return `<s>${text}</s>`;
        case "code":
            return `<code>${text}</code>`;
        case "link":
            return `<a href="${escapeHtml(mark.attrs?.href || "")}">${text}</a>`;
        case "highlight":
            return `<mark>${text}</mark>`;
        case "textStyle": {
            const color = mark.attrs?.color;
            return color ? `<span style="color:${escapeHtml(color)}">${text}</span>` : text;
        }
        default:
            return text;
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Convert HTML → simplified markdown (for MD view notes)
 */
export function htmlToMarkdown(html: string): string {
    if (!html) return "";
    return html
        .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
        .replace(/<b>(.*?)<\/b>/g, "**$1**")
        .replace(/<em>(.*?)<\/em>/g, "*$1*")
        .replace(/<i>(.*?)<\/i>/g, "*$1*")
        .replace(/<u>(.*?)<\/u>/g, "__$1__")
        .replace(/<s>(.*?)<\/s>/g, "~~$1~~")
        .replace(/<code>(.*?)<\/code>/g, "`$1`")
        .replace(/<a href="(.*?)">(.*?)<\/a>/g, "[$2]($1)")
        .replace(/<mark>(.*?)<\/mark>/g, "==$1==")
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<p>(.*?)<\/p>/g, "$1\n")
        .replace(/<h(\d)>(.*?)<\/h\d>/g, (_m, l, t) => "#".repeat(Number(l)) + " " + t + "\n")
        .replace(/<li class="task-item"><input type="checkbox" checked disabled \/>(.*?)<\/li>/g, "- [x] $1")
        .replace(/<li class="task-item"><input type="checkbox"  disabled \/>(.*?)<\/li>/g, "- [ ] $1")
        .replace(/<li>(.*?)<\/li>/g, "- $1\n")
        .replace(/<blockquote>(.*?)<\/blockquote>/g, "> $1\n")
        .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, "```\n$1\n```\n")
        .replace(/<hr\s*\/?>/g, "---\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
}

/**
 * Strip HTML to plain text
 */
export function htmlToPlainText(html: string): string {
    if (!html) return "";
    return html
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<\/p>/g, "\n")
        .replace(/<\/li>/g, "\n")
        .replace(/<\/h\d>/g, "\n")
        .replace(/<hr\s*\/?>/g, "\n---\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
}
