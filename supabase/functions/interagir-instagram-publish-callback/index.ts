import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallbackRequest {
  post_id: string;
  instagram_media_id: string;
  permalink?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const { post_id, instagram_media_id, permalink }: CallbackRequest = await req.json();

    if (!post_id || !instagram_media_id) {
      return new Response(
        JSON.stringify({ error: 'post_id and instagram_media_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the post with the Instagram media ID
    const { data: post, error: updateError } = await supabase
      .from('mkt_social_posts')
      .update({ 
        instagram_media_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', post_id)
      .select('title, workspace_id')
      .single();

    if (updateError) {
      console.error('Error updating post:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update post', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the activity
    await supabase.from('mkt_activity_log').insert({
      workspace_id: post.workspace_id,
      action: 'instagram_media_linked',
      entity_type: 'social_post',
      entity_id: post_id,
      entity_title: post.title,
      details: {
        instagram_media_id,
        permalink: permalink || null
      }
    });

    console.log(`Successfully linked Instagram media ${instagram_media_id} to post ${post_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Instagram media ID linked successfully',
        post_id,
        instagram_media_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in instagram-publish-callback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
