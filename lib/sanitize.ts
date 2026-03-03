/**
 * Sanitize HTML to prevent XSS in rendered note content.
 * Allows safe formatting tags, strips everything else.
 */

const ALLOWED_TAGS = new Set([
    "p", "br", "b", "strong", "i", "em", "u", "s", "strike",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "span", "div",
    "table", "thead", "tbody", "tr", "th", "td",
    "mark", "input", "img", "hr",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(["href", "title", "target"]),
    span: new Set(["class", "style"]),
    div: new Set(["class"]),
    code: new Set(["class"]),
    pre: new Set(["class"]),
    img: new Set(["src", "alt", "width", "height"]),
    input: new Set(["type", "checked", "disabled"]),
    td: new Set(["colspan", "rowspan"]),
    th: new Set(["colspan", "rowspan"]),
    li: new Set(["class"]),
};

export function sanitizeHtml(html: string): string {
    // Remove script tags and their content
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Remove on* event handlers
    clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

    // Remove javascript: URLs
    clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');

    // Remove data: URLs in src (could be used for XSS)
    clean = clean.replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, "");

    // Strip disallowed tags but keep content
    clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
        const tagLower = tag.toLowerCase();
        if (!ALLOWED_TAGS.has(tagLower)) return "";

        // For allowed tags, strip disallowed attributes
        if (match.startsWith("</")) return `</${tagLower}>`;

        const allowedAttrs = ALLOWED_ATTRS[tagLower];
        if (!allowedAttrs) {
            // No attributes allowed for this tag
            return `<${tagLower}>`;
        }

        // Extract and filter attributes
        const attrRegex = /\s([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/gi;
        const attrs: string[] = [];
        let attrMatch;
        while ((attrMatch = attrRegex.exec(match))) {
            const name = attrMatch[1].toLowerCase();
            const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
            if (allowedAttrs.has(name)) {
                attrs.push(`${name}="${value}"`);
            }
        }

        return `<${tagLower}${attrs.length ? " " + attrs.join(" ") : ""}>`;
    });

    return clean;
}
