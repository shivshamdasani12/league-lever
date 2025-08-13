import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Trophy, User, RefreshCw, AlertCircle, Shield, Info } from "lucide-react";
import { fetchRosters, LeagueRosterRow } from "@/lib/queries/league";
import { fetchPlayersByIds, PlayerRow } from "@/lib/queries/players";
import { supabase } from "@/integrations/supabase/client";

interface Props { leagueId: string }

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
  if (!playerName) return undefined;
  
  // Try multiple Sleeper CDN endpoints for player images
  const endpoints = [
    `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`,
    `https://sleepercdn.com/avatars/thumbs/${playerId}`,
    `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
  ];
  
  // For now, return the first one - in a real app you might want to test which ones work
  return endpoints[0];
}

export default function RostersTab({ leagueId }: Props) {
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [syncingPlayers, setSyncingPlayers] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const { data: rosters, isLoading, isError, error } = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  // Set default selected roster when data loads
  useEffect(() => {
    if (rosters && rosters.length > 0 && !selectedRosterId) {
      setSelectedRosterId(String(rosters[0].roster_id));
    }
  }, [rosters, selectedRosterId]);

  // Build unique list of player IDs across all rosters
  const allPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    (rosters || []).forEach((r: LeagueRosterRow) => {
      (Array.isArray(r.players) ? r.players : []).forEach((id) => ids.add(id));
      (Array.isArray(r.starters) ? r.starters : []).forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [rosters]);

  const playersQ = useQuery({
    queryKey: ["players-by-ids", leagueId, allPlayerIds.join(",")],
    enabled: !!leagueId && allPlayerIds.length > 0,
    queryFn: () => fetchPlayersByIds(allPlayerIds),
  });

  const playerMap = (playersQ.data || {}) as Record<string, PlayerRow>;

  // Check for missing player data
  const missingPlayers = useMemo(() => {
    return allPlayerIds.filter((id) => !playerMap[id]?.full_name);
  }, [allPlayerIds, playerMap]);

  // Manual sync function for missing players
  const syncMissingPlayers = async () => {
    if (!leagueId || missingPlayers.length === 0) return;
    
    setSyncingPlayers(true);
    try {
      console.log(`Starting sync for ${missingPlayers.length} missing players...`);
      
      const result = await supabase.functions.invoke("sleeper-sync-players", { body: { league_id: leagueId } as any });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      setLastSyncTime(new Date());
      console.log("Player sync completed:", result);
      
      // Force a refetch of the players data
      await playersQ.refetch();
      
      // Check if we still have missing players after sync
      setTimeout(() => {
        const stillMissing = allPlayerIds.filter((id) => !playerMap[id]?.full_name);
        console.log(`After sync - still missing: ${stillMissing.length} players`);
        if (stillMissing.length > 0) {
          console.log("Sample missing player IDs:", stillMissing.slice(0, 5));
        }
      }, 1000);
      
    } catch (e) {
      console.error("Failed to sync players", e);
    } finally {
      setSyncingPlayers(false);
    }
  };

  // Attempt to sync missing players automatically
  useEffect(() => {
    if (!leagueId || allPlayerIds.length === 0) return;
    if (missingPlayers.length === 0) return;
    
    console.log(`Auto-sync triggered for ${missingPlayers.length} missing players`);
    
    // Auto-sync after a short delay
    const timer = setTimeout(() => {
      syncMissingPlayers();
    }, 1000); // Reduced from 2000ms to 1000ms
    
    return () => clearTimeout(timer);
  }, [leagueId, allPlayerIds.join(","), missingPlayers.length]);

  // Additional sync attempt when component mounts
  useEffect(() => {
    if (!leagueId || allPlayerIds.length === 0) return;
    
    // Try to sync on mount if we have missing players
    if (missingPlayers.length > 0) {
      console.log(`Component mount sync for ${missingPlayers.length} missing players`);
      setTimeout(() => {
        syncMissingPlayers();
      }, 500);
    }
  }, [leagueId, allPlayerIds.length]);

  // Get the selected roster data
  const selectedRoster = useMemo(() => {
    if (!selectedRosterId || !rosters) return null;
    return rosters.find(r => String(r.roster_id) === selectedRosterId);
  }, [selectedRosterId, rosters]);

  // Debug logging
  useEffect(() => {
    if (allPlayerIds.length > 0) {
      console.log("Total player IDs:", allPlayerIds.length);
      console.log("Players with names:", Object.values(playerMap).filter(p => p.full_name).length);
      console.log("Missing players:", missingPlayers.length);
      console.log("Sample player data:", Object.values(playerMap).slice(0, 3));
    }
  }, [allPlayerIds.length, playerMap, missingPlayers.length]);

  if (isLoading) return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-2 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Loading rosters...</span>
      </div>
    </div>
  );
  
  if (isError) return (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4" />
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
        {/* Header with roster selector and sync button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Select a roster to view player details</span>
          </div>
          
          {missingPlayers.length > 0 && (
            <Button 
              onClick={syncMissingPlayers} 
              disabled={syncingPlayers}
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${syncingPlayers ? 'animate-spin' : ''}`} />
              Sync {missingPlayers.length} Players
            </Button>
          )}
        </div>

        {/* Player Data Status Alert */}
        {missingPlayers.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <Info className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{missingPlayers.length} players</strong> are missing data (names, positions, teams). 
              {lastSyncTime && (
                <span className="block mt-1 text-sm">
                  Last sync attempt: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
              {syncingPlayers && (
                <span className="block mt-1 text-sm font-medium">
                  Syncing player data now...
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

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
                      <span>{Array.isArray(selectedRoster.starters) ? selectedRoster.starters.length : 0} starters</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-blue-600" />
                      <span>{getBench(selectedRoster.players, selectedRoster.starters).length} bench</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Starters Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    <h3 className="text-lg font-semibold text-yellow-700">Starters</h3>
                  </div>
                  
                  {!Array.isArray(selectedRoster.starters) || selectedRoster.starters.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">No starters set</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {selectedRoster.starters.map((pid, idx) => {
                        const player = playerMap[pid];
                        return (
                          <div key={pid + idx} className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200 hover:border-yellow-300 transition-colors">
                            {/* Player Headshot */}
                            <Avatar className="h-12 w-12">
                              <AvatarImage 
                                src={getPlayerHeadshotUrl(pid, player?.full_name)} 
                                alt={`${player?.full_name || 'Player'} headshot`} 
                              />
                              <AvatarFallback className="bg-yellow-100 text-yellow-800 font-semibold">
                                {player?.full_name ? player.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-base text-black mb-2">
                                {player?.full_name || `Player ${pid}`}
                              </div>
                              {!player?.full_name && (
                                <div className="text-xs text-gray-500 mb-2">
                                  Sleeper ID: {pid}
                                </div>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                {player?.position && (
                                  <Badge variant="secondary" className={`text-xs ${getPositionColor(player.position)}`}>
                                    {player.position}
                                  </Badge>
                                )}
                                {player?.team && (
                                  <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">
                                    {player.team}
                                  </Badge>
                                )}
                                {player?.status && player.status !== 'Active' && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className={`text-xs ${getStatusColor(player.status)}`}>
                                        {player.status}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Player status: {player.status}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {!player?.full_name && (
                                  <Badge variant="destructive" className="text-xs">
                                    Missing Data
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bench Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-700">Bench</h3>
                  </div>
                  
                  {(() => {
                    const bench = getBench(selectedRoster.players, selectedRoster.starters);
                    if (bench.length === 0) {
                      return <p className="text-muted-foreground text-sm italic">No bench players</p>;
                    }
                    
                    return (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {bench.map((pid, idx) => {
                          const player = playerMap[pid];
                          return (
                            <div key={pid + idx} className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors">
                              {/* Player Headshot */}
                              <Avatar className="h-12 w-12">
                                <AvatarImage 
                                  src={getPlayerHeadshotUrl(pid, player?.full_name)} 
                                  alt={`${player?.full_name || 'Player'} headshot`} 
                                />
                                <AvatarFallback className="bg-blue-100 text-blue-800 font-semibold">
                                  {player?.full_name ? player.full_name.split(' ').map(n => n[0]).join('').slice(0,2) : '??'}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-base text-black mb-2">
                                  {player?.full_name || `Player ${pid}`}
                                </div>
                                {!player?.full_name && (
                                  <div className="text-xs text-gray-500 mb-2">
                                    Sleeper ID: {pid}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {player?.position && (
                                    <Badge variant="secondary" className={`text-xs ${getPositionColor(player.position)}`}>
                                      {player.position}
                                    </Badge>
                                  )}
                                  {player?.team && (
                                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                      {player.team}
                                    </Badge>
                                  )}
                                  {player?.status && player.status !== 'Active' && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className={`text-xs ${getStatusColor(player.status)}`}>
                                          {player.status}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Player status: {player.status}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!player?.full_name && (
                                    <Badge variant="destructive" className="text-xs">
                                      Missing Data
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
