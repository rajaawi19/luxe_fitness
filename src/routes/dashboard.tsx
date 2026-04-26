import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Activity, Calendar, Flame, LogOut, Trophy } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — RKDF Gym" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (!data.session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  const name = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Member";

  return (
    <div className="py-20">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex items-start justify-between flex-wrap gap-6 mb-16">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-gradient-gold">Member Portal</span>
            <h1 className="font-display text-5xl md:text-6xl mt-4">
              Welcome, <em className="text-gradient-gold not-italic">{name}</em>.
            </h1>
            <p className="text-muted-foreground mt-2">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full glass gold-border text-xs uppercase tracking-[0.2em] hover:bg-accent/40 transition"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: Flame, label: "Calories Today", value: "1,248" },
            { icon: Activity, label: "Active Minutes", value: "78" },
            { icon: Trophy, label: "Streak", value: "12 days" },
          ].map((s) => (
            <div key={s.label} className="p-8 rounded-2xl glass">
              <div className="h-12 w-12 rounded-xl bg-gradient-gold flex items-center justify-center mb-5 shadow-gold">
                <s.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">{s.label}</div>
              <div className="font-display text-4xl text-gradient-gold">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="p-10 rounded-3xl glass gold-border">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl">Next Session</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Your AI-curated workout is ready. Iron Sanctuary at 18:00 with Coach Aarav.
          </p>
          <button className="px-8 py-3 rounded-full bg-gradient-gold text-primary-foreground text-xs font-semibold uppercase tracking-[0.25em] shadow-gold">
            Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
}
