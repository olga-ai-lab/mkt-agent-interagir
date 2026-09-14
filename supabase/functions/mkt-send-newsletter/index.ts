import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNewsletterRequest {
  campaign_id: string;
  subject: string;
  content: string;
  segments: string[];
  test_email?: string; // when set, sends only to this address without updating campaign status
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveName(email: string, name?: string | null) {
  if (name?.trim()) return name.trim();
  return email.split("@")[0]?.trim() || "there";
}

function personalizeHtml(html: string, name: string) {
  return html.replace(/\{\{name\}\}/g, name);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: 'interagir' } });

  try {
    const smtpHost = Deno.env.get("SMTP_HOST_NEWS");
    const smtpUser = Deno.env.get("SMTP_USER_NEWS");
    const smtpPass = Deno.env.get("SMTP_PASS_NEWS");
    const smtpPort = Number(Deno.env.get("SMTP_PORT_NEWS") ?? "465");
    const smtpFrom = Deno.env.get("SMTP_FROM_NEWS") ?? smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ success: false, error: "SMTP_HOST_NEWS, SMTP_USER_NEWS e SMTP_PASS_NEWS são obrigatórios" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { campaign_id, subject, content, segments, test_email }: SendNewsletterRequest = await req.json();

    console.log("mkt-send-newsletter:start", { campaign_id, segments, smtpHost, smtpPort, test_email: test_email ?? null });

    // Locaweb email-ssl.com.br usa SSL direto na 465 com método LOGIN
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        type: "LOGIN",
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: "TLSv1",
      },
      socketTimeout: 30000,
      connectionTimeout: 30000,
    });

    // ── TEST MODE: send only to test_email, no campaign status updates ──
    if (test_email) {
      const name = resolveName(test_email);
      await transporter.sendMail({
        from: smtpFrom,
        to: test_email,
        subject: `[TESTE] ${subject}`,
        text: "Este email requer um cliente com suporte a HTML.",
        html: personalizeHtml(content, name),
      });
      console.log("mkt-send-newsletter:test_sent", { test_email });
      return new Response(
        JSON.stringify({ success: true, test: true, sent_to: test_email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── REAL SEND: fetch active subscribers ──
    let query = supabase
      .from("newsletter_subscribers")
      .select("id, email, name")
      .eq("is_active", true);

    if (segments?.length > 0) {
      query = query.overlaps("segments", segments);
    }

    const { data: subscribers, error: subscribersError } = await query;
    if (subscribersError) throw new Error(`Erro ao buscar assinantes: ${subscribersError.message}`);

    const recipients = (subscribers ?? []).map((sub) => ({
      email: sub.email as string,
      name: resolveName(sub.email as string, (sub as any).name),
    }));

    if (recipients.length === 0) {
      await supabase
        .from("newsletter_campaigns")
        .update({ status: "failed", sent_at: new Date().toISOString(), recipient_count: 0, sent_count: 0, failed_count: 0 })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({ success: false, error: "Nenhum assinante encontrado", recipient_count: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("newsletter_campaigns")
      .update({ status: "sending", recipient_count: recipients.length })
      .eq("id", campaign_id);

    let sentCount = 0;
    let failedCount = 0;
    const errorsPreview: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from: smtpFrom,
          to: recipient.email,
          subject,
          text: "Este email requer um cliente com suporte a HTML.",
          html: personalizeHtml(content, recipient.name),
        });
        sentCount++;
        await sleep(200);
      } catch (err) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("smtp_error", { email: recipient.email, error: msg });
        if (errorsPreview.length < 10) errorsPreview.push({ email: recipient.email, error: msg });
      }
    }

    const finalStatus = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "sent_with_errors";

    await supabase
      .from("newsletter_campaigns")
      .update({ status: finalStatus, sent_at: new Date().toISOString(), sent_count: sentCount, failed_count: failedCount })
      .eq("id", campaign_id);

    console.log("mkt-send-newsletter:done", { campaign_id, sentCount, failedCount, finalStatus });

    return new Response(
      JSON.stringify({ success: finalStatus !== "failed", recipient_count: recipients.length, sent_count: sentCount, failed_count: failedCount, errors_preview: errorsPreview }),
      { status: finalStatus === "failed" ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("mkt-send-newsletter:fatal", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
