-- Extend bets schema to match app usage and add supporting structures

-- 1) Add missing columns to bets
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS accepted_by uuid,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

-- 2) Transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  league_id uuid NOT NULL,
  bet_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can read own league transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = transactions.league_id AND lm.user_id = auth.uid()
  ));

-- 3) Token balance helper RPC
CREATE OR REPLACE FUNCTION public.increment_token_balance(user_id uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_balance integer;
BEGIN
  UPDATE public.profiles
  SET token_balance = COALESCE(token_balance, 0) + amount
  WHERE id = user_id
  RETURNING token_balance INTO new_balance;
  RETURN new_balance;
END;
$$;