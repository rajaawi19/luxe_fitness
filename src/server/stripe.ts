import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PLANS = {
  Basic: { amount: 99900, name: "RKDF Basic Membership" },
  Premium: { amount: 199900, name: "RKDF Premium Membership" },
  Elite: { amount: 499900, name: "RKDF Elite Membership" },
} as const;

export type PlanName = keyof typeof PLANS;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2025-03-31.basil" as any });
}

async function getUserFromRequest() {
  const auth = getRequestHeader("authorization");
  if (!auth) return null;
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: { plan: PlanName; origin: string }) => {
    if (!(input.plan in PLANS)) throw new Error("Invalid plan");
    return input;
  })
  .handler(async ({ data }) => {
    const stripe = getStripe();
    const user = await getUserFromRequest();
    if (!user) throw new Error("You must be signed in to checkout");

    const plan = PLANS[data.plan];
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "inr",
            recurring: { interval: "month" },
            product_data: { name: plan.name },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      metadata: { user_id: user.id, plan: data.plan },
      subscription_data: { metadata: { user_id: user.id, plan: data.plan } },
      success_url: `${data.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/membership`,
    });

    return { url: session.url };
  });

export const verifyCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data }) => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });

    const sub = session.subscription as Stripe.Subscription | null;
    const periodEnd = sub
      ? new Date((sub as any).current_period_end * 1000).toISOString()
      : null;

    return {
      paid: session.payment_status === "paid",
      status: session.status,
      plan: (session.metadata?.plan as PlanName) ?? null,
      email: session.customer_details?.email ?? null,
      amountTotal: session.amount_total,
      currency: session.currency,
      currentPeriodEnd: periodEnd,
      subscriptionStatus: sub?.status ?? null,
    };
  });
