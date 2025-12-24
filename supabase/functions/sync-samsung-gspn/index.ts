import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SamsungServiceOrder {
  SvcOrderNo: string;
  AscJobNo: string;
  ReqDate: string;
  Model: string;
  SerialNo: string;
  IMEI: string;
  PurchaseDate: string;
  WarrantyType: string;
  CustName: string;
  CustCity: string;
  ScheduleDate: string;
  CollectionCenter: string;
  CollectionCenterName: string;
  SvcTypeDesc: string;
  StatusDesc: string;
  StReasonDesc: string;
  CollectionRefNo: string;
  CompleteDate: string;
  Engineer: string;
  EngineerName: string;
  Remark: string;
  AscCode: string;
  AscName: string;
  CustComment: string;
  CustHomePhone: string;
  CustOfficePhone: string;
  CustMobilePhone: string;
  SvcProduct: string;
  CustFeedback: string;
  SvcComment: string;
  LocalProduct: string;
  CcAppDate: string;
  RedoFlag: string;
  Status: string;
  ScheduleTime: string;
  PostingDate: string;
  DetailType: string;
  CustZipcode: string;
  CustFirstName: string;
  CustLastName: string;
  CustAddress: string;
  CustState: string;
  StReason: string;
  CompleteTime: string;
  SvcTAT: string;
  InboundTrackingNo: string;
  WarrantyStatus: string;
  EliteService: string;
  AppTime: string;
  WtyType: string;
  CallReceivedDate: string;
  CallReceivedTime: string;
  CustRequestDate: string;
  CustRequestTime: string;
  UrgentService: string;
  RiskGrade: string;
}

interface SamsungAPIResponse {
  Return: {
    EsCommonResult: {
      Code: string;
      Codedesc: string;
      Msgid: string;
      Sac: string;
      Pac: string;
    };
    EvRetCode: string;
    EvRetMsg: string;
  };
  EtSvcInfo: {
    results: SamsungServiceOrder[];
  };
}

