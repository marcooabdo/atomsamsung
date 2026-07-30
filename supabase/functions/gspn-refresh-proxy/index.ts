import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BACKEND_BASE = "https://bot-post-products.groupglobal.com.br";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const osId = url.searchParams.get("os_id");

    if (!osId) {
      return new Response(
        JSON.stringify({ error: "Missing os_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const backendUrl = `${BACKEND_BASE}/api/gspn/refresh/${osId}`;

    const backendResp = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const body = await backendResp.text();

    return new Response(body, {
      status: backendResp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
