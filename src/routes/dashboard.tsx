import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Activity, Calendar, Crown, Flame, Loader2, LogOut, Settings, Trophy, XCircle } from "lucide-react";
import {
  cancelSubscription,
  createPortalSession,
  getMembershipStatus,
  resumeSubscription,
} from "@/server/stripe";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — RKDF Gym" }],
  }),
  component: DashboardPage,
});

type Membership = Awaited<ReturnType<typeof getMembershipStatus>>;

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"portal" | "cancel" | "resume" | null>(null);

  const loadMembership = useCallback(async () => {
    setMembershipLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const result = await getMembershipStatus({
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      } as any);
      setMembership(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load membership";
      toast.error(msg);
    } finally {
      setMembershipLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (!data.session) navigate({ to: "/auth" });
      else loadMembership();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, loadMembership]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  const withAuth = async <T,>(fn: (auth: string) => Promise<T>): Promise<T | null> => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return null;
    return fn(`Bearer ${sess.session.access_token}`);
  };

  const openPortal = async () => {
    setActionLoading("portal");
    try {
      const result = await withAuth((auth) =>
        createPortalSession({
          data: { origin: window.location.origin },
          headers: { Authorization: auth },
        } as any),
      );
      if (result?.url) window.location.href = result.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
      setActionLoading(null);
    }
  };

  const cancel = async () => {
    if (!membership || !("subscriptionId" in membership) || !membership.subscriptionId) return;
    if (!confirm("Cancel your membership at the end of the current period?")) return;
    setActionLoading("cancel");
    try {
      await withAuth((auth) =>
        cancelSubscription({
          data: { subscriptionId: membership.subscriptionId! },
          headers: { Authorization: auth },
        } as any),
      );
      toast.success("Membership will end at the period close");
      await loadMembership();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(null);
    }
  };

  const resume = async () => {
    if (!membership || !("subscriptionId" in membership) || !membership.subscriptionId) return;
    setActionLoading("resume");
    try {
      await withAuth((auth) =>
        resumeSubscription({
          data: { subscriptionId: membership.subscriptionId! },
          headers: { Authorization: auth },
        } as any),
      );
      toast.success("Membership resumed");
      await loadMembership();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setActionLoading(null);
    }
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

        {/* Membership card */}
        <div className="p-10 rounded-3xl glass gold-border mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Crown className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl">Your Membership</h2>
          </div>

          {membershipLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading membership…
            </div>
          ) : !membership || !membership.active && !("subscriptionId" in membership && membership.subscriptionId) ? (
            <div>
              <p className="text-muted-foreground mb-6">You don't have an active membership yet.</p>
              <Link
                to="/membership"
                className="px-8 py-3 rounded-full bg-gradient-gold text-primary-foreground text-xs font-semibold uppercase tracking-[0.25em] shadow-gold inline-block"
              >
                Choose a Plan
              </Link>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <Stat label="Tier" value={membership.plan ?? "—"} accent />
                <Stat
                  label="Status"
                  value={
                    membership.cancelAtPeriodEnd
                      ? "Canceling"
                      : (membership.status ?? "—")
                  }
                />
                <Stat
                  label={membership.cancelAtPeriodEnd ? "Ends" : "Renews"}
                  value={
                    membership.currentPeriodEnd
                      ? new Date(membership.currentPeriodEnd).toLocaleDateString()
                      : "—"
                  }
                />
                <Stat label="Auto-renew" value={membership.cancelAtPeriodEnd ? "Off" : "On"} />
              </div>

              {membership.cancelAtPeriodEnd && (
                <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
                  Your membership is set to cancel on{" "}
                  <strong>
                    {membership.currentPeriodEnd
                      ? new Date(membership.currentPeriodEnd).toLocaleDateString()
                      : "the period end"}
                  </strong>
                  . You'll keep access until then.
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={openPortal}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-gold text-primary-foreground text-xs font-semibold uppercase tracking-[0.25em] shadow-gold disabled:opacity-60"
                >
                  {actionLoading === "portal" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Settings className="h-3 w-3" />
                  )}
                  Manage Billing
                </button>

                {membership.cancelAtPeriodEnd ? (
                  <button
                    onClick={resume}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass gold-border text-xs font-semibold uppercase tracking-[0.25em] hover:bg-accent/40 disabled:opacity-60"
                  >
                    {actionLoading === "resume" && <Loader2 className="h-3 w-3 animate-spin" />}
                    Resume Membership
                  </button>
                ) : (
                  <button
                    onClick={cancel}
                    disabled={actionLoading !== null || !membership.active}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-destructive/40 text-xs font-semibold uppercase tracking-[0.25em] text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    {actionLoading === "cancel" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Cancel Membership
                  </button>
                )}

                <Link
                  to="/membership"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass text-xs font-semibold uppercase tracking-[0.25em] hover:bg-accent/40"
                >
                  Change Plan
                </Link>
              </div>
            </>
          )}
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">{label}</div>
      <div
        className={`font-display capitalize ${accent ? "text-3xl text-gradient-gold" : "text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}
