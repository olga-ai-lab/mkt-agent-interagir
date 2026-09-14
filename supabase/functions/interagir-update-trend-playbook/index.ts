import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to count occurrences in an array
function countOccurrences(arr: string[]): Record<string, number> {
  return arr.reduce((acc, item) => {
    const normalized = item.toLowerCase().replace(/^#/, '');
    acc[normalized] = (acc[normalized] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// Helper to get hour range string
function getHourRange(hour: number): string {
  const nextHour = (hour + 1) % 24;
  return `${hour.toString().padStart(2, '0')}:00 - ${nextHour.toString().padStart(2, '0')}:00`;
}

// Helper to get format name from channel
function getFormatName(channel: string): string {
  const formatMap: Record<string, string> = {
    'instagram': 'Feed Instagram',
    'facebook': 'Feed Facebook',
    'linkedin': 'Post LinkedIn',
    'twitter': 'Tweet',
  };
  return formatMap[channel] || channel;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Updating trend playbook for workspace:", workspace_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    , { db: { schema: 'interagir' } });

    // Fetch all published posts with their insights
    const { data: postsWithInsights, error: postsError } = await supabase
      .from("mkt_social_posts")
      .select(`
        id,
        title,
        channels,
        published_at,
        mkt_ai_post_insights (
          performance_score,
          suggested_hashtags,
          strengths
        )
      `)
      .eq("workspace_id", workspace_id)
      .eq("status", "PUBLISHED")
      .not("published_at", "is", null);

    if (postsError) {
      console.error("Error fetching posts:", postsError);
      throw postsError;
    }

    console.log(`Found ${postsWithInsights?.length || 0} published posts`);

    // Filter posts that have insights
    const postsWithData = (postsWithInsights || [])
      .filter(p => p.ai_post_insights && p.ai_post_insights.length > 0)
      .map(p => ({
        ...p,
        insight: p.ai_post_insights[0],
      }));

    console.log(`${postsWithData.length} posts have AI insights`);

    // Sort by performance score (highest first)
    const sortedPosts = postsWithData.sort(
      (a, b) => (b.insight?.performance_score || 0) - (a.insight?.performance_score || 0)
    );

    // 1. Calculate best_formats from top 10 performing posts
    const topPosts = sortedPosts.slice(0, 10);
    const formatCounts = countOccurrences(
      topPosts.flatMap(p => (p.channels || []).map(getFormatName))
    );
    const best_formats = Object.entries(formatCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([format]) => format);

    console.log("Best formats:", best_formats);

    // 2. Calculate best_posting_times from top posts with published_at
    const postsWithTime = topPosts.filter(p => p.published_at);
    const hourCounts = countOccurrences(
      postsWithTime.map(p => {
        const hour = new Date(p.published_at).getHours();
        return getHourRange(hour);
      })
    );
    const best_posting_times = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([time]) => time);

    console.log("Best posting times:", best_posting_times);

    // 3. Calculate top_hashtags from all insights
    const allHashtags = postsWithData
      .flatMap(p => p.insight?.suggested_hashtags || [])
      .filter(Boolean);
    const hashtagCounts = countOccurrences(allHashtags);
    const top_hashtags = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    console.log("Top hashtags:", top_hashtags);

    // 4. Calculate avg_save_rate from post_analytics
    const postIds = postsWithData.map(p => p.id);
    let avg_save_rate = 0;

    if (postIds.length > 0) {
      const { data: analytics, error: analyticsError } = await supabase
        .from("mkt_post_analytics")
        .select("saves, reach, post_id")
        .in("post_id", postIds);

      if (analyticsError) {
        console.error("Error fetching analytics:", analyticsError);
      } else if (analytics && analytics.length > 0) {
        const totalSaves = analytics.reduce((sum, a) => sum + (a.saves || 0), 0);
        const totalReach = analytics.reduce((sum, a) => sum + (a.reach || 0), 0);
        avg_save_rate = totalReach > 0 ? (totalSaves / totalReach) * 100 : 0;
        console.log(`Calculated avg_save_rate: ${avg_save_rate.toFixed(2)}% (${totalSaves} saves / ${totalReach} reach)`);
      }
    }

    // 5. Extract do_list and dont_list from AI analysis (strengths as do, weaknesses as dont)
    const allStrengths = postsWithData
      .filter(p => (p.insight?.performance_score || 0) >= 70)
      .flatMap(p => p.insight?.strengths || [])
      .filter(Boolean);
    const strengthCounts = countOccurrences(allStrengths);
    const do_list = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item]) => item.charAt(0).toUpperCase() + item.slice(1));

    // 6. Upsert the playbook
    const { data: playbook, error: upsertError } = await supabase
      .from("mkt_ai_trend_playbook")
      .upsert({
        workspace_id,
        best_formats: best_formats.length > 0 ? best_formats : null,
        best_posting_times: best_posting_times.length > 0 ? best_posting_times : null,
        top_hashtags: top_hashtags.length > 0 ? top_hashtags : null,
        avg_save_rate: avg_save_rate,
        do_list: do_list.length > 0 ? do_list : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id',
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting playbook:", upsertError);
      throw upsertError;
    }

    console.log("Successfully updated trend playbook:", playbook);

    return new Response(
      JSON.stringify({ 
        success: true, 
        playbook,
        stats: {
          total_posts: postsWithInsights?.length || 0,
          posts_with_insights: postsWithData.length,
          best_formats,
          best_posting_times,
          top_hashtags_count: top_hashtags.length,
          avg_save_rate: avg_save_rate.toFixed(2),
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in update-trend-playbook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
