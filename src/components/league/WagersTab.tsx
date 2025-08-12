import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

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
}

export default function WagersTab({ leagueId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [betType, setBetType] = useState("");
  const [betAmount, setBetAmount] = useState<number>(10);
  const [creatingBet, setCreatingBet] = useState(false);

  const betsQuery = useQuery({
    queryKey: ["bets", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bets")
        .select("id,type,status,token_amount,created_by,accepted_by,created_at,accepted_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BetRow[];
    },
  });

  const createBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!betType.trim()) return;
    setCreatingBet(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase.from("bets").insert({
        league_id: leagueId,
        created_by: uid,
        type: betType.trim(),
        token_amount: Number(betAmount) || 0,
      });
      if (error) throw error;
      setBetType("");
      setBetAmount(10);
      toast({ title: "Bet offered", description: "Your bet is now available to accept." });
      await qc.invalidateQueries({ queryKey: ["bets", leagueId] });
    } catch (err: any) {
      toast({ title: "Error creating bet", description: err.message });
    } finally {
      setCreatingBet(false);
    }
  };

  const acceptBet = async (bet: BetRow) => {
    try {
      const { error } = await supabase
        .from("bets")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", bet.id);
      if (error) throw error;
      toast({ title: "Bet accepted", description: "You joined this bet." });
      await qc.invalidateQueries({ queryKey: ["bets", leagueId] });
    } catch (err: any) {
      toast({ title: "Error accepting bet", description: err.message });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle>Offer a Bet</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createBet} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="betType">Bet description</Label>
              <Input id="betType" placeholder="e.g., Team A beats Team B" value={betType} onChange={(e) => setBetType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="betAmount">Token amount</Label>
              <Input id="betAmount" type="number" min={1} value={betAmount} onChange={(e) => setBetAmount(parseInt(e.target.value || "0", 10))} />
            </div>
            <Button type="submit" disabled={!betType.trim() || creatingBet}>
              {creatingBet ? "Offering..." : "Offer bet"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle>Open & Recent Bets</CardTitle>
        </CardHeader>
        <CardContent>
          {betsQuery.isLoading && <p className="text-muted-foreground">Loading bets...</p>}
          {betsQuery.isError && <p className="text-destructive">Failed to load bets.</p>}
          {betsQuery.data?.length === 0 && !betsQuery.isLoading && (
            <p className="text-muted-foreground">No bets yet. Offer one above.</p>
          )}
          <ul className="space-y-3">
            {betsQuery.data?.map((b) => (
              <li key={b.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{b.type}</div>
                  <div className="text-sm text-muted-foreground">
                    {b.token_amount} tokens • {b.status}
                  </div>
                </div>
                {b.status === "offered" && (
                  <Button size="sm" onClick={() => acceptBet(b)}>Accept</Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
