import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export type PlanName = "Basic" | "Premium" | "Elite";

const PLAN_AMOUNTS: Record<PlanName, number> = {
  Basic: 999,
  Premium: 1999,
  Elite: 4999,
};

function admin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function requireUser() {
  const auth = getRequestHeader("authorization");
  if (!auth) throw new Error("You must be signed in");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("You must be signed in");
  return data.user;
}

async function requireAdmin() {
  const user = await requireUser();
  const sb = admin();
  const { data: roles } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Error("Admin access required");
  }
  return user;
}

function buildUpiUri(opts: { amount: number; plan: PlanName; requestId: string }) {
  const upiId = process.env.RKDF_UPI_ID || "merchant@upi";
  const payeeName = process.env.RKDF_UPI_NAME || "RKDF Gym";
  const note = `${opts.plan}-${opts.requestId.slice(0, 8)}`;
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: opts.amount.toString(),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `RKDF-${block()}-${block()}-${block()}`;
}

export const createPaymentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { plan: PlanName }) => {
    if (!["Basic", "Premium", "Elite"].includes(input.plan)) throw new Error("Invalid plan");
    return input;
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = admin();
    const amount = PLAN_AMOUNTS[data.plan];

    const { data: existingMembership } = await sb
      .from("memberships")
      .select("status, expires_at, plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      existingMembership &&
      existingMembership.status === "active" &&
      new Date(existingMembership.expires_at) > new Date()
    ) {
      // allow upgrade — don't block, just inform via response
    }

    const { data: row, error } = await sb
      .from("payment_requests")
      .insert({ user_id: user.id, plan: data.plan, amount, status: "pending" })
      .select("id, plan, amount, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      plan: row.plan as PlanName,
      amount: row.amount,
      status: row.status,
      createdAt: row.created_at,
      upi: buildUpiUri({ amount, plan: data.plan, requestId: row.id }),
      payeeName: process.env.RKDF_UPI_NAME || "RKDF Gym",
      upiId: process.env.RKDF_UPI_ID || "merchant@upi",
    };
  });

export const getPaymentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = admin();
    const { data: row, error } = await sb
      .from("payment_requests")
      .select("id, plan, amount, status, utr, notes, created_at, user_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row.user_id !== user.id) throw new Error("Not authorized");
    return {
      id: row.id,
      plan: row.plan as PlanName,
      amount: row.amount,
      status: row.status,
      utr: row.utr,
      notes: row.notes,
      createdAt: row.created_at,
      upi: buildUpiUri({ amount: row.amount, plan: row.plan as PlanName, requestId: row.id }),
      payeeName: process.env.RKDF_UPI_NAME || "RKDF Gym",
      upiId: process.env.RKDF_UPI_ID || "merchant@upi",
    };
  });

export const submitPaymentProof = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; utr: string }) => {
    const utr = (input.utr || "").trim();
    if (utr.length < 6 || utr.length > 64) throw new Error("Enter a valid UPI transaction reference");
    return { id: input.id, utr };
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = admin();
    const { data: row, error: e1 } = await sb
      .from("payment_requests")
      .select("id, user_id, status")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    if (row.user_id !== user.id) throw new Error("Not authorized");
    if (!["pending", "awaiting_review"].includes(row.status)) throw new Error("This request can no longer be updated");

    const { error: e2 } = await sb
      .from("payment_requests")
      .update({ utr: data.utr, status: "awaiting_review" })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const listPendingPayments = createServerFn({ method: "POST" })
  .inputValidator((input: { status?: "pending" | "awaiting_review" | "approved" | "rejected" | "all" }) => input ?? {})
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = admin();
    const status = data.status ?? "awaiting_review";
    let q = sb
      .from("payment_requests")
      .select("id, user_id, plan, amount, utr, status, notes, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") q = q.eq("status", status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Attach user emails
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const emails: Record<string, string | null> = {};
    for (const id of userIds) {
      const { data: u } = await sb.auth.admin.getUserById(id);
      emails[id] = u.user?.email ?? null;
    }

    return {
      requests: (rows ?? []).map((r: any) => ({
        ...r,
        email: emails[r.user_id] ?? null,
      })),
    };
  });

export const approvePaymentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const reviewer = await requireAdmin();
    const sb = admin();
    const { data: req, error: e1 } = await sb
      .from("payment_requests")
      .select("id, user_id, plan, status")
      .eq("id", data.id)
      .single();
    if (e1) throw new Error(e1.message);
    if (req.status === "approved") throw new Error("Already approved");
    if (req.status === "rejected") throw new Error("This request was rejected");

    // Generate unique code
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await sb
        .from("activation_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
      code = genCode();
    }

    const { data: ac, error: e2 } = await sb
      .from("activation_codes")
      .insert({
        code,
        payment_request_id: req.id,
        user_id: req.user_id,
        plan: req.plan,
      })
      .select("id, code, plan, expires_at")
      .single();
    if (e2) throw new Error(e2.message);

    await sb
      .from("payment_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewer.id })
      .eq("id", req.id);

    return { ok: true, code: ac.code, plan: ac.plan, expiresAt: ac.expires_at };
  });

export const rejectPaymentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const reviewer = await requireAdmin();
    const sb = admin();
    const { error } = await sb
      .from("payment_requests")
      .update({
        status: "rejected",
        notes: data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer.id,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyActivationCodes = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  const sb = admin();
  const { data, error } = await sb
    .from("activation_codes")
    .select("id, code, plan, expires_at, redeemed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { codes: data ?? [] };
});

export const redeemActivationCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    const code = (input.code || "").trim().toUpperCase();
    if (code.length < 8) throw new Error("Enter a valid activation code");
    return { code };
  })
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = admin();

    const { data: ac, error: e1 } = await sb
      .from("activation_codes")
      .select("id, code, plan, user_id, expires_at, redeemed_at")
      .eq("code", data.code)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!ac) throw new Error("Invalid code");
    if (ac.user_id !== user.id) throw new Error("This code belongs to a different account");
    if (ac.redeemed_at) throw new Error("This code has already been redeemed");
    if (new Date(ac.expires_at) < new Date()) throw new Error("This code has expired");

    // Activate / extend membership: 30 days from today (or extend existing expiry, whichever later)
    const now = new Date();
    const baseExpiry = new Date();
    baseExpiry.setDate(baseExpiry.getDate() + 30);

    const { data: existing } = await sb
      .from("memberships")
      .select("id, expires_at, status")
      .eq("user_id", user.id)
      .maybeSingle();

    let newExpiry = baseExpiry;
    if (existing && existing.status === "active" && new Date(existing.expires_at) > now) {
      const extended = new Date(existing.expires_at);
      extended.setDate(extended.getDate() + 30);
      newExpiry = extended;
    }

    if (existing) {
      const { error: e2 } = await sb
        .from("memberships")
        .update({
          plan: ac.plan,
          status: "active",
          activated_at: now.toISOString(),
          expires_at: newExpiry.toISOString(),
          activation_code_id: ac.id,
        })
        .eq("id", existing.id);
      if (e2) throw new Error(e2.message);
    } else {
      const { error: e3 } = await sb.from("memberships").insert({
        user_id: user.id,
        plan: ac.plan,
        status: "active",
        activated_at: now.toISOString(),
        expires_at: newExpiry.toISOString(),
        activation_code_id: ac.id,
      });
      if (e3) throw new Error(e3.message);
    }

    await sb
      .from("activation_codes")
      .update({ redeemed_at: now.toISOString() })
      .eq("id", ac.id);

    return { ok: true, plan: ac.plan, expiresAt: newExpiry.toISOString() };
  });
