import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NUVEMFISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const NUVEMFISCAL_API_URL = "https://api.nuvemfiscal.com.br";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getNuvemFiscalToken(
  clientId: string,
  clientSecret: string,
  audience: string
): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const resp = await fetch(NUVEMFISCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "nfe distribuicao-nfe",
      audience,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OAuth token error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

async function getCredentials() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: secrets } = await supabase
    .from("system_secrets")
    .select("key, value")
    .in("key", [
      "NUVEMFISCAL_CLIENT_ID",
      "NUVEMFISCAL_CLIENT_SECRET",
      "NUVEMFISCAL_AUDIENCE",
    ]);

  const map: Record<string, string> = {};
  for (const s of secrets || []) {
    map[s.key] = s.value;
  }

  return {
    clientId: map["NUVEMFISCAL_CLIENT_ID"],
    clientSecret: map["NUVEMFISCAL_CLIENT_SECRET"],
    audience: map["NUVEMFISCAL_AUDIENCE"] || "https://api.nuvemfiscal.com.br/",
  };
}

function extractCnpjFromChave(chave: string): string {
  return chave.substring(6, 20);
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/[.\-\/]/g, "");
}

async function distribuirPorChave(
  token: string,
  cpfCnpj: string,
  chaveAcesso: string
): Promise<{ success: boolean; documentId?: string; xml?: string; error?: string }> {
  // Step 1: Request distribution by access key
  const distResp = await fetch(`${NUVEMFISCAL_API_URL}/distribuicao/nfe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cpf_cnpj: cpfCnpj,
      ambiente: "producao",
      tipo_consulta: "cons-chave",
      cons_chave: chaveAcesso,
    }),
  });

  if (!distResp.ok) {
    const errBody = await distResp.text();
    let parsed: any = {};
    try { parsed = JSON.parse(errBody); } catch { /* ignore */ }
    const msg = parsed?.error?.message || parsed?.message || errBody;
    return { success: false, error: `Distribuicao falhou (${distResp.status}): ${msg}` };
  }

  const distData = await distResp.json();

  // The response contains the documents found
  const documentos = distData.documentos || distData.body?.documentos || [];

  if (documentos.length === 0) {
    // Check if the response has a single document inline
    if (distData.id) {
      return await downloadXml(token, distData.id);
    }
    return {
      success: false,
      error: distData.motivo_status || "Nenhum documento encontrado para esta chave. Verifique se a NF-e esta autorizada.",
    };
  }

  // Get the first document with XML available
  const doc = documentos[0];
  const docId = doc.id;

  if (!docId) {
    return { success: false, error: "Documento encontrado mas sem ID para download." };
  }

  return await downloadXml(token, docId);
}

async function downloadXml(
  token: string,
  documentId: string
): Promise<{ success: boolean; documentId?: string; xml?: string; error?: string }> {
  const xmlResp = await fetch(
    `${NUVEMFISCAL_API_URL}/distribuicao/nfe/documentos/${documentId}/xml`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!xmlResp.ok) {
    const errBody = await xmlResp.text();
    return {
      success: false,
      documentId,
      error: `Download XML falhou (${xmlResp.status}): ${errBody.substring(0, 200)}`,
    };
  }

  const xml = await xmlResp.text();
  return { success: true, documentId, xml };
}

async function downloadPdf(
  token: string,
  documentId: string
): Promise<{ success: boolean; pdf_base64?: string; error?: string }> {
  const pdfResp = await fetch(
    `${NUVEMFISCAL_API_URL}/distribuicao/nfe/documentos/${documentId}/pdf`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!pdfResp.ok) {
    return { success: false, error: `Download PDF falhou (${pdfResp.status})` };
  }

  const arrayBuf = await pdfResp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { success: true, pdf_base64: btoa(binary) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { chaveAcesso, chavesAcesso, cpfCnpj } = body;

    // Get credentials
    const creds = await getCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      return new Response(
        JSON.stringify({ error: "Credenciais NuvemFiscal nao configuradas." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth token
    const token = await getNuvemFiscalToken(
      creds.clientId,
      creds.clientSecret,
      creds.audience
    );

    // Single key lookup
    if (chaveAcesso && !chavesAcesso) {
      const chave = chaveAcesso.replace(/\s/g, "");

      if (chave.length !== 44) {
        return new Response(
          JSON.stringify({ error: "Chave de acesso deve ter 44 caracteres" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine CNPJ: use provided one, or look up from unidades using CNPJ in the key
      let cnpj = cpfCnpj ? formatCnpj(cpfCnpj) : "";
      if (!cnpj) {
        cnpj = await findCnpjForChave(chave);
      }

      if (!cnpj) {
        return new Response(
          JSON.stringify({ error: "CNPJ da empresa nao encontrado. Envie cpfCnpj no body." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await distribuirPorChave(token, cnpj, chave);

      if (!result.success) {
        return new Response(
          JSON.stringify({ success: false, error: result.error, chaveAcesso: chave }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to get PDF
      let pdf_base64: string | undefined;
      if (result.documentId) {
        const pdfResult = await downloadPdf(token, result.documentId);
        if (pdfResult.success) {
          pdf_base64 = pdfResult.pdf_base64;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          xml: result.xml,
          pdf_base64,
          chaveAcesso: chave,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multiple keys (batch)
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
      const results = [];
      for (let i = 0; i < chavesAcesso.length; i++) {
        const chave = chavesAcesso[i].replace(/\s/g, "");
        try {
          let cnpj = cpfCnpj ? formatCnpj(cpfCnpj) : "";
          if (!cnpj) {
            cnpj = await findCnpjForChave(chave);
          }

          if (!cnpj) {
            results.push({ chaveAcesso: chave, success: false, error: "CNPJ nao encontrado" });
            continue;
          }

          const result = await distribuirPorChave(token, cnpj, chave);
          if (result.success) {
            let pdf_base64: string | undefined;
            if (result.documentId) {
              const pdfResult = await downloadPdf(token, result.documentId);
              if (pdfResult.success) pdf_base64 = pdfResult.pdf_base64;
            }
            results.push({ chaveAcesso: chave, success: true, xml: result.xml, pdf_base64 });
          } else {
            results.push({ chaveAcesso: chave, success: false, error: result.error });
          }
        } catch (err: any) {
          results.push({ chaveAcesso: chave, success: false, error: err.message });
        }
        if (i < chavesAcesso.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Envie chaveAcesso (string) ou chavesAcesso (array)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function findCnpjForChave(chave: string): Promise<string> {
  // The access key contains the emitter CNPJ at positions 6-19
  // But for distribution we need the RECIPIENT's CNPJ (our company)
  // Try all registered companies - use the first one that has distribution enabled
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: unidades } = await supabase
    .from("unidades")
    .select("cnpj")
    .not("cnpj", "is", null);

  if (!unidades || unidades.length === 0) return "";

  // Return the first unidade CNPJ (cleaned)
  // In practice the user should pass cpfCnpj for the specific unit
  return formatCnpj(unidades[0].cnpj);
}
