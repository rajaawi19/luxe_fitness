// Canonical site URL used for SEO/OG tags.
// Override via VITE_SITE_URL when a custom domain is configured.
export const SITE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SITE_URL) ||
  "https://id-preview--b367f66d-dc3a-4eee-818a-a27521508023.lovable.app";

export const canonical = (path: string) => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL.replace(/\/$/, "")}${clean === "/" ? "" : clean}`;
};

export const ORG_NAME = "FITBLISS Gym";
export const ORG_LEGAL_NAME = "FITBLISS Gym";
export const ORG_LOGO = `${SITE_URL.replace(/\/$/, "")}/favicon.ico`;
export const ORG_SAMEAS: string[] = [];

export const organizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: ORG_NAME,
  legalName: ORG_LEGAL_NAME,
  url: SITE_URL,
  logo: ORG_LOGO,
  sameAs: ORG_SAMEAS,
});

export const websiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: ORG_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL.replace(/\/$/, "")}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});

export const webpageJsonLd = (opts: { name: string; description: string; path: string }) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: opts.name,
  description: opts.description,
  url: canonical(opts.path),
  isPartOf: { "@type": "WebSite", name: ORG_NAME, url: SITE_URL },
});

export const jsonLdScript = (data: unknown) => ({
  type: "application/ld+json" as const,
  children: JSON.stringify(data),
});
