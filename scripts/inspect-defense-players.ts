/**
 * Script to inspect what defense players are currently stored in rosters
 * This will help us understand what Sleeper defense IDs to use for projections
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectDefensePlayers() {
  try {
    console.log('🔍 Inspecting defense players in rosters...\n');

    // Get all rosters with their players
    const { data: rosters, error } = await supabase
      .from('sleeper_rosters')
      .select('roster_id, starters, players, league_id');

    if (error) {
      console.error('Error fetching rosters:', error);
      return;
    }

    console.log(`Found ${rosters?.length || 0} rosters\n`);

    const defensePlayerIds = new Set<string>();
    const defensePlayersByLeague = new Map<string, Set<string>>();

    // Inspect each roster for defense players
    for (const roster of rosters || []) {
      const leagueId = roster.league_id;
      if (!defensePlayersByLeague.has(leagueId)) {
        defensePlayersByLeague.set(leagueId, new Set());
      }

      // Check starters
      if (roster.starters && Array.isArray(roster.starters)) {
        for (const playerId of roster.starters) {
          if (typeof playerId === 'string' && playerId.length <= 4) {
            // Likely a defense player (team abbreviation)
            defensePlayerIds.add(playerId);
            defensePlayersByLeague.get(leagueId)!.add(playerId);
          }
        }
      }

      // Check all players
      if (roster.players && Array.isArray(roster.players)) {
        for (const playerId of roster.players) {
          if (typeof playerId === 'string' && playerId.length <= 4) {
            // Likely a defense player (team abbreviation)
            defensePlayerIds.add(playerId);
            defensePlayersByLeague.get(leagueId)!.add(playerId);
          }
        }
      }
    }

    console.log('🏈 Defense Player IDs found:');
    const sortedDefenseIds = Array.from(defensePlayerIds).sort();
    console.log(sortedDefenseIds.join(', '));
    console.log(`\nTotal unique defense players: ${defensePlayerIds.size}\n`);

    console.log('📊 Defense players by league:');
    for (const [leagueId, playerIds] of defensePlayersByLeague) {
      if (playerIds.size > 0) {
        console.log(`League ${leagueId}: ${Array.from(playerIds).sort().join(', ')}`);
      }
    }

    // Now let's check what these defense players look like in the players table
    if (defensePlayerIds.size > 0) {
      console.log('\n🔍 Checking defense player details in players table...');
      
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('player_id, full_name, position, team')
        .in('player_id', Array.from(defensePlayerIds));

      if (playersError) {
        console.error('Error fetching players:', playersError);
      } else {
        console.log('\nDefense player details:');
        for (const player of players || []) {
          console.log(`${player.player_id}: ${player.full_name || 'No name'} | ${player.position || 'No position'} | ${player.team || 'No team'}`);
        }
      }
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

// Run the inspection
inspectDefensePlayers().catch(console.error);
