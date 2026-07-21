import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NUVEM_FISCAL_CLIENT_ID = "kfrx2HqLfTfOjM6MIkku";
const NUVEM_FISCAL_CLIENT_SECRET = "x9mrWhVT2x4tvs5ZEbz6oC3BGTWu8maeJGNLPaDT";
const NUVEM_FISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const NUVEM_FISCAL_API = "https://api.nuvemfiscal.com.br";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30000) {
    return cachedToken.access_token;
  }

  const resp = await fetch(NUVEM_FISCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: NUVEM_FISCAL_CLIENT_ID,
      client_secret: NUVEM_FISCAL_CLIENT_SECRET,
      scope: "cnpj nfe distribuicao-nfe",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.access_token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadDocumentXml(docId: string, token: string): Promise<{ xml: string | null; method: string; debug_info?: unknown }> {
  // Method 1: GET the document details - the body field contains the XML
  try {
    const docResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${docId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (docResp.ok) {
      const docData = await docResp.json();
      // The body field contains the XML content (might be base64 or plain text)
      if (docData.body) {
        let xmlContent = docData.body;
        // If body looks like base64 (no < at start), try to decode
        if (!xmlContent.startsWith("<") && !xmlContent.startsWith("<?")) {
          try {
            xmlContent = atob(xmlContent);
          } catch { /* not base64, use as-is */ }
        }
        if (xmlContent.length > 50) {
          return { xml: xmlContent, method: "document-body", debug_info: { tipo_documento: docData.tipo_documento, resumo: docData.resumo, schema: docData.schema, body_length: docData.body?.length } };
        }
      }
      // If no body, check if there's a xml_content or documento field
      if (docData.xml) {
        return { xml: docData.xml, method: "document-xml-field" };
      }
      if (docData.documento) {
        return { xml: docData.documento, method: "document-documento-field" };
      }
      // Return debug info about what fields are available
      return { xml: null, method: "document-no-body", debug_info: { available_fields: Object.keys(docData), tipo_documento: docData.tipo_documento, resumo: docData.resumo, schema: docData.schema, body_exists: !!docData.body, body_length: docData.body?.length || 0 } };
    }
  } catch (e: any) {
    // continue to fallback
  }

  // Method 2: Try /corpo endpoint
  try {
    const corpoResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${docId}/corpo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (corpoResp.ok) {
      const contentType = corpoResp.headers.get("content-type") || "";
      const corpo = await corpoResp.text();
      if (corpo && corpo.length > 50) {
        return { xml: corpo, method: "corpo", debug_info: { content_type: contentType, length: corpo.length } };
      }
    }
  } catch { /* continue */ }

  // Method 3: Try /xml endpoint  
  try {
    const xmlResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${docId}/xml`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (xmlResp.ok) {
      const xml = await xmlResp.text();
      if (xml && xml.length > 50) {
        return { xml, method: "xml-endpoint" };
      }
    }
  } catch { /* continue */ }

  return { xml: null, method: "all-failed" };
}

async function consultarChave(
  chave: string,
  cpfCnpj: string,
  token: string
): Promise<{ xml: string | null; debug: Record<string, unknown> }> {
  const debug: Record<string, unknown> = { steps: [] };
  const steps = debug.steps as unknown[];

  // Step 1: POST /distribuicao/nfe with tipo_consulta "cons-chave"
  const requestBody = {
    cpf_cnpj: cpfCnpj,
    ambiente: "producao",
    tipo_consulta: "cons-chave",
    cons_chave: chave,
  };

  steps.push({ action: "POST /distribuicao/nfe", body: requestBody });

  const distResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const distText = await distResp.text();
  steps.push({ http_status: distResp.status, response_preview: distText.substring(0, 1500) });

  if (!distResp.ok) {
    debug.error = `Nuvem Fiscal retornou ${distResp.status}`;
    debug.nuvem_response = distText.substring(0, 2000);
    return { xml: null, debug };
  }

  let distResult: any;
  try {
    distResult = JSON.parse(distText);
  } catch {
    debug.error = "Resposta da Nuvem Fiscal nao e JSON valido";
    return { xml: null, debug };
  }

  debug.distribuicao = {
    id: distResult.id,
    status: distResult.status,
    codigo_status: distResult.codigo_status,
    motivo_status: distResult.motivo_status,
    documentos_count: distResult.documentos?.length || 0,
  };

  // Step 2: If already completed with documents, download XML
  if (distResult.status === "concluido" && distResult.documentos?.length > 0) {
    for (const doc of distResult.documentos) {
      // First check if the document body is already in the response
      if (doc.body) {
        let xmlContent = doc.body;
        if (!xmlContent.startsWith("<") && !xmlContent.startsWith("<?")) {
          try { xmlContent = atob(xmlContent); } catch { /* not base64 */ }
        }
        if (xmlContent.length > 50) {
          steps.push({ action: "XML from inline body", docId: doc.id, length: xmlContent.length });
          return { xml: xmlContent, debug };
        }
      }

      if (doc.id) {
        steps.push({ action: "trying download", docId: doc.id, resumo: doc.resumo, tipo_documento: doc.tipo_documento, has_body: !!doc.body });
        const result = await downloadDocumentXml(doc.id, token);
        if (result.xml) {
          steps.push({ action: "XML downloaded", docId: doc.id, method: result.method, source: "distribuicao-concluido" });
          return { xml: result.xml, debug };
        }
        steps.push({ action: "download failed", docId: doc.id, method: result.method, detail: result.debug_info });
      }
    }
    steps.push({ note: "Documentos encontrados mas XML nao disponivel para download direto. Tentando manifestacao (ciencia da operacao)..." });

    // Step 2b: Perform manifestacao (ciencia da operacao) to unlock full XML
    try {
      const manifestBody = {
        cpf_cnpj: cpfCnpj,
        ambiente: "producao",
        chave_acesso: chave,
        tipo_evento: "ciencia_operacao",
      };
      const manifestResp = await fetch(`${NUVEM_FISCAL_API}/nfe/eventos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(manifestBody),
      });
      const manifestText = await manifestResp.text();
      steps.push({ action: "manifestacao ciencia_operacao", status: manifestResp.status, response: manifestText.substring(0, 500) });

      if (manifestResp.ok || manifestResp.status === 409) {
        // Wait a moment then retry download
        await sleep(3000);
        for (const doc of distResult.documentos) {
          if (doc.id) {
            const retryResult = await downloadDocumentXml(doc.id, token);
            if (retryResult.xml) {
              steps.push({ action: "XML downloaded after manifestacao", docId: doc.id });
              return { xml: retryResult.xml, debug };
            }
          }
        }

        // Also try a fresh distribution request after manifestation
        const retryDistResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cpf_cnpj: cpfCnpj,
            ambiente: "producao",
            tipo_consulta: "cons-chave",
            cons_chave: chave,
          }),
        });
        if (retryDistResp.ok) {
          const retryDist = await retryDistResp.json();
          steps.push({ action: "retry distribution after manifest", status: retryDist.status, docs: retryDist.documentos?.length || 0 });
          if (retryDist.status === "concluido" && retryDist.documentos?.length > 0) {
            for (const doc of retryDist.documentos) {
              if (doc.id) {
                const r = await downloadDocumentXml(doc.id, token);
                if (r.xml) return { xml: r.xml, debug };
              }
            }
          }
        }
      }
    } catch (err: any) {
      steps.push({ action: "manifestacao error", message: err.message });
    }
  }

  // Step 3: If processing, poll until done (max ~60s)
  if (distResult.status === "processando" && distResult.id) {
    for (let i = 0; i < 12; i++) {
      await sleep(5000);

      const pollResp = await fetch(`${NUVEM_FISCAL_API}/distribuicao/nfe/${distResult.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!pollResp.ok) {
        steps.push({ poll: i + 1, error: `poll returned ${pollResp.status}` });
        continue;
      }

      const pollData = await pollResp.json();
      steps.push({
        poll: i + 1,
        status: pollData.status,
        codigo_status: pollData.codigo_status,
        docs_count: pollData.documentos?.length || 0,
      });

      if (pollData.status === "concluido") {
        if (pollData.documentos?.length > 0) {
          for (const doc of pollData.documentos) {
            if (doc.id) {
              const result = await downloadDocumentXml(doc.id, token);
              if (result.xml) return { xml: result.xml, debug };
            }
          }
        }
        break;
      }

      if (pollData.status === "erro") {
        debug.error = `SEFAZ retornou erro: ${pollData.motivo_status || "sem detalhes"}`;
        break;
      }
    }
  }

  // Step 4: Fallback - search in existing documents by chave_acesso
  try {
    const searchResp = await fetch(
      `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos?chave_acesso=${chave}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const items = searchData?.data || searchData;
      steps.push({ action: "search existing docs", items_count: Array.isArray(items) ? items.length : 0 });
      if (Array.isArray(items)) {
        for (const doc of items) {
          if (doc.id) {
            const result = await downloadDocumentXml(doc.id, token);
            if (result.xml) return { xml: result.xml, debug };
          }
        }
      }
    }
  } catch { /* continue */ }

  // Step 5: Fallback - check NF-e listing (for notes emitted via Nuvem Fiscal)
  try {
    const nfeResp = await fetch(`${NUVEM_FISCAL_API}/nfe?chave=${chave}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (nfeResp.ok) {
      const nfeData = await nfeResp.json();
      const items = nfeData?.data || [];
      if (Array.isArray(items) && items.length > 0 && items[0].id) {
        const xmlResp = await fetch(`${NUVEM_FISCAL_API}/nfe/${items[0].id}/xml`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (xmlResp.ok) {
          const xml = await xmlResp.text();
          if (xml && xml.length > 100) {
            steps.push({ action: "found in NF-e listing" });
            return { xml, debug };
          }
        }
      }
    }
  } catch { /* continue */ }

  return { xml: null, debug };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
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

    const invalidChaves = chaves.filter((c) => !c || c.replace(/\s/g, "").length !== 44);
    if (invalidChaves.length > 0) {
      return new Response(
        JSON.stringify({ error: `Chave invalida (deve ter 44 digitos): ${invalidChaves[0]}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cpfCnpj = body.cpf_cnpj;
    if (!cpfCnpj) {
      return new Response(
        JSON.stringify({
          error: "CNPJ da unidade nao fornecido. A consulta por chave requer o CNPJ do destinatario.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getToken();

    if (chaves.length === 1) {
      const chave = chaves[0].replace(/\s/g, "");
      const result = await consultarChave(chave, cpfCnpj, token);

      if (result.xml) {
        return new Response(
          JSON.stringify({ success: true, chaveAcesso: chave, xml: result.xml }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error:
            "XML nao encontrado. Possiveis causas: (1) chave incorreta, (2) NF-e nao autorizada ainda, (3) CNPJ da unidade nao e o destinatario desta NF-e, (4) certificado digital nao esta vinculado ao CNPJ na Nuvem Fiscal.",
          chaveAcesso: chave,
          debug: result.debug,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch processing
    const results: any[] = [];
    for (const rawChave of chaves) {
      const chave = rawChave.replace(/\s/g, "");
      try {
        const result = await consultarChave(chave, cpfCnpj, token);
        if (result.xml) {
          results.push({ chaveAcesso: chave, success: true, xml: result.xml });
        } else {
          results.push({ chaveAcesso: chave, success: false, error: "XML nao encontrado", debug: result.debug });
        }
      } catch (err: any) {
        results.push({ chaveAcesso: chave, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
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
      JSON.stringify({ error: "Erro interno", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
