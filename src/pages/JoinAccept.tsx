import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function JoinAccept() {
  const { invite_code } = useParams<{ invite_code: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = invite_code ?? "";
    document.title = `Join League ${code} | league-lever`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", `Accept your invitation code ${code} to join a league on league-lever.`);
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", window.location.origin + `/join/${code}`);
      document.head.appendChild(link);
    }
  }, [invite_code]);

  const handleAccept = async () => {
    if (!invite_code) return;
    setLoading(true);
    try {
      // Temporarily disable invite functionality
      toast({ title: "Feature unavailable", description: "Invite system is being updated." });
      // const leagueId = undefined;
      // toast({ title: "Invitation accepted", description: "Welcome to the league!" });
      // if (leagueId) navigate(`/leagues/${leagueId}`);
    } catch (err: any) {
      toast({ title: "Join failed", description: err.message ?? "Invalid or expired invite." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Accept Invitation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invitation Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Code: <span className="font-mono">{invite_code}</span>
            </div>
            <Button onClick={handleAccept} disabled={loading}>
              {loading ? "Joining..." : "Accept invite"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
