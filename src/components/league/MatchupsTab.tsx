import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Trophy, ArrowRight, X, Zap, TrendingUp, Activity, Shield, Award, Target, BarChart3, User } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { fetchWeeks, fetchLeagueMatchupsByWeek, LeagueWeekRow, fetchRosterDetails, fetchRosters, fetchApiProjections } from "@/lib/queries/league";
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
  const [activeTab, setActiveTab] = useState("projections");

  const weeksQ = useQuery({
    queryKey: ["league-weeks", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchWeeks(leagueId),
  });

  const initialWeek = (() => {
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

  // Fetch projections for the current week
  const { data: projections } = useQuery({
    queryKey: ["api-projections", leagueId, week],
    enabled: !!leagueId && !!week,
    queryFn: () => fetchApiProjections(leagueId, week!),
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

  // Auto-refresh player data every 5 minutes to keep it current
  useEffect(() => {
    if (!leagueId || allPlayerIds.length === 0) return;

    const interval = setInterval(() => {
      console.log("Auto-refreshing player data...");
      qc.invalidateQueries({ queryKey: ['players'] });
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [leagueId, allPlayerIds.length, qc]);

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
      
      // Calculate win probabilities based on projected points
      let aWinProb = 50;
      let bWinProb = 50;
      
      if (projections && rosterADetails && rosterBDetails) {
        const aProjectedTotal = calculateProjectedTotal((rosterADetails.starters as string[]) || [], projections);
        const bProjectedTotal = calculateProjectedTotal((rosterBDetails.starters as string[]) || [], projections);
        
        if (aProjectedTotal > 0 && bProjectedTotal > 0) {
          const totalPoints = aProjectedTotal + bProjectedTotal;
          aWinProb = Math.round((aProjectedTotal / totalPoints) * 100);
          bWinProb = 100 - aWinProb;
        }
      }
      
      return { 
        a: { ...a, winProb: aWinProb }, 
        b: b ? { ...b, winProb: bWinProb } : null 
      };
    });
    
    return pairs;
  }, [rows, projections, rosterADetails, rosterBDetails]);

  // Helper function to calculate projected total for a roster
  const calculateProjectedTotal = (starters: string[], projections: any) => {
    if (!projections || !Array.isArray(starters)) return 0;
    
    return starters.reduce((total, playerId) => {
      const playerProjection = projections.find((p: any) => p.player_id === playerId);
      return total + (playerProjection?.projection_points || 0);
    }, 0);
  };

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
  };

  // Handle player click to show player bio dialog (instead of navigation)
  const handlePlayerClick = (playerId: string) => {
    const player = playerData?.[playerId];
    if (player) {
      setSelectedPlayer(player);
      setIsPlayerBioOpen(true);
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

  const getPlayerHeadshotUrl = (playerId: string) => {
    if (!playerId) return undefined;
    // Use the most reliable Sleeper CDN endpoint for player images
    return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
  };

  const getPlayerProjection = (playerId: string) => {
    if (!projections) return 0;
    const playerProjection = projections.find((p: any) => p.player_id === playerId);
    return playerProjection?.projection_points || 0;
  };

  // Helper function to render player row
  const renderPlayerRow = (playerId: string, position: string, isProjectionsTab: boolean = false) => {
    const player = playerData?.[playerId];
    const projection = getPlayerProjection(playerId);
    
    return (
      <div key={playerId} className="flex items-center gap-3 py-2 px-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors" onClick={() => handlePlayerClick(playerId)}>
        <Avatar className="h-8 w-8">
          <AvatarImage 
            src={getPlayerHeadshotUrl(playerId)} 
            alt={`${getPlayerDisplayName(playerId)} headshot`} 
          />
          <AvatarFallback className="text-xs">
            {getPlayerDisplayName(playerId).split(' ').map(n => n[0]).join('').slice(0,2) || '??'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{getPlayerDisplayName(playerId)}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{position}</span>
            <span>•</span>
            <span>{getPlayerTeam(playerId)}</span>
          </div>
        </div>
        {isProjectionsTab && (
          <div className="text-right">
            <div className="font-medium text-sm">{projection.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">proj</div>
          </div>
        )}
      </div>
    );
  };

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

          {/* Matchup Cards */}
          <div className="grid gap-4">
            {matchupPairs.map((pair, index) => {
              const { a, b } = pair;
              const winner = getWinner(a, b);
              const aProjectedTotal = calculateProjectedTotal((rosterADetails?.starters as string[]) || [], projections);
              const bProjectedTotal = calculateProjectedTotal((rosterBDetails?.starters as string[]) || [], projections);

              return (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:shadow-md transition-shadow" 
                  onClick={() => handleMatchupClick(pair)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      {/* Team A */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-right">
                          <div className="font-semibold text-lg">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRosterSelect?.(String(a.roster_id));
                              }}
                              className="hover:text-primary hover:underline cursor-pointer transition-colors"
                            >
                              {truncateText(rosterName.get(a.roster_id) || `Team ${a.roster_id}`, 15)}
                            </button>
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {a.points !== null ? Number(a.points).toFixed(1) : '--'}
                          </div>
                          {projections && (
                            <div className="text-sm text-muted-foreground">
                              Proj: {aProjectedTotal.toFixed(1)} • {a.winProb}% win
                            </div>
                          )}
                        </div>
                        {winner === a.roster_id && (
                          <Trophy className="h-6 w-6 text-yellow-500" />
                        )}
                      </div>

                      {/* VS indicator */}
                      <div className="px-4">
                        <div className="text-muted-foreground text-sm font-medium bg-muted rounded-full px-3 py-1">
                          VS
                        </div>
                      </div>

                      {/* Team B */}
                      <div className="flex items-center gap-3 flex-1">
                        {winner === (b?.roster_id) && (
                          <Trophy className="h-6 w-6 text-yellow-500" />
                        )}
                        <div className="text-left">
                          <div className="font-semibold text-lg">
                            {b ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRosterSelect?.(String(b.roster_id));
                                }}
                                className="hover:text-primary hover:underline cursor-pointer transition-colors"
                              >
                                {truncateText(rosterName.get(b.roster_id) || `Team ${b.roster_id}`, 15)}
                              </button>
                            ) : (
                              'BYE'
                            )}
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {b?.points !== null ? Number(b.points).toFixed(1) : '--'}
                          </div>
                          {projections && b && (
                            <div className="text-sm text-muted-foreground">
                              Proj: {bProjectedTotal.toFixed(1)} • {b.winProb}% win
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Roster Details Dialog - Side by Side */}
      <Dialog open={isRosterDialogOpen} onOpenChange={setIsRosterDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Matchup Details
            </DialogTitle>
          </DialogHeader>

          {selectedMatchup && (
            <div className="space-y-6">
              {/* Matchup Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="font-semibold">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRosterSelect?.(String(selectedMatchup.a.roster_id));
                      }}
                      className="hover:text-primary hover:underline cursor-pointer transition-colors"
                    >
                      {rosterName.get(selectedMatchup.a.roster_id) || `Team ${selectedMatchup.a.roster_id}`}
                    </button>
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {selectedMatchup.a.points !== null ? Number(selectedMatchup.a.points).toFixed(1) : '--'}
                  </div>
                  {projections && (
                    <div className="text-sm text-muted-foreground">
                      {calculateProjectedTotal((rosterADetails?.starters as string[]) || [], projections).toFixed(1)} proj • {selectedMatchup.a.winProb}% win
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground font-medium">VS</div>
                <div className="text-center">
                  <div className="font-semibold">
                    {selectedMatchup.b ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRosterSelect?.(String(selectedMatchup.b.roster_id));
                        }}
                        className="hover:text-primary hover:underline cursor-pointer transition-colors"
                      >
                        {rosterName.get(selectedMatchup.b.roster_id) || `Team ${selectedMatchup.b.roster_id}`}
                      </button>
                    ) : (
                      'BYE'
                    )}
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {selectedMatchup.b?.points !== null ? Number(selectedMatchup.b.points).toFixed(1) : '--'}
                  </div>
                  {projections && selectedMatchup.b && (
                    <div className="text-sm text-muted-foreground">
                      {calculateProjectedTotal((rosterBDetails?.starters as string[]) || [], projections).toFixed(1)} proj • {selectedMatchup.b.winProb}% win
                    </div>
                  )}
                </div>
              </div>

              {/* Team/Projections Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="projections" className="space-y-6">
                  {/* Side by Side Projections */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Team A Projections */}
                    <Card>
                      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-green-600" />
                          <CardTitle className="text-sm">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRosterSelect?.(String(selectedMatchup.a.roster_id));
                              }}
                              className="hover:text-primary hover:underline cursor-pointer transition-colors"
                            >
                              {rosterName.get(selectedMatchup.a.roster_id) || `Team ${selectedMatchup.a.roster_id}`}
                            </button>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({calculateProjectedTotal((rosterADetails?.starters as string[]) || [], projections).toFixed(1)} pts)
                            </span>
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          {((rosterADetails?.starters as string[]) || []).map((playerId: string, index: number) => {
                            const position = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K'][index] || 'BN';
                            return renderPlayerRow(playerId, position, true);
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Team B Projections */}
                    {selectedMatchup.b && (
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-purple-600" />
                            <CardTitle className="text-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRosterSelect?.(String(selectedMatchup.b.roster_id));
                                }}
                                className="hover:text-primary hover:underline cursor-pointer transition-colors"
                              >
                                {rosterName.get(selectedMatchup.b.roster_id) || `Team ${selectedMatchup.b.roster_id}`}
                              </button>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({calculateProjectedTotal((rosterBDetails?.starters as string[]) || [], projections).toFixed(1)} pts)
                              </span>
                            </CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            {((rosterBDetails?.starters as string[]) || []).map((playerId: string, index: number) => {
                              const position = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K'][index] || 'BN';
                              return renderPlayerRow(playerId, position, true);
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Player Bio Dialog */}
      <Dialog open={isPlayerBioOpen} onOpenChange={setIsPlayerBioOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Player Profile
            </DialogTitle>
          </DialogHeader>

          {selectedPlayer && (
            <div className="space-y-6">
              {/* Player Header */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg">
                <Avatar className="h-20 w-20">
                  <AvatarImage 
                    src={getPlayerHeadshotUrl(selectedPlayer.player_id)} 
                    alt={`${selectedPlayer.full_name || 'Player'} headshot`} 
                  />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                    {selectedPlayer.full_name ? selectedPlayer.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{selectedPlayer.full_name || `Player ${selectedPlayer.player_id}`}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant="outline" className="border-blue-300 text-blue-700">
                      {selectedPlayer.position || 'N/A'}
                    </Badge>
                    <Badge variant="outline" className="border-green-300 text-green-700">
                      {selectedPlayer.team || 'N/A'}
                    </Badge>
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                      {selectedPlayer.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Player Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Player Info</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Position:</span>
                      <span className="font-medium">{selectedPlayer.position || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team:</span>
                      <span className="font-medium">{selectedPlayer.team || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">{selectedPlayer.status || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Injury:</span>
                      <span className="font-medium">{selectedPlayer.injury_status || 'Healthy'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Projection</h3>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-3xl font-bold text-primary">
                      {getPlayerProjection(selectedPlayer.player_id).toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">Week 1 Projected Points</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
