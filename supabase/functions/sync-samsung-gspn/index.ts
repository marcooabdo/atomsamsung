import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SamsungOS {
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

interface SamsungListResponse {
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
    results: SamsungOS[];
  };
}

interface SamsungDetailResponse {
  Return: {
    EsBpInfo: {
      CustEmail: string;
      CustFirstName: string;
      CustLastName: string;
      CustAddrStreet1: string;
      CustAddrStreet2: string;
      CustDistrict: string;
      CustCity: string;
      CustState: string;
      CustZipcode: string;
      CustMobilePhone: string;
      CustHomePhone: string;
      CustOfficePhone: string;
    };
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
}

function formatDateForAPI(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function getCurrentPac(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, unidade_id, nome')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario) {
      throw new Error('User not found in database');
    }

    const { unidadeId, dataInicio, dataFim } = await req.json();

    if (!unidadeId || !dataInicio || !dataFim) {
      throw new Error('Missing required parameters');
    }

    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .select('samsung_asccode, samsung_token')
      .eq('id', unidadeId)
      .single();

    if (unidadeError || !unidade) {
      throw new Error('Unit not found or missing Samsung configuration');
    }

    if (!unidade.samsung_asccode || !unidade.samsung_token) {
      throw new Error('Samsung API configuration incomplete for this unit');
    }

    const syncLog = await supabase
      .from('samsung_sync_logs')
      .insert({
        unidade_id: unidadeId,
        status: 'em_progresso',
        iniciado_em: new Date().toISOString(),
        executado_por: usuario.id,
        total_os_encontradas: 0,
        total_os_criadas: 0,
        total_os_ignoradas: 0,
        detalhes: {
          periodo: {
            de: dataInicio,
            ate: dataFim
          }
        }
      })
      .select()
      .single();

    if (syncLog.error || !syncLog.data) {
      console.error('Error creating sync log:', syncLog.error);
      throw new Error(`Failed to create sync log: ${syncLog.error?.message || 'Unknown error'}`);
    }

    const logId = syncLog.data.id;

    try {
      const baseUrl = 'https://latam.ipaas.samsung.com/latam/gcic';
      const listUrl = `${baseUrl}/GetSOList/1.0/ImportSet`;

      const startDate = new Date(dataInicio);
      const endDate = new Date(dataFim);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const dateRanges: Array<{ from: string; to: string }> = [];

      if (daysDiff <= 7) {
        dateRanges.push({ from: dataInicio, to: dataFim });
      } else {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const rangeEnd = new Date(currentDate);
          rangeEnd.setDate(rangeEnd.getDate() + 6);

          if (rangeEnd > endDate) {
            rangeEnd.setTime(endDate.getTime());
          }

          dateRanges.push({
            from: currentDate.toISOString().split('T')[0],
            to: rangeEnd.toISOString().split('T')[0]
          });

          currentDate.setDate(currentDate.getDate() + 7);
        }
      }

      const allOsList: SamsungOS[] = [];

      for (const range of dateRanges) {
        const pac = getCurrentPac();
        const reqDateFrom = formatDateForAPI(range.from);
        const reqDateTo = formatDateForAPI(range.to);

        const listBody = {
          IsBasicCond: {
            AscCode: unidade.samsung_asccode,
            ReqDateFrom: reqDateFrom,
            ReqDateTo: reqDateTo
          },
          IvCompany: '',
          IsCommonHeader: {
            Company: 'C820',
            AscCode: unidade.samsung_asccode,
            Country: 'BR',
            Lang: 'EN',
            Pac: pac
          }
        };

        const listResponse = await fetch(listUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${unidade.samsung_token}`,
            'Cookie': 'sap-usercontext=sap-client=100',
          },
          body: JSON.stringify(listBody),
        });

        if (!listResponse.ok) {
          throw new Error(`Samsung API error: ${listResponse.status} ${listResponse.statusText}`);
        }

        const data: SamsungListResponse = await listResponse.json();

        if (data.Return.EvRetCode !== '0') {
          throw new Error(`Samsung API returned error: ${data.Return.EvRetMsg}`);
        }

        if (data.EtSvcInfo?.results) {
          allOsList.push(...data.EtSvcInfo.results);
        }
      }

      const osList = allOsList;
      const totalEncontradas = osList.length;

      await supabase
        .from('samsung_sync_logs')
        .update({ total_os_encontradas: totalEncontradas })
        .eq('id', logId);

      if (totalEncontradas === 0) {
        await supabase
          .from('samsung_sync_logs')
          .update({
            status: 'concluido',
            finalizado_em: new Date().toISOString(),
            total_os_encontradas: 0,
            total_os_criadas: 0,
            total_os_ignoradas: 0
          })
          .eq('id', logId);

        return new Response(
          JSON.stringify({
            success: true,
            totalEncontradas: 0,
            totalCriadas: 0,
            totalIgnoradas: 0
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const existingOSNumbers = await supabase
        .from('os')
        .select('numero_os_samsung')
        .eq('unidade_id', unidadeId)
        .in('numero_os_samsung', osList.map(os => os.SvcOrderNo));

      const existingNumbers = new Set(
        (existingOSNumbers.data || []).map(os => os.numero_os_samsung)
      );

      const osToCreate = osList.filter(os => !existingNumbers.has(os.SvcOrderNo));
      const totalIgnoradas = osList.length - osToCreate.length;

      await supabase
        .from('samsung_sync_logs')
        .update({ total_os_ignoradas: totalIgnoradas })
        .eq('id', logId);

      if (osToCreate.length === 0) {
        await supabase
          .from('samsung_sync_logs')
          .update({
            status: 'concluido',
            finalizado_em: new Date().toISOString()
          })
          .eq('id', logId);

        return new Response(
          JSON.stringify({
            success: true,
            totalEncontradas,
            totalCriadas: 0,
            totalIgnoradas
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const detailUrl = `${baseUrl}/GetSOInfoAll/1.0/ImportSet`;

      const detailPromises = osToCreate.map(async (os) => {
        try {
          const detailPac = getCurrentPac();
          const detailBody = {
            IvSvcOrderNo: os.SvcOrderNo,
            IsCommonHeader: {
              Company: 'C820',
              AscCode: unidade.samsung_asccode,
              Country: 'BR',
              Lang: 'EN',
              Pac: detailPac
            }
          };

          const detailResponse = await fetch(detailUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${unidade.samsung_token}`,
              'Cookie': 'sap-usercontext=sap-client=100',
            },
            body: JSON.stringify(detailBody),
          });

