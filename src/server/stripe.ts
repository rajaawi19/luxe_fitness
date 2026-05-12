// Compatibility shim — the project moved from Stripe to a manual UPI / QR-code
// + activation-code flow. The functions below preserve the original signatures
// used by existing UI (dashboard, checkout success page) but read from the new
// `memberships` / `payment_requests` tables instead of Stripe.

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export type PlanName = "Basic" | "Premium" | "Elite";

async function getUserFromRequest() {
  const auth = getRequestHeader("authorization");
  if (!auth) return null;
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data } = await sb.auth.getUser();
  return data.user;
}

function admin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Disabled — kept only so old imports don't break the build.
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: { plan: PlanName; origin: string }) => input)
  .handler(async () => {
    throw new Error("Online checkout is disabled. Please use the QR code flow.");
  });

export const verifyCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async () => {
    throw new Error("Online checkout is disabled.");
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: string }) => input)
  .handler(async () => {
    throw new Error("Self-serve billing is not available. Contact the gym to manage your membership.");
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: { subscriptionId: string }) => input)
  .handler(async ({ data }) => {
    const user = await getUserFromRequest();
    if (!user) throw new Error("You must be signed in");
    const sb = admin();
    await sb.from("memberships").update({ status: "expired" }).eq("user_id", user.id);
    return { status: "expired", cancelAtPeriodEnd: true, currentPeriodEnd: null };
  });

export const resumeSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: { subscriptionId: string }) => input)
  .handler(async () => {
    throw new Error("To extend your membership, please redeem a new activation code.");
  });

export const listInvoices = createServerFn({ method: "POST" }).handler(async () => {
  // No invoice provider — return empty array so the dashboard renders cleanly.
  return { invoices: [] as Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    amountDue: number;
    currency: string | null;
    created: string;
    periodStart: string | null;
    periodEnd: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    description: string | null;
  }> };
});

export const getMembershipStatus = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getUserFromRequest();
  if (!user) throw new Error("You must be signed in");
  const sb = admin();
  const { data: m } = await sb
    .from("memberships")
    .select("plan, status, activated_at, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!m) return { active: false as const };
  const isActive = m.status === "active" && new Date(m.expires_at) > new Date();
  return {
    active: isActive,
    status: m.status,
    plan: m.plan as PlanName,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: m.expires_at,
    subscriptionId: null as string | null,
    customerId: null as string | null,
  };
});
