import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NUVEMFISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const NUVEMFISCAL_API_URL = "https://api.nuvemfiscal.com.br";

async function getNuvemFiscalToken(
  clientId: string,
  clientSecret: string,
  audience: string
): Promise<string> {
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
  return data.access_token;
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/[.\-\/\s]/g, "");
}

function parseNFeXml(xmlText: string) {
  const getTag = (tag: string, xml: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? match[1].trim() : "";
  };

  const getTagSection = (tag: string, xml: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? match[1] : "";
  };

  const nNF = getTag("nNF", xmlText);
  let chaveAcesso = getTag("chNFe", xmlText);
  if (!chaveAcesso) {
    const idMatch = xmlText.match(/Id="NFe(\d{44})"/);
    if (idMatch) chaveAcesso = idMatch[1];
  }

  const emitSection = getTagSection("emit", xmlText);
  const fornecedor = getTag("xNome", emitSection);
  const fornecedorCnpj = getTag("CNPJ", emitSection);

  const destSection = getTagSection("dest", xmlText);
  const destCnpj = getTag("CNPJ", destSection);

  const dhEmi = getTag("dhEmi", xmlText) || getTag("dEmi", xmlText);
  const dataEmissao = dhEmi ? dhEmi.split("T")[0] : null;

  const totalSection = getTagSection("total", xmlText);
  const icmsTotSection = getTagSection("ICMSTot", totalSection);
  const vNF = getTag("vNF", icmsTotSection) || getTag("vNF", xmlText);
  const valorTotal = parseFloat(vNF) || 0;

  const infCpl = getTag("infCpl", xmlText);
  let delivery: string | null = null;
  if (infCpl) {
    const deliveryMatch = infCpl.match(/DELIVERY:\s*([^\s;,]+)/i);
    if (deliveryMatch) delivery = deliveryMatch[1].trim();
  }

  return {
    numero_nf: nNF,
    chave_acesso: chaveAcesso,
    fornecedor,
    fornecedor_cnpj: fornecedorCnpj,
    dest_cnpj: destCnpj,
    data_emissao: dataEmissao,
    valor_total: valorTotal,
    delivery,
    xml: xmlText,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Nuvem Fiscal credentials
    const { data: secrets } = await supabase
      .from("system_secrets")
      .select("key, value")
      .in("key", ["NUVEMFISCAL_CLIENT_ID", "NUVEMFISCAL_CLIENT_SECRET", "NUVEMFISCAL_AUDIENCE"]);

    const map: Record<string, string> = {};
    for (const s of secrets || []) map[s.key] = s.value;

    const clientId = map["NUVEMFISCAL_CLIENT_ID"];
    const clientSecret = map["NUVEMFISCAL_CLIENT_SECRET"];
    const audience = map["NUVEMFISCAL_AUDIENCE"] || "https://api.nuvemfiscal.com.br/";

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Credenciais NuvemFiscal nao configuradas." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getNuvemFiscalToken(clientId, clientSecret, audience);

    // Get all unidades with CNPJ
    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, nome, cnpj")
      .not("cnpj", "is", null);

    if (!unidades || unidades.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma unidade com CNPJ cadastrado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let totalNovas = 0;
    let totalExistentes = 0;

    for (const unidade of unidades) {
      const cnpj = formatCnpj(unidade.cnpj);
      if (!cnpj || cnpj.length < 11) continue;

      // Fetch recent distributed documents for this CNPJ
      // This endpoint lists already-distributed docs - FREE, no event consumed
      const params = new URLSearchParams({
        cpf_cnpj: cnpj,
        ambiente: "producao",
        $top: "50",
        $orderby: "dataHoraAutorizacao desc",
      });

      const listResp = await fetch(
        `${NUVEMFISCAL_API_URL}/distribuicao/nfe/documentos?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!listResp.ok) {
        results.push({
          unidade: unidade.nome,
          cnpj,
          error: `Erro ao listar documentos (${listResp.status})`,
          novas: 0,
        });
        continue;
      }

      const listData = await listResp.json();
      const documentos = listData.data || listData.items || [];

      // Collect all valid chaves from this batch
      const docMap: Record<string, any> = {};
      for (const doc of documentos) {
        const chave = doc.chave || doc.chaveNFe || doc.chave_acesso || "";
        if (chave && chave.length === 44) {
          docMap[chave] = doc;
        }
      }

      const allChaves = Object.keys(docMap);
      if (allChaves.length === 0) {
        results.push({ unidade: unidade.nome, cnpj, documentos_encontrados: 0, novas: 0 });
        continue;
      }

      // Batch check which chaves already exist
      const { data: existingNfs } = await supabase
        .from("estoque_nfs")
        .select("chave_acesso")
        .in("chave_acesso", allChaves);

      const existingSet = new Set((existingNfs || []).map((n) => n.chave_acesso));
      const novasChaves = allChaves.filter((c) => !existingSet.has(c));
      totalExistentes += existingSet.size;

      let novasNesta = 0;

      for (const chave of novasChaves) {
        const doc = docMap[chave];

        // Try to download XML for this document (FREE - already distributed)
        let xmlContent: string | null = null;
        const docId = doc.id;

        if (docId) {
          const xmlResp = await fetch(
            `${NUVEMFISCAL_API_URL}/distribuicao/nfe/documentos/${docId}/xml`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (xmlResp.ok) {
            xmlContent = await xmlResp.text();
          }
        }

        // Parse XML to extract NF data
        let nfData: any = {
          chave_acesso: chave,
          fornecedor: doc.nome_emitente || doc.nomeEmitente || null,
          numero_nf: doc.numero_documento || doc.numeroDocumento || null,
          data_emissao: doc.data_emissao || doc.dataEmissao || doc.dataHoraAutorizacao?.split("T")[0] || null,
          valor_total: doc.valor_documento || doc.valorDocumento || null,
        };

        if (xmlContent && (xmlContent.includes("<nfeProc") || xmlContent.includes("<NFe"))) {
          const parsed = parseNFeXml(xmlContent);
          nfData = {
            chave_acesso: parsed.chave_acesso || chave,
            fornecedor: parsed.fornecedor || nfData.fornecedor,
            numero_nf: parsed.numero_nf || nfData.numero_nf,
            data_emissao: parsed.data_emissao || nfData.data_emissao,
            valor_total: parsed.valor_total || nfData.valor_total,
            delivery: parsed.delivery,
          };
        }

        // Insert as pending NF
        const { error: insertError } = await supabase
          .from("estoque_nfs")
          .insert({
            numero_nf: nfData.numero_nf || `NF-${chave.substring(25, 34)}`,
            chave_acesso: chave,
            xml_conteudo: xmlContent,
            fornecedor: nfData.fornecedor,
            data_emissao: nfData.data_emissao,
            valor_total: nfData.valor_total,
            unidade_id: unidade.id,
            processada: false,
            pendente_entrada: true,
            origem: "distribuicao_automatica",
            delivery: nfData.delivery,
            nsu: doc.nsu || doc.NSU || null,
          });

        if (!insertError) {
          novasNesta++;
          totalNovas++;
        }
      }

      results.push({
        unidade: unidade.nome,
        cnpj,
        documentos_encontrados: documentos.length,
        novas: novasNesta,
        ja_existentes: existingSet.size,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_novas_nfs: totalNovas,
        total_ja_existentes: totalExistentes,
        por_unidade: results,
        sincronizado_em: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
