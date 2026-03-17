import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { nfe_id } = await req.json();

    if (!nfe_id) {
      return new Response(
        JSON.stringify({ error: "nfe_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Sending NFe emission request for ID: ${nfe_id}`);

    const response = await fetch(
      "https://bot-post-products.groupglobal.com.br/api/nuvemFiscal/nfe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nfe_id }),
      }
    );

    const responseText = await response.text();
    console.log(`External API response status: ${response.status}`);
    console.log(`External API response: ${responseText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseData,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in emit-nfe function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
