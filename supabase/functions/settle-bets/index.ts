import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing environment variables');
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const { league_id, week, season, game_results } = await req.json();

    if (!league_id || !week || !season || !game_results) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: league_id, week, season, game_results' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert game results
    const { error: gameError } = await supabase
      .from('game_results')
      .upsert(game_results, {
        onConflict: 'league_id,week,season,home_roster_id,away_roster_id'
      });

    if (gameError) {
      console.error('Error inserting game results:', gameError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert game results', details: gameError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active bets for this league/week/season
    const { data: activeBets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('league_id', league_id)
      .eq('status', 'active')
      .filter('terms->week', 'eq', week)
      .filter('terms->season', 'eq', season);

    if (betsError) {
      console.error('Error fetching active bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch active bets', details: betsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!activeBets || activeBets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active bets to settle', settled_count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let settledCount = 0;
    const settlementResults = [];

    // Process each active bet
    for (const bet of activeBets) {
      try {
        // Calculate bet outcome based on game results
        const outcome = calculateBetOutcome(bet, game_results);
        
        if (outcome === 'push') {
          // Handle push - return tokens to both parties
          await handlePush(bet, supabase);
          settlementResults.push({
            bet_id: bet.id,
            outcome: 'push',
            message: 'Push - bet returned to both parties'
          });
        } else {
          // Determine winner and loser
          const winner_id = outcome === 'won' ? bet.created_by : bet.accepted_by;
          const loser_id = outcome === 'won' ? bet.accepted_by : bet.created_by;
          
          // Calculate payout
          const payout_amount = bet.token_amount * 2;
          
          // Update bet status
          const { error: updateError } = await supabase
            .from('bets')
            .update({
              status: 'settled',
              settled_at: new Date().toISOString(),
              outcome: outcome,
              terms: {
                ...bet.terms,
                game_result: game_results,
                settlement_date: new Date().toISOString()
              }
            })
            .eq('id', bet.id);

          if (updateError) {
            console.error(`Error updating bet ${bet.id}:`, updateError);
            continue;
          }

          // Update token balances
          await updateTokenBalances(bet, winner_id, loser_id, payout_amount, supabase);
          
          // Create transaction records
          await createTransactionRecords(bet, winner_id, loser_id, payout_amount, outcome, supabase);
          
          settlementResults.push({
            bet_id: bet.id,
            outcome: outcome,
            winner_id: winner_id,
            payout_amount: payout_amount,
            message: `Bet settled: ${outcome}`
          });
        }
        
        settledCount++;
        
      } catch (error) {
        console.error(`Error processing bet ${bet.id}:`, error);
        settlementResults.push({
          bet_id: bet.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Bet settlement completed',
        settled_count: settledCount,
        results: settlementResults
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in settle-bets function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Calculate bet outcome based on game results and bet terms
function calculateBetOutcome(bet: any, gameResults: any): 'won' | 'lost' | 'push' {
  const { terms, type } = bet;
  
  if (!terms || !gameResults) return 'push';
  
  // Extract team information from bet type
  const match = type.match(/^(.+?)\s+([+-]\d+\.?\d*)\s+vs\s+(.+)$/);
  if (!match) return 'push';
  
  const [, teamName, spreadStr, opponentName] = match;
  const spread = parseFloat(spreadStr);
  
  // Determine which team the bet is on and their actual score
  let teamScore: number;
  let opponentScore: number;
  
  // Find the relevant game result
  const gameResult = gameResults.find((gr: any) => 
    (gr.home_roster_id.toString() === teamName || gr.away_roster_id.toString() === teamName)
  );
  
  if (!gameResult) return 'push';
  
  if (gameResult.home_roster_id.toString() === teamName) {
    teamScore = gameResult.home_roster_points;
    opponentScore = gameResult.away_roster_points;
  } else {
    teamScore = gameResult.away_roster_points;
    opponentScore = gameResult.home_roster_points;
  }
  
  // Calculate adjusted score with spread
  const adjustedScore = teamScore + spread;
  
  if (adjustedScore > opponentScore) {
    return 'won';
  } else if (adjustedScore < opponentScore) {
    return 'lost';
  } else {
    return 'push';
  }
}

// Handle push (tie) - return tokens to both parties
async function handlePush(bet: any, supabase: any) {
  // Update bet status
  await supabase
    .from('bets')
    .update({
      status: 'settled',
      settled_at: new Date().toISOString(),
      outcome: 'push',
      terms: {
        ...bet.terms,
        settlement_date: new Date().toISOString(),
        settlement_reason: 'Push - bet returned to both parties'
      }
    })
    .eq('id', bet.id);
  
  // Return tokens to both parties
  await updateTokenBalances(bet, bet.created_by, bet.accepted_by, bet.token_amount, supabase);
  
  // Create transaction records for push
  await createTransactionRecords(bet, bet.created_by, bet.accepted_by, bet.token_amount, 'push', supabase);
}

// Update token balances for winner and loser
async function updateTokenBalances(bet: any, winner_id: string, loser_id: string, payout_amount: number, supabase: any) {
  // Winner gets payout (their original bet + opponent's bet)
  await supabase.rpc('increment_token_balance', { 
    user_id: winner_id, 
    amount: payout_amount 
  });
  
  // Loser loses their bet (already deducted when bet was accepted)
  // No additional deduction needed
}

// Create transaction records for audit trail
async function createTransactionRecords(bet: any, winner_id: string, loser_id: string, payout_amount: number, outcome: string, supabase: any) {
  const transactions: any[] = [];
  
  if (outcome === 'push') {
    // Both parties get their tokens back
    transactions.push(
      {
        user_id: bet.created_by,
        league_id: bet.league_id,
        bet_id: bet.id,
        amount: bet.token_amount,
        type: 'payout_won',
        description: 'Push - bet returned'
      },
      {
        user_id: bet.accepted_by,
        league_id: bet.league_id,
        bet_id: bet.id,
        amount: bet.token_amount,
        type: 'payout_won',
        description: 'Push - bet returned'
      }
    );
  } else {
    // Winner gets payout, loser gets nothing
    transactions.push({
      user_id: winner_id,
      league_id: bet.league_id,
      bet_id: bet.id,
      amount: payout_amount,
      type: 'payout_won',
      description: `Won bet: ${bet.type}`
    });
  }
  
  if (transactions.length > 0) {
    await supabase
      .from('transactions')
      .insert(transactions);
  }
}
