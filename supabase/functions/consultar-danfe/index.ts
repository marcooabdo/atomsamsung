import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConsultaRequest {
  chaveAcesso: string;
}

function extractDeliveryFromXML(xmlContent: string): string | null {
  try {
    const infCplMatch = xmlContent.match(/<infCpl>(.*?)<\/infCpl>/);
    if (!infCplMatch) return null;

    const infCplContent = infCplMatch[1];

    const parts = infCplContent.split(/\s+/);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'DELIVERY:' && i + 1 < parts.length) {
        return parts[i + 1].trim();
      }
    }

    const deliveryMatch = infCplContent.match(/DELIVERY:\s*([^\s]+)/i);
    if (deliveryMatch) {
      return deliveryMatch[1].trim();
    }

    return null;
  } catch (e) {
    console.error('Erro ao extrair delivery:', e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { chaveAcesso }: ConsultaRequest = await req.json();

    if (!chaveAcesso || chaveAcesso.length !== 44) {
      return new Response(
        JSON.stringify({ error: "Chave de acesso inválida. Deve conter 44 dígitos." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const apiUrl = `https://consultadanfe.com/api/consulta/${chaveAcesso}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Supabase-Edge-Function',
        },
      });

      let apiData = null;
      if (response.ok) {
        try {
          apiData = await response.json();
        } catch (e) {
          console.log('Resposta não é JSON');
        }
      }

      let delivery = null;
      try {
        const xmlUrl = `https://consultadanfe.com/danfe/xml/${chaveAcesso}`;
        const xmlResponse = await fetch(xmlUrl);
        if (xmlResponse.ok) {
          const xmlContent = await xmlResponse.text();
          delivery = extractDeliveryFromXML(xmlContent);
        }
      } catch (e) {
        console.error('Erro ao buscar XML:', e);
      }

      const pdfUrl = `https://consultadanfe.com/danfe/pdf/${chaveAcesso}`;
      const xmlUrl = `https://consultadanfe.com/danfe/xml/${chaveAcesso}`;
      const visualizarUrl = `https://consultadanfe.com/consulta/${chaveAcesso}`;

      return new Response(
        JSON.stringify({
          success: true,
          chaveAcesso,
          pdfUrl,
          xmlUrl,
          visualizarUrl,
          delivery,
          data: apiData,
          message: "DANFE disponível para download."
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (apiError) {
      console.error('Erro na API, retornando URLs diretas:', apiError);

      const pdfUrl = `https://consultadanfe.com/danfe/pdf/${chaveAcesso}`;
      const xmlUrl = `https://consultadanfe.com/danfe/xml/${chaveAcesso}`;
      const visualizarUrl = `https://consultadanfe.com/consulta/${chaveAcesso}`;

      return new Response(
        JSON.stringify({
          success: true,
          chaveAcesso,
          pdfUrl,
          xmlUrl,
          visualizarUrl,
          delivery: null,
          message: "Links para download do DANFE gerados."
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Erro ao consultar DANFE:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao processar solicitação",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
