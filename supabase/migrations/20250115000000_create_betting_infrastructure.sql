-- Create game_results table for tracking actual game outcomes
CREATE TABLE IF NOT EXISTS public.game_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    season INTEGER NOT NULL,
    home_roster_id INTEGER NOT NULL,
    away_roster_id INTEGER NOT NULL,
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    home_roster_points DECIMAL(8,2) NOT NULL,
    away_roster_points DECIMAL(8,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'final')) DEFAULT 'scheduled',
    game_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(league_id, week, season, home_roster_id, away_roster_id)
);

-- Create transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bet_placed', 'bet_accepted', 'payout_won', 'payout_lost')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add token_balance column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'token_balance') THEN
        ALTER TABLE public.profiles ADD COLUMN token_balance INTEGER DEFAULT 1000;
    END IF;
END $$;

-- Create function to increment token balance
CREATE OR REPLACE FUNCTION increment_token_balance(user_id UUID, amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles 
    SET token_balance = token_balance + amount 
    WHERE id = user_id;
    
    RETURN (SELECT token_balance FROM public.profiles WHERE id = user_id);
END;
$$;

-- Create function to decrement token balance
CREATE OR REPLACE FUNCTION decrement_token_balance(user_id UUID, amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles 
    SET token_balance = GREATEST(0, token_balance - amount)
    WHERE id = user_id;
    
    RETURN (SELECT token_balance FROM public.profiles WHERE id = user_id);
END;
$$;

-- Create function to settle bets based on game results
CREATE OR REPLACE FUNCTION settle_bets_for_game(
    p_league_id UUID,
    p_week INTEGER,
    p_season INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_game_result RECORD;
    v_bet RECORD;
    v_settled_count INTEGER := 0;
    v_outcome TEXT;
    v_winner_id UUID;
    v_loser_id UUID;
BEGIN
    -- Get the game result
    SELECT * INTO v_game_result
    FROM public.game_results
    WHERE league_id = p_league_id 
      AND week = p_week 
      AND season = p_season
      AND status = 'final';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No final game result found for league %, week %, season %', p_league_id, p_week, p_season;
    END IF;
    
    -- Process all active bets for this matchup
    FOR v_bet IN 
        SELECT * FROM public.bets 
        WHERE league_id = p_league_id 
          AND terms->>'week' = p_week::TEXT
          AND terms->>'season' = p_season::TEXT
          AND status = 'active'
    LOOP
        -- Calculate outcome based on bet type and game result
        -- This is a simplified version - in practice, you'd want more sophisticated logic
        v_outcome := 'won'; -- Placeholder - implement actual logic
        
        -- Update bet status
        UPDATE public.bets 
        SET status = 'settled',
            settled_at = now(),
            outcome = v_outcome,
            terms = jsonb_set(terms, '{game_result}', to_jsonb(v_game_result))
        WHERE id = v_bet.id;
        
        -- Update token balances
        IF v_outcome = 'won' THEN
            v_winner_id := v_bet.created_by;
            v_loser_id := v_bet.accepted_by;
        ELSE
            v_winner_id := v_bet.accepted_by;
            v_loser_id := v_bet.created_by;
        END IF;
        
        -- Winner gets payout
        PERFORM increment_token_balance(v_winner_id, v_bet.token_amount * 2);
        
        -- Create transaction records
        INSERT INTO public.transactions (user_id, league_id, bet_id, amount, type, description)
        VALUES (v_winner_id, p_league_id, v_bet.id, v_bet.token_amount * 2, 'payout_won', 'Won bet: ' || v_bet.type);
        
        v_settled_count := v_settled_count + 1;
    END LOOP;
    
    RETURN v_settled_count;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_results_league_week_season ON public.game_results(league_id, week, season);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_league_id ON public.transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bet_id ON public.transactions(bet_id);
CREATE INDEX IF NOT EXISTS idx_bets_league_week_season ON public.bets(league_id, (terms->>'week'), (terms->>'season'));

-- Enable RLS
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_results
CREATE POLICY "Game results are viewable by league members" ON public.game_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.league_members 
            WHERE league_id = game_results.league_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Game results can be created by service role" ON public.game_results
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Game results can be updated by service role" ON public.game_results
    FOR UPDATE USING (true);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions" ON public.transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Transactions can be created by service role" ON public.transactions
    FOR INSERT WITH CHECK (true);

-- RLS Policies for profiles (token balance)
CREATE POLICY "Users can view their own token balance" ON public.profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own token balance" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.game_results TO anon, authenticated;
GRANT ALL ON public.transactions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_token_balance(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_token_balance(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION settle_bets_for_game(UUID, INTEGER, INTEGER) TO anon, authenticated;
