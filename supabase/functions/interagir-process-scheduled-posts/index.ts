import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PUBLISHING DISABLED — manual review required before re-enabling.
// To re-enable: remove this early return and restore the dispatch logic.
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("process-scheduled-posts: DISABLED — automatic publishing is turned off");
  return new Response(
    JSON.stringify({ dispatched: 0, disabled: true, message: "Automatic publishing is disabled" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
