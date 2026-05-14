## Goal

Replace the current Stripe checkout with a manual **QR-code + activation-code** flow:

1. User signs up / logs in
2. On `/membership`, clicks **Select Basic / Premium / Elite**
3. App shows a **QR code containing a UPI payment link with the exact amount** (₹999 / ₹1,999 / ₹4,999)
4. User pays via any UPI app (GPay / PhonePe / Paytm) and submits a UTR/transaction reference
5. Admin sees the pending payment in the admin dashboard, verifies it, and approves
6. On approval, the system **emails a unique activation code** to the user
7. User goes to their **Dashboard → Redeem Code**, enters the code, and the membership is activated

This removes the dependency on Stripe entirely (which is currently broken because the `STRIPE_SECRET_KEY` value is invalid — it stores `Awishek@19` instead of a real `sk_...` key).

## User flow (visual)

```text
Signup ──► Login ──► /membership ──► Select Plan
                                          │
                                          ▼
                              ┌────────────────────────┐
                              │  QR code (UPI link)    │
                              │  Amount + Plan shown   │
                              │  Submit UTR / txn ref  │
                              └────────────┬───────────┘
                                           │
                                  payment_request = pending
                                           │
                                           ▼
                              Admin dashboard verifies
                                           │
                              ┌────────────┴───────────┐
                              │ Approve  │  Reject     │
                              └────┬─────────────┬─────┘
                                   │             │
                                   ▼             ▼
                       Generate unique code    Email rejection
                       Email it to user
                                   │
                                   ▼
                       Dashboard → Redeem Code → Membership active
```

## Database changes (Lovable Cloud)

Three new tables (all with RLS):

- **`payment_requests`** — one row per "Select plan" click
  - `id`, `user_id`, `plan` (Basic/Premium/Elite), `amount`, `utr` (txn ref entered by user), `status` (`pending` / `approved` / `rejected`), `created_at`, `reviewed_at`, `reviewed_by`, `notes`

- **`activation_codes`** — generated on admin approval
  - `id`, `code` (16-char unique, e.g. `FITBLISS-XXXX-XXXX-XXXX`), `payment_request_id`, `user_id`, `plan`, `expires_at`, `redeemed_at`, `created_at`

- **`memberships`** — active membership per user
  - `id`, `user_id`, `plan`, `activated_at`, `expires_at` (activation_at + 30 days), `activation_code_id`, `status` (`active` / `expired`)

RLS:
- Users: insert/select their own `payment_requests`; select their own `activation_codes` and `memberships`; redeem their own codes
- Admins (existing `has_role(uid, 'admin')`): select/update all `payment_requests`, insert `activation_codes`

## Frontend changes

1. **`/membership`** — replace Stripe checkout call. "Select" button now creates a `payment_requests` row and routes to `/pay/$requestId`.

2. **New `/pay/$requestId`** page:
   - Shows plan name + amount
   - Renders a QR code containing a UPI payment link:
     `upi://pay?pa=<UPI_ID>&pn=FITBLISS%20Gym&am=<amount>&cu=INR&tn=<plan>-<requestId>`
   - Field to paste **UTR / transaction reference** + "I have paid" button → updates request, shows "Awaiting verification — you'll get an email with your activation code"
   - Uses `qrcode.react` (lightweight, no external API)

3. **`/dashboard`** — add a **Redeem Code** card:
   - Input for the activation code
   - On submit, calls a server function that validates the code, marks it redeemed, and creates/updates the user's `memberships` row
   - Shows current active membership status, plan, and expiry

4. **`/admin`** — add a **Pending Payments** section:
   - Lists all `payment_requests` with status = pending
   - Shows user email, plan, amount, UTR, submitted time
   - **Approve** button → generates unique code, inserts `activation_codes`, marks request approved, triggers email
   - **Reject** button with reason → marks rejected, triggers rejection email

## Backend changes (server functions)

In `src/lib/payments.functions.ts` (replaces Stripe-coupled bits):
- `createPaymentRequest({ plan })` — auth required; inserts pending row, returns id + UPI deep link + amount
- `submitPaymentProof({ requestId, utr })` — auth required; saves UTR
- `approvePaymentRequest({ requestId })` — admin only; generates code, sends email
- `rejectPaymentRequest({ requestId, reason })` — admin only
- `redeemActivationCode({ code })` — auth required; validates + activates membership

Keep `getMembershipStatus` but rewrite it to read from `memberships` table instead of Stripe.

## Email sending

Use Lovable's built-in email infrastructure (no third-party key needed):
- One email domain setup (one-time DNS step you'll be guided through)
- Two app email templates:
  - **`membership-activation-code`** — sent on approval, contains the code, plan, and amount
  - **`payment-rejected`** — sent on rejection, contains the reason

## Configuration needed from you

- **UPI ID** to receive payments (e.g. `yourname@okicici`) — stored as a secret `FITBLISS_UPI_ID`
- **Payee name** displayed on the QR (default: "FITBLISS Gym")
- (Later, when setting up emails) approval to add the email domain and DNS records

## What gets removed / cleaned up

- The Stripe BYOK integration: `src/server/stripe.ts`, `src/routes/checkout.success.tsx`, the bad `STRIPE_SECRET_KEY` secret, and Stripe-specific tracking events in `admin.ts`
- The runtime "Invalid API Key provided: Awishek@19" error goes away because Stripe is no longer called

## Deliverables checklist

- [ ] Migration: `payment_requests`, `activation_codes`, `memberships` tables + RLS
- [ ] Server functions: create / submit / approve / reject / redeem
- [ ] Frontend: rewired `/membership`, new `/pay/$requestId`, dashboard redeem card, admin pending payments panel
- [ ] Email: domain setup + 2 templates wired into approve/reject actions
- [ ] Remove Stripe code & secret
- [ ] Add `FITBLISS_UPI_ID` secret (you provide the UPI ID)

## Open question

Before I implement: please share the **UPI ID** you want to receive payments on (e.g. `something@okhdfcbank`). I'll store it as a secret. If you'd rather use a static QR image you already have, tell me — I can render that instead of generating a UPI deep link.
