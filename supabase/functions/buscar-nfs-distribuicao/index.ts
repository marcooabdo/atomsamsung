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

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: NUVEM_FISCAL_CLIENT_ID,
    client_secret: NUVEM_FISCAL_CLIENT_SECRET,
    audience: NUVEM_FISCAL_AUDIENCE,
    scope: "nfe distribuicao-nfe",
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

    // Get units to process
    let unidades: any[] = [];
    if (unidade_id) {
      const { data } = await supabase.from("unidades").select("id, nome, cnpj").eq("id", unidade_id).single();
      if (data && data.cnpj) unidades = [data];
    } else {
      const { data } = await supabase.from("unidades").select("id, nome, cnpj").not("cnpj", "is", null);
      unidades = (data || []).filter((u: any) => u.cnpj && u.cnpj.trim());
    }

    if (unidades.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma unidade com CNPJ cadastrado encontrada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getAccessToken();
    const results: { unidade: string; novas: number; existentes: number; erros: string[] }[] = [];

    for (const unidade of unidades) {
      const cnpj = normalizeCnpj(unidade.cnpj);
      const unidadeResult = { unidade: unidade.nome, novas: 0, existentes: 0, erros: [] as string[] };

      try {
        // Fetch recent documents from distribution
        const distUrl = `https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos?cpf_cnpj=${cnpj}&$top=50&$orderBy=dh_emissao desc`;
        const distResponse = await fetch(distUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });

        if (!distResponse.ok) {
          const errText = await distResponse.text();
          unidadeResult.erros.push(`Erro ao buscar distribuição: ${distResponse.status} - ${errText}`);
          results.push(unidadeResult);
          continue;
        }

        const distData = await distResponse.json();
        const documentos = distData.data || [];

        for (const doc of documentos) {
          const chave = doc.chave || "";
          const nsu = doc.nsu || doc.id || "";

          if (!chave || chave.length !== 44) continue;

          // Check if already exists
          const { data: existing } = await supabase
            .from("estoque_nfs")
            .select("id")
            .eq("chave_acesso", chave)
            .maybeSingle();

          if (existing) {
            unidadeResult.existentes++;
            continue;
          }

          // Download full XML
          let xmlContent: string | null = null;
          if (doc.id) {
            try {
              const xmlUrl = `https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos/${doc.id}/xml`;
              const xmlResponse = await fetch(xmlUrl, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/xml" },
              });
              if (xmlResponse.ok) {
                xmlContent = await xmlResponse.text();
              }
            } catch {
              // XML download failed
            }
          }

          // Extract NF data
          let nfData: any = null;
          if (xmlContent) {
            nfData = extractNFDataFromXML(xmlContent);
          }

          const delivery = xmlContent ? extractDeliveryFromXML(xmlContent) : null;

          // Insert as pending
          const insertData: any = {
            chave_acesso: chave,
            numero_nf: nfData?.numeroNF || doc.numero_documento || "",
            fornecedor: nfData?.fornecedor || doc.nome_emitente || "",
            data_emissao: nfData?.dataEmissao || doc.dh_emissao?.split("T")[0] || null,
            valor_total: nfData?.valorTotal || doc.valor_nfe || 0,
            delivery,
            xml_conteudo: xmlContent,
            unidade_id: unidade.id,
            processada: false,
            pendente_entrada: true,
            origem: "distribuicao_automatica",
            nsu: String(nsu),
            manifestada: false,
          };

          const { error: insertError } = await supabase.from("estoque_nfs").insert(insertData);
          if (insertError) {
            unidadeResult.erros.push(`Erro ao inserir NF ${chave.slice(0, 8)}...: ${insertError.message}`);
          } else {
            unidadeResult.novas++;
          }
        }
      } catch (err) {
        unidadeResult.erros.push(`Erro geral: ${err instanceof Error ? err.message : "desconhecido"}`);
      }

      results.push(unidadeResult);
    }

    const totalNovas = results.reduce((acc, r) => acc + r.novas, 0);
    const totalExistentes = results.reduce((acc, r) => acc + r.existentes, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Busca concluída: ${totalNovas} novas NFs encontradas, ${totalExistentes} já existentes.`,
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