          if (!detailResponse.ok) {
            return null;
          }

          const detailData: SamsungDetailResponse = await detailResponse.json();

          if (detailData.Return.EvRetCode !== '0') {
            return null;
          }

          return {
            svcOrderNo: os.SvcOrderNo,
            cliente_email: detailData.Return.EsBpInfo?.CustEmail || null,
            cliente_endereco: detailData.Return.EsBpInfo?.CustAddrStreet1 || null,
            cliente_numero: detailData.Return.EsBpInfo?.CustAddrStreet2 || null,
            cliente_bairro: detailData.Return.EsBpInfo?.CustDistrict || null,
            cliente_cidade: detailData.Return.EsBpInfo?.CustCity || null,
            cliente_estado: detailData.Return.EsBpInfo?.CustState || null,
            cliente_cep: detailData.Return.EsBpInfo?.CustZipcode || null
          };
        } catch (error) {
          console.error(`Error fetching details for ${os.SvcOrderNo}:`, error);
          return null;
        }
      });

      const detailsResults = await Promise.all(detailPromises);
      const detailsMap = new Map(
        detailsResults
          .filter(d => d !== null)
          .map(d => [d!.svcOrderNo, d])
      );

      const { data: tecnicos } = await supabase
        .from('usuarios')
        .select('id, numero_tecnico')
        .eq('unidade_id', unidadeId)
        .not('numero_tecnico', 'is', null);

      const tecnicoMap = new Map(
        (tecnicos || []).map(t => [t.numero_tecnico, t])
      );

      const errors: string[] = [];
      let criadas = 0;

      for (const os of osToCreate) {
        try {
          let clienteNome = '';
          if (os.CustFirstName || os.CustLastName) {
            clienteNome = `${os.CustFirstName || ''} ${os.CustLastName || ''}`.trim();
          } else if (os.CustName) {
            clienteNome = os.CustName;
          }

          if (!clienteNome) {
            clienteNome = 'Cliente Samsung';
          }

          let telefone = os.CustMobilePhone || os.CustHomePhone || os.CustOfficePhone || null;
          if (telefone) {
            telefone = telefone.replace(/\D/g, '');
            if (telefone.length < 10) telefone = null;
          }

          let imei = os.IMEI || os.SerialNo || null;
          if (imei) {
            imei = imei.replace(/\D/g, '');
            if (imei.length < 15) imei = null;
          }

          const tipoReparo = os.WarrantyType === 'I' ? 'garantia' :
                            os.WarrantyType === 'O' ? 'fora_garantia' : 'fora_garantia';

          const tipoAtendimento = os.SvcTypeDesc === 'In Home' ? 'IH' :
                                 os.SvcTypeDesc === 'Carry In' ? 'CI' : 'IH';

          const warrantyType = (os.WarrantyType || 'O').toUpperCase();
          const tipoOS = warrantyType === 'I' ? 'LP' : 'OW';
          const tipoOrcamento = 'normal';

          const details = detailsMap.get(os.SvcOrderNo);
          const tecnico = os.Engineer ? tecnicoMap.get(os.Engineer) : null;

          const osData: any = {
            unidade_id: unidadeId,
            numero_os_samsung: os.SvcOrderNo,
            cliente_nome: clienteNome,
            cliente_telefone: telefone || null,
            cliente_email: details?.cliente_email || null,
            cliente_endereco: details?.cliente_endereco || os.CustAddress || null,
            cliente_numero: details?.cliente_numero || null,
            cliente_bairro: details?.cliente_bairro || null,
            cliente_cep: details?.cliente_cep || os.CustZipcode || null,
            cliente_cidade: details?.cliente_cidade || os.CustCity || null,
            cliente_estado: details?.cliente_estado || os.CustState || null,
            cliente_vip: os.EliteService !== 'N',
            aparelho_marca: 'Samsung',
            aparelho_modelo: os.Model || null,
            aparelho_imei: imei || null,
            data_compra: os.PurchaseDate || null,
            defeito_relatado: os.Remark || os.CustComment || os.SvcComment || null,
            coluna_kanban: 'os_nova',
            tipo_os: tipoOS,
            tipo_orcamento: tipoOrcamento,
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

          const { error: insertError } = await supabase
            .from('os')
            .insert(osData);

          if (insertError) {
            console.error(`Erro ao criar OS ${os.SvcOrderNo}:`, insertError);
            errors.push(`OS ${os.SvcOrderNo}: ${insertError.message}`);
          } else {
            criadas++;
          }
        } catch (error: any) {
          console.error(`Error processing OS ${os.SvcOrderNo}:`, error);
          errors.push(`OS ${os.SvcOrderNo}: ${error.message}`);
        }
      }

      const finalStatus = errors.length > 0 ? 'concluido_com_erros' : 'concluido';
      const mensagemErro = errors.length > 0 ? errors.join('\n') : null;

      await supabase
        .from('samsung_sync_logs')
        .update({
          status: finalStatus,
          finalizado_em: new Date().toISOString(),
          total_os_criadas: criadas,
          mensagem_erro: mensagemErro,
          detalhes: {
            periodo: {
              de: dataInicio,
              ate: dataFim
            },
            erros: errors
          }
        })
        .eq('id', logId);

      return new Response(
        JSON.stringify({
          success: true,
          totalEncontradas,
          totalCriadas: criadas,
          totalIgnoradas,
          errors: errors.length > 0 ? errors : undefined
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (error: any) {
      await supabase
        .from('samsung_sync_logs')
        .update({
          status: 'erro',
          finalizado_em: new Date().toISOString(),
          mensagem_erro: error.message
        })
        .eq('id', logId);

      throw error;
    }

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
