// Canonical site URL used for SEO/OG tags.
// Override via VITE_SITE_URL when a custom domain is configured.
export const SITE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SITE_URL) ||
  "https://id-preview--b367f66d-dc3a-4eee-818a-a27521508023.lovable.app";

export const canonical = (path: string) => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL.replace(/\/$/, "")}${clean === "/" ? "" : clean}`;
};
