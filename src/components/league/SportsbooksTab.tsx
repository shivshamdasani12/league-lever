import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchLeagueMatchupsByWeek, LeagueWeekRow, fetchRosterDetails, fetchApiProjections, PlayerProjection } from "@/lib/queries/league";
import { fetchRosters } from "@/lib/queries/league";
import { fetchPlayersByIds, PlayerRow } from "@/lib/queries/players";
import { TrendingUp, Users, Trophy, ArrowRight, DollarSign } from "lucide-react";
import { useMemo } from "react";

interface Props {
  leagueId: string;
}

interface BetOffer {
  matchupIndex: number;
  side: 'teamA' | 'teamB';
  tokenAmount: number;
  betType: string;
}

export default function SportsbooksTab({ leagueId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [betOffer, setBetOffer] = useState<BetOffer | null>(null);
  const [tokenAmount, setTokenAmount] = useState<number>(10);
  const [isCreatingBet, setIsCreatingBet] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch week 1 matchups
  const { data: week1Matchups = [] } = useQuery({
    queryKey: ['league-matchups-by-week', leagueId, 1],
    enabled: !!leagueId,
    queryFn: () => fetchLeagueMatchupsByWeek(leagueId, 1),
  });

  // Fetch projections for week 1
  const { data: projections = [] } = useQuery({
    queryKey: ['api-projections', leagueId, 1, 2025],
    enabled: !!leagueId,
    queryFn: () => fetchApiProjections(leagueId, 1, 2025, 'PPR'),
  });

  // Fetch rosters for team names
  const { data: rosters = [] } = useQuery({
    queryKey: ['rosters', leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  // Helper function to calculate projected total for a roster
  const calculateProjectedTotal = (starters: string[], projectionsData: PlayerProjection[]) => {
    if (!Array.isArray(starters) || !Array.isArray(projectionsData) || projectionsData.length === 0) {
      return 0;
    }
    
    return starters.reduce((total, playerId) => {
      if (!playerId) return total;
      const playerProjection = projectionsData.find((p: PlayerProjection) => p && p.player_id === playerId);
      return total + (playerProjection?.projection_points || 0);
    }, 0);
  };

  // Helper function to get roster name and username
  const getRosterInfo = (rosterId: number) => {
    const roster = rosters.find(r => r.roster_id === rosterId);
    return {
      displayName: roster?.owner_name || roster?.owner_username || `Team ${rosterId}`,
      ownerName: roster?.owner_name || roster?.owner_username || `User ${rosterId}`,
      ownerUsername: roster?.owner_username || roster?.owner_name || `user${rosterId}`
    };
  };

  // Helper function to get player display name
  const getPlayerDisplayName = (playerId: string, player: PlayerRow | null) => {
    if (player?.full_name) return player.full_name;
    if (player?.first_name && player?.last_name) return `${player.first_name} ${player.last_name}`;
    return `Player ${playerId}`;
  };

  // Helper function to get player headshot URL
  const getPlayerHeadshotUrl = (playerId: string, fullName?: string) => {
    if (!fullName) return '';
    const name = fullName.toLowerCase().replace(/\s+/g, '-');
    return `https://sleepercdn.com/avatars/thumbs/${playerId}`;
  };

  // Helper function to get position color
  const getPositionColor = (position: string | null) => {
    if (!position) return 'bg-gray-100 text-gray-800';
    const pos = position.toUpperCase();
    switch (pos) {
      case 'QB': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'RB': return 'bg-green-100 text-green-800 border-green-300';
      case 'WR': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'TE': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'K': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'DEF': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Group matchups into pairs
  const matchupPairs = useMemo(() => {
    const groups: Record<string, LeagueWeekRow[]> = {};
    week1Matchups.forEach(matchup => {
      const key = `${matchup.week}_${matchup.matchup_id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(matchup);
    });

    return Object.values(groups).map(g => {
      const [a, b] = g.sort((x, y) => x.roster_id - y.roster_id);
      return { a, b };
    });
  }, [week1Matchups]);

  // Calculate spreads for each matchup
  const matchupsWithSpreads = useMemo(() => {
    return matchupPairs.map(pair => {
      // Get roster details for both teams
      const aRosterDetails = rosters.find(r => r.roster_id === pair.a.roster_id);
      const bRosterDetails = pair.b ? rosters.find(r => r.roster_id === pair.b.roster_id) : null;

      // Calculate projected totals
      const aProjectedTotal = aRosterDetails?.starters ? 
        calculateProjectedTotal(aRosterDetails.starters as string[], projections) : 0;
      const bProjectedTotal = bRosterDetails?.starters ? 
        calculateProjectedTotal(bRosterDetails.starters as string[], projections) : 0;

      // Calculate spread (positive means team A is favored, negative means team B is favored)
      const spread = aProjectedTotal - bProjectedTotal;
      
      // Get team info for display
      const teamAInfo = getRosterInfo(pair.a.roster_id);
      const teamBInfo = pair.b ? getRosterInfo(pair.b.roster_id) : null;
      
      return {
        ...pair,
        aProjectedTotal,
        bProjectedTotal,
        spread,
        isTeamAFavored: spread > 0,
        spreadDisplay: Math.abs(spread).toFixed(1),
        teamAInfo,
        teamBInfo
      };
    });
  }, [matchupPairs, rosters, projections]);

  // Handle bet offering
  const handleBetOffer = (matchupIndex: number, side: 'teamA' | 'teamB') => {
    const matchup = matchupsWithSpreads[matchupIndex];
    if (!matchup) return;

    const sideName = side === 'teamA' ? matchup.teamAInfo.displayName : matchup.teamBInfo?.displayName;
    const spreadText = matchup.isTeamAFavored 
      ? (side === 'teamA' ? `-${matchup.spreadDisplay}` : `+${matchup.spreadDisplay}`)
      : (side === 'teamA' ? `+${matchup.spreadDisplay}` : `-${matchup.spreadDisplay}`);

    setBetOffer({
      matchupIndex,
      side,
      tokenAmount: 10,
      betType: `${sideName} ${spreadText} vs ${side === 'teamA' ? matchup.teamBInfo?.displayName : matchup.teamAInfo.displayName}`
    });
    setTokenAmount(10);
    setIsDialogOpen(true);
  };

  // Create the bet
  const createBet = async () => {
    if (!betOffer || tokenAmount < 1) return;
    
    setIsCreatingBet(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");
      
      const { error } = await supabase.from("bets").insert({
        league_id: leagueId,
        created_by: uid,
        type: betOffer.betType,
        token_amount: tokenAmount,
        terms: { 
          matchupIndex: betOffer.matchupIndex,
          side: betOffer.side,
          week: 1,
          season: 2025
        },
        status: "offered"
      });
      
      if (error) throw error;
      
      toast({ 
        title: "Bet offered!", 
        description: `Your bet of ${tokenAmount} tokens is now available in the Wagers tab.` 
      });
      
      // Reset and close dialog
      setBetOffer(null);
      setTokenAmount(10);
      setIsDialogOpen(false);
      
      // Invalidate bets query to refresh wagers tab
      await qc.invalidateQueries({ queryKey: ["bets", leagueId] });
    } catch (err: any) {
      toast({ title: "Error creating bet", description: err.message });
    } finally {
      setIsCreatingBet(false);
    }
  };

  if (week1Matchups.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Week 1 Matchups</h3>
        <p className="text-sm text-muted-foreground">Matchups will appear here once the season begins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">Week 1 Sportsbook</h2>
        <p className="text-muted-foreground">Place bets on either side of the spread • Projected spreads based on FantasyPros</p>
      </div>

      {/* Matchups Grid */}
      <div className="grid gap-4">
        {matchupsWithSpreads.map((matchup, index) => (
          <Card key={index} className="overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Matchup {index + 1}</CardTitle>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Week 1
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6 items-center">
                {/* Team A */}
                <div className="text-center space-y-3">
                  <div className="flex flex-col items-center gap-2">
                    <Avatar className="h-16 w-16 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {getRosterInfo(matchup.a.roster_id).displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-lg">{getRosterInfo(matchup.a.roster_id).displayName}</h3>
                      <p className="text-sm text-muted-foreground">@{getRosterInfo(matchup.a.roster_id).ownerUsername}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {matchup.aProjectedTotal.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">Projected Points</div>
                    </div>
                    
                    {matchup.isTeamAFavored && (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        -{matchup.spreadDisplay}
                      </Badge>
                    )}
                  </div>

                  {/* Bet Button for Team A */}
                  <Button 
                    onClick={() => handleBetOffer(index, 'teamA')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Bet on {getRosterInfo(matchup.a.roster_id).displayName}
                  </Button>
                </div>

                {/* VS / Spread */}
                <div className="text-center space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-4xl font-bold text-muted-foreground">VS</div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">
                        {matchup.spread > 0 ? `+${matchup.spreadDisplay}` : `-${matchup.spreadDisplay}`}
                      </div>
                      <div className="text-xs text-muted-foreground">Spread</div>
                    </div>
                    
                    <Badge variant="outline" className="bg-muted/50">
                      {matchup.isTeamAFavored ? `${matchup.teamAInfo.displayName} Favored` : `${matchup.teamBInfo?.displayName || 'Opponent'} Favored`}
                    </Badge>
                  </div>
                </div>

                {/* Team B */}
                <div className="text-center space-y-3">
                  <div className="flex flex-col items-center gap-2">
                    <Avatar className="h-16 w-16 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {matchup.b ? getRosterInfo(matchup.b.roster_id).displayName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'BYE'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-bold">
                        {matchup.b ? getRosterInfo(matchup.b.roster_id).displayName : 'BYE'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {matchup.b ? `@${getRosterInfo(matchup.b.roster_id).ownerUsername}` : 'No opponent'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {matchup.b ? matchup.bProjectedTotal.toFixed(1) : '--'}
                      </div>
                      <div className="text-xs text-muted-foreground">Projected Points</div>
                    </div>
                    
                    {!matchup.isTeamAFavored && matchup.b && (
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        -{matchup.spreadDisplay}
                      </Badge>
                    )}
                  </div>

                  {/* Bet Button for Team B */}
                  {matchup.b && (
                    <Button 
                      onClick={() => handleBetOffer(index, 'teamB')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Bet on {getRosterInfo(matchup.b.roster_id).displayName}
                    </Button>
                  )}
                </div>
              </div>

              {/* Projection Details */}
              {projections.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3">Projection Source</h4>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>FantasyPros • Week 1 • PPR Scoring</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bet Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirm Your Bet</DialogTitle>
          </DialogHeader>
          
          {betOffer && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Bet Details</h4>
                <p className="text-sm text-muted-foreground">{betOffer.betType}</p>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="tokenAmount" className="text-sm font-semibold">
                  How many tokens do you want to bet?
                </Label>
                <Input
                  id="tokenAmount"
                  type="number"
                  min="1"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
                  className="h-12 text-base"
                  placeholder="Enter token amount"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum bet: 1 token
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createBet}
                  disabled={isCreatingBet || tokenAmount < 1}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {isCreatingBet ? "Creating..." : `Bet ${tokenAmount} Tokens`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Info Box */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>How it works:</strong> Click "Bet on [Team]" to place a wager on either side of the spread.
            </p>
            <p className="mb-2">
              Positive spread means the team is favored by that many points. 
              Negative spread means the team is an underdog by that many points.
            </p>
            <p>
              Your bet will appear in the Wagers tab once confirmed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
