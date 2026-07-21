import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NUVEM_FISCAL_CLIENT_ID = "kfrx2HqLfTfOjM6MIkku";
const NUVEM_FISCAL_CLIENT_SECRET = "x9mrWhVT2x4tvs5ZEbz6oC3BGTWu8maeJGNLPaDT";
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
      scope: "cnpj nfe distribuicao-nfe",
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

async function fetchFromDistribuicao(chaveAcesso: string, token: string): Promise<string | null> {
  // Try to find the document in the distribution service by chave
  const url = `${NUVEM_FISCAL_API_BASE}/distribuicao/nfe/documentos?chave=${chaveAcesso}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const docs = data?.data || data?.items || data;

    if (Array.isArray(docs) && docs.length > 0) {
      const doc = docs[0];
      const docId = doc.id;

      if (docId) {
        // Download the XML using the document ID
        const xmlResp = await fetch(`${NUVEM_FISCAL_API_BASE}/distribuicao/nfe/documentos/${docId}/xml`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/xml",
          },
        });

        if (xmlResp.ok) {
          const xml = await xmlResp.text();
          if (xml && xml.length > 100) return xml;
        }
      }

      // If document has inline body/xml
      if (doc.corpo_xml || doc.xml) {
        return doc.corpo_xml || doc.xml;
      }
    }
  } catch {
    // Fallthrough
  }

  return null;
}

async function fetchFromNfeEndpoint(chaveAcesso: string, token: string): Promise<string | null> {
  // Try the NF-e listing endpoint filtered by chave
  const url = `${NUVEM_FISCAL_API_BASE}/nfe?chave=${chaveAcesso}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const docs = data?.data || data?.items || data;

    if (Array.isArray(docs) && docs.length > 0) {
      const doc = docs[0];
      const docId = doc.id;

      if (docId) {
        const xmlResp = await fetch(`${NUVEM_FISCAL_API_BASE}/nfe/${docId}/xml`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/xml",
          },
        });

        if (xmlResp.ok) {
          const xml = await xmlResp.text();
          if (xml && xml.length > 100) return xml;
        }
      }
    }
  } catch {
    // Fallthrough
  }

  return null;
}

async function fetchFromConsultaDanfe(chaveAcesso: string): Promise<string | null> {
  const urls = [
    `https://www.consultadanfe.com.br/api/xml/${chaveAcesso}`,
    `https://consultadanfe.com.br/api/xml/${chaveAcesso}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/xml, text/xml, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 100 && (text.includes("<nfeProc") || text.includes("<NFe") || text.includes("<infNFe"))) {
          return text;
        }
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}

async function fetchFromSefazPortal(chaveAcesso: string): Promise<string | null> {
  // Try nfe.fazenda.gov.br-style query (won't return XML but might confirm existence)
  // This is a best-effort fallback using alternative free services
  const fallbackUrls = [
    `https://nfe-api.deno.dev/xml/${chaveAcesso}`,
    `https://brasilapi.com.br/api/nfe/v1/${chaveAcesso}`,
  ];

  for (const url of fallbackUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/xml, application/json, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();

        if (contentType.includes("xml") || text.includes("<nfeProc") || text.includes("<NFe")) {
          if (text.length > 100) return text;
        }

        // If JSON response with XML field
        if (contentType.includes("json")) {
          try {
            const json = JSON.parse(text);
            if (json.xml && json.xml.length > 100) return json.xml;
          } catch {}
        }
      }
    } catch {
      // Try next
    }
  }

  return null;
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

async function consultarChave(chave: string, token: string): Promise<{ xml: string | null }> {
  // Strategy 1: Nuvem Fiscal Distribution API
  let xml = await fetchFromDistribuicao(chave, token);
  if (xml) return { xml };

  // Strategy 2: Nuvem Fiscal NF-e listing
  xml = await fetchFromNfeEndpoint(chave, token);
  if (xml) return { xml };

  // Strategy 3: consultadanfe.com.br
  xml = await fetchFromConsultaDanfe(chave);
  if (xml) return { xml };

  // Strategy 4: Other fallbacks
  xml = await fetchFromSefazPortal(chave);
  if (xml) return { xml };

  return { xml: null };
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
      const result = await consultarChave(chave, token);

      if (!result.xml) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "XML não encontrado para esta chave de acesso. Verifique se a chave está correta e se a NF-e já foi autorizada na SEFAZ.",
            chaveAcesso: chave
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          chaveAcesso: chave,
          xml: result.xml,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch processing
    const results: ConsultaResult[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < chaves.length; i += BATCH_SIZE) {
      const batch = chaves.slice(i, i + BATCH_SIZE).map(c => c.replace(/\s/g, ""));
      const batchPromises = batch.map(async (chave): Promise<ConsultaResult> => {
        try {
          const result = await consultarChave(chave, token);
          if (!result.xml) {
            return { chaveAcesso: chave, success: false, error: "XML não encontrado" };
          }
          return { chaveAcesso: chave, success: true, xml: result.xml };
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
