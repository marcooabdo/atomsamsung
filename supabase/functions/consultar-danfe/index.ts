import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CONSULTA_DANFE_API = "https://consultadanfe.com/api/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { chaveAcesso, chavesAcesso, xml, action } = body;

    // Generate PDF from XML (uses /danfe endpoint - 500 req/min limit)
    if (action === "gerar-pdf" && xml) {
      const result = await gerarPDFFromXML(xml);
      if (!result.success) {
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: result.httpStatus || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, pdf_base64: result.pdf_base64 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single key
    if (chaveAcesso && !chavesAcesso) {
      const chave = chaveAcesso.replace(/\s/g, "");

      if (chave.length !== 44) {
        return new Response(
          JSON.stringify({ error: "Chave de acesso deve ter 44 caracteres", chaveAcesso: chave }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await consultarChave(chave);

      if (!result.success) {
        return new Response(
          JSON.stringify({ error: result.error, chaveAcesso: chave, debug: result.debug }),
          { status: result.httpStatus || 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, xml: result.xml, pdf_base64: result.pdf_base64, chaveAcesso: chave }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multiple keys (batch)
    if (chavesAcesso && Array.isArray(chavesAcesso)) {
      const results = [];
      for (let i = 0; i < chavesAcesso.length; i++) {
        const clean = chavesAcesso[i].replace(/\s/g, "");
        try {
          const result = await consultarChave(clean);
          if (result.success) {
            results.push({ chaveAcesso: clean, success: true, xml: result.xml, pdf_base64: result.pdf_base64 });
          } else {
            results.push({ chaveAcesso: clean, success: false, error: result.error, debug: result.debug });
          }
        } catch (err: any) {
          results.push({ chaveAcesso: clean, success: false, error: err.message });
        }
        if (i < chavesAcesso.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Envie chaveAcesso (string), chavesAcesso (array), ou action:'gerar-pdf' com xml" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function gerarPDFFromXML(xml: string): Promise<{
  success: boolean;
  pdf_base64?: string;
  error?: string;
  httpStatus?: number;
}> {
  const xmlBase64 = btoa(unescape(encodeURIComponent(xml)));

  const resp = await fetch(`${CONSULTA_DANFE_API}/danfe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xml: xmlBase64 }),
  });

  if (resp.status === 429) {
    const retryAfter = resp.headers.get("Retry-After") || "60";
    const waitSecs = parseInt(retryAfter, 10);
    return {
      success: false,
      error: `Rate limit atingido. Aguarde ${waitSecs > 120 ? Math.ceil(waitSecs / 60) + ' minutos' : waitSecs + ' segundos'} e tente novamente.`,
      httpStatus: 429,
    };
  }

  if (!resp.ok) {
    let errorBody: any = {};
    try { errorBody = await resp.json(); } catch { /* ignore */ }
    return {
      success: false,
      error: errorBody.message || errorBody.error || `Erro HTTP ${resp.status}`,
      httpStatus: resp.status,
    };
  }

  const data = await resp.json();
  if (data.pdf_base64) {
    return { success: true, pdf_base64: data.pdf_base64 };
  }

  // If response is the PDF directly as binary
  if (resp.headers.get("content-type")?.includes("application/pdf")) {
    const arrayBuf = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { success: true, pdf_base64: btoa(binary) };
  }

  return { success: false, error: "API nao retornou PDF" };
}

async function consultarChave(chave: string, retryCount = 0): Promise<{
  success: boolean;
  xml?: string;
  pdf_base64?: string;
  error?: string;
  httpStatus?: number;
  debug?: any;
}> {
  const resp = await fetch(`${CONSULTA_DANFE_API}/consulta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chave, format: "json" }),
  });

  const errorCode = resp.headers.get("X-Error-Code") || undefined;

  if (resp.status === 429) {
    const retryAfter = resp.headers.get("Retry-After") || "60";
    const waitSecs = parseInt(retryAfter, 10);
    if (retryCount < 1 && waitSecs <= 65) {
      await new Promise(r => setTimeout(r, (waitSecs + 1) * 1000));
      return consultarChave(chave, retryCount + 1);
    }
    return {
      success: false,
      error: `Rate limit atingido. Aguarde ${waitSecs > 120 ? Math.ceil(waitSecs / 60) + ' minutos' : waitSecs + ' segundos'} e tente novamente.`,
      httpStatus: 429,
      debug: { errorCode: "rate_limit", retryAfter },
    };
  }

  if (resp.status === 202) {
    return {
      success: false,
      error: "NF-e em contingencia, ainda nao autorizada na SEFAZ. Tente novamente em alguns minutos.",
      httpStatus: 202,
      debug: { errorCode: errorCode || "pendente" },
    };
  }

  if (!resp.ok) {
    let errorBody: any = {};
    try { errorBody = await resp.json(); } catch { /* ignore */ }
    const message = errorBody.message || errorBody.error || `Erro HTTP ${resp.status}`;
    return {
      success: false,
      error: message,
      httpStatus: resp.status,
      debug: { errorCode, httpStatus: resp.status, errorBody },
    };
  }

  const data = await resp.json();

  if (data.status !== "ok" && data.status !== "multiplas_chaves") {
    return {
      success: false,
      error: `Status inesperado: ${data.status}`,
      debug: data,
    };
  }

  let xml: string | undefined;
  if (data.xml_base64) {
    try {
      xml = atob(data.xml_base64);
    } catch {
      xml = data.xml_base64;
    }
  } else if (data.xml) {
    xml = data.xml;
  }

  if (!xml) {
    return {
      success: false,
      error: "API retornou sucesso mas sem XML. Verifique se a NF-e esta autorizada.",
      debug: { status: data.status, hasXml: !!data.xml, hasXmlBase64: !!data.xml_base64, hasPdf: !!data.pdf_base64 },
    };
  }

  return {
    success: true,
    xml,
    pdf_base64: data.pdf_base64,
  };
}
