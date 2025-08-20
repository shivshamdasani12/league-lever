import { supabase } from "@/integrations/supabase/client";

export interface GameResult {
  league_id: string;
  week: number;
  season: number;
  home_roster_id: number;
  away_roster_id: number;
  home_score: number;
  away_score: number;
  home_roster_points: number;
  away_roster_points: number;
  status: 'scheduled' | 'live' | 'final';
  game_date: string;
}

export interface BetSettlement {
  bet_id: string;
  outcome: 'won' | 'lost' | 'push';
  winner_id: string;
  loser_id: string;
  payout_amount: number;
  settlement_reason: string;
}

export interface TokenTransaction {
  user_id: string;
  league_id: string;
  bet_id: string;
  amount: number;
  type: 'bet_placed' | 'bet_accepted' | 'payout_won' | 'payout_lost';
  description: string;
  created_at: string;
}

// Calculate bet outcome based on game results and bet terms
export const calculateBetOutcome = (
  bet: any,
  gameResult: GameResult
): 'won' | 'lost' | 'push' => {
  const { terms, type } = bet;
  
  if (!terms || !gameResult) return 'push';
  
  // Extract team information from bet type
  const match = type.match(/^(.+?)\s+([+-]\d+\.?\d*)\s+vs\s+(.+)$/);
  if (!match) return 'push';
  
  const [, teamName, spreadStr, opponentName] = match;
  const spread = parseFloat(spreadStr);
  
  // Determine which team the bet is on and their actual score
  let teamScore: number;
  let opponentScore: number;
  
  if (teamName === gameResult.home_roster_id.toString() || 
      teamName.includes(gameResult.home_roster_id.toString())) {
    teamScore = gameResult.home_roster_points;
    opponentScore = gameResult.away_roster_points;
  } else if (teamName === gameResult.away_roster_id.toString() || 
             teamName.includes(gameResult.away_roster_id.toString())) {
    teamScore = gameResult.away_roster_points;
    opponentScore = gameResult.home_roster_points;
  } else {
    return 'push'; // Can't determine team
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
};

// Settle a bet and update all related data
export const settleBet = async (
  bet: any,
  gameResult: GameResult
): Promise<BetSettlement | null> => {
  try {
    const outcome = calculateBetOutcome(bet, gameResult);
    
    if (outcome === 'push') {
      // Handle push - return tokens to both parties
      await handlePush(bet);
      return null;
    }
    
    // Determine winner and loser
    const winner_id = outcome === 'won' ? bet.created_by : bet.accepted_by;
    const loser_id = outcome === 'won' ? bet.accepted_by : bet.created_by;
    
    // Calculate payout (2x bet amount for winner)
    const payout_amount = bet.token_amount * 2;
    
    // Update bet status
    const { error: betError } = await supabase
      .from('bets')
      .update({
        status: 'settled',
        settled_at: new Date().toISOString(),
        outcome: outcome,
        terms: {
          ...bet.terms,
          game_result: gameResult,
          settlement_date: new Date().toISOString()
        }
      })
      .eq('id', bet.id);
    
    if (betError) throw betError;
    
    // Update token balances
    await updateTokenBalances(bet, winner_id, loser_id, payout_amount);
    
    // Create transaction records
    await createTransactionRecords(bet, winner_id, loser_id, payout_amount, outcome);
    
    return {
      bet_id: bet.id,
      outcome,
      winner_id,
      loser_id,
      payout_amount,
      settlement_reason: `Game result: ${gameResult.home_roster_points}-${gameResult.away_roster_points}`
    };
    
  } catch (error) {
    console.error('Error settling bet:', error);
    throw error;
  }
};

// Handle push (tie) - return tokens to both parties
const handlePush = async (bet: any) => {
  try {
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
    await updateTokenBalances(bet, bet.created_by, bet.accepted_by, bet.token_amount);
    
    // Create transaction records for push
    await createTransactionRecords(bet, bet.created_by, bet.accepted_by, bet.token_amount, 'push');
    
  } catch (error) {
    console.error('Error handling push:', error);
    throw error;
  }
};

// Update token balances for winner and loser
const updateTokenBalances = async (
  bet: any,
  winner_id: string,
  loser_id: string,
  payout_amount: number
) => {
  try {
    // Winner gets payout (their original bet + opponent's bet)
    const { error: winnerError } = await supabase
      .from('profiles')
      .update({
        token_balance: supabase.rpc('increment_token_balance', { 
          user_id: winner_id, 
          amount: payout_amount 
        })
      })
      .eq('id', winner_id);
    
    if (winnerError) throw winnerError;
    
    // Loser loses their bet (already deducted when bet was accepted)
    // No additional deduction needed
    
  } catch (error) {
    console.error('Error updating token balances:', error);
    throw error;
  }
};

// Create transaction records for audit trail
const createTransactionRecords = async (
  bet: any,
  winner_id: string,
  loser_id: string,
  payout_amount: number,
  outcome: string
) => {
  try {
    const transactions: Partial<TokenTransaction>[] = [];
    
    if (outcome === 'push') {
      // Both parties get their tokens back
      transactions.push(
        {
          user_id: bet.created_by,
          league_id: bet.league_id,
          bet_id: bet.id,
          amount: bet.token_amount,
          type: 'payout_won',
          description: `Push - bet returned`,
          created_at: new Date().toISOString()
        },
        {
          user_id: bet.accepted_by!,
          league_id: bet.league_id,
          bet_id: bet.id,
          amount: bet.token_amount,
          type: 'payout_won',
          description: `Push - bet returned`,
          created_at: new Date().toISOString()
        }
      );
    } else {
      // Winner gets payout, loser gets nothing
      transactions.push(
        {
          user_id: winner_id,
          league_id: bet.league_id,
          bet_id: bet.id,
          amount: payout_amount,
          type: 'payout_won',
          description: `Won bet: ${bet.type}`,
          created_at: new Date().toISOString()
        }
      );
    }
    
    if (transactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .insert(transactions);
      
      if (error) throw error;
    }
    
  } catch (error) {
    console.error('Error creating transaction records:', error);
    throw error;
  }
};

// Get bet history analytics for a user
export const getBetAnalytics = async (userId: string, leagueId: string) => {
  try {
    // Default analytics object
    const defaultAnalytics = {
      total_bets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      win_rate: 0,
      total_wagered: 0,
      total_won: 0,
      total_lost: 0,
      net_profit: 0,
      average_bet_size: 0,
      largest_win: 0,
      largest_loss: 0,
      current_streak: 0,
      best_streak: 0
    };

    try {
      const { data: bets, error } = await supabase
        .from('bets')
        .select('*')
        .eq('league_id', leagueId)
        .or(`created_by.eq.${userId},accepted_by.eq.${userId}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn('Error fetching bets for analytics:', error);
        return defaultAnalytics;
      }
      
      if (!bets || bets.length === 0) {
        return defaultAnalytics;
      }
      
      const analytics = { ...defaultAnalytics };
      analytics.total_bets = bets.length;
      
      let currentStreak = 0;
      let bestStreak = 0;
      
      bets.forEach(bet => {
        if (bet.status === 'settled' && bet.outcome) {
          // Determine if the user won or lost this bet
          let userWon = false;
          let userLost = false;
          
          console.log(`Processing bet ${bet.id}:`, {
            outcome: bet.outcome,
            created_by: bet.created_by,
            accepted_by: bet.accepted_by,
            user_id: userId,
            token_amount: bet.token_amount,
            isCreator: bet.created_by === userId,
            isAcceptor: bet.accepted_by === userId
          });
          
          if (bet.outcome === 'won') {
            // If user created the bet and it was won, user won
            if (bet.created_by === userId) {
              userWon = true;
              analytics.wins++;
              analytics.total_won += bet.token_amount;
              analytics.largest_win = Math.max(analytics.largest_win, bet.token_amount);
              currentStreak = Math.max(currentStreak, 0) + 1;
              console.log(`User WON as creator: +${bet.token_amount} tokens`);
            } else if (bet.accepted_by === userId) {
              // If user accepted the bet and it was won, user lost
              userLost = true;
              analytics.losses++;
              analytics.total_lost += bet.token_amount;
              analytics.largest_loss = Math.max(analytics.largest_loss, bet.token_amount);
              currentStreak = Math.min(currentStreak, 0) - 1;
              console.log(`User LOST as acceptor: -${bet.token_amount} tokens`);
            }
          } else if (bet.outcome === 'lost') {
            // If user created the bet and it was lost, user lost
            if (bet.created_by === userId) {
              userLost = true;
              analytics.losses++;
              analytics.total_lost += bet.token_amount;
              analytics.largest_loss = Math.max(analytics.largest_loss, bet.token_amount);
              currentStreak = Math.min(currentStreak, 0) - 1;
              console.log(`User LOST as creator: -${bet.token_amount} tokens`);
            } else if (bet.accepted_by === userId) {
              // If user accepted the bet and it was lost, user won
              userWon = true;
              analytics.wins++;
              analytics.total_won += bet.token_amount;
              analytics.largest_win = Math.max(analytics.largest_win, bet.token_amount);
              currentStreak = Math.max(currentStreak, 0) + 1;
              console.log(`User WON as acceptor: +${bet.token_amount} tokens`);
            }
          } else if (bet.outcome === 'push') {
            analytics.pushes++;
            currentStreak = 0;
            // For pushes, no tokens are won or lost
            console.log(`Push - no tokens won or lost`);
          }
          
          bestStreak = Math.max(bestStreak, Math.abs(currentStreak));
        }
        
        // Track total wagered (only count bets the user created)
        if (bet.created_by === userId) {
          analytics.total_wagered += bet.token_amount;
        }
      });
      
      // Calculate derived values safely
      if (analytics.wins + analytics.losses > 0) {
        analytics.win_rate = (analytics.wins / (analytics.wins + analytics.losses)) * 100;
      }
      
      // Net profit = total won - total lost
      analytics.net_profit = analytics.total_won - analytics.total_lost;
      
      console.log('Final analytics calculation:', {
        total_bets: analytics.total_bets,
        wins: analytics.wins,
        losses: analytics.losses,
        total_won: analytics.total_won,
        total_lost: analytics.total_lost,
        net_profit: analytics.net_profit,
        total_wagered: analytics.total_wagered
      });
      
      if (analytics.total_bets > 0) {
        analytics.average_bet_size = analytics.total_wagered / analytics.total_bets;
      }
      
      analytics.current_streak = currentStreak;
      analytics.best_streak = bestStreak;
      
      return analytics;
      
    } catch (fetchError) {
      console.warn('Error in bet analytics calculation:', fetchError);
      return defaultAnalytics;
    }
    
  } catch (error) {
    console.error('Error getting bet analytics:', error);
    // Return default analytics instead of throwing
    return {
      total_bets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      win_rate: 0,
      total_wagered: 0,
      total_won: 0,
      total_lost: 0,
      net_profit: 0,
      average_bet_size: 0,
      largest_win: 0,
      largest_loss: 0,
      current_streak: 0,
      best_streak: 0
    };
  }
};

// Advanced spread adjustment algorithm
export const calculateOptimalSpread = (
  originalSpread: number,
  marketConditions: {
    betVolume: number;
    acceptanceRate: number;
    timeUntilGame: number;
    teamPopularity: number;
  }
): number => {
  let adjustment = 0;
  
  // Adjust based on bet volume (more volume = tighter spread)
  if (marketConditions.betVolume > 100) {
    adjustment += 0.5;
  } else if (marketConditions.betVolume < 20) {
    adjustment -= 0.5;
  }
  
  // Adjust based on acceptance rate (low acceptance = more attractive spread)
  if (marketConditions.acceptanceRate < 0.3) {
    adjustment -= 0.5;
  } else if (marketConditions.acceptanceRate > 0.7) {
    adjustment += 0.5;
  }
  
  // Adjust based on time until game (closer = more accurate spread)
  if (marketConditions.timeUntilGame < 24) {
    adjustment *= 0.5; // Reduce adjustment as game approaches
  }
  
  // Adjust based on team popularity (popular teams = tighter spread)
  if (marketConditions.teamPopularity > 0.8) {
    adjustment += 0.3;
  }
  
  return Math.round((originalSpread + adjustment) * 10) / 10; // Round to 1 decimal
};
