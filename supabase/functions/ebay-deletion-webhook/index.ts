import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify eBay's HMAC-SHA256 signature
async function verifyEbaySignature(
  body: string,
  signatureHeader: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(clientSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = Uint8Array.from(
      atob(signatureHeader),
      (c) => c.charCodeAt(0)
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(body)
    );
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // eBay sends a GET challenge during endpoint registration
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challengeCode = url.searchParams.get("challenge_code");

    if (challengeCode) {
    const clientSecret = Deno.env.get('EBAY_VERIFICATION_TOKEN') ?? '';
    const endpointUrl = 'https://www.graderanger.com/api/ebay-deletion';

      // eBay challenge response hash: SHA-256(challengeCode + clientSecret + endpointUrl)
      const hashInput = challengeCode + clientSecret + endpointUrl;
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(hashInput)
      );
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return new Response(
        JSON.stringify({ challengeResponse: hashHex }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  }

  // eBay sends a POST when a user deletes their account
  if (req.method === "POST") {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
      const bodyText = await req.text();
      const body = JSON.parse(bodyText);

      // Log the deletion request for audit trail
      console.log("[ebay-deletion-webhook] Received:", JSON.stringify(body));

      const topic = body.metadata?.topic;
      if (topic !== "MARKETPLACE_ACCOUNT_DELETION") {
        return new Response("OK", { status: 200 });
      }

      const ebayUserId = body.notification?.data?.userId;
      const ebayUsername = body.notification?.data?.username;

      if (!ebayUserId) {
        return new Response("Missing userId", { status: 400 });
      }

      // Find Grade Ranger users linked to this eBay account
      // (stored when users connect their eBay account)
      const { data: linkedUsers } = await supabase
        .from("user_integrations")
        .select("user_id")
        .eq("provider", "ebay")
        .eq("provider_user_id", ebayUserId);

      if (linkedUsers && linkedUsers.length > 0) {
        for (const { user_id } of linkedUsers) {
          // Remove eBay-specific data for this user
          await supabase
            .from("user_integrations")
            .delete()
            .eq("user_id", user_id)
            .eq("provider", "ebay");

          // Log the deletion for compliance records
          await supabase.from("deletion_audit_log").insert({
            provider: "ebay",
            provider_user_id: ebayUserId,
            provider_username: ebayUsername,
            grade_ranger_user_id: user_id,
            deleted_at: new Date().toISOString(),
          });
        }
      } else {
        // No linked user — still log it for compliance
        await supabase.from("deletion_audit_log").insert({
          provider: "ebay",
          provider_user_id: ebayUserId,
          provider_username: ebayUsername,
          grade_ranger_user_id: null,
          deleted_at: new Date().toISOString(),
        });
      }

      return new Response("OK", {
        headers: { ...corsHeaders },
        status: 200,
      });
    } catch (err) {
      console.error("[ebay-deletion-webhook]", err);
      // Always return 200 to eBay — retry logic is their problem
      return new Response("OK", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});