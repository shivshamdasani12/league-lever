import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Users, Trophy, User, MapPin, TrendingUp, Activity, Shield, Award, Target, Zap } from "lucide-react";
import { fetchRosters, LeagueRosterRow } from "@/lib/queries/league";
import { fetchPlayersByIds, PlayerRow } from "@/lib/queries/players";

interface Props { 
  leagueId: string;
  selectedRosterId?: string | null;
}

function getBench(all: string[] | null, starters: string[] | null) {
  const a = Array.isArray(all) ? all : [];
  const s = new Set(Array.isArray(starters) ? starters : []);
  return a.filter((id) => !s.has(id));
}

// Helper function to get position color
function getPositionColor(position: string | null): string {
  if (!position) return "bg-gray-100 text-gray-800 border-gray-200";
  
  const colors: Record<string, string> = {
    'QB': 'bg-blue-100 text-blue-800 border-blue-200',
    'RB': 'bg-green-100 text-green-800 border-green-200',
    'WR': 'bg-purple-100 text-purple-800 border-purple-200',
    'TE': 'bg-orange-100 text-orange-800 border-orange-200',
    'K': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'DEF': 'bg-red-100 text-red-800 border-red-200',
    'DL': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'LB': 'bg-pink-100 text-pink-800 border-pink-200',
    'DB': 'bg-teal-100 text-teal-800 border-teal-200',
  };
  
  return colors[position] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Helper function to get status color
function getStatusColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-800 border-gray-200";
  
  const colors: Record<string, string> = {
    'Active': 'bg-green-100 text-green-800 border-green-200',
    'Inactive': 'bg-red-100 text-red-800 border-red-200',
    'IR': 'bg-orange-100 text-orange-800 border-orange-200',
    'O': 'bg-red-100 text-red-800 border-red-200',
    'Q': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'D': 'bg-blue-100 text-blue-800 border-blue-200',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Helper function to get player headshot URL
function getPlayerHeadshotUrl(playerId: string, playerName: string | null): string | undefined {
  if (!playerId) return undefined;
  
  // Use the most reliable Sleeper CDN endpoint for player images
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

// Helper function to get injury status display
function getInjuryDisplay(injuryStatus: string | null, practiceParticipation: string | null) {
  if (!injuryStatus && !practiceParticipation) return null;
  
  if (injuryStatus === 'IR') return { text: 'IR', color: 'bg-red-100 text-red-800 border-red-200' };
  if (injuryStatus === 'O') return { text: 'Out', color: 'bg-red-100 text-red-800 border-red-200' };
  if (injuryStatus === 'Q') return { text: 'Questionable', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  if (injuryStatus === 'D') return { text: 'Doubtful', color: 'bg-orange-100 text-orange-800 border-orange-200' };
  
  if (practiceParticipation === 'Full') return { text: 'Full Practice', color: 'bg-green-100 text-green-800 border-green-200' };
  if (practiceParticipation === 'Limited') return { text: 'Limited', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  if (practiceParticipation === 'DNP') return { text: 'DNP', color: 'bg-red-100 text-red-800 border-red-200' };
  
  return null;
}

// Helper function to generate mock stats based on position
function getMockStatsForPosition(position: string | null) {
  if (!position) return null;
  
  const pos = position.toUpperCase();
  
  // Quarterback stats
  if (pos === 'QB') {
    return {
      passing_yards: 0,
      passing_touchdowns: 0,
      passing_interceptions: 0,
      passing_attempts: 0,
      passing_completions: 0,
      rushing_yards: 0,
      rushing_touchdowns: 0,
      fantasy_points: 0
    };
  }
  
  // Running back stats
  if (pos === 'RB') {
    return {
      rushing_yards: 0,
      rushing_touchdowns: 0,
      rushing_attempts: 0,
      receiving_yards: 0,
      receiving_touchdowns: 0,
      receiving_targets: 0,
      receiving_receptions: 0,
      fantasy_points: 0
    };
  }
  
  // Wide receiver stats
  if (pos === 'WR') {
    return {
      receiving_yards: 0,
      receiving_touchdowns: 0,
      receiving_targets: 0,
      receiving_receptions: 0,
      rushing_yards: 0,
      rushing_touchdowns: 0,
      fantasy_points: 0
    };
  }
  
  // Tight end stats
  if (pos === 'TE') {
    return {
      receiving_yards: 0,
      receiving_touchdowns: 0,
      receiving_targets: 0,
      receiving_receptions: 0,
      fantasy_points: 0
    };
  }
  
  // Kicker stats
  if (pos === 'K') {
    return {
      field_goals_made: 0,
      field_goals_attempted: 0,
      extra_points_made: 0,
      extra_points_attempted: 0,
      fantasy_points: 0
    };
  }
  
  // Defense stats
  if (pos === 'DEF') {
    return {
      tackles: 0,
      sacks: 0,
      interceptions: 0,
      passes_defended: 0,
      fumbles_forced: 0,
      fumbles_recovered: 0,
      fantasy_points: 0
    };
  }
  
  // Default stats for other positions
  return {
    fantasy_points: 0,
    total_yards: 0,
    touchdowns: 0
  };
}

export default function RostersTab({ leagueId, selectedRosterId: propSelectedRosterId }: Props) {
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(propSelectedRosterId || null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [isPlayerBioOpen, setIsPlayerBioOpen] = useState(false);

  const { data: rosters, isLoading, isError, error } = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  // Update selected roster when prop changes
  useEffect(() => {
    console.log("RostersTab: propSelectedRosterId changed to:", propSelectedRosterId);
    if (propSelectedRosterId && propSelectedRosterId !== selectedRosterId) {
      console.log("RostersTab: Setting selectedRosterId to:", propSelectedRosterId);
      setSelectedRosterId(propSelectedRosterId);
    }
  }, [propSelectedRosterId, selectedRosterId]);



  // Build unique list of player IDs across all rosters
  const allPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    (rosters || []).forEach((r: LeagueRosterRow) => {
      (Array.isArray(r.players) ? r.players as string[] : []).forEach((id) => ids.add(String(id)));
      (Array.isArray(r.starters) ? r.starters as string[] : []).forEach((id) => ids.add(String(id)));
    });
    return Array.from(ids);
  }, [rosters]);

  const playersQ = useQuery({
    queryKey: ["players-by-ids", leagueId, allPlayerIds.join(",")],
    enabled: !!leagueId && allPlayerIds.length > 0,
    queryFn: () => fetchPlayersByIds(allPlayerIds),
  });

  const playerMap = (playersQ.data || {}) as Record<string, PlayerRow>;

  // Debug logging for player data
  useEffect(() => {
    if (selectedRosterId && rosters) {
      console.log("=== ROSTERS TAB DEBUG ===");
      console.log("Selected roster ID:", selectedRosterId);
      console.log("All player IDs:", allPlayerIds);
      console.log("Player data:", playersQ.data);
      console.log("Player error:", playersQ.error);
      console.log("Player map keys:", Object.keys(playerMap));
      console.log("Sample player data:", Object.values(playerMap)[0]);
      console.log("=========================");
    }
  }, [selectedRosterId, rosters, allPlayerIds, playersQ.data, playersQ.error, playerMap]);


  // Get the selected roster data
  const selectedRoster = useMemo(() => {
    if (!selectedRosterId || !rosters) return null;
    return rosters.find(r => String(r.roster_id) === selectedRosterId);
  }, [selectedRosterId, rosters]);

  // Get starters and bench players for selected roster
  const starters = useMemo(() => {
    if (!selectedRoster?.starters || !Array.isArray(selectedRoster.starters)) return [];
    return (selectedRoster.starters as string[]).map(pid => ({
      id: pid,
      player: playerMap[pid],
      isStarter: true
    }));
  }, [selectedRoster, playerMap]);

  const bench = useMemo(() => {
    if (!selectedRoster?.players || !Array.isArray(selectedRoster.players)) return [];
    const starterIds = new Set(selectedRoster.starters as string[] || []);
    return (selectedRoster.players as string[])
      .filter(pid => !starterIds.has(pid))
      .map(pid => ({
        id: pid,
        player: playerMap[pid],
        isStarter: false
      }));
  }, [selectedRoster, playerMap]);



  // Helper function to get player display name with fallback
  const getPlayerDisplayName = (playerId: string, player: PlayerRow | undefined) => {
    if (player?.full_name) return player.full_name;
    // Try to extract name from player ID if it's a Sleeper ID
    if (playerId && playerId.length > 10) {
      return `Player ${playerId.slice(-4)}`; // Show last 4 chars as fallback
    }
    return `Player ${playerId}`;
  };

  // Helper function to get player team with fallback
  const getPlayerTeam = (player: PlayerRow | undefined) => {
    return player?.team || 'N/A';
  };

  // Helper function to get player position with fallback
  const getPlayerPosition = (player: PlayerRow | undefined) => {
    return player?.position || 'N/A';
  };

  // Function to handle player click and show bio
  const handlePlayerClick = (player: PlayerRow) => {
    setSelectedPlayer(player);
    setIsPlayerBioOpen(true);
  };


  if (isLoading) return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="h-4 w-4 animate-spin" />
        <span>Loading rosters...</span>
      </div>
    </div>
  );
  
  if (isError) return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-2 text-destructive">
        <Users className="h-4 w-4" />
        <span>{(error as any)?.message || "Failed to load rosters."}</span>
      </div>
    </div>
  );
  
  if (!rosters || rosters.length === 0) return (
    <div className="flex items-center justify-center p-8">
      <p className="text-muted-foreground">No rosters found.</p>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with roster selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Select a roster to view player details</span>
          </div>
        </div>



        {/* Roster Selector */}
        <div className="max-w-md">
          <Select value={selectedRosterId || ""} onValueChange={setSelectedRosterId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a roster" />
            </SelectTrigger>
            <SelectContent>
              {rosters.map((roster) => {
                const initials = (roster.owner_name || roster.owner_username || "?").split(" ").map((p) => p[0]).join("").slice(0,2).toUpperCase();
                return (
                  <SelectItem key={roster.roster_id} value={String(roster.roster_id)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={roster.owner_avatar || undefined} alt={`${roster.owner_name || roster.owner_username || "Owner"} avatar`} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <span>{roster.owner_name || roster.owner_username || `Roster ${roster.roster_id}`}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Roster Display */}
        {selectedRoster && (
          <div className="space-y-6">
            {/* Player Data Error Display */}
            {playersQ.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">Player Data Error:</p>
                <p className="text-red-600 text-sm mt-1">
                  {(playersQ.error as any)?.message || "Failed to load player data. Player data will be loaded automatically."}
                </p>
              </div>
            )}

            {/* Roster Header Card */}
            <Card className="w-full">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedRoster.owner_avatar || undefined} alt={`${selectedRoster.owner_name || selectedRoster.owner_username || "Owner"} avatar`} />
                    <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                      {(selectedRoster.owner_name || selectedRoster.owner_username || "?").split(" ").map((p) => p[0]).join("").slice(0,2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">{selectedRoster.owner_name || selectedRoster.owner_username || `Roster ${selectedRoster.roster_id}`}</CardTitle>
                    <div className="flex items-center gap-4 text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4 text-yellow-600" />
                        <span>{starters.length} starters</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-blue-600" />
                        <span>{bench.length} bench</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Starters Table */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  <CardTitle className="text-lg text-yellow-700">Starters</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-yellow-50/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {starters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No starters set
                        </TableCell>
                      </TableRow>
                    ) : (
                      starters.map(({ id, player }, index) => {
                        const position = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K'][index] || 'BN';
                        const injuryDisplay = getInjuryDisplay(player?.injury_status, player?.practice_participation);
                        
                         return (
                           <TableRow key={String(id)} className="hover:bg-yellow-50/30">
                             <TableCell>
                               <Avatar className="h-10 w-10">
                                 <AvatarImage 
                                   src={getPlayerHeadshotUrl(String(id), player?.full_name)} 
                                   alt={`${player?.full_name || 'Player'} headshot`} 
                                 />
                                 <AvatarFallback className="bg-yellow-100 text-yellow-800 font-semibold text-sm">
                                   {player?.full_name ? player.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                                 </AvatarFallback>
                               </Avatar>
                             </TableCell>
                                                          <TableCell>
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => player && handlePlayerClick(player)}
                                    className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                                    disabled={!player}
                                  >
                                    <span className="font-semibold">
                                      {getPlayerDisplayName(String(id), player)}
                                    </span>
                                    {!player?.full_name && (
                                      <span className="text-xs text-muted-foreground">
                                        Sleeper ID: {String(id)}
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </TableCell>
                             <TableCell>
                               <Badge variant="secondary" className={getPositionColor(player?.position)}>
                                 {position}
                               </Badge>
                             </TableCell>
                             <TableCell>
                               {getPlayerTeam(player) !== 'N/A' ? (
                                 <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                                   {getPlayerTeam(player)}
                                 </Badge>
                               ) : (
                                 <span className="text-muted-foreground">--</span>
                               )}
                             </TableCell>
                            <TableCell className="text-right">
                              {injuryDisplay ? (
                                <Badge variant="outline" className={injuryDisplay.color}>
                                  {injuryDisplay.text}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Bench Table */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg text-blue-700">Bench</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bench.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No bench players
                        </TableCell>
                      </TableRow>
                    ) : (
                      bench.map(({ id, player }) => {
                        const injuryDisplay = getInjuryDisplay(player?.injury_status, player?.practice_participation);
                        
                         return (
                           <TableRow key={String(id)} className="hover:bg-blue-50/30">
                             <TableCell>
                               <Avatar className="h-10 w-10">
                                 <AvatarImage 
                                   src={getPlayerHeadshotUrl(String(id), player?.full_name)} 
                                   alt={`${player?.full_name || 'Player'} headshot`} 
                                 />
                                 <AvatarFallback className="bg-blue-100 text-blue-800 font-semibold text-sm">
                                   {player?.full_name ? player.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                                 </AvatarFallback>
                               </Avatar>
                             </TableCell>
                                                          <TableCell>
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => player && handlePlayerClick(player)}
                                    className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                                    disabled={!player}
                                  >
                                    <span className="font-semibold">
                                      {getPlayerDisplayName(String(id), player)}
                                    </span>
                                    {!player?.full_name && (
                                      <span className="text-xs text-muted-foreground">
                                        Sleeper ID: {String(id)}
                                      </span>
                                    )}
                                  </button>
                                </div>
                              </TableCell>
                             <TableCell>
                               {getPlayerPosition(player) !== 'N/A' ? (
                                 <Badge variant="secondary" className={getPositionColor(player.position)}>
                                   {getPlayerPosition(player)}
                                 </Badge>
                               ) : (
                                 <span className="text-muted-foreground">--</span>
                               )}
                             </TableCell>
                             <TableCell>
                               {getPlayerTeam(player) !== 'N/A' ? (
                                 <Badge variant="outline" className="border-blue-300 text-blue-700">
                                   {getPlayerTeam(player)}
                                 </Badge>
                               ) : (
                                 <span className="text-muted-foreground">--</span>
                               )}
                             </TableCell>
                            <TableCell className="text-right">
                              {injuryDisplay ? (
                                <Badge variant="outline" className={injuryDisplay.color}>
                                  {injuryDisplay.text}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Player Bio Dialog */}
      <Dialog open={isPlayerBioOpen} onOpenChange={setIsPlayerBioOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage 
                  src={selectedPlayer ? getPlayerHeadshotUrl(selectedPlayer.player_id, selectedPlayer.full_name) : undefined} 
                  alt={`${selectedPlayer?.full_name || 'Player'} headshot`} 
                />
                <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                  {selectedPlayer?.full_name ? selectedPlayer.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{selectedPlayer?.full_name || 'Player'}</h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="secondary" className={getPositionColor(selectedPlayer?.position)}>
                    {selectedPlayer?.position || 'N/A'}
                  </Badge>
                  {selectedPlayer?.team && (
                    <Badge variant="outline">
                      {selectedPlayer.team}
                    </Badge>
                  )}

                </div>
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
                    {selectedPlayer.fantasy_positions?.join(', ') || 'N/A'}
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
                    const stats = selectedPlayer.per_game_stats || selectedPlayer.current_week_stats || getMockStatsForPosition(selectedPlayer.position);
                    if (!stats) return null;
                    
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">
                            {selectedPlayer.per_game_stats ? 'Per Game Averages' : 'Current Week Performance'}
                          </div>
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
                    const stats = selectedPlayer.current_week_stats || getMockStatsForPosition(selectedPlayer.position);
                    if (!stats) return null;
                    
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">
                            Season Statistics
                          </div>
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
    </TooltipProvider>
  );
}
