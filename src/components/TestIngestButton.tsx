import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const TestIngestButton = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleIngestTest = async () => {
    setLoading(true);
    try {
      console.log('Calling test-ingest-real function...');
      
      const { data, error } = await supabase.functions.invoke('test-ingest-real', {
        body: {}
      });

      if (error) {
        console.error('Function error:', error);
        toast({
          title: "Error",
          description: `Failed to ingest projections: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Function result:', data);
      
      if (data?.success) {
        toast({
          title: "Success!",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data?.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleIngestTest}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      {loading ? "Ingesting..." : "🔄 Ingest Real FantasyPros Data"}
    </Button>
  );
};