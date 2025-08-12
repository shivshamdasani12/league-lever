import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RostersTab from "@/components/league/RostersTab";
import MatchupsTab from "@/components/league/MatchupsTab";
import StandingsTab from "@/components/league/StandingsTab";

interface Bet {
  id: string;
  type: string;
  status: string;
  token_amount: number;
  created_by: string;
  accepted_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const leagueId = useMemo(() => id ?? "", [id]);

  useEffect(() => {
    document.title = "League Details | league-lever";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "View league members and bets on league-lever.");
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", window.location.origin + `/leagues/${leagueId}`);
      document.head.appendChild(link);
    }
  }, [leagueId]);

  const leagueQuery = useQuery({
    queryKey: ["league", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leagues")
        .select("id,name,created_at,updated_at,created_by")
        .eq("id", leagueId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("League not found");
      return data as { id: string; name: string; created_at: string; updated_at: string; created_by: string };
    },
  });

  const membersQuery = useQuery({
    queryKey: ["league-members", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_members")
        .select("id,user_id,role,joined_at")
        .eq("league_id", leagueId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

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
      return (data ?? []) as Bet[];
    },
  });

  const [betType, setBetType] = useState("");
  const [betAmount, setBetAmount] = useState<number>(10);
  const [creatingBet, setCreatingBet] = useState(false);

  // Invitations
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);


  const createBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !betType.trim()) return;
    setCreatingBet(true);
    try {
      const { error } = await supabase.from("bets").insert({
        league_id: leagueId,
        created_by: user.id,
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

  const createInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteEmail.trim()) return;
    setCreatingInvite(true);
    try {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { error } = await supabase.from("invitations").insert({
        league_id: leagueId,
        invited_by: user.id,
        email: inviteEmail.trim(),
        code,
      });
      if (error) throw error;
      setCreatedCode(code);
      setInviteEmail("");
      toast({ title: "Invitation created", description: "Share the code with your friend to join." });
    } catch (err: any) {
      toast({ title: "Error creating invitation", description: err.message });
    } finally {
      setCreatingInvite(false);
    }
  };

  const acceptBet = async (bet: Bet) => {
    if (!user) return;
    if (bet.created_by === user.id) {
      toast({ title: "Cannot accept", description: "You cannot accept your own bet." });
      return;
    }
    try {
      const { error } = await supabase
        .from("bets")
        .update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() })
        .eq("id", bet.id);
      if (error) throw error;
      toast({ title: "Bet accepted", description: "You joined this bet." });
      await qc.invalidateQueries({ queryKey: ["bets", leagueId] });
    } catch (err: any) {
      toast({ title: "Error accepting bet", description: err.message });
    }
  };
  if (leagueQuery.isLoading) return <div className="p-4">Loading league...</div>;
  if (leagueQuery.isError) return <div className="p-4 text-destructive">Failed to load league.</div>;

  const league = leagueQuery.data!;

  return (
    <section className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">{league.name}</h1>

      <Tabs defaultValue="rosters" className="mb-6">
        <TabsList>
          <TabsTrigger value="rosters">Rosters</TabsTrigger>
          <TabsTrigger value="matchups">Matchups</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
        </TabsList>
        <TabsContent value="rosters">
          <RostersTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="matchups">
          <MatchupsTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="standings">
          <StandingsTab leagueId={leagueId} />
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            {membersQuery.isLoading && <p className="text-muted-foreground">Loading members...</p>}
            {membersQuery.isError && <p className="text-destructive">Failed to load members.</p>}
            {membersQuery.data?.length === 0 && !membersQuery.isLoading && (
              <p className="text-muted-foreground">No members yet.</p>
            )}
            <ul className="space-y-2">
              {membersQuery.data?.map((m: any) => (
                <li key={m.id} className="text-sm">
                  <span className="font-mono">{m.user_id}</span> – {m.role}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offer a bet</CardTitle>
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
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Invite members</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvitation} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="inviteEmail">Email</Label>
              <Input id="inviteEmail" type="email" placeholder="friend@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={creatingInvite}>
              {creatingInvite ? "Creating..." : "Create invite code"}
            </Button>
            {createdCode && (
              <p className="text-sm text-muted-foreground">
                Code: <span className="font-mono">{createdCode}</span> — Share link: <a href={`/join/${createdCode}`} className="underline">/join/{createdCode}</a>
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Bets</CardTitle>
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
                {b.status === "offered" && user && b.created_by !== user.id && (
                  <Button size="sm" onClick={() => acceptBet(b)}>Accept</Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-4">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
      </div>
    </section>
  );
}
