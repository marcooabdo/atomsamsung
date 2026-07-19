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
    throw new Error(`Token error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, "");
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

function extractNFDataFromXML(xmlContent: string): { numeroNF: string; fornecedor: string; dataEmissao: string; valorTotal: number; chaveAcesso: string } | null {
  try {
    const getTag = (tag: string): string => {
      const match = xmlContent.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return match ? match[1] : "";
    };

    const numeroNF = getTag("nNF");
    let chaveAcesso = getTag("chNFe");
    if (!chaveAcesso) {
      const idMatch = xmlContent.match(/Id="NFe(\d{44})"/);
      if (idMatch) chaveAcesso = idMatch[1];
    }

    const fornecedor = getTag("xNome");
    const dataEmissao = (getTag("dhEmi") || getTag("dEmi")).split("T")[0];
    const valorTotal = parseFloat(getTag("vNF")) || 0;

    if (!numeroNF && !chaveAcesso) return null;
    return { numeroNF, fornecedor, dataEmissao, valorTotal, chaveAcesso };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { unidade_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = await getAccessToken();

    // Get empresas registered in Nuvem Fiscal
    let empresasNF: { cpf_cnpj: string; razao_social: string }[] = [];
    try {
      const empResponse = await fetch(`${NUVEM_FISCAL_API}/empresas?$top=50`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (empResponse.ok) {
        const empData = await empResponse.json();
        empresasNF = (empData.data || empData || []).map((e: any) => ({
          cpf_cnpj: (e.cpf_cnpj || "").replace(/[^\d]/g, ""),
          razao_social: e.razao_social || e.nome_fantasia || "",
        }));
      }
    } catch {}

    // Match with our unidades to know which unidade_id to assign
    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, nome, cnpj")
      .not("cnpj", "is", null);

    const unidadeMap = new Map<string, { id: string; nome: string }>();
    for (const u of (unidades || [])) {
      if (u.cnpj) {
        unidadeMap.set(normalizeCnpj(u.cnpj), { id: u.id, nome: u.nome });
      }
    }

    // Filter empresas: if unidade_id is specified, only use that one
    let targetEmpresas = empresasNF;
    if (unidade_id) {
      const targetUnidade = (unidades || []).find((u: any) => u.id === unidade_id);
      if (targetUnidade?.cnpj) {
        const targetCnpj = normalizeCnpj(targetUnidade.cnpj);
        targetEmpresas = empresasNF.filter(e => e.cpf_cnpj === targetCnpj);
      }
    }

    if (targetEmpresas.length === 0) {
      // Fallback: use DB CNPJs directly
      if (unidade_id) {
        const u = (unidades || []).find((u: any) => u.id === unidade_id);
        if (u?.cnpj) {
          targetEmpresas = [{ cpf_cnpj: normalizeCnpj(u.cnpj), razao_social: u.nome }];
        }
      } else {
        targetEmpresas = (unidades || [])
          .filter((u: any) => u.cnpj)
          .map((u: any) => ({ cpf_cnpj: normalizeCnpj(u.cnpj), razao_social: u.nome }));
      }
    }

    if (targetEmpresas.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma empresa com CNPJ encontrada para buscar distribuição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range: last 7 days
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 7);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];

    const results: { unidade: string; cnpj: string; novas: number; existentes: number; erros: string[] }[] = [];

    for (const empresa of targetEmpresas) {
      const unidadeInfo = unidadeMap.get(empresa.cpf_cnpj);
      const resultItem = {
        unidade: unidadeInfo?.nome || empresa.razao_social || empresa.cpf_cnpj,
        cnpj: empresa.cpf_cnpj,
        novas: 0,
        existentes: 0,
        erros: [] as string[],
      };

      try {
        // Fetch documents from distribution - last 7 days
        const distUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos?cpf_cnpj=${empresa.cpf_cnpj}&$top=50&$orderby=dh_emissao desc`;
        const distResponse = await fetch(distUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });

        if (!distResponse.ok) {
          const errText = await distResponse.text();
          resultItem.erros.push(`API ${distResponse.status}: ${errText.slice(0, 150)}`);
          results.push(resultItem);
          continue;
        }

        const distData = await distResponse.json();
        const documentos = distData.data || [];
        resultItem.erros.push(`Total docs retornados: ${documentos.length}`);

        for (const doc of documentos) {
          const chave = doc.chave || "";
          if (!chave || chave.length !== 44) continue;

          // Check emission date
          const dhEmissao = doc.dh_emissao || "";
          if (dhEmissao && dhEmissao.split("T")[0] < dataInicioStr) continue;

          // Check if already exists
          const { data: existing } = await supabase
            .from("estoque_nfs")
            .select("id")
            .eq("chave_acesso", chave)
            .maybeSingle();

          if (existing) {
            resultItem.existentes++;
            continue;
          }

          // Download full XML
          let xmlContent: string | null = null;
          if (doc.id) {
            try {
              const xmlUrl = `${NUVEM_FISCAL_API}/distribuicao/nfe/documentos/${doc.id}/xml`;
              const xmlResponse = await fetch(xmlUrl, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
              });
              if (xmlResponse.ok) {
                xmlContent = await xmlResponse.text();
              }
            } catch {}
          }

          const nfData = xmlContent ? extractNFDataFromXML(xmlContent) : null;
          const delivery = xmlContent ? extractDeliveryFromXML(xmlContent) : null;

          const insertData: any = {
            chave_acesso: chave,
            numero_nf: nfData?.numeroNF || doc.numero_documento || "",
            fornecedor: nfData?.fornecedor || doc.nome_emitente || "",
            data_emissao: nfData?.dataEmissao || (dhEmissao ? dhEmissao.split("T")[0] : null),
            valor_total: nfData?.valorTotal || doc.valor_nfe || 0,
            delivery,
            xml_conteudo: xmlContent,
            unidade_id: unidadeInfo?.id || unidade_id || null,
            processada: false,
            pendente_entrada: true,
            origem: "distribuicao_automatica",
            nsu: String(doc.nsu || doc.id || ""),
            manifestada: false,
          };

          const { error: insertError } = await supabase.from("estoque_nfs").insert(insertData);
          if (insertError) {
            resultItem.erros.push(`Insert error: ${insertError.message}`);
          } else {
            resultItem.novas++;
          }
        }
      } catch (err) {
        resultItem.erros.push(`Error: ${err instanceof Error ? err.message : "unknown"}`);
      }

      results.push(resultItem);
    }

    const totalNovas = results.reduce((acc, r) => acc + r.novas, 0);
    const totalExistentes = results.reduce((acc, r) => acc + r.existentes, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Busca concluída: ${totalNovas} novas NFs encontradas, ${totalExistentes} já existentes.`,
        empresasConsultadas: targetEmpresas.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Erro ao buscar NFs da distribuição",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
