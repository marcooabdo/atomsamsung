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
const NUVEM_FISCAL_API = "https://api.nuvemfiscal.com.br";

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
    throw new Error(`No access_token in response`);
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
    const { chaveAcesso, cnpj } = await req.json();

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

    // Step 2: Get CNPJ to use
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let cnpjsToTry: string[] = [];

    if (cnpj) {
      cnpjsToTry = [cnpj.replace(/[^\d]/g, "")];
    } else {
      const { data: unidades } = await supabase
        .from("unidades")
        .select("cnpj")
        .not("cnpj", "is", null);
      cnpjsToTry = (unidades || [])
        .filter((u: any) => u.cnpj && u.cnpj.trim())
        .map((u: any) => u.cnpj.replace(/[^\d]/g, ""));
    }

    debugLog.push(`CNPJs to try: ${cnpjsToTry.join(", ")}`);

    let xmlContent: string | null = null;
    let manifestacaoTriggered = false;

    // Step 3: Try distribution endpoint with ambiente=1 (production)
    for (const cnpjAtual of cnpjsToTry) {
      // Try with chave filter
      const distUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos?cpf_cnpj=${cnpjAtual}&ambiente=1&chave=${chave}&$top=1`;
      debugLog.push(`GET ${distUrl}`);

      try {
        const distResponse = await fetch(distUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });

        const responseText = await distResponse.text();
        debugLog.push(`  Response ${distResponse.status}: ${responseText.slice(0, 200)}`);

        if (distResponse.ok) {
          let distData: any;
          try {
            distData = JSON.parse(responseText);
          } catch {
            debugLog.push(`  Parse failed`);
            continue;
          }

          const docs = distData.data || [];
          debugLog.push(`  Docs found: ${docs.length}`);

          if (docs.length > 0) {
            const doc = docs[0];
            debugLog.push(`  Doc ID: ${doc.id}, tipo_documento: ${doc.tipo_documento}, schema: ${doc.schema}`);
            
            // Try to download XML
            if (doc.id) {
              const xmlUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${doc.id}/xml`;
              debugLog.push(`  GET XML: ${xmlUrl}`);
              const xmlResponse = await fetch(xmlUrl, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
              });
              if (xmlResponse.ok) {
                xmlContent = await xmlResponse.text();
                debugLog.push(`  XML OK (${xmlContent.length} chars)`);
                break;
              } else {
                const xmlErr = await xmlResponse.text();
                debugLog.push(`  XML ${xmlResponse.status}: ${xmlErr.slice(0, 100)}`);
              }
            }
            
            // If doc has body/xml directly
            if (!xmlContent && doc.body) {
              xmlContent = doc.body;
              debugLog.push(`  Using doc.body`);
              break;
            }
          }
        }
      } catch (err) {
        debugLog.push(`  Error: ${err instanceof Error ? err.message : "unknown"}`);
      }

      // Step 4: Try manifestação if not found
      if (!xmlContent) {
        try {
          debugLog.push(`  Trying manifestação (ciencia_operacao) for ${cnpjAtual}...`);
          const manifestUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/manifestacoes`;
          const manifestBody = {
            ambiente: 1,
            cpf_cnpj: cnpjAtual,
            chave: chave,
            tipo_evento: "ciencia_operacao",
          };
          debugLog.push(`  POST ${manifestUrl} body: ${JSON.stringify(manifestBody)}`);

          const manifestResponse = await fetch(manifestUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(manifestBody),
          });

          const manifestText = await manifestResponse.text();
          debugLog.push(`  Manifest ${manifestResponse.status}: ${manifestText.slice(0, 200)}`);

          if (manifestResponse.ok || manifestResponse.status === 201 || manifestResponse.status === 202) {
            manifestacaoTriggered = true;
            
            // Wait 4 seconds and retry
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            const retryUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos?cpf_cnpj=${cnpjAtual}&ambiente=1&chave=${chave}&$top=1`;
            debugLog.push(`  Retry after manifest: GET ${retryUrl}`);
            const retryResponse = await fetch(retryUrl, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const docs = retryData.data || [];
              debugLog.push(`  Retry docs: ${docs.length}`);
              if (docs.length > 0 && docs[0].id) {
                const xmlUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${docs[0].id}/xml`;
                const xmlResponse = await fetch(xmlUrl, {
                  headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
                });
                if (xmlResponse.ok) {
                  xmlContent = await xmlResponse.text();
                  debugLog.push(`  XML after manifest OK`);
                  break;
                }
              }
            }
          }
        } catch (err) {
          debugLog.push(`  Manifest error: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    }

    if (!xmlContent) {
      const hint = manifestacaoTriggered
        ? "A manifestação (ciência da operação) foi enviada ao SEFAZ. O XML pode levar de 1 a 5 minutos para ficar disponível. Tente novamente em instantes."
        : "Possíveis causas: 1) A distribuição NF-e ainda não trouxe esta NF do SEFAZ (pode levar até 5h conforme o intervalo configurado); 2) O CNPJ desta unidade não é o destinatário desta NF; 3) A NF ainda não foi autorizada no SEFAZ.";

      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível localizar o XML da NF-e.",
          hint,
          chaveAcesso: chave,
          manifestacaoTriggered,
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
