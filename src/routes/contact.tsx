import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { canonical } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Visit the RKDF Sanctuary in Mumbai" },
      { name: "description", content: "Visit RKDF in Mumbai or reach our concierge team for tours, private consultations, and membership inquiries — we respond within an hour." },
      { property: "og:title", content: "Contact — Visit the RKDF Sanctuary in Mumbai" },
      { property: "og:description", content: "Tour the sanctuary, book a private consultation, or speak with our concierge." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical("/contact") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Contact — Visit the RKDF Sanctuary in Mumbai" },
      { name: "twitter:description", content: "Tour the sanctuary, book a private consultation, or speak with our concierge." },
    ],
    links: [{ rel: "canonical", href: canonical("/contact") }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="py-24">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-xs uppercase tracking-[0.4em] text-gradient-gold">Concierge</span>
          <h1 className="font-display text-5xl md:text-7xl mt-6 mb-6">
            Begin the <em className="text-gradient-gold not-italic">conversation</em>.
          </h1>
          <p className="text-lg text-muted-foreground">
            Tour the sanctuary, book a private consultation, or simply say hello.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            {[
              { icon: MapPin, label: "Sanctuary", value: "Linking Road, Bandra West, Mumbai 400050" },
              { icon: Phone, label: "Direct", value: "+91 98765 43210" },
              { icon: Mail, label: "Concierge", value: "concierge@rkdf.fit" },
              { icon: Clock, label: "Hours", value: "Open 24 / 7 — every day of the year" },
            ].map((c) => (
              <div key={c.label} className="p-6 rounded-2xl glass flex items-start gap-5">
                <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold flex-shrink-0">
                  <c.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">{c.label}</div>
                  <div className="text-foreground">{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="p-10 rounded-3xl glass gold-border space-y-6"
          >
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2 block">Name</label>
              <input
                type="text"
                className="w-full bg-input/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2 block">Email</label>
              <input
                type="email"
                className="w-full bg-input/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2 block">Message</label>
              <textarea
                rows={5}
                className="w-full bg-input/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition resize-none"
                placeholder="Tell us about your goals…"
              />
            </div>
            <button
              type="submit"
              className="w-full px-6 py-4 rounded-full bg-gradient-gold text-primary-foreground text-xs font-semibold uppercase tracking-[0.25em] shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all duration-500 ease-luxury"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
