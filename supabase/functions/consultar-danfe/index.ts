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
const NUVEM_FISCAL_API_BASE = "https://api.nuvemfiscal.com.br";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getNuvemFiscalToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30000) {
    return cachedToken.access_token;
  }

  const response = await fetch(NUVEM_FISCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: NUVEM_FISCAL_CLIENT_ID,
      client_secret: NUVEM_FISCAL_CLIENT_SECRET,
      audience: NUVEM_FISCAL_AUDIENCE,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth2 token error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

async function fetchXMLFromNuvemFiscal(chaveAcesso: string, token: string): Promise<{ xml: string; status: string } | null> {
  const url = `${NUVEM_FISCAL_API_BASE}/nfe/consulta/${chaveAcesso}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    throw new Error(`Nuvem Fiscal API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const xml = data.xml_nfe || data.xml || null;
  const status = data.status || "unknown";

  if (!xml) return null;
  return { xml, status };
}

async function fetchXMLDirectFromNuvemFiscal(chaveAcesso: string, token: string): Promise<string | null> {
  const url = `${NUVEM_FISCAL_API_BASE}/nfe/${chaveAcesso}/xml`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/xml",
    },
  });

  if (!response.ok) return null;
  const xml = await response.text();
  if (!xml || xml.length < 100) return null;
  return xml;
}

interface ConsultaRequest {
  chaveAcesso?: string;
  chavesAcesso?: string[];
}

interface ConsultaResult {
  chaveAcesso: string;
  success: boolean;
  xml?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: ConsultaRequest = await req.json();
    const chaves: string[] = [];

    if (body.chavesAcesso && Array.isArray(body.chavesAcesso)) {
      chaves.push(...body.chavesAcesso);
    } else if (body.chaveAcesso) {
      chaves.push(body.chaveAcesso);
    }

    if (chaves.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma chave de acesso fornecida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (chaves.length > 100) {
      return new Response(
        JSON.stringify({ error: "Máximo de 100 chaves por requisição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invalidChaves = chaves.filter(c => !c || c.replace(/\s/g, "").length !== 44);
    if (invalidChaves.length > 0) {
      return new Response(
        JSON.stringify({ error: `Chaves inválidas (devem ter 44 dígitos): ${invalidChaves.slice(0, 5).join(", ")}...` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getNuvemFiscalToken();

    if (chaves.length === 1) {
      const chave = chaves[0].replace(/\s/g, "");
      let xml: string | null = null;

      const consultaResult = await fetchXMLFromNuvemFiscal(chave, token);
      if (consultaResult?.xml) {
        xml = consultaResult.xml;
      } else {
        xml = await fetchXMLDirectFromNuvemFiscal(chave, token);
      }

      if (!xml) {
        const fallbackXmlUrl = `https://consultadanfe.com/danfe/xml/${chave}`;
        try {
          const fallbackResp = await fetch(fallbackXmlUrl);
          if (fallbackResp.ok) {
            const fallbackXml = await fallbackResp.text();
            if (fallbackXml && fallbackXml.length > 100 && (fallbackXml.includes("<nfeProc") || fallbackXml.includes("<NFe"))) {
              xml = fallbackXml;
            }
          }
        } catch {}
      }

      if (!xml) {
        return new Response(
          JSON.stringify({ success: false, error: "XML não encontrado para esta chave de acesso.", chaveAcesso: chave }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          chaveAcesso: chave,
          xml,
          xmlUrl: `${NUVEM_FISCAL_API_BASE}/nfe/${chave}/xml`,
          pdfUrl: `https://consultadanfe.com/danfe/pdf/${chave}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ConsultaResult[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < chaves.length; i += BATCH_SIZE) {
      const batch = chaves.slice(i, i + BATCH_SIZE).map(c => c.replace(/\s/g, ""));
      const batchPromises = batch.map(async (chave): Promise<ConsultaResult> => {
        try {
          let xml: string | null = null;

          const consultaResult = await fetchXMLFromNuvemFiscal(chave, token);
          if (consultaResult?.xml) {
            xml = consultaResult.xml;
          } else {
            xml = await fetchXMLDirectFromNuvemFiscal(chave, token);
          }

          if (!xml) {
            try {
              const fallbackResp = await fetch(`https://consultadanfe.com/danfe/xml/${chave}`);
              if (fallbackResp.ok) {
                const fallbackXml = await fallbackResp.text();
                if (fallbackXml && fallbackXml.length > 100 && (fallbackXml.includes("<nfeProc") || fallbackXml.includes("<NFe"))) {
                  xml = fallbackXml;
                }
              }
            } catch {}
          }

          if (!xml) {
            return { chaveAcesso: chave, success: false, error: "XML não encontrado" };
          }
          return { chaveAcesso: chave, success: true, xml };
        } catch (err: any) {
          return { chaveAcesso: chave, success: false, error: err.message || "Erro desconhecido" };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        total: chaves.length,
        encontradas: successCount,
        nao_encontradas: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Erro ao processar solicitação",
        details: error.message || "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
