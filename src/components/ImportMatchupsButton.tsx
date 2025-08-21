import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImportMatchupsButtonProps {
  leagueId: string;
}

export const ImportMatchupsButton = ({ leagueId }: ImportMatchupsButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleImportMatchups = async () => {
    setLoading(true);
    try {
      // Import matchups for all weeks (1-18)
      const { data, error } = await supabase.functions.invoke('sleeper-import-matchups', {
        body: { 
          league_id: leagueId,
          all_to_current: true
        }
      });

      if (error) {
        console.error('Error importing matchups:', error);
        toast({
          title: "Error",
          description: "Failed to import matchups data. Please try again.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Error calling function:', error);
      toast({
        title: "Error",
        description: "Failed to import matchups data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleImportMatchups} 
      disabled={loading}
      variant="outline"
      size="sm"
    >
      {loading ? "Importing..." : "🏈 Import Matchups Data"}
    </Button>
  );
};