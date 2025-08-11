import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function Join() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Join a League | league-lever";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Join a league using your invitation code on league-lever.");
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", window.location.origin + "/join");
      document.head.appendChild(link);
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!code.trim()) {
      toast({ title: "Enter a code", description: "Please paste your invitation code." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("accept_invite", { _invite_code: code.trim() });
      if (error) throw error;
      const leagueId = (data as any)?.league_id as string | undefined;
      toast({ title: "Joined league", description: "Welcome!" });
      if (leagueId) navigate(`/leagues/${leagueId}`);
    } catch (err: any) {
      toast({ title: "Join failed", description: err.message ?? "Invalid or expired invite." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Join a League</h1>
      <Card>
        <CardHeader>
          <CardTitle>Enter your invitation code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="code">Invitation code</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste code here" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Joining..." : "Join league"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
