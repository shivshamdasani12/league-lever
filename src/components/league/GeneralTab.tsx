import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { triggerSleeperSyncAll } from "@/lib/queries/league";

interface Props { leagueId: string; leagueName: string; teamsCount: number; }

export default function GeneralTab({ leagueId, leagueName, teamsCount }: Props) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await triggerSleeperSyncAll(leagueId);
      toast({ title: "Sync started", description: "Syncing league data. Refresh in a few seconds." });
      await qc.invalidateQueries();
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore members query
  const membersQ = useQuery({
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

  const createInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setCreatingInvite(true);
    try {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { error } = await supabase.from("invitations").insert({
        league_id: leagueId,
        email: inviteEmail.trim(),
        code,
        invited_by: (await supabase.auth.getUser()).data.user?.id,
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

  return (
    <div className="space-y-4">
      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">League</div>
              <div className="font-medium">{leagueName}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Members</div>
              <div className="font-medium">{teamsCount}</div>
            </div>
              {/* Sync button removed to keep data automatic */}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle>Invite Member</CardTitle>
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

      <Card className="bg-card border shadow-card">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersQ.isLoading && <p className="text-muted-foreground">Loading members...</p>}
          {membersQ.isError && <p className="text-destructive">Failed to load members.</p>}
          {membersQ.data?.length === 0 && !membersQ.isLoading && (
            <p className="text-muted-foreground">No members yet — invite someone to get started.</p>
          )}
          <ul className="space-y-2">
            {membersQ.data?.map((m: any) => (
              <li key={m.id} className="text-sm">
                <span className="font-mono">{m.user_id}</span> – {m.role}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
