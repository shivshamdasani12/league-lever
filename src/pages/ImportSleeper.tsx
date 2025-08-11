import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const currentNFLSeason = () => {
  const now = new Date();
  return now.getFullYear();
};

export default function ImportSleeper() {
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Import from Sleeper | league-lever";
  }, []);

  const [mode, setMode] = useState<"username" | "leagueId">("username");
  const [username, setUsername] = useState("");
  const [leagueIdInput, setLeagueIdInput] = useState("");
  const [season, setSeason] = useState<number>(currentNFLSeason());

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [lookup, setLookup] = useState<{ user_id: string; username: string; display_name?: string | null } | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);

  const years = useMemo(() => {
    const y: number[] = [];
    for (let i = currentNFLSeason() + 1; i >= 2018; i--) y.push(i);
    return y;
  }, []);

  const handleContinueFromStep1 = async () => {
    try {
      setLoading(true);
      if (mode === "username") {
        const { data, error } = await supabase.functions.invoke("sleeper-lookup-user", {
          body: { username: username.trim() },
        });
        if (error) throw error;
        setLookup(data);
        const { data: leaguesData, error: leaguesErr } = await supabase.functions.invoke("sleeper-user-leagues", {
          body: { user_id: data.user_id, season },
        });
        if (leaguesErr) throw leaguesErr;
        setLeagues(leaguesData || []);
        setStep(2);
      } else {
        if (!leagueIdInput.trim()) {
          toast({ title: "Enter a League ID", description: "Please provide a Sleeper League ID." });
          return;
        }
        setSelectedLeagueId(leagueIdInput.trim());
        setStep(3);
      }
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const proceedToReview = async () => {
    if (!selectedLeagueId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("sleeper-league-snapshot", {
        body: { league_id: selectedLeagueId },
      });
      if (error) throw error;
      setSnapshot(data);
      setStep(3);
    } catch (e: any) {
      toast({ title: "Failed to fetch league", description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedLeagueId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("sleeper-import", {
        body: { league_id: selectedLeagueId },
      });
      if (error) throw error;
      toast({ title: "Import complete", description: "League data imported successfully." });
      if (data?.league_id) navigate(`/leagues/${data.league_id}`);
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 pb-16">
      <h1 className="text-2xl font-bold mb-6">Import from Sleeper</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 1 — Choose Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <RadioGroupItem value="username" id="by-username" />
              <Label htmlFor="by-username">By Username</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-md">
              <RadioGroupItem value="leagueId" id="by-league" />
              <Label htmlFor="by-league">By League ID</Label>
            </div>
          </RadioGroup>

          {mode === "username" ? (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="username">Sleeper Username</Label>
                <Input id="username" placeholder="ex: johndoe" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="season">Season</Label>
                <select
                  id="season"
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="leagueId">Sleeper League ID</Label>
              <Input id="leagueId" placeholder="ex: 123456789012345678" value={leagueIdInput} onChange={(e) => setLeagueIdInput(e.target.value)} />
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleContinueFromStep1} disabled={loading}>
              {mode === "username" ? "Continue" : "Review"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {step >= 2 && mode === "username" && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Step 2 — Select League</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {leagues.length === 0 ? (
              <p className="text-muted-foreground">No leagues found for {lookup?.username} in {season}.</p>
            ) : (
              <RadioGroup value={selectedLeagueId} onValueChange={setSelectedLeagueId} className="space-y-3">
                {leagues.map((lg) => (
                  <div key={lg.league_id} className="flex items-center gap-3 p-3 border rounded-md">
                    <RadioGroupItem value={lg.league_id} id={`lg-${lg.league_id}`} />
                    <Label htmlFor={`lg-${lg.league_id}`}>
                      <span className="font-medium">{lg.name}</span>
                      <span className="ml-2 text-muted-foreground text-sm">Season {lg.season} • {lg.status ?? 'active'}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
            <div className="flex justify-end">
              <Button onClick={proceedToReview} disabled={!selectedLeagueId || loading}>Review</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Step 3 — Review & Import</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!snapshot ? (
              <p className="text-muted-foreground">Loading league details...</p>
            ) : (
              <div className="space-y-1">
                <div className="text-lg font-semibold">{snapshot.league?.name}</div>
                <div className="text-sm text-muted-foreground">Teams: {snapshot.rosters?.length ?? 0}</div>
                <div className="text-sm text-muted-foreground">Season: {snapshot.league?.season}</div>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(mode === 'username' ? 2 : 1)} disabled={loading}>Back</Button>
              <Button onClick={handleImport} disabled={loading || !selectedLeagueId}>Import</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
