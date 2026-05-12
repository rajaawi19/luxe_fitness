
-- payment_requests
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('Basic','Premium','Elite')),
  amount integer NOT NULL,
  utr text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','awaiting_review','approved','rejected')),
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own payment requests"
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own payment requests"
  ON public.payment_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE POLICY "Users update own pending request utr"
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending','awaiting_review'))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update any payment request"
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

-- activation_codes
CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  payment_request_id uuid NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own codes"
  ON public.activation_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE POLICY "Admins insert codes"
  ON public.activation_codes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Users mark own code redeemed"
  ON public.activation_codes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- memberships
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activation_code_id uuid REFERENCES public.activation_codes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own membership"
  ON public.memberships FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert their own membership"
  ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own membership"
  ON public.memberships FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_payment_requests_updated BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
