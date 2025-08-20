import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="space-y-6">
      {/* Wagers Tabs */}
      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Your Wagers</CardTitle>
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
                            <h3 className="text-lg font-semibold text-foreground">{bet.type}</h3>
                            {getStatusBadge(bet.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Amount:</span>
                              <div className="font-semibold text-lg text-primary">{bet.token_amount} tokens</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Offered by:</span>
                              <div className="font-medium">{getUserDisplayName(bet.created_by)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created:</span>
                              <div className="font-medium">{formatDate(bet.created_at)}</div>
                            </div>
                            {bet.terms?.description && (
                              <div>
                                <span className="text-muted-foreground">Terms:</span>
                                <div className="font-medium">{bet.terms.description}</div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 ml-4">
                          <Button 
                            onClick={() => acceptBet(bet)}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            Accept Bet
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
                          <h3 className="text-lg font-semibold text-foreground">{bet.type}</h3>
                          {getStatusBadge(bet.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount:</span>
                            <div className="font-semibold text-lg text-primary">{bet.token_amount} tokens</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Offered by:</span>
                            <div className="font-medium">{getUserDisplayName(bet.created_by)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Accepted by:</span>
                            <div className="font-medium">{getUserDisplayName(bet.accepted_by!)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Started:</span>
                            <div className="font-medium">{formatDate(bet.accepted_at!)}</div>
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
                {filterBetsByStatus("settled").map((bet) => (
                  <Card key={bet.id} className="border-l-4 border-l-gray-500 bg-gradient-to-r from-gray-50/50 to-transparent hover:shadow-md transition-all duration-200">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{bet.type}</h3>
                          {getStatusBadge(bet.status)}
                          {bet.outcome && (
                            <Badge variant={bet.outcome === 'won' ? 'default' : 'destructive'}>
                              {bet.outcome === 'won' ? 'Won' : 'Lost'}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount:</span>
                            <div className="font-semibold text-lg text-primary">{bet.token_amount} tokens</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Offered by:</span>
                            <div className="font-medium">{getUserDisplayName(bet.created_by)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Accepted by:</span>
                            <div className="font-medium">{getUserDisplayName(bet.accepted_by!)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Settled:</span>
                            <div className="font-medium">{bet.settled_at ? formatDate(bet.settled_at) : 'Pending'}</div>
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
