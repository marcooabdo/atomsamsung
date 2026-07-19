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
    throw new Error(`Auth response missing access_token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function listEmpresasNuvemFiscal(token: string): Promise<{ cpf_cnpj: string; razao_social: string }[]> {
  const response = await fetch(`${NUVEM_FISCAL_API}/empresas?$top=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Empresas list failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return (data.data || data || []).map((e: any) => ({
    cpf_cnpj: (e.cpf_cnpj || "").replace(/[^\d]/g, ""),
    razao_social: e.razao_social || e.nome_fantasia || "",
  }));
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

    // Step 2: List empresas registered in Nuvem Fiscal
    let empresas: { cpf_cnpj: string; razao_social: string }[] = [];
    try {
      empresas = await listEmpresasNuvemFiscal(token);
      debugLog.push(`Empresas NF: ${empresas.length} (${empresas.map(e => e.cpf_cnpj).join(", ")})`);
    } catch (err) {
      debugLog.push(`Empresas list error: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // If no empresas from API, fall back to DB CNPJs
    if (empresas.length === 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: unidades } = await supabase
        .from("unidades")
        .select("cnpj, nome")
        .not("cnpj", "is", null);
      empresas = (unidades || [])
        .filter((u: any) => u.cnpj && u.cnpj.trim())
        .map((u: any) => ({
          cpf_cnpj: u.cnpj.replace(/[^\d]/g, ""),
          razao_social: u.nome || "",
        }));
      debugLog.push(`Fallback to DB: ${empresas.length} CNPJs`);
    }

    let xmlContent: string | null = null;
    let manifestacaoTriggered = false;

    // Step 3: Try distribution endpoint for each registered empresa
    for (const empresa of empresas) {
      try {
        const distUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos?cpf_cnpj=${empresa.cpf_cnpj}&chave=${chave}&$top=1`;
        debugLog.push(`Dist query: ${empresa.razao_social} (${empresa.cpf_cnpj})`);

        const distResponse = await fetch(distUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const responseText = await distResponse.text();

        if (!distResponse.ok) {
          debugLog.push(`  -> ${distResponse.status}: ${responseText.slice(0, 150)}`);
          continue;
        }

        let distData: any;
        try {
          distData = JSON.parse(responseText);
        } catch {
          debugLog.push(`  -> Parse error: ${responseText.slice(0, 100)}`);
          continue;
        }

        const docs = distData.data || [];
        debugLog.push(`  -> ${docs.length} docs found`);

        if (docs.length > 0) {
          const doc = docs[0];
          if (doc.id) {
            const xmlUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${doc.id}/xml`;
            const xmlResponse = await fetch(xmlUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/xml",
              },
            });
            if (xmlResponse.ok) {
              xmlContent = await xmlResponse.text();
              debugLog.push(`  -> XML downloaded OK`);
              break;
            } else {
              debugLog.push(`  -> XML download: ${xmlResponse.status}`);
            }
          }
        }
      } catch (err) {
        debugLog.push(`  -> Error: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Step 4: If not found, try to manifest the NF (ciência da operação) to pull from SEFAZ
    if (!xmlContent && empresas.length > 0) {
      // Determine which empresa is the recipient (the CNPJ in positions 7-20 of the chave is the EMITTER, not the recipient)
      // We try manifestation with each empresa
      for (const empresa of empresas) {
        try {
          debugLog.push(`Manifesting for ${empresa.cpf_cnpj}...`);
          const manifestUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/manifestacoes`;
          const manifestResponse = await fetch(manifestUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              cpf_cnpj: empresa.cpf_cnpj,
              chave: chave,
              tipo_evento: "ciencia_operacao",
            }),
          });

          const manifestText = await manifestResponse.text();
          if (manifestResponse.ok || manifestResponse.status === 201 || manifestResponse.status === 202) {
            debugLog.push(`  -> Manifestação OK: ${manifestText.slice(0, 100)}`);
            manifestacaoTriggered = true;
            
            // Wait a moment and try to get the document again
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const retryUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos?cpf_cnpj=${empresa.cpf_cnpj}&chave=${chave}&$top=1`;
            const retryResponse = await fetch(retryUrl, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const docs = retryData.data || [];
              if (docs.length > 0 && docs[0].id) {
                const xmlUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${docs[0].id}/xml`;
                const xmlResponse = await fetch(xmlUrl, {
                  headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
                });
                if (xmlResponse.ok) {
                  xmlContent = await xmlResponse.text();
                  debugLog.push(`  -> XML after manifest OK`);
                  break;
                }
              }
            }
          } else {
            debugLog.push(`  -> Manifest ${manifestResponse.status}: ${manifestText.slice(0, 150)}`);
          }
        } catch (err) {
          debugLog.push(`  -> Manifest error: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    }

    // Step 5: Fallback to consultadanfe.com
    if (!xmlContent) {
      try {
        debugLog.push("Trying consultadanfe.com");
        const danfeResponse = await fetch(`https://consultadanfe.com/danfe/xml/${chave}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (danfeResponse.ok) {
          const text = await danfeResponse.text();
          if (text.includes("<nfeProc") || text.includes("<NFe") || text.includes("<infNFe")) {
            xmlContent = text;
            debugLog.push("  -> consultadanfe OK");
          } else {
            debugLog.push(`  -> Not XML: ${text.slice(0, 60)}`);
          }
        } else {
          debugLog.push(`  -> ${danfeResponse.status}`);
        }
      } catch (err) {
        debugLog.push(`  -> Error: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (!xmlContent) {
      const hint = manifestacaoTriggered
        ? "A manifestação (ciência da operação) foi enviada ao SEFAZ. Aguarde alguns minutos e tente novamente — o SEFAZ pode levar até 5 min para disponibilizar o XML."
        : "Verifique se: 1) O CNPJ destinatário desta NF está cadastrado como empresa no Nuvem Fiscal com certificado digital ativo; 2) A distribuição NF-e está habilitada para essa empresa no Console Nuvem Fiscal.";

      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível localizar o XML da NF-e para esta chave de acesso.",
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
