import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateImagePayload {
  post_id: string;
  title: string;
  content: string;
  company: string;
  feedback?: string;
  previous_attempt?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const N8N_WEBHOOK_URL = Deno.env.get("N8N_GENERATE_IMAGE_WEBHOOK");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!N8N_WEBHOOK_URL) {
      console.error("N8N_GENERATE_IMAGE_WEBHOOK not configured");
      return new Response(
        JSON.stringify({ error: "Webhook não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Credenciais do storage não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: GenerateImagePayload = await req.json();
    const { post_id, title, content, company, feedback, previous_attempt } = payload;

    console.log("Generating image for post:", post_id, "Title:", title, "Feedback:", feedback || "none");

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Título é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_id,
        title,
        content: content || "",
        company: company || "livonius",
        feedback: feedback || null,
        is_regeneration: previous_attempt || false,
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("n8n webhook error:", n8nResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar imagem no n8n", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check content-type of response
    const contentType = n8nResponse.headers.get("content-type") || "";
    console.log("n8n response content-type:", contentType);

    // If response is binary (image)
    if (contentType.includes("image/")) {
      console.log("Received binary image from n8n, uploading to storage...");
      
      const imageBuffer = await n8nResponse.arrayBuffer();
      
      // Create Supabase client with service role key
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'interagir' } });
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `img-${timestamp}.png`;
      const filePath = `generated/${fileName}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("interagir-post-media")
        .upload(filePath, imageBuffer, {
          contentType: "image/png",
          upsert: false
        });
      
      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return new Response(
          JSON.stringify({ error: "Erro ao salvar imagem no storage", details: uploadError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("interagir-post-media")
        .getPublicUrl(filePath);
      
      console.log("Image uploaded successfully:", publicUrlData.publicUrl);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          image_url: publicUrlData.publicUrl 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // If response is JSON (legacy support or error)
    const result = await n8nResponse.json();
    console.log("n8n JSON response:", result);

    if (!result.image_url && !result.success) {
      return new Response(
        JSON.stringify({ error: "n8n não retornou URL da imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        image_url: result.image_url,
        base_image_url: result.base_image_url || result.raw_image_url || null,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("Error in generate-image-n8n:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
