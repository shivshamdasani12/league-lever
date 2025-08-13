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
import GeneralTab from "@/components/league/GeneralTab";
import WagersTab from "@/components/league/WagersTab";

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

      <Tabs defaultValue="general" className="mb-6">
        <div className="flex justify-center">
          <TabsList className="mx-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="rosters">Rosters</TabsTrigger>
            <TabsTrigger value="matchups">Matchups</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="wagers">Wagers</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="general">
          <GeneralTab leagueId={leagueId} leagueName={league.name} teamsCount={0} />
        </TabsContent>
        <TabsContent value="rosters">
          <RostersTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="matchups">
          <MatchupsTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="standings">
          <StandingsTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="wagers">
          <WagersTab leagueId={leagueId} />
        </TabsContent>
      </Tabs>

      {/* Content below tabs removed; now handled inside General and Wagers tabs */}


      <div className="mt-4">
        <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
      </div>
    </section>
  );
}
