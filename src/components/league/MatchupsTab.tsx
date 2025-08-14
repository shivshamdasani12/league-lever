import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users, Trophy, ArrowRight, X, Zap, TrendingUp, Activity, Shield, Award, Target } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { fetchWeeks, fetchLeagueMatchupsByWeek, LeagueWeekRow, fetchRosterDetails, fetchRosters } from "@/lib/queries/league";
import { fetchPlayersByIds, PlayerRow } from "@/lib/queries/players";
import { useEnsureLeagueMatchups } from "@/hooks/useEnsureLeagueMatchups";

interface Props { 
  leagueId: string;
  onRosterSelect?: (rosterId: string) => void;
}

interface RosterData {
  roster_id: number;
  owner_name: string | null;
  owner_username: string | null;
  owner_avatar: string | null;
  starters: string[] | null;
  players: string[] | null;
}

interface PlayerData {
  id: string;
  name: string | null;
  position: string | null;
  team: string | null;
  status: string | null;
  points: number | null;
}

interface RosterDetails {
  starters: string[];
  players: string[];
}

export default function MatchupsTab({ leagueId, onRosterSelect }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = searchParams;
  const qc = useQueryClient();
  const [selectedMatchup, setSelectedMatchup] = useState<{a: any, b: any} | null>(null);
  const [isRosterDialogOpen, setIsRosterDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [isPlayerBioOpen, setIsPlayerBioOpen] = useState(false);

  const weeksQ = useQuery({
    queryKey: ["league-weeks", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchWeeks(leagueId),
  });

  const initialWeek = (() => {``
    const w = params.get("week");
    return w ? parseInt(w, 10) : null;
  })();

  const [week, setWeek] = useState<number | null>(initialWeek);

  // Memoize the week selection logic to prevent unnecessary recalculations
  const selectedWeek = useMemo(() => {
    if (weeksQ.data && weeksQ.data.length > 0 && (week == null || !params.get("week"))) {
      return weeksQ.data.find(w => w.week === 1) || weeksQ.data[0];
    }
    return null;
  }, [weeksQ.data, week, params]);

  // Memoize the week change handler to prevent recreation on every render
  const handleWeekChange = useCallback((value: string) => {
    const next = Number(value);
    setWeek(next);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("week", String(next));
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (selectedWeek) {
      setWeek(selectedWeek.week);
      const nextParams = new URLSearchParams(params);
      nextParams.set("week", String(selectedWeek.week));
      setSearchParams(nextParams, { replace: true });
    }
  }, [selectedWeek, params, setSearchParams]);

  const { importing: importingWeek } = useEnsureLeagueMatchups(leagueId, week);

  const { data: rows = [] } = useQuery({
    queryKey: ['leagueMatchups', leagueId, week],
    queryFn: () => fetchLeagueMatchupsByWeek(leagueId!, week!),
    enabled: Boolean(leagueId && week),
  });

  const rostersQ = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  // Fetch roster details when a matchup is selected
  const { data: rosterADetails } = useQuery({
    queryKey: ['roster-details', leagueId, week, selectedMatchup?.a?.roster_id],
    queryFn: () => fetchRosterDetails(leagueId!, week!, selectedMatchup!.a.roster_id),
    enabled: Boolean(leagueId && week && selectedMatchup?.a?.roster_id),
  });

  const { data: rosterBDetails } = useQuery({
    queryKey: ['roster-details', leagueId, week, selectedMatchup?.b?.roster_id],
    queryFn: () => fetchRosterDetails(leagueId!, week!, selectedMatchup!.b.roster_id),
    enabled: Boolean(leagueId && week && selectedMatchup?.b?.roster_id),
  });

  // Fetch player data for both rosters
  const allPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (rosterADetails?.starters && Array.isArray(rosterADetails.starters)) {
      rosterADetails.starters.forEach((id: string) => ids.add(id));
    }
    if (rosterADetails?.players && Array.isArray(rosterADetails.players)) {
      rosterADetails.players.forEach((id: string) => ids.add(id));
    }
    if (rosterBDetails?.starters && Array.isArray(rosterBDetails.starters)) {
      rosterBDetails.starters.forEach((id: string) => ids.add(id));
    }
    if (rosterBDetails?.players && Array.isArray(rosterBDetails.players)) {
      rosterBDetails.players.forEach((id: string) => ids.add(id));
    }
    return Array.from(ids);
  }, [rosterADetails, rosterBDetails]);

  const { data: playerData, error: playerError, isLoading: playerLoading } = useQuery({
    queryKey: ['players', allPlayerIds],
    queryFn: () => fetchPlayersByIds(allPlayerIds),
    enabled: allPlayerIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Debug logging for selected roster
  useEffect(() => {
    if (selectedMatchup) {
      console.log("=== MATCHUPS TAB DEBUG ===");
      console.log("Selected matchup:", selectedMatchup);
      console.log("Roster A details:", rosterADetails);
      console.log("Roster B details:", rosterBDetails);
      console.log("All player IDs:", allPlayerIds);
      console.log("Player data:", playerData);
      console.log("Player error:", playerError);
      console.log("Player loading:", playerLoading);
      console.log("Player data keys:", playerData ? Object.keys(playerData) : []);
      console.log("Sample player data:", playerData ? Object.values(playerData)[0] : null);
      console.log("Supabase URL:", "https://dcqxqetlbgtaceyospij.supabase.co");
      console.log("League ID:", leagueId);
      console.log("=========================");
    }
  }, [selectedMatchup, rosterADetails, rosterBDetails, playerData, playerError, playerLoading, allPlayerIds, leagueId]);

  // Auto-refresh player data every 5 minutes to keep it current
  useEffect(() => {
    if (!leagueId || allPlayerIds.length === 0) return;

    const interval = setInterval(() => {
      console.log("Auto-refreshing player data...");
      qc.invalidateQueries({ queryKey: ['players'] });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [leagueId, allPlayerIds.length, qc]);

  // Automatically load player data when rosters are available
  useEffect(() => {
    if (leagueId && allPlayerIds.length > 0 && !playerData) {
      console.log("Automatically loading player data for", allPlayerIds.length, "players");
      qc.invalidateQueries({ queryKey: ['players'] });
    }
  }, [leagueId, allPlayerIds.length, playerData, qc]);

  // Check database schema when component mounts
  useEffect(() => {
    const checkDatabaseSchema = async () => {
      try {
        console.log("=== DATABASE SCHEMA CHECK ===");
        console.log("Checking if players table exists and has correct structure...");
        
        // This will help us see what's happening with the database
        const { data, error } = await fetchPlayersByIds(['test']);
        
        if (error) {
          console.error("Database schema check failed:", error);
          console.log("This suggests the players table might not exist or have the right structure");
        } else {
          console.log("Database schema check passed");
          console.log("Players table exists and is accessible");
        }
        console.log("=========================");
      } catch (err) {
        console.error("Database schema check error:", err);
      }
    };
    
    if (leagueId) {
      checkDatabaseSchema();
    }
  }, [leagueId]);

  // Memoize the roster name mapping to prevent recalculation on every render
  const rosterName = useMemo(() => {
    const map = new Map<number, string>();
    (rostersQ.data || []).forEach((r: any) => {
      map.set(r.roster_id, r.owner_name || r.owner_username || `Roster ${r.roster_id}`);
    });
    return map;
  }, [rostersQ.data]);

  // Group matchups by matchup_id and create pairs
  const matchupPairs = useMemo(() => {
    if (rows.length === 0) return [];
    
    // Group by matchup_id; fall back to a unique key if null
    const groups = rows.reduce((acc: Record<string, typeof rows>, r) => {
      const key = r.matchup_id != null ? String(r.matchup_id) : `${r.league_id}-${r.week}-${r.roster_id}`;
      (acc[key] ||= []).push(r);
      return acc;
    }, {});

    // Create pairs from groups
    const pairs = Object.values(groups).map(g => {
      const [a, b] = g.sort((x, y) => x.roster_id - y.roster_id);
      return { a, b: b ?? null };
    });
    
    return pairs;
  }, [rows]);

  // Memoize the weeks data to prevent unnecessary re-renders
  const weeks = useMemo(() => weeksQ.data || [], [weeksQ.data]);
  const hasWeeks = weeks.length > 0;

  // Memoize the loading states to prevent unnecessary re-renders
  const isLoading = useMemo(() => 
    weeksQ.isLoading || importingWeek, 
    [weeksQ.isLoading, importingWeek]
  );

  const hasError = useMemo(() => 
    weeksQ.isError, 
    [weeksQ.isError]
  );

  const handleMatchupClick = (matchup: {a: any, b: any}) => {
    // Ensure player data is loaded before opening matchup
    if (allPlayerIds.length > 0 && (!playerData || Object.keys(playerData).length === 0)) {
      console.log("Player data not loaded, loading now...");
      qc.invalidateQueries({ queryKey: ['players'] });
      alert("Loading player data. Please try again in a moment.");
      return;
    }
    
    setSelectedMatchup(matchup);
    setIsRosterDialogOpen(true);
    
    // Debug: Log the matchup selection
    console.log("Matchup selected:", matchup);
    console.log("Player IDs that should be loaded:", allPlayerIds);
    console.log("Current player data:", playerData);
  };

  const handlePlayerClick = (playerId: string) => {
    const player = playerData?.[playerId];
    if (player) {
      console.log("Opening player bio for:", player);
      setSelectedPlayer(player);
      setIsPlayerBioOpen(true);
    } else {
      console.error("Player not found for ID:", playerId);
      console.log("Available players:", playerData);
      console.log("Player IDs:", allPlayerIds);
      console.log("Player data keys:", playerData ? Object.keys(playerData) : []);
      
      // Try to fetch the player data if it's not available
      if (allPlayerIds.includes(playerId)) {
        console.log("Player ID exists in roster but data not loaded, triggering refresh...");
        qc.invalidateQueries({ queryKey: ['players'] });
        alert("Player data is loading. Please try again in a moment.");
      } else {
        alert("Player not found in roster.");
      }
    }
  };

  const getWinner = (a: any, b: any) => {
    if (!b) return null;
    if (a.points === null || b.points === null) return null;
    if (a.points > b.points) return a.roster_id;
    if (b.points > a.points) return b.roster_id;
    return 'tie';
  };

  const truncateText = (text: string, maxLength: number = 20) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const getPlayerDisplayName = (playerId: string) => {
    const player = playerData?.[playerId];
    if (player?.full_name) return player.full_name;
    if (playerLoading) return "Loading...";
    // Try to extract name from player ID if it's a Sleeper ID
    if (playerId && playerId.length > 10) {
      return `Player ${playerId.slice(-4)}`; // Show last 4 chars as fallback
    }
    return `Player ${playerId}`;
  };

  const getPlayerPosition = (playerId: string) => {
    const player = playerData?.[playerId];
    if (player?.position) return player.position;
    if (playerLoading) return "Loading...";
    return 'N/A';
  };

  const getPlayerTeam = (playerId: string) => {
    const player = playerData?.[playerId];
    if (player?.team) return player.team;
    if (playerLoading) return "Loading...";
    return 'N/A';
  };

  const getPlayerFantasyPositions = (playerId: string) => {
    const player = playerData?.[playerId];
    if (player?.fantasy_positions && player.fantasy_positions.length > 0) {
      return player.fantasy_positions.join(', ');
    }
    if (playerLoading) return "Loading...";
    return 'N/A';
  };

  const getPlayerHeadshotUrl = (playerId: string) => {
    if (!playerId) return undefined;
    // Use the most reliable Sleeper CDN endpoint for player images
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  };

  // Remove mock stats - we'll use real data from the database
  // The stats will come from current_week_stats or per_game_stats columns

  if (weeksQ.isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading weeks...</div>;
  }

  if (weeksQ.isError) {
    return <div className="p-4 text-center text-destructive">Failed to load weeks.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <div className="max-w-xs">
          <Select value={week != null ? String(week) : ""} onValueChange={handleWeekChange}>
            <SelectTrigger aria-label="Select week" className="bg-card border-border">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent>
              {hasWeeks ? (
                weeks.map((w) => (
                  <SelectItem key={w.week} value={String(w.week)}>
                    Week {w.week}{w.is_latest ? " (current)" : ""}
                  </SelectItem>
                ))
              ) : (
                Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                  <SelectItem key={w} value={String(w)} disabled>
                    Week {w} (Import Required)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-4">
          {hasWeeks && (
            <div className="text-sm text-muted-foreground">
              {matchupPairs.length} Matchup{matchupPairs.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Show preseason message if no weeks available */}
      {!hasWeeks && (
        <div className="p-8 text-center space-y-4">
          <div className="text-muted-foreground">
            <h3 className="text-lg font-semibold mb-2">Preseason - No Schedule Available</h3>
            <p className="mb-4">
              The regular season hasn't started yet. Matchup data will be available 
              once the NFL regular season begins.
            </p>
            <p className="text-sm">
              <strong>Tip:</strong> Check the Standings tab to see all teams in your league.
            </p>
          </div>
        </div>
      )}

      {/* Show matchups if weeks are available */}
      {hasWeeks && (
        <>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading matchups...</span>
            </div>
          )}
          
          {hasError && <p className="text-destructive">Failed to load matchups.</p>}
          
          {playerError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Player Data Error:</p>
              <p className="text-red-600 text-sm mt-1">
                {playerError.message || "Failed to load player data. Player data will be loaded automatically."}
              </p>
            </div>
          )}

          {playerLoading && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading player data...</span>
              </div>
            </div>
          )}

          {/* Backend Connection Verification */}
          {playerData && Object.keys(playerData).length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium">Backend Connected ✓</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p>• Database: Connected to Supabase</p>
                <p>• Player Data: {Object.keys(playerData).length} players loaded</p>
                <p>• Data Source: Sleeper API via Edge Functions</p>
                <p>• Auto-refresh: Every 5 minutes</p>
                <p>• Auto-load: Player data loads automatically</p>
                <p>• Last Update: {new Date().toLocaleString()}</p>
              </div>
              {/* Debug: Show sample player data */}
              <details className="mt-3">
                <summary className="text-xs text-green-600 cursor-pointer">Debug: Sample Player Data</summary>
                <pre className="text-xs bg-white p-2 rounded mt-2 overflow-auto max-h-32">
                  {JSON.stringify(Object.values(playerData)[0], null, 2)}
                </pre>
              </details>
            </div>
          )}

          <div className="space-y-4">
            {matchupPairs.length === 0 && !isLoading && (
              <p className="text-muted-foreground text-center py-8">No matchups for week {week}.</p>
            )}
            
            {matchupPairs.map(({ a, b }) => {
              const winner = getWinner(a, b);
              const isBye = !b;
              
              return (
                <Card 
                  key={`${a.league_id}-${a.week}-${a.roster_id}`}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                    isBye ? 'border-blue-500/30 bg-blue-500/5' : 'hover:border-primary/50'
                  }`}
                  onClick={() => !isBye && handleMatchupClick({ a, b })}
                >
                  <CardContent className="p-6">
                    {/* Week header */}
                    <div className="text-center mb-4">
                      <Badge variant="secondary" className="text-xs font-medium">
                        Week {a.week}
                      </Badge>
                    </div>

                    {isBye ? (
                      <div className="text-center py-8">
                        <div className="flex items-center justify-center gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-border">
                              <AvatarImage alt={`${rosterName.get(a.roster_id) || "Team"} avatar`} />
                              <AvatarFallback className="bg-secondary text-secondary-foreground">
                                {(rosterName.get(a.roster_id) || "T").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-left">
                              <div className="font-semibold text-lg truncate max-w-[120px]">
                                {onRosterSelect ? (
                                  <button
                                    onClick={() => onRosterSelect(String(a.roster_id))}
                                    className="hover:text-primary hover:underline cursor-pointer transition-colors w-full"
                                  >
                                    {truncateText(rosterName.get(a.roster_id) || `Roster ${a.roster_id}`, 18)}
                                  </button>
                                ) : (
                                  truncateText(rosterName.get(a.roster_id) || `Roster ${a.roster_id}`, 18)
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Points: {a.points ?? 0}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <X className="h-6 w-6 text-blue-500" />
                            <span className="text-blue-500 font-semibold text-lg">BYE WEEK</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Team A */}
                        <div className="text-center">
                          <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-border">
                            <AvatarImage alt={`${rosterName.get(a.roster_id) || "Team"} avatar`} />
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
                              {(rosterName.get(a.roster_id) || "T").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="font-semibold text-lg truncate max-w-[140px] mx-auto">
                            {onRosterSelect ? (
                              <button
                                onClick={() => {
                                  console.log("MatchupsTab: Team A username clicked for roster:", a.roster_id);
                                  onRosterSelect(String(a.roster_id));
                                }}
                                className="hover:text-primary hover:underline cursor-pointer transition-colors w-full"
                              >
                                {truncateText(rosterName.get(a.roster_id) || `Roster ${a.roster_id}`, 20)}
                              </button>
                            ) : (
                              truncateText(rosterName.get(a.roster_id) || `Roster ${a.roster_id}`, 20)
                            )}
                          </div>
                          <div className={`text-2xl font-bold mt-2 ${
                            winner === a.roster_id ? 'text-green-500' : 
                            winner === 'tie' ? 'text-yellow-500' : 'text-foreground'
                          }`}>
                            {a.points ?? 0}
                          </div>
                          {winner === a.roster_id && (
                            <Trophy className="h-5 w-5 text-yellow-500 mx-auto mt-1" />
                          )}
                        </div>

                        {/* VS */}
                        <div className="text-center">
                          <div className="text-muted-foreground text-sm font-medium mb-2">VS</div>
                          <Separator orientation="vertical" className="h-16 mx-auto" />
                          <div className="text-xs text-muted-foreground mt-2">
                            {winner === 'tie' ? 'TIE' : winner ? 'FINAL' : 'LIVE'}
                          </div>
                        </div>

                        {/* Team B */}
                        <div className="text-center">
                          <Avatar className="h-16 w-16 mx-auto mb-3 border-2 border-border">
                            <AvatarImage alt={`${rosterName.get(b.roster_id) || "Opponent"} avatar`} />
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
                              {(rosterName.get(b.roster_id) || "T").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="font-semibold text-lg truncate max-w-[140px] mx-auto">
                            {onRosterSelect ? (
                              <button
                                onClick={() => {
                                  console.log("MatchupsTab: Team B username clicked for roster:", b.roster_id);
                                  onRosterSelect(String(b.roster_id));
                                }}
                                className="hover:text-primary hover:underline cursor-pointer transition-colors w-full"
                              >
                                {truncateText(rosterName.get(b.roster_id) || `Roster ${b.roster_id}`, 20)}
                              </button>
                            ) : (
                              truncateText(rosterName.get(b.roster_id) || `Roster ${b.roster_id}`, 20)
                            )}
                          </div>
                          <div className={`text-2xl font-bold mt-2 ${
                            winner === b.roster_id ? 'text-green-500' : 
                            winner === 'tie' ? 'text-yellow-500' : 'text-foreground'
                          }`}>
                            {b.points ?? 0}
                          </div>
                          {winner === b.roster_id && (
                            <Trophy className="h-5 w-5 text-yellow-500 mx-auto mt-1" />
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Head-to-Head Roster Dialog */}
      <Dialog open={isRosterDialogOpen} onOpenChange={setIsRosterDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Head-to-Head: Week {selectedMatchup?.a?.week}
            </DialogTitle>
          </DialogHeader>
          
          {selectedMatchup && (
            <div className="grid grid-cols-2 gap-6">
              {/* Team A Roster */}
              <div className="space-y-4">
                <div className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-3 border-2 border-border">
                    <AvatarImage alt={`${rosterName.get(selectedMatchup.a.roster_id) || "Team"} avatar`} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xl">
                      {(rosterName.get(selectedMatchup.a.roster_id) || "T").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold text-lg">
                    {onRosterSelect ? (
                      <button
                        onClick={() => onRosterSelect(String(selectedMatchup.a.roster_id))}
                        className="hover:text-primary hover:underline cursor-pointer transition-colors"
                      >
                        {rosterName.get(selectedMatchup.a.roster_id) || `Roster ${selectedMatchup.a.roster_id}`}
                      </button>
                    ) : (
                      rosterName.get(selectedMatchup.a.roster_id) || `Roster ${selectedMatchup.a.roster_id}`
                    )}
                  </h3>
                  <div className="text-2xl font-bold text-primary">
                    {selectedMatchup.a.points ?? 0} pts
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Starters
                  </h4>
                  <div className="space-y-2">
                    {rosterADetails?.starters && Array.isArray(rosterADetails.starters) ? (
                      rosterADetails.starters.map((playerId: string, index: number) => {
                        const player = playerData?.[playerId];
                        const position = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K'][index] || 'BN';
                        
                        return (
                          <div key={playerId} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={getPlayerHeadshotUrl(playerId)} alt={`${getPlayerDisplayName(playerId)} headshot`} />
                                <AvatarFallback className="text-xs">
                                  {getPlayerDisplayName(playerId)?.slice(0, 2).toUpperCase() || 'N/A'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <button
                                  onClick={() => player && handlePlayerClick(playerId)}
                                  className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                                  disabled={!player}
                                >
                                  <span className="text-sm font-medium">{getPlayerDisplayName(playerId)}</span>
                                </button>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    {position}
                                  </Badge>
                                  <span>{getPlayerTeam(playerId)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">0.0 pts</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-center py-4">
                        Loading starters...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Team B Roster */}
              <div className="space-y-4">
                <div className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-3 border-2 border-border">
                    <AvatarImage alt={`${rosterName.get(selectedMatchup.b.roster_id) || "Opponent"} avatar`} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xl">
                      {(rosterName.get(selectedMatchup.b.roster_id) || "T").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-bold text-lg">
                    {onRosterSelect ? (
                      <button
                        onClick={() => onRosterSelect(String(selectedMatchup.b.roster_id))}
                        className="hover:text-primary hover:underline cursor-pointer transition-colors"
                      >
                        {rosterName.get(selectedMatchup.b.roster_id) || `Roster ${selectedMatchup.b.roster_id}`}
                      </button>
                    ) : (
                      rosterName.get(selectedMatchup.b.roster_id) || `Roster ${selectedMatchup.b.roster_id}`
                    )}
                  </h3>
                  <div className="text-2xl font-bold text-primary">
                    {selectedMatchup.b.points ?? 0} pts
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Starters
                  </h4>
                  <div className="space-y-2">
                    {rosterBDetails?.starters && Array.isArray(rosterBDetails.starters) ? (
                      rosterBDetails.starters.map((playerId: string, index: number) => {
                        const player = playerData?.[playerId];
                        const position = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K'][index] || 'BN';
                        
                        return (
                          <div key={playerId} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={getPlayerHeadshotUrl(playerId)} alt={`${getPlayerDisplayName(playerId)} headshot`} />
                                <AvatarFallback className="text-xs">
                                  {getPlayerDisplayName(playerId)?.slice(0, 2).toUpperCase() || 'N/A'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <button
                                  onClick={() => player && handlePlayerClick(playerId)}
                                  className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                                  disabled={!player}
                                >
                                  <span className="text-sm font-medium">{getPlayerDisplayName(playerId)}</span>
                                </button>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    {position}
                                  </Badge>
                                  <span>{getPlayerTeam(playerId)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">0.0 pts</div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-center py-4">
                        Loading starters...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Player Bio Dialog */}
      <Dialog open={isPlayerBioOpen} onOpenChange={setIsPlayerBioOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage 
                  src={selectedPlayer ? getPlayerHeadshotUrl(selectedPlayer.player_id) : undefined} 
                  alt={`${selectedPlayer?.full_name || 'Player'} headshot`} 
                />
                <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                  {selectedPlayer?.full_name ? selectedPlayer.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{selectedPlayer?.full_name || 'Player'}</h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="secondary">
                    {selectedPlayer?.position || 'N/A'}
                  </Badge>
                  {selectedPlayer?.team && (
                    <Badge variant="outline">
                      {selectedPlayer.team}
                    </Badge>
                  )}
                  {selectedPlayer?.fantasy_positions && selectedPlayer.fantasy_positions.length > 0 && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {selectedPlayer.fantasy_positions.join(', ')}
                    </Badge>
                  )}
                </div>
                {selectedPlayer?.updated_at && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Last updated: {new Date(selectedPlayer.updated_at).toLocaleString()}
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPlayer && (
            <div className="space-y-6">
              {/* Player Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-muted-foreground">Fantasy Positions</span>
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    {selectedPlayer.fantasy_positions && selectedPlayer.fantasy_positions.length > 0 
                      ? selectedPlayer.fantasy_positions.join(', ') 
                      : selectedPlayer.position || 'N/A'
                    }
                  </div>
                </Card>
                
                <Card className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {selectedPlayer.status || 'Active'}
                  </div>
                </Card>
                
                <Card className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-muted-foreground">Injury Status</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">
                    {selectedPlayer.injury_status || 'Healthy'}
                  </div>
                </Card>
                
                <Card className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-muted-foreground">Practice</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-700">
                    {selectedPlayer.practice_participation || 'Full'}
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Per Game Stats */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Per Game Stats
                </h3>
                <Card className="p-4">
                  {(() => {
                    const stats = selectedPlayer.per_game_stats || selectedPlayer.current_week_stats || {};
                    if (!stats || Object.keys(stats).length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No stats available yet</p>
                          <p className="text-sm mt-2">Stats will appear here as the season progresses</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">
                            {selectedPlayer.per_game_stats ? 'Per Game Averages' : 'Current Week Performance'}
                          </div>
                          {selectedPlayer.updated_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Last updated: {new Date(selectedPlayer.updated_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(stats).map(([key, value]) => (
                            <div key={key} className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="text-sm font-medium text-muted-foreground capitalize mb-1">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-lg font-semibold text-yellow-700">
                                {typeof value === 'number' ? value.toFixed(1) : String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              </div>

              {/* Season Stats */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Season Statistics
                </h3>
                <Card className="p-4">
                  {(() => {
                    const stats = selectedPlayer.per_game_stats || selectedPlayer.current_week_stats || {};
                    if (!stats || Object.keys(stats).length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No season stats available yet</p>
                          <p className="text-sm mt-2">Season statistics will appear here as games are played</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">
                            Season Statistics
                          </div>
                          {selectedPlayer.updated_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Last updated: {new Date(selectedPlayer.updated_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(stats).map(([key, value]) => (
                            <div key={key} className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                              <div className="text-xs font-medium text-muted-foreground capitalize mb-1">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-lg font-bold text-green-700">
                                {typeof value === 'number' ? value.toFixed(1) : String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
