import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NUVEM_FISCAL_CLIENT_ID = "kfrx2HqLfTfOjM6MIkku";
const NUVEM_FISCAL_CLIENT_SECRET = "x9mrWhVT2x4tvs5ZEbz6oC3BGTWu8maeJGNLPaDT";
const NUVEM_FISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const NUVEM_FISCAL_API = "https://api.nuvemfiscal.com.br";

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: NUVEM_FISCAL_CLIENT_ID,
    client_secret: NUVEM_FISCAL_CLIENT_SECRET,
    scope: "empresa distribuicao-nfe",
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

    for (const cnpjAtual of cnpjsToTry) {
      // Step 1: Use POST /distribuicao/nfe with cons-chave to query SEFAZ directly
      const distBody = {
        cpf_cnpj: cnpjAtual,
        ambiente: "producao",
        tipo_consulta: "cons-chave",
        cons_chave: chave,
      };

      debugLog.push(`POST /distribuicao/nfe body: ${JSON.stringify(distBody)}`);

      try {
        const distResponse = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(distBody),
        });

        const responseText = await distResponse.text();
        debugLog.push(`  Response ${distResponse.status}: ${responseText.slice(0, 300)}`);

        if (!distResponse.ok) {
          debugLog.push(`  Distribution request failed`);
          continue;
        }

        let distData: any;
        try {
          distData = JSON.parse(responseText);
        } catch {
          debugLog.push(`  JSON parse failed`);
          continue;
        }

        debugLog.push(`  Status: ${distData.status}, codigo_status: ${distData.codigo_status}, motivo: ${distData.motivo_status}`);

        // If status is "processando", poll until done (max 15s)
        let finalData = distData;
        if (distData.status === "processando" && distData.id) {
          debugLog.push(`  Polling distribution ${distData.id}...`);
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const pollResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/${distData.id}`, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            });
            if (pollResp.ok) {
              finalData = await pollResp.json();
              debugLog.push(`  Poll ${i + 1}: status=${finalData.status}`);
              if (finalData.status !== "processando") break;
            }
          }
        }

        const docs = finalData.documentos || [];
        debugLog.push(`  Docs returned: ${docs.length}`);

        if (docs.length > 0) {
          // Find the nota document (not evento)
          const notaDoc = docs.find((d: any) => d.tipo_documento === "nota") || docs[0];
          debugLog.push(`  Doc ID: ${notaDoc.id}, tipo: ${notaDoc.tipo_documento}, resumo: ${notaDoc.resumo}`);

          if (notaDoc.id) {
            // Download the XML
            const xmlUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${notaDoc.id}/xml`;
            debugLog.push(`  GET XML: ${xmlUrl}`);
            const xmlResponse = await fetch(xmlUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (xmlResponse.ok) {
              xmlContent = await xmlResponse.text();
              debugLog.push(`  XML OK (${xmlContent.length} chars)`);

              // If it's a resumo, we need to manifest ciencia and retry
              if (notaDoc.resumo === true && xmlContent.includes("resNFe")) {
                debugLog.push(`  Document is resumo only, triggering ciencia...`);
                const manifestBody = {
                  ambiente: "producao",
                  cpf_cnpj: cnpjAtual,
                  chave_acesso: chave,
                  tipo_evento: "210210",
                };
                const manifestResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/manifestacoes`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(manifestBody),
                });
                const manifestText = await manifestResp.text();
                debugLog.push(`  Manifest ${manifestResp.status}: ${manifestText.slice(0, 150)}`);

                // Retry distribution after manifest
                await new Promise(resolve => setTimeout(resolve, 5000));
                const retryResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(distBody),
                });
                if (retryResp.ok) {
                  const retryData = await retryResp.json();
                  let retryFinal = retryData;
                  if (retryData.status === "processando" && retryData.id) {
                    for (let i = 0; i < 5; i++) {
                      await new Promise(resolve => setTimeout(resolve, 3000));
                      const pr = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/${retryData.id}`, {
                        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                      });
                      if (pr.ok) {
                        retryFinal = await pr.json();
                        if (retryFinal.status !== "processando") break;
                      }
                    }
                  }
                  const retryDocs = retryFinal.documentos || [];
                  const fullDoc = retryDocs.find((d: any) => d.tipo_documento === "nota" && d.resumo !== true) || retryDocs.find((d: any) => d.tipo_documento === "nota");
                  if (fullDoc?.id) {
                    const xmlUrl2 = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${fullDoc.id}/xml`;
                    const xmlResp2 = await fetch(xmlUrl2, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (xmlResp2.ok) {
                      xmlContent = await xmlResp2.text();
                      debugLog.push(`  Full XML after manifest OK (${xmlContent.length} chars)`);
                    }
                  }
                }
              }
              break;
            } else {
              const xmlErr = await xmlResponse.text();
              debugLog.push(`  XML download ${xmlResponse.status}: ${xmlErr.slice(0, 100)}`);
            }
          }
        } else {
          // No docs from cons-chave - maybe CNPJ is not destinatário
          debugLog.push(`  No documents for this CNPJ/chave combination`);
        }
      } catch (err) {
        debugLog.push(`  Error: ${err instanceof Error ? err.message : "unknown"}`);
      }

      if (xmlContent) break;
    }

    if (!xmlContent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível localizar o XML da NF-e.",
          hint: "Possíveis causas: 1) O CNPJ desta unidade não é o destinatário desta NF; 2) A NF ainda não foi autorizada no SEFAZ; 3) A chave de acesso está incorreta.",
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
