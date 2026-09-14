import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUDIO_BUCKET_CANDIDATES = ['mkt-tts-audio', 'tts-audio'];

// Strip HTML tags and get plain text
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple hash function for text
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// Background upload function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadToStorage(
  supabase: any,
  audioBuffer: ArrayBuffer,
  articleId: string,
  textHash: string
) {
  const storagePath = `articles/${articleId}.mp3`;
  const audioBytes = new Uint8Array(audioBuffer);
  let uploadError: unknown = null;
  let uploadedBucket: string | null = null;

  for (const bucket of AUDIO_BUCKET_CANDIDATES) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, audioBytes, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (!error) {
      uploadedBucket = bucket;
      break;
    }

    uploadError = error;
  }

  if (!uploadedBucket) {
    console.error('Storage upload error:', uploadError);
    return;
  }

  await supabase
    .from('mkt_tts_audio_cache')
    .upsert({
      article_id: articleId,
      storage_path: storagePath,
      text_hash: textHash,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'article_id' });

  console.log('Audio cached successfully in background');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const { text, title, articleId } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean HTML and prepare text
    let cleanText = stripHtml(text);
    
    // Add introduction if title provided
    if (title) {
      cleanText = `Você está ouvindo: ${title}. ${cleanText}`;
    }

    // Limit text to 5000 characters (ElevenLabs limit)
    if (cleanText.length > 5000) {
      cleanText = cleanText.substring(0, 4997) + '...';
    }

    // Generate hash for cache lookup
    const textHash = await hashText(cleanText);
    
    // Check if we have cached audio for this article
    if (articleId) {
      const { data: cacheEntry } = await supabase
        .from('mkt_tts_audio_cache')
        .select('storage_path, text_hash')
        .eq('article_id', articleId)
        .maybeSingle();

      // If cache exists and text hasn't changed, return cached URL
      if (cacheEntry && cacheEntry.text_hash === textHash) {
        let publicUrl: string | null = null;
        for (const bucket of AUDIO_BUCKET_CANDIDATES) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(cacheEntry.storage_path);
          if (data?.publicUrl) {
            publicUrl = data.publicUrl;
            break;
          }
        }

        if (!publicUrl) {
          throw new Error('Audio bucket not available for cached file');
        }

        console.log('Returning cached audio:', publicUrl);
        
        return new Response(
          JSON.stringify({ 
            cached: true, 
            audioUrl: publicUrl 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Generating TTS with streaming for ${cleanText.length} characters`);

    // Call ElevenLabs Streaming API with Turbo model
    // Voice: Matilda (XrExE9yKIg1WjnnlVkGX) - clear female voice
    const voiceId = 'XrExE9yKIg1WjnnlVkGX';
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_turbo_v2_5', // Faster model for low latency
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`ElevenLabs API error [${response.status}]: ${errorText}`);
    }

    // If we have articleId, collect the stream for caching while streaming to client
    if (articleId && response.body) {
      const [clientStream, cacheStream] = response.body.tee();
      
      // Start background upload (don't await)
      const cacheReader = cacheStream.getReader();
      const chunks: Uint8Array[] = [];
      
      // Read all chunks for caching in background
      (async () => {
        try {
          while (true) {
            const { done, value } = await cacheReader.read();
            if (done) break;
            chunks.push(value);
          }
          
          // Combine chunks and upload
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const audioBuffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            audioBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          
          await uploadToStorage(supabase, audioBuffer.buffer, articleId, textHash);
        } catch (err) {
          console.error('Background cache error:', err);
        }
      })();

      // Return streaming response to client
      return new Response(clientStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked',
          'X-Streaming': 'true',
          'X-Text-Length': cleanText.length.toString(),
        },
      });
    }

    // No articleId - just stream directly
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'X-Streaming': 'true',
        'X-Text-Length': cleanText.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('TTS Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar áudio';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
