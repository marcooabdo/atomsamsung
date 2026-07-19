import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    scope: "empresa nfe distribuicao-nfe",
  });

  const response = await fetch(NUVEM_FISCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Auth failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Auth response missing access_token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function extractDeliveryFromXML(xmlContent: string): string | null {
  try {
    const infCplMatch = xmlContent.match(/<infCpl>([\s\S]*?)<\/infCpl>/);
    if (!infCplMatch) return null;
    const deliveryMatch = infCplMatch[1].match(/DELIVERY:\s*([^\s<]+)/i);
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
    const debugLog: string[] = [];

    // Step 1: Authenticate
    let token: string;
    try {
      token = await getAccessToken();
      debugLog.push("Auth OK");
    } catch (authErr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro de autenticação com Nuvem Fiscal: ${authErr instanceof Error ? authErr.message : "desconhecido"}`,
          debug: debugLog,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get all company CNPJs from the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, nome, cnpj")
      .not("cnpj", "is", null);

    const cnpjs = (unidades || [])
      .filter((u: any) => u.cnpj && u.cnpj.trim())
      .map((u: any) => ({
        id: u.id,
        nome: u.nome,
        cnpj: u.cnpj.replace(/[^\d]/g, ""),
      }));

    debugLog.push(`Found ${cnpjs.length} CNPJs`);

    let xmlContent: string | null = null;

    // Step 3: Try distribution endpoint for each CNPJ
    for (const empresa of cnpjs) {
      try {
        const distUrl = `https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos?cpf_cnpj=${empresa.cnpj}&chave=${chave}&$top=1`;
        debugLog.push(`Trying dist: ${empresa.nome} (${empresa.cnpj})`);

        const distResponse = await fetch(distUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!distResponse.ok) {
          const errText = await distResponse.text();
          debugLog.push(`Dist ${empresa.cnpj}: ${distResponse.status} - ${errText.slice(0, 100)}`);
          continue;
        }

        const distData = await distResponse.json();
        debugLog.push(`Dist ${empresa.cnpj}: ${(distData.data || []).length} docs found`);

        if (distData.data && distData.data.length > 0) {
          const doc = distData.data[0];
          if (doc.id) {
            const xmlUrl = `https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos/${doc.id}/xml`;
            const xmlResponse = await fetch(xmlUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/xml",
              },
            });
            if (xmlResponse.ok) {
              xmlContent = await xmlResponse.text();
              debugLog.push(`XML downloaded from dist (${empresa.nome})`);
              break;
            } else {
              debugLog.push(`XML download failed: ${xmlResponse.status}`);
            }
          }
        }
      } catch (err) {
        debugLog.push(`Dist error for ${empresa.cnpj}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Step 4: Try NF-e listing endpoint (for NFs emitted through Nuvem Fiscal)
    if (!xmlContent) {
      try {
        const nfeListUrl = `https://api.nuvemfiscal.com.br/nfe?chave=${chave}&$top=1`;
        debugLog.push("Trying /nfe endpoint");
        const nfeListResponse = await fetch(nfeListUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (nfeListResponse.ok) {
          const nfeListData = await nfeListResponse.json();
          debugLog.push(`/nfe result: ${(nfeListData.data || []).length} docs`);
          if (nfeListData.data && nfeListData.data.length > 0) {
            const nfeId = nfeListData.data[0].id;
            const xmlUrl = `https://api.nuvemfiscal.com.br/nfe/${nfeId}/xml/nota`;
            const xmlResponse = await fetch(xmlUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/xml",
              },
            });
            if (xmlResponse.ok) {
              xmlContent = await xmlResponse.text();
              debugLog.push("XML downloaded from /nfe");
            }
          }
        } else {
          const errText = await nfeListResponse.text();
          debugLog.push(`/nfe error: ${nfeListResponse.status} - ${errText.slice(0, 100)}`);
        }
      } catch (err) {
        debugLog.push(`/nfe exception: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Step 5: Fallback to consultadanfe.com
    if (!xmlContent) {
      try {
        debugLog.push("Trying consultadanfe.com fallback");
        const danfeXmlUrl = `https://consultadanfe.com/danfe/xml/${chave}`;
        const danfeResponse = await fetch(danfeXmlUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (danfeResponse.ok) {
          const text = await danfeResponse.text();
          if (text.includes("<nfeProc") || text.includes("<NFe") || text.includes("<infNFe")) {
            xmlContent = text;
            debugLog.push("XML from consultadanfe.com OK");
          } else {
            debugLog.push(`consultadanfe.com: response not XML (${text.slice(0, 50)}...)`);
          }
        } else {
          debugLog.push(`consultadanfe.com: ${danfeResponse.status}`);
        }
      } catch (err) {
        debugLog.push(`consultadanfe.com error: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (!xmlContent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível localizar o XML da NF-e para esta chave de acesso.",
          hint: "Verifique se: 1) A chave está correta; 2) A NF foi emitida contra um dos CNPJs cadastrados; 3) A distribuição NF-e está habilitada na Nuvem Fiscal.",
          chaveAcesso: chave,
          debug: debugLog,
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
        debug: debugLog,
        message: "NF-e localizada com sucesso.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro interno ao consultar NF-e",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
