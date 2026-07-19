import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NUVEM_FISCAL_CLIENT_ID = "kfrx2HqLfTfOjM6MIkku";
const NUVEM_FISCAL_CLIENT_SECRET = "x9mrWhVT2x4tvs5ZEbz6oC3BGTWu8maeJGNLPaDT";
const NUVEM_FISCAL_AUDIENCE = "https://api.nuvemfiscal.com.br/";
const NUVEM_FISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: NUVEM_FISCAL_CLIENT_ID,
    client_secret: NUVEM_FISCAL_CLIENT_SECRET,
    audience: NUVEM_FISCAL_AUDIENCE,
    scope: "nfe distribuicao-nfe",
  });

  const response = await fetch(NUVEM_FISCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get Nuvem Fiscal token: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

function extractDeliveryFromXML(xmlContent: string): string | null {
  try {
    const infCplMatch = xmlContent.match(/<infCpl>([\s\S]*?)<\/infCpl>/);
    if (!infCplMatch) return null;
    const infCplContent = infCplMatch[1];
    const deliveryMatch = infCplContent.match(/DELIVERY:\s*([^\s<]+)/i);
    return deliveryMatch ? deliveryMatch[1].trim() : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { chaveAcesso } = await req.json();

    if (!chaveAcesso || chaveAcesso.replace(/\s/g, "").length !== 44) {
      return new Response(
        JSON.stringify({ error: "Chave de acesso inválida. Deve conter 44 dígitos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chave = chaveAcesso.replace(/\s/g, "");
    const token = await getAccessToken();

    // Try to find the NF-e via distribution endpoint (consultation by key)
    const consultaUrl = `https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos?chave=${chave}&$top=1`;
    const consultaResponse = await fetch(consultaUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    let xmlContent: string | null = null;
    let nfeData: any = null;

    if (consultaResponse.ok) {
      const consultaData = await consultaResponse.json();
      if (consultaData.data && consultaData.data.length > 0) {
        nfeData = consultaData.data[0];
        // Download XML
        if (nfeData.id) {
          const xmlUrl = `https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos/${nfeData.id}/xml`;
          const xmlResponse = await fetch(xmlUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
          });
          if (xmlResponse.ok) {
            xmlContent = await xmlResponse.text();
          }
        }
      }
    }

    // If not found via distribution, try direct NF-e consultation
    if (!xmlContent) {
      const nfeListUrl = `https://api.nuvemfiscal.com.br/nfe?chave=${chave}&$top=1`;
      const nfeListResponse = await fetch(nfeListUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (nfeListResponse.ok) {
        const nfeListData = await nfeListResponse.json();
        if (nfeListData.data && nfeListData.data.length > 0) {
          const nfeId = nfeListData.data[0].id;
          nfeData = nfeListData.data[0];
          const xmlUrl = `https://api.nuvemfiscal.com.br/nfe/${nfeId}/xml/nota`;
          const xmlResponse = await fetch(xmlUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
          });
          if (xmlResponse.ok) {
            xmlContent = await xmlResponse.text();
          }
        }
      }
    }

    // Fallback: try consultadanfe.com
    if (!xmlContent) {
      try {
        const danfeXmlUrl = `https://consultadanfe.com/danfe/xml/${chave}`;
        const danfeResponse = await fetch(danfeXmlUrl);
        if (danfeResponse.ok) {
          const text = await danfeResponse.text();
          if (text.includes("<nfeProc") || text.includes("<NFe") || text.includes("<infNFe")) {
            xmlContent = text;
          }
        }
      } catch {
        // Fallback failed silently
      }
    }

    if (!xmlContent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível localizar o XML da NF-e para esta chave de acesso. Verifique se a chave está correta e se a NF já foi autorizada.",
          chaveAcesso: chave,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const delivery = extractDeliveryFromXML(xmlContent);

    return new Response(
      JSON.stringify({
        success: true,
        chaveAcesso: chave,
        xml: xmlContent,
        delivery,
        nfeData,
        message: "NF-e localizada com sucesso via Nuvem Fiscal.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro ao consultar NF-e",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
