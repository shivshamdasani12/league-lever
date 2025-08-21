import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting ingestion test...");
    
    // Read the scraper output file from the project
    const scraperData = await Deno.readTextFile("../../../scraper_output.txt");
    const parsedData = JSON.parse(scraperData);
    
    console.log("Parsed scraper data:", parsedData.data.length, "projections");
    
    // Get the INGEST_API_KEY from environment
    const ingestApiKey = Deno.env.get("INGEST_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    
    if (!ingestApiKey || !supabaseUrl) {
      throw new Error("Missing INGEST_API_KEY or SUPABASE_URL");
    }
    
    // Call the ingest-projections function
    const response = await fetch(`${supabaseUrl}/functions/v1/ingest-projections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ingestApiKey,
      },
      body: JSON.stringify(parsedData),
    });
    
    const result = await response.json();
    console.log("Ingestion result:", result);
    
    return new Response(JSON.stringify({
      success: true,
      message: "Ingestion test completed",
      result: result,
      projectionsCount: parsedData.data.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in test-ingest function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: "Check the Edge Function logs for more details"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});