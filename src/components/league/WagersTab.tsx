import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings, DollarSign } from "lucide-react";
import React from "react";

interface Props { leagueId: string }

interface BetRow {
  id: string;
  type: string;
  status: string;
  token_amount: number;
  created_by: string;
  accepted_by: string | null;
  created_at: string;
  accepted_at: string | null;
  settled_at: string | null;
  outcome: string | null;
  terms?: any;
}

interface User {
  user_id: string;
}

export default function WagersTab({ leagueId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("offered");
  const [isCounterOfferOpen, setIsCounterOfferOpen] = useState(false);
  const [counterOfferData, setCounterOfferData] = useState<{
    originalBet: BetRow | null;
    adjustedSpread: number;
    payoutRatio: number;
    tokenAmount: number;
  }>({
    originalBet: null,
    adjustedSpread: 0,
    payoutRatio: 2.0,
    tokenAmount: 10
  });

  const betsQuery = useQuery({
    queryKey: ["bets", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bets")
        .select("id,type,status,token_amount,created_by,accepted_by,created_at,accepted_at,settled_at,outcome,terms")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BetRow[];
    },
  });

  const usersQuery = useQuery({
    queryKey: ["league-users", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId);
      if (error) throw error;
      return (data ?? []) as User[];
    },
  });

  const acceptBet = async (bet: BetRow) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("bets")
        .update({ 
          status: "active", 
          accepted_by: uid,
          accepted_at: new Date().toISOString() 
        })
        .eq("id", bet.id);
      
      if (error) throw error;
      toast({ title: "Bet accepted", description: "You joined this bet." });
      await qc.invalidateQueries({ queryKey: ["bets", leagueId] });
    } catch (err: any) {
      toast({ title: "Error accepting bet", description: err.message });
    }
  };

  const getUserDisplayName = (userId: string) => {
    // For now, just show a shortened user ID since we can't access other users' profiles
    return `@${userId.slice(0, 8)}...`;
  };

  const openCounterOffer = (bet: BetRow) => {
    // Extract the current spread from the bet type
    const spreadMatch = bet.type.match(/[+-]?\d+\.?\d*/);
    const currentSpread = spreadMatch ? parseFloat(spreadMatch[0]) : 0;
    
    // For counter offers, we want the OPPOSITE position
    // If original bet is "Team A +3.5", counter should default to "Team B -3.5"
    // So we flip the sign of the spread
    const oppositeSpread = -currentSpread;
    
    // Set competitive default payout (slightly better than original to attract attention)
    const originalPayoutRatio = bet.terms?.payoutRatio || 2.0;
    const competitivePayoutRatio = Math.min(originalPayoutRatio + 0.1, 5.0);
    
    setCounterOfferData({
      originalBet: bet,
      adjustedSpread: oppositeSpread,
      payoutRatio: competitivePayoutRatio,
      tokenAmount: bet.token_amount
    });
    setIsCounterOfferOpen(true);
  };

  const createCounterOffer = async () => {
    if (!counterOfferData.originalBet) return;
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");
      
      // Create the opposite position bet type with the adjusted spread
      const originalBetType = counterOfferData.originalBet.type;
      const oppositeBetType = getOppositePosition(originalBetType, { adjustedSpread: counterOfferData.adjustedSpread });
      
      // Create a new bet with the counter offer terms
      const { error } = await supabase.from("bets").insert({
        league_id: leagueId,
        created_by: uid,
        type: oppositeBetType,
        status: "offered",
        token_amount: counterOfferData.tokenAmount,
        terms: {
          originalBetId: counterOfferData.originalBet.id,
          adjustedSpread: counterOfferData.adjustedSpread,
          payoutRatio: counterOfferData.payoutRatio,
          isCounterOffer: true,
          counterTo: originalBetType
        }
      });
      
      if (error) throw error;
      
      toast({ title: "Counter offer created", description: "Your counter offer has been posted." });
      setIsCounterOfferOpen(false);
      await qc.invalidateQueries({ queryKey: ["bets", leagueId] });
    } catch (err: any) {
      toast({ title: "Error creating counter offer", description: err.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "offered":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Offered</Badge>;
      case "active":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "settled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-100">Settled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filterBetsByStatus = (status: string) => {
    return betsQuery.data?.filter(bet => bet.status === status) || [];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to get the opposite position for display with adjusted spreads
  const getOppositePosition = (betType: string, terms?: any) => {
    // Parse the bet type to extract the spread and create opposite position
    // Example: "Team A +1.9 vs Team B" becomes "Team B -1.9 vs Team A"
    const match = betType.match(/^(.+?)\s+([+-]\d+\.?\d*)\s+vs\s+(.+)$/);
    if (match) {
      const [, team1, spread, team2] = match;
      const oppositeSpread = spread.startsWith('+') ? spread.replace('+', '-') : spread.replace('-', '+');
      return `${team2} ${oppositeSpread} vs ${team1}`;
    }
    
    // If we can't parse the bet type, try to use the terms data
    if (terms?.adjustedSpread !== undefined) {
      // This is a more complex bet, try to reconstruct the opposite position
      const adjustedSpread = terms.adjustedSpread;
      const spreadText = adjustedSpread > 0 ? `+${adjustedSpread.toFixed(1)}` : `${adjustedSpread.toFixed(1)}`;
      
      // For now, return a simplified version
      return `Opposite Side ${spreadText}`;
    }
    
    return betType; // Return original if we can't parse it
  };

  // Function to get the position that the acceptor will be taking (with adjusted spreads)
  const getAcceptorPosition = (bet: BetRow) => {
    // If the bet has an adjusted spread in terms, use that
    if (bet.terms?.adjustedSpread !== undefined) {
      const adjustedSpread = bet.terms.adjustedSpread;
      const spreadText = adjustedSpread > 0 ? `+${adjustedSpread.toFixed(1)}` : `${adjustedSpread.toFixed(1)}`;
      
      // Parse the original bet type to get team names
      const match = bet.type.match(/^(.+?)\s+[+-]\d+\.?\d*\s+vs\s+(.+)$/);
      if (match) {
        const [, team1, team2] = match;
        // The acceptor takes the opposite side, so flip the teams
        return `${team2} ${spreadText} vs ${team1}`;
      }
    }
    
    // Fallback to the opposite position calculation
    return getOppositePosition(bet.type, bet.terms);
  };

  // Function to calculate payout based on custom payout ratio
  const calculatePayout = (tokenAmount: number, payoutRatio?: number) => {
    console.log('calculatePayout called with:', { tokenAmount, payoutRatio, terms: payoutRatio });
    if (payoutRatio && payoutRatio > 1.0) {
      return tokenAmount * payoutRatio;
    }
    return tokenAmount * 2; // Default 2x payout
  };

  // Function to get the payout from the acceptor's perspective
  const getAcceptorPayout = (bet: BetRow) => {
    const payoutRatio = bet.terms?.payoutRatio || 2.0;
    const originalWinAmount = bet.token_amount * payoutRatio;
    const originalRiskAmount = bet.token_amount;
    
    // The acceptor takes the opposite side, so they risk the original win amount to win the original risk amount
    const acceptorRiskAmount = originalWinAmount; // What acceptor risks (original win amount)
    const acceptorWinAmount = originalRiskAmount; // What acceptor wins (original risk amount)
    const totalPot = acceptorRiskAmount + acceptorWinAmount; // Total potential payout
    
    return {
      riskAmount: acceptorRiskAmount, // What acceptor risks (what they lose if they lose)
      winAmount: acceptorWinAmount, // What acceptor wins
      totalPot: totalPot, // Total potential payout
      payoutRatio: payoutRatio
    };
  };

  // Function to get payout display text
  const getPayoutDisplay = (bet: BetRow) => {
    console.log('getPayoutDisplay called with bet:', bet);
    const payoutRatio = bet.terms?.payoutRatio;
    console.log('Extracted payoutRatio:', payoutRatio);
    if (payoutRatio && payoutRatio > 1.0) {
      return `${payoutRatio.toFixed(1)}x payout`;
    }
    return "2x payout";
  };

  // Function to get settlement details for display
  const getSettlementDetails = (bet: BetRow) => {
    if (bet.status !== 'settled' || !bet.terms?.game_result) {
      return null;
    }

    const gameResult = bet.terms.game_result;
    return {
      homeScore: gameResult.home_roster_points,
      awayScore: gameResult.away_roster_points,
      settlementDate: bet.terms.settlement_date,
      settlementReason: bet.terms.settlement_reason
    };
  };

  return (
    <div className="space-y-6">
      {/* Payout System Explanation */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="font-semibold text-blue-800 mb-2">🎯 Understanding Wager Payouts</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <div><strong>Example:</strong> If you offer a wager risking 10 tokens to win 20 tokens...</div>
              <div>• <strong>You risk:</strong> 10 tokens | <strong>You win:</strong> 20 tokens</div>
              <div>• <strong>Acceptor risks:</strong> 20 tokens | <strong>Acceptor wins:</strong> 10 tokens</div>
              <div>• <strong>Total potential payout:</strong> 30 tokens (10 risked + 20 risked)</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Wagers Tabs */}
      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Your Wagers</CardTitle>
          <div className="text-sm text-muted-foreground mt-2">
            <strong>How it works:</strong> When you offer a wager, you risk X tokens to win Y tokens. 
            When someone accepts, they risk Y tokens to win X tokens (opposite side). The total potential payout is always X+Y tokens.
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger 
                value="offered" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Offered Wagers
                <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                  {filterBetsByStatus("offered").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Active Wagers
                <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                  {filterBetsByStatus("active").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="past" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Past Wagers
                <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-800">
                  {filterBetsByStatus("settled").length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Offered Wagers Tab */}
            <TabsContent value="offered" className="mt-6">
              {betsQuery.isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading offered wagers...</p>
                </div>
              )}
              
              {betsQuery.isError && (
                <div className="text-center py-8">
                  <p className="text-destructive">Failed to load wagers.</p>
                </div>
              )}
              
              {filterBetsByStatus("offered").length === 0 && !betsQuery.isLoading && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Offered Wagers</h3>
                  <p className="text-sm text-muted-foreground">Go to the Sportsbook tab to place bets on matchups!</p>
                </div>
              )}
              
              <div className="space-y-4">
                {filterBetsByStatus("offered").map((bet) => (
                  <Card key={bet.id} className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent hover:shadow-md transition-all duration-200">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-foreground">{getAcceptorPosition(bet)}</h3>
                            {getStatusBadge(bet.status)}
                            {bet.terms?.isCounterOffer && (
                              <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
                                Counter Offer
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Risk Amount:</span>
                              <div className="font-semibold text-lg text-blue-700">{getAcceptorPayout(bet).riskAmount} tokens</div>
                              <div className="text-xs text-muted-foreground">What you lose if you lose</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Win Amount:</span>
                              <div className="font-semibold text-lg text-green-700">
                                {getAcceptorPayout(bet).winAmount} tokens
                              </div>
                              <div className="text-xs text-muted-foreground">
                                What you win if you win
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Potential Payout:</span>
                              <div className="font-semibold text-lg text-purple-700">{getAcceptorPayout(bet).totalPot} tokens</div>
                              <div className="text-xs text-muted-foreground">Risk + Win amounts</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Offered by:</span>
                              <div className="font-medium">{getUserDisplayName(bet.created_by)}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <div className="font-medium">{formatDate(bet.created_at)}</div>
                            </div>
                          </div>
                          
                          {/* Original Bettor's Position */}
                          <div className="pt-2 border-t bg-gray-50 p-2 rounded">
                            <span className="text-black text-sm font-medium">Original Bettor:</span>
                            <span className="text-black text-sm ml-2">
                              <strong>Spread:</strong> {bet.type} | <strong>Risk:</strong> {bet.token_amount} tokens | <strong>Win:</strong> {getAcceptorPayout(bet).winAmount} tokens | <strong>Total Payout:</strong> {getAcceptorPayout(bet).totalPot} tokens
                            </span>
                          </div>
                          
                          {bet.terms?.description && (
                            <div className="pt-2 border-t">
                              <span className="text-muted-foreground text-sm">Terms:</span>
                              <div className="font-medium text-sm">{bet.terms.description}</div>
                            </div>
                          )}
                          
                          {bet.terms?.isCounterOffer && (
                            <div className="pt-2 border-t">
                              <span className="text-muted-foreground text-sm">Countering:</span>
                              <div className="font-medium text-sm text-orange-600">
                                {bet.terms?.counterTo || bet.type}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 ml-4">
                          <Button 
                            onClick={() => acceptBet(bet)}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            Accept Bet
                          </Button>
                          <Button 
                            onClick={() => openCounterOffer(bet)}
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 px-6 py-2 font-semibold transition-all duration-200"
                          >
                            Counter Offer
                          </Button>
                          <span className="text-xs text-muted-foreground text-center">Join this wager</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Active Wagers Tab */}
            <TabsContent value="active" className="mt-6">
              {filterBetsByStatus("active").length === 0 && !betsQuery.isLoading && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⚡</div>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Active Wagers</h3>
                  <p className="text-sm text-muted-foreground">Accept a bet to see it here!</p>
                </div>
              )}
              
              <div className="space-y-4">
                {filterBetsByStatus("active").map((bet) => (
                  <Card key={bet.id} className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent hover:shadow-md transition-all duration-200">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{getAcceptorPosition(bet)}</h3>
                          {getStatusBadge(bet.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Your Risk:</span>
                            <div className="font-semibold text-lg text-blue-700">{bet.token_amount} tokens</div>
                            <div className="text-xs text-muted-foreground">What you lose if you lose</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Your Win:</span>
                            <div className="font-semibold text-lg text-green-700">
                                {getAcceptorPayout(bet).winAmount} tokens
                              </div>
                              <div className="text-xs text-muted-foreground">
                                What you win if you win
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Offered by:</span>
                              <div className="font-medium">{getUserDisplayName(bet.created_by)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Accepted by:</span>
                              <div className="font-medium">{getUserDisplayName(bet.accepted_by!)}</div>
                            </div>
                          </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Started:</span>
                            <div className="font-medium">{formatDate(bet.accepted_at!)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Pot:</span>
                            <div className="font-semibold text-lg text-purple-700">{getAcceptorPayout(bet).totalPot} tokens</div>
                          </div>
                        </div>
                        
                        {bet.terms?.description && (
                          <div className="pt-2 border-t">
                            <span className="text-muted-foreground text-sm">Terms:</span>
                            <div className="font-medium text-sm">{bet.terms.description}</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Past Wagers Tab */}
            <TabsContent value="past" className="mt-6">
              {filterBetsByStatus("settled").length === 0 && !betsQuery.isLoading && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏆</div>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Past Wagers</h3>
                  <p className="text-sm text-muted-foreground">Completed bets will appear here!</p>
                </div>
              )}
              
              <div className="space-y-4">
                {filterBetsByStatus("settled").map((bet) => {
                  const settlementDetails = getSettlementDetails(bet);
                  
                  return (
                    <Card key={bet.id} className="border-l-4 border-l-gray-500 bg-gradient-to-r from-gray-50/50 to-transparent hover:shadow-md transition-all duration-200">
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-foreground">{getAcceptorPosition(bet)}</h3>
                            {getStatusBadge(bet.status)}
                            {bet.outcome && (
                              <Badge variant={bet.outcome === 'won' ? 'default' : 
                                            bet.outcome === 'lost' ? 'destructive' : 'secondary'}>
                                {bet.outcome === 'won' ? 'Won' : 
                                 bet.outcome === 'lost' ? 'Lost' : 'Push'}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Your Risk:</span>
                              <div className="font-semibold text-lg text-blue-700">{bet.token_amount} tokens</div>
                              <div className="text-xs text-muted-foreground">What you would have lost</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Your Win:</span>
                              <div className="font-semibold text-lg text-green-700">
                                {calculatePayout(bet.token_amount, bet.terms?.payoutRatio)} tokens
                              </div>
                              <div className="text-xs text-muted-foreground">
                                What you would have won
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Offered by:</span>
                              <div className="font-medium">{getUserDisplayName(bet.created_by)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Accepted by:</span>
                              <div className="font-medium">{getUserDisplayName(bet.accepted_by!)}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Settled:</span>
                              <div className="font-medium">{bet.settled_at ? formatDate(bet.settled_at) : 'Pending'}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Pot:</span>
                              <div className="font-semibold text-lg text-purple-700">{bet.token_amount * 2} tokens</div>
                            </div>
                          </div>
                          
                          {/* Settlement Details */}
                          {settlementDetails && (
                            <div className="pt-2 border-t">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Final Score:</span>
                                  <div className="font-medium">{settlementDetails.homeScore} - {settlementDetails.awayScore}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Settlement Date:</span>
                                  <div className="font-medium">{settlementDetails.settlementDate ? formatDate(settlementDetails.settlementDate) : 'N/A'}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Reason:</span>
                                  <div className="font-medium">{settlementDetails.settlementReason || 'Game completed'}</div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {bet.terms?.description && (
                            <div className="pt-2 border-t">
                              <span className="text-muted-foreground text-sm">Terms:</span>
                              <div className="font-medium text-sm">{bet.terms.description}</div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Counter Offer Dialog */}
      <Dialog open={isCounterOfferOpen} onOpenChange={setIsCounterOfferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Make Counter Offer
            </DialogTitle>
          </DialogHeader>
          
          {counterOfferData.originalBet && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Original Bet</h4>
                <p className="text-sm text-muted-foreground">{counterOfferData.originalBet.type}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Offered by: {getUserDisplayName(counterOfferData.originalBet.created_by)}
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm mb-2 text-blue-700">Your Counter Position</h4>
                <p className="text-sm text-blue-600">
                  {getOppositePosition(counterOfferData.originalBet.type, { adjustedSpread: counterOfferData.adjustedSpread })}
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  You're taking the opposite side of this bet
                </p>
                <div className="mt-2 p-2 bg-blue-100 rounded text-xs text-blue-700">
                  <strong>Example:</strong> If original bet risks 10 tokens to win 25, 
                  you risk 10 tokens to win 25. Total potential payout: 35 tokens.
                </div>
              </div>
              
              {/* Spread Adjustment */}
              <div className="space-y-3">
                <Label htmlFor="counterSpread" className="text-sm font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Adjust Opposite Spread
                </Label>
                <Input
                  id="counterSpread"
                  type="number"
                  step="0.1"
                  value={counterOfferData.adjustedSpread}
                  onChange={(e) => {
                    const newSpread = parseFloat(e.target.value) || 0;
                    setCounterOfferData(prev => ({ ...prev, adjustedSpread: newSpread }));
                  }}
                  className="h-12 text-base"
                  placeholder="Enter adjusted spread"
                />
                <div className="text-xs text-muted-foreground">
                  Current: {counterOfferData.adjustedSpread > 0 ? `+${counterOfferData.adjustedSpread.toFixed(1)}` : counterOfferData.adjustedSpread.toFixed(1)}
                  <br />
                  Adjust this spread to make your counter offer more attractive
                </div>
              </div>
              
              {/* Payout Ratio Adjustment */}
              <div className="space-y-3">
                <Label htmlFor="counterPayoutRatio" className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Payout Ratio: {counterOfferData.payoutRatio.toFixed(1)}x
                </Label>
                <div className="space-y-2">
                  <input
                    id="counterPayoutRatio"
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={counterOfferData.payoutRatio}
                    onChange={(e) => setCounterOfferData(prev => ({ ...prev, payoutRatio: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((counterOfferData.payoutRatio - 1) / 4) * 100}%, #e5e7eb ${((counterOfferData.payoutRatio - 1) / 4) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1.0x</span>
                    <span>2.0x</span>
                    <span>3.0x</span>
                    <span>4.0x</span>
                    <span>5.0x</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong>Your win amount:</strong> {counterOfferData.tokenAmount * counterOfferData.payoutRatio} tokens
                  <br />
                  <strong>Total potential payout:</strong> {counterOfferData.tokenAmount + (counterOfferData.tokenAmount * counterOfferData.payoutRatio)} tokens
                </div>
              </div>
              
              {/* Token Amount */}
              <div className="space-y-3">
                <Label htmlFor="counterTokenAmount" className="text-sm font-semibold">
                  Your Risk Amount
                </Label>
                <Input
                  id="counterTokenAmount"
                  type="number"
                  min="1"
                  value={counterOfferData.tokenAmount}
                  onChange={(e) => setCounterOfferData(prev => ({ ...prev, tokenAmount: parseInt(e.target.value) || 0 }))}
                  className="h-12 text-base"
                  placeholder="Enter token amount"
                />
                <div className="text-xs text-muted-foreground">
                  This is what you lose if you lose. You'll win {counterOfferData.tokenAmount * counterOfferData.payoutRatio} tokens if you're right.
                </div>
              </div>
              
              {/* Summary */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-sm mb-2 text-green-700">Bet Summary</h4>
                <div className="text-sm text-green-600 space-y-1">
                  <div><strong>You risk:</strong> {counterOfferData.tokenAmount} tokens</div>
                  <div><strong>You win:</strong> {counterOfferData.tokenAmount * counterOfferData.payoutRatio} tokens</div>
                  <div><strong>Total potential payout:</strong> {counterOfferData.tokenAmount + (counterOfferData.tokenAmount * counterOfferData.payoutRatio)} tokens</div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCounterOfferOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createCounterOffer}
                  disabled={counterOfferData.tokenAmount < 1}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Create Counter Offer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
