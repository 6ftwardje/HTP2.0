import sanitizeHtml from "sanitize-html";

export function sanitizeArticle(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "a", "img", "figure", "figcaption", "hr", "code", "pre"],
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "width", "height", "title"], ol: ["start"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      img: (_, attributes) => ({ tagName: "img", attribs: {
        ...attributes,
        ...Object.fromEntries(["width", "height"].filter((key) => attributes[key] && (!/^\d{1,5}$/.test(attributes[key]) || Number(attributes[key]) < 1)).map((key) => [key, ""])),
        loading: "lazy", decoding: "async",
      } }),
    },
  });
}

export function articleReadingMinutes(html: string, intro?: string | null) {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  const words = `${intro ?? ""} ${text}`.trim().split(/\s+/u).filter(Boolean).length;
  return words ? Math.max(1, Math.ceil(words / 220)) : null;
}

// Platform convention, including DST. Never inherit a server's timezone.
export const MARKET_POST_TIMEZONE = "Europe/Brussels";
export function formatPostPublication(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Publicatiedatum onbekend";
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: MARKET_POST_TIMEZONE }).format(date);
}
