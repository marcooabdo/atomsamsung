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
    throw new Error(`Token error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract CNPJ from chave de acesso (positions 6-19)
function extractCNPJFromChave(chave: string): string {
  return chave.substring(6, 20);
}

// Strategy 1: Check if document already exists in distribution
async function findInDistribuicao(chave: string, token: string): Promise<string | null> {
  try {
    const url = `${NUVEM_FISCAL_API_BASE}/distribuicao/nfe/documentos?chave=${chave}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const items = data?.data || [];
    if (items.length > 0 && items[0].id) {
      const xmlResp = await fetch(
        `${NUVEM_FISCAL_API_BASE}/distribuicao/nfe/documentos/${items[0].id}/xml`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" } }
      );
      if (xmlResp.ok) {
        const xml = await xmlResp.text();
        if (xml && xml.length > 200 && (xml.includes("<nfeProc") || xml.includes("<NFe") || xml.includes("<infNFe"))) {
          return xml;
        }
      }
    }
  } catch { /* fallthrough */ }
  return null;
}

// Strategy 2: Request distribution by chave (triggers SEFAZ lookup)
async function requestDistribuicaoByChave(chave: string, cpfCnpj: string, token: string): Promise<string | null> {
  try {
    // Request distribution specifying the chave
    const resp = await fetch(`${NUVEM_FISCAL_API_BASE}/distribuicao/nfe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        cpf_cnpj: cpfCnpj,
        ch_nfe: chave,
      }),
    });

    if (!resp.ok) {
      // Try alternative body format
      const resp2 = await fetch(`${NUVEM_FISCAL_API_BASE}/distribuicao/nfe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          cpf_cnpj: cpfCnpj,
          chNFe: chave,
        }),
      });
      if (!resp2.ok) return null;
    }

    // Poll for the document to become available (up to 60s)
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(5000);
      const xml = await findInDistribuicao(chave, token);
      if (xml) return xml;
    }
  } catch { /* fallthrough */ }
  return null;
}

// Strategy 3: Try NF-e listing (for notes emitted through Nuvem Fiscal)
async function findInNfeListing(chave: string, token: string): Promise<string | null> {
  try {
    const resp = await fetch(`${NUVEM_FISCAL_API_BASE}/nfe?chave=${chave}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const items = data?.data || [];
    if (items.length > 0 && items[0].id) {
      const xmlResp = await fetch(
        `${NUVEM_FISCAL_API_BASE}/nfe/${items[0].id}/xml`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" } }
      );
      if (xmlResp.ok) {
        const xml = await xmlResp.text();
        if (xml && xml.length > 200) return xml;
      }
    }
  } catch { /* fallthrough */ }
  return null;
}

// Strategy 4: Try consultadanfe.com (free service that queries SEFAZ)
async function fetchFromConsultaDanfe(chave: string): Promise<string | null> {
  // consultadanfe.com has an API at /api/consulta
  const urls = [
    `https://consultadanfe.com/api/consulta/${chave}`,
    `https://consultadanfe.com/api/v1/consulta/${chave}`,
    `https://api.consultadanfe.com/v1/nfe/${chave}`,
    `https://consultadanfe.com/${chave}`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          Accept: "application/json, application/xml, text/xml, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") || "";
      const text = await resp.text();

      // Check if it's XML directly
      if (text.includes("<nfeProc") || text.includes("<NFe") || text.includes("<infNFe")) {
        if (text.length > 200) return text;
      }

      // Check if it's JSON with xml field
      if (contentType.includes("json")) {
        try {
          const json = JSON.parse(text);
          if (json.xml && json.xml.length > 200) return json.xml;
          if (json.xmlCode && json.xmlCode.length > 200) return json.xmlCode;
          if (json.data?.xml && json.data.xml.length > 200) return json.data.xml;
        } catch { /* not json */ }
      }
    } catch { /* try next */ }
  }
  return null;
}

// Strategy 5: webdanfe.com.br
async function fetchFromWebDanfe(chave: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://www.webdanfe.com.br/api/get-xml?key=${chave}`, {
      headers: {
        Accept: "application/xml, text/xml, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (text.length > 200 && (text.includes("<nfeProc") || text.includes("<NFe") || text.includes("<infNFe"))) {
      return text;
    }
  } catch { /* fallthrough */ }
  return null;
}

interface ConsultaRequest {
  chaveAcesso?: string;
  chavesAcesso?: string[];
  cpf_cnpj?: string;
}

async function consultarChave(chave: string, token: string, cpfCnpj?: string): Promise<{ xml: string | null; source?: string }> {
  // 1. Quick check in existing distribution documents
  let xml = await findInDistribuicao(chave, token);
  if (xml) return { xml, source: "distribuicao-cache" };

  // 2. Quick check in NF-e listing
  xml = await findInNfeListing(chave, token);
  if (xml) return { xml, source: "nfe-listing" };

  // 3. Try free fallback services (fast, no waiting)
  xml = await fetchFromConsultaDanfe(chave);
  if (xml) return { xml, source: "consultadanfe" };

  xml = await fetchFromWebDanfe(chave);
  if (xml) return { xml, source: "webdanfe" };

  // 4. Request distribution from SEFAZ via Nuvem Fiscal (slow, up to 60s)
  if (cpfCnpj) {
    xml = await requestDistribuicaoByChave(chave, cpfCnpj, token);
    if (xml) return { xml, source: "distribuicao-sefaz" };
  }

  // 5. Try with CNPJ extracted from the chave itself (emitter's CNPJ)
  const cnpjFromChave = extractCNPJFromChave(chave);
  if (cnpjFromChave && cnpjFromChave !== cpfCnpj) {
    xml = await requestDistribuicaoByChave(chave, cnpjFromChave, token);
    if (xml) return { xml, source: "distribuicao-cnpj-chave" };
  }

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
        JSON.stringify({ error: `Chaves inválidas (devem ter 44 dígitos): ${invalidChaves.slice(0, 5).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getNuvemFiscalToken();
    const cpfCnpj = body.cpf_cnpj;

    if (chaves.length === 1) {
      const chave = chaves[0].replace(/\s/g, "");
      const result = await consultarChave(chave, token, cpfCnpj);

      if (!result.xml) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "XML não encontrado para esta chave de acesso. Verifique se a chave está correta e se a NF-e já foi autorizada. Tente novamente em alguns segundos ou importe via arquivo XML.",
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
          source: result.source,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch processing - process sequentially to avoid rate limits
    const results: any[] = [];
    for (const rawChave of chaves) {
      const chave = rawChave.replace(/\s/g, "");
      try {
        const result = await consultarChave(chave, token, cpfCnpj);
        if (result.xml) {
          results.push({ chaveAcesso: chave, success: true, xml: result.xml, source: result.source });
        } else {
          results.push({ chaveAcesso: chave, success: false, error: "XML não encontrado" });
        }
      } catch (err: any) {
        results.push({ chaveAcesso: chave, success: false, error: err.message || "Erro" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return new Response(
      JSON.stringify({
        success: true,
        total: chaves.length,
        encontradas: successCount,
        nao_encontradas: chaves.length - successCount,
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