interface SamsungDetailResponse {
  Return: {
    EsHeaderInfo: {
      AscCode: string;
      [key: string]: any;
    };
    EsBpInfo: {
      CustAddrStreet2?: string;
      CustEmail?: string;
      CustDistrict?: string;
      CustId?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

interface ProcessedOS {
  numero_os_samsung: string;
  cliente_numero: string;
  cliente_email: string;
  cliente_bairro: string;
  cliente_complemento: string;
  cliente_cpf_cnpj: string;
}

interface SamsungAttachment {
  Filename: string;
  Filetype: string;
  Fileobjkey: string;
  Description: string;
  FileSize: string;
  CreatedDt: string;
  CreatedTm: string;
  CreatedBy: string;
  Docclass: string;
}

interface SamsungAttachListResponse {
  EtFileInfo: {
    results: SamsungAttachment[];
  };
}

interface SamsungAttachFileResponse {
  Return: {
    EsCommonResult: {
      Code: string;
      Codedesc: string;
      Msgid: string;
      Sac: string;
      Pac: string;
    };
    EvFileStream: string;
  };
}

function mapFileTypeToTipo(filetype: string, filename: string): 'foto' | 'video' | 'documento' {
  const lowerFiletype = (filetype || '').toLowerCase();
  const lowerFilename = (filename || '').toLowerCase();

  if (lowerFiletype.includes('image') || lowerFilename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
    return 'foto';
  }

  if (lowerFiletype.includes('video') || lowerFilename.match(/\.(mp4|avi|mov|wmv|flv|webm)$/)) {
    return 'video';
  }

  return 'documento';
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  processItem: (item: T) => Promise<void>
): Promise<void> {
  const results: Promise<void>[] = [];

  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchPromises = batch.map(item => processItem(item).catch(err => {
      console.error('Erro ao processar item:', err);
    }));
    await Promise.all(batchPromises);
  }
}

async function downloadAndSaveAttachments(
  osId: string,
  numeroOSSamsung: string,
  unidade: { samsung_asccode: string; samsung_token: string },
  supabase: any,
  generatePac: () => string,
  usuarioId: string
): Promise<void> {
  try {
    const listPayload = {
      IvSvcOrderNo: numeroOSSamsung,
      IsCommonHeader: {
        Company: "C820",
        AscCode: unidade.samsung_asccode,
        Country: "BR",
        Lang: "EN",
        Pac: generatePac()
      }
    };

    const listResponse = await fetch(
      'https://latam.ipaas.samsung.com/latam/gcic/GetSOAttachList/1.0/ImportSet',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${unidade.samsung_token}`,
          'Cookie': 'sap-usercontext=sap-client=100'
        },
        body: JSON.stringify(listPayload)
      }
    );

    if (!listResponse.ok) {
      console.error(`Erro ao listar anexos da OS ${numeroOSSamsung}`);
      return;
    }

    const listData: SamsungAttachListResponse = await listResponse.json();
    const attachments = listData.EtFileInfo?.results || [];

    if (attachments.length === 0) {
      console.log(`Nenhum anexo encontrado para OS ${numeroOSSamsung}`);
      return;
    }

    console.log(`Encontrados ${attachments.length} anexos para OS ${numeroOSSamsung}`);

    for (const attachment of attachments) {
      try {
        const filePayload = {
          IvSvcOrderNo: numeroOSSamsung,
          IvDocKey: attachment.Fileobjkey,
          IsCommonHeader: {
            Company: "C820",
            AscCode: unidade.samsung_asccode,
            Country: "BR",
            Lang: "EN",
            Pac: generatePac()
          }
        };

        const fileResponse = await fetch(
          'https://latam.ipaas.samsung.com/latam/gcic/GetSOAttachFile/1.0/ImportSet',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${unidade.samsung_token}`,
              'Cookie': 'sap-usercontext=sap-client=100'
            },
            body: JSON.stringify(filePayload)
          }
        );

        if (!fileResponse.ok) {
          console.error(`Erro ao baixar anexo ${attachment.Filename}`);
          continue;
        }

        const fileData: SamsungAttachFileResponse = await fileResponse.json();

        if (!fileData.Return?.EvFileStream) {
          console.error(`Stream vazio para anexo ${attachment.Filename}`);
          continue;
        }

        const base64Data = fileData.Return.EvFileStream;
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        const timestamp = Date.now();
        const fileName = `${osId}/${timestamp}_${attachment.Filename}`;

        const { error: uploadError } = await supabase.storage
          .from('os_anexos')
          .upload(fileName, binaryData, {
            contentType: attachment.Filetype || 'application/octet-stream',
            upsert: false
          });

        if (uploadError) {
          console.error(`Erro ao fazer upload do anexo ${attachment.Filename}:`, uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('os_anexos')
          .getPublicUrl(fileName);

        const tipoAnexo = mapFileTypeToTipo(attachment.Filetype, attachment.Filename);

        await supabase
          .from('os_anexos')
          .insert({
            os_id: osId,
            nome_arquivo: attachment.Filename,
            url: urlData.publicUrl,
            tipo: tipoAnexo,
            tamanho_bytes: parseInt(attachment.FileSize) || 0,
            usuario_id: usuarioId
          });

        console.log(`Anexo ${attachment.Filename} salvo com sucesso`);
      } catch (error) {
        console.error(`Erro ao processar anexo ${attachment.Filename}:`, error);
      }
    }
  } catch (error) {
    console.error(`Erro ao processar anexos da OS ${numeroOSSamsung}:`, error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, unidade_id, tipo')
      .eq('id', user.id)
      .single();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetUnidadeId = body.unidade_id;

    let unidadeId = targetUnidadeId || usuario.unidade_id;

    if (!unidadeId) {
      return new Response(
        JSON.stringify({ error: 'Unidade não especificada. Usuário master deve informar unidade_id no corpo da requisição.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUnidadeId && targetUnidadeId !== usuario.unidade_id && usuario.unidade_id !== null) {
      if (usuario.tipo !== 'master' && usuario.tipo !== 'diretoria') {
        return new Response(
          JSON.stringify({ error: 'Sem permissão para sincronizar outras unidades' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: unidade } = await supabase
      .from('unidades')
      .select('samsung_asccode, samsung_token')
      .eq('id', unidadeId)
      .single();

    if (!unidade || !unidade.samsung_asccode || !unidade.samsung_token) {
      return new Response(
        JSON.stringify({ error: 'Configuração Samsung não encontrada na unidade' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: syncLog, error: syncLogError } = await supabase
      .from('samsung_sync_logs')
      .insert({
        unidade_id: unidadeId,
        config_id: null,
        status: 'em_andamento',
        iniciado_em: new Date().toISOString(),
        executado_por: usuario.id
      })
      .select()
      .single();

    if (syncLogError || !syncLog) {
      console.error('Erro ao criar log de sincronização:', syncLogError);
      return new Response(
        JSON.stringify({ error: 'Erro ao iniciar sincronização', details: syncLogError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - 7);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const generatePac = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}${hours}${minutes}${seconds}`;
    };

    const payload = {
      IsBasicCond: {
        AscCode: unidade.samsung_asccode,
        ReqDateFrom: formatDate(dataInicio),
        ReqDateTo: formatDate(hoje)
      },
      IvCompany: "",
      IsCommonHeader: {
        Company: "C820",
        AscCode: unidade.samsung_asccode,
        Country: "BR",
        Lang: "EN",
        Pac: generatePac()
      }
    };

    const apiUrl = 'https://latam.ipaas.samsung.com/latam/gcic/GetSOList/1.0/ImportSet';

    console.log('Consultando API Samsung:', JSON.stringify(payload));

    const samsungResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unidade.samsung_token}`,
        'Cookie': 'sap-usercontext=sap-client=100'
      },
      body: JSON.stringify(payload)
    });

    if (!samsungResponse.ok) {
      const errorText = await samsungResponse.text();
      console.error('Erro na API Samsung:', errorText);

      await supabase
        .from('samsung_sync_logs')
        .update({
          status: 'erro',
          finalizado_em: new Date().toISOString(),
          mensagem_erro: `API retornou status ${samsungResponse.status}: ${errorText}`
        })
        .eq('id', syncLog.id);

      return new Response(
        JSON.stringify({
          error: 'Erro na API Samsung',
          details: errorText,
          status: samsungResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData: SamsungAPIResponse = await samsungResponse.json();

    if (responseData.Return.EvRetCode !== "0") {
      const errorMsg = `API Samsung retornou erro: ${responseData.Return.EvRetMsg || 'Erro desconhecido'}`;
      console.error(errorMsg);

      await supabase
        .from('samsung_sync_logs')
        .update({
          status: 'erro',
          finalizado_em: new Date().toISOString(),
          mensagem_erro: errorMsg
        })
        .eq('id', syncLog.id);

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const osList = responseData.EtSvcInfo?.results || [];
    console.log(`Total de OS encontradas: ${osList.length}`);

    const { data: existingOS } = await supabase
      .from('os')
      .select('numero_os_samsung')
      .eq('unidade_id', unidadeId)
      .not('numero_os_samsung', 'is', null);

    const existingNumbers = new Set((existingOS || []).map(os => os.numero_os_samsung));

    const { data: tecnicos } = await supabase
      .from('usuarios')
      .select('id, nome, email, numero_tecnico')
      .eq('unidade_id', unidadeId)
      .not('numero_tecnico', 'is', null);

    const tecnicoMap = new Map<string, { id: string; nome: string; email: string }>();
    (tecnicos || []).forEach(t => {
      if (t.numero_tecnico) {
        tecnicoMap.set(t.numero_tecnico, { id: t.id, nome: t.nome, email: t.email });
      }
    });

    let criadas = 0;
    let ignoradas = 0;
    const erros: string[] = [];

    const osToCreate: any[] = [];
    const detailsMap = new Map<string, ProcessedOS>();

    for (const os of osList) {
      if (existingNumbers.has(os.SvcOrderNo)) {
        ignoradas++;
        continue;
      }
      osToCreate.push(os);
    }

    console.log(`Processando ${osToCreate.length} OS com detalhes complementares...`);

    await runWithConcurrencyLimit(osToCreate, 3, async (os) => {
      try {
        const detailPayload = {
          IvSvcOrderNo: os.SvcOrderNo,
          IsCommonHeader: {
            Company: "C820",
            AscCode: unidade.samsung_asccode,
            Country: "BR",
            Lang: "EN",
            Pac: generatePac()
          }
        };

        const detailResponse = await fetch(
          'https://latam.ipaas.samsung.com/latam/gcic/GetSOInfoAll/1.0/ImportSet',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${unidade.samsung_token}`
            },
            body: JSON.stringify(detailPayload)
          }
        );

        if (detailResponse.ok) {
          const detailData: SamsungDetailResponse = await detailResponse.json();

          if (detailData?.Return?.EsHeaderInfo?.AscCode) {
            detailsMap.set(os.SvcOrderNo, {
              numero_os_samsung: os.SvcOrderNo,
              cliente_numero: detailData.Return.EsBpInfo.CustAddrStreet2 || '',
              cliente_email: detailData.Return.EsBpInfo.CustEmail || '',
              cliente_bairro: detailData.Return.EsBpInfo.CustDistrict || '',
              cliente_complemento: '',
              cliente_cpf_cnpj: detailData.Return.EsBpInfo.CustId || ''
            });
          }
        }
      } catch (error) {
        console.error(`Erro ao buscar detalhes da OS ${os.SvcOrderNo}:`, error);
      }
    });

    console.log(`Criando ${osToCreate.length} OS no banco...`);

    for (const os of osToCreate) {
      const clienteNome = os.CustName?.trim() ||
                         `${os.CustFirstName || ''} ${os.CustLastName || ''}`.trim() ||
                         'Cliente Samsung';

      const telefone = os.CustMobilePhone || os.CustHomePhone || os.CustOfficePhone || '';
      const imei = os.IMEI || os.SerialNo || '';

      const tipoReparo = os.SvcTypeDesc === 'In Home' ? 'VISITA TECNICA' :
                        os.SvcTypeDesc === 'Carry In' ? 'BALCAO' :
                        os.SvcTypeDesc || 'VISITA TECNICA';

      const tipoAtendimento = os.SvcTypeDesc === 'In Home' ? 'IH' :
                             os.SvcTypeDesc === 'Carry In' ? 'CI' : 'IH';

      const warrantyType = (os.WarrantyType || 'O').toUpperCase();
      const tipoOS = warrantyType === 'I' ? 'LP' : 'OW';

      const details = detailsMap.get(os.SvcOrderNo);
      const tecnico = os.Engineer ? tecnicoMap.get(os.Engineer) : null;

      const osData: any = {
        unidade_id: unidadeId,
        numero_os_samsung: os.SvcOrderNo,
        cliente_nome: clienteNome,
        cliente_telefone: telefone || null,
        cliente_email: details?.cliente_email || null,
        cliente_cpf_cnpj: details?.cliente_cpf_cnpj || null,
        cliente_endereco: os.CustAddress || null,
        cliente_numero: details?.cliente_numero || null,
        cliente_complemento: details?.cliente_complemento || null,
        cliente_bairro: details?.cliente_bairro || null,
        cliente_cep: os.CustZipcode || null,
        cliente_cidade: os.CustCity || null,
        cliente_estado: os.CustState || null,
        cliente_vip: os.EliteService !== 'N',
        aparelho_marca: 'Samsung',
        aparelho_modelo: os.Model || null,
        aparelho_imei: imei || null,
        data_compra: os.PurchaseDate || null,
        defeito_relatado: os.Remark || os.CustComment || os.SvcComment || null,
        coluna_kanban: 'os_nova',
        tipo_os: tipoOS,
        tipo_orcamento: 'normal',
        tipo_atendimento: tipoAtendimento,
        tipo_reparo: tipoReparo,
        status_garantia: os.WarrantyType || os.WarrantyStatus || null,
        status_samsung_desc: os.StatusDesc || null,
        status_samsung_reason: os.StReasonDesc || null,
        data_abertura_samsung: os.ReqDate || null,
        data_requisicao_samsung: os.CustRequestDate || null,
        criado_por: usuario.id
      };

      if (tecnico) {
        osData.atribuido_a = tecnico.id;
      }

      const { data: osCreated, error: insertError } = await supabase
        .from('os')
        .insert(osData)
        .select('id')
        .single();

      if (insertError) {
        console.error(`Erro ao criar OS ${os.SvcOrderNo}:`, insertError);
        erros.push(`OS ${os.SvcOrderNo}: ${insertError.message}`);
      } else {
        criadas++;

        if (osCreated?.id) {
          await downloadAndSaveAttachments(
            osCreated.id,
            os.SvcOrderNo,
            unidade,
            supabase,
            generatePac,
            usuario.id
          );
        }
      }
    }

    await supabase
      .from('samsung_sync_logs')
      .update({
        status: erros.length > 0 ? 'parcial' : 'sucesso',
        finalizado_em: new Date().toISOString(),
        total_os_encontradas: osList.length,
        total_os_criadas: criadas,
        total_os_ignoradas: ignoradas,
        mensagem_erro: erros.length > 0 ? erros.join('\n') : null,
        detalhes: {
          periodo: {
            de: formatDate(dataInicio),
            ate: formatDate(hoje)
          },
          erros: erros
        }
      })
      .eq('id', syncLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        total_encontradas: osList.length,
        total_criadas: criadas,
        total_ignoradas: ignoradas,
        erros: erros.length > 0 ? erros : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    console.error('Stack trace:', error.stack);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});