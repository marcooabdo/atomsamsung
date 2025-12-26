import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AttachmentInfo {
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

interface AttachmentFileResponse {
  Return: {
    EsCommonResult: {
      Code: string;
      Codedesc: string;
    };
    EvFileStream: string;
  };
}

function generatePac(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function parseGspnDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || dateStr.length !== 8) return null;
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));

  let hours = 0, minutes = 0, seconds = 0;
  if (timeStr && timeStr.length >= 6) {
    hours = parseInt(timeStr.substring(0, 2));
    minutes = parseInt(timeStr.substring(2, 4));
    seconds = parseInt(timeStr.substring(4, 6));
  }

  return new Date(year, month, day, hours, minutes, seconds);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function getFileType(filename: string, filetype: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')) return 'foto';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) return 'video';
  return 'documento';
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

function extractAttachments(data: any): AttachmentInfo[] {
  if (!data) return [];

  if (data.EtFileInfo?.results && Array.isArray(data.EtFileInfo.results)) {
    return data.EtFileInfo.results;
  }

  if (data.EtFileInfo && Array.isArray(data.EtFileInfo)) {
    return data.EtFileInfo;
  }

  if (data.ET_FILE_INFO?.results && Array.isArray(data.ET_FILE_INFO.results)) {
    return data.ET_FILE_INFO.results;
  }

  if (data.ET_FILE_INFO && Array.isArray(data.ET_FILE_INFO)) {
    return data.ET_FILE_INFO;
  }

  if (data.results && Array.isArray(data.results)) {
    return data.results;
  }

  if (data.d?.results && Array.isArray(data.d.results)) {
    return data.d.results;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function normalizeAttachment(att: any): AttachmentInfo | null {
  if (!att) return null;

  return {
    Filename: att.Filename || att.FILENAME || att.filename || att.FileName || '',
    Filetype: att.Filetype || att.FILETYPE || att.filetype || att.FileType || '',
    Fileobjkey: att.Fileobjkey || att.FILEOBJKEY || att.fileobjkey || att.FileObjKey || att.DocKey || '',
    Description: att.Description || att.DESCRIPTION || att.description || '',
    FileSize: String(att.FileSize || att.FILESIZE || att.filesize || att.Filesize || '0'),
    CreatedDt: att.CreatedDt || att.CREATEDDT || att.createddt || att.CreateDate || '',
    CreatedTm: att.CreatedTm || att.CREATEDTM || att.createdtm || att.CreateTime || '',
    CreatedBy: att.CreatedBy || att.CREATEDBY || att.createdby || '',
    Docclass: att.Docclass || att.DOCCLASS || att.docclass || '',
  };
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
        JSON.stringify({ error: 'Autorizacao necessaria' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario nao autenticado' }),
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
        JSON.stringify({ error: 'Usuario nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { os_id } = body;

    if (!os_id) {
      return new Response(
        JSON.stringify({ error: 'os_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: os, error: osError } = await supabase
      .from('os')
      .select('id, numero_os_samsung, unidade_id')
      .eq('id', os_id)
      .single();

    if (osError || !os) {
      return new Response(
        JSON.stringify({ error: 'OS nao encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!os.numero_os_samsung) {
      return new Response(
        JSON.stringify({ error: 'Esta OS nao possui numero Samsung vinculado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: unidade } = await supabase
      .from('unidades')
      .select('samsung_asccode, samsung_token')
      .eq('id', os.unidade_id)
      .single();

    if (!unidade || !unidade.samsung_asccode || !unidade.samsung_token) {
      return new Response(
        JSON.stringify({ error: 'Configuracao Samsung nao encontrada na unidade' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingAnexos } = await supabase
      .from('os_anexos')
      .select('gspn_fileobjkey')
      .eq('os_id', os_id)
      .not('gspn_fileobjkey', 'is', null);

    const existingKeys = new Set((existingAnexos || []).map(a => a.gspn_fileobjkey));

    console.log(`[SYNC] Iniciando sync de anexos para OS Samsung ${os.numero_os_samsung}`);
    console.log(`[SYNC] ASC Code: ${unidade.samsung_asccode}`);

    const listPayload = {
      IvSvcOrderNo: os.numero_os_samsung,
      IsCommonHeader: {
        Company: "C820",
        AscCode: unidade.samsung_asccode,
        Country: "BR",
        Lang: "EN",
        Pac: generatePac()
      }
    };

    console.log(`[SYNC] Payload da requisicao:`, JSON.stringify(listPayload));

    const listResponse = await fetch(
      'https://latam.ipaas.samsung.com/latam/gcic/GetSOAttachList/1.0/ImportSet',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${unidade.samsung_token}`
        },
        body: JSON.stringify(listPayload)
      }
    );

    console.log(`[SYNC] Status da resposta: ${listResponse.status}`);

    const responseText = await listResponse.text();
    console.log(`[SYNC] Resposta completa (primeiros 2000 chars): ${responseText.substring(0, 2000)}`);

    if (!listResponse.ok) {
      console.error('[SYNC] Erro na requisicao:', responseText);
      return new Response(
        JSON.stringify({
          error: 'Erro ao buscar anexos do GSPN',
          status: listResponse.status,
          details: responseText.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let listData: any;
    try {
      listData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[SYNC] Erro ao fazer parse da resposta:', parseError);
      return new Response(
        JSON.stringify({
          error: 'Resposta invalida do GSPN',
          details: responseText.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SYNC] Estrutura da resposta:`, JSON.stringify(Object.keys(listData)));

    if (listData.Return?.EsCommonResult) {
      console.log(`[SYNC] EsCommonResult:`, JSON.stringify(listData.Return.EsCommonResult));
    }

    const rawAttachments = extractAttachments(listData);
    console.log(`[SYNC] Anexos brutos extraidos: ${rawAttachments.length}`);

    if (rawAttachments.length > 0) {
      console.log(`[SYNC] Primeiro anexo bruto:`, JSON.stringify(rawAttachments[0]));
    }

    const attachments = rawAttachments
      .map(normalizeAttachment)
      .filter((a): a is AttachmentInfo => a !== null && !!a.Fileobjkey);

    console.log(`[SYNC] Anexos normalizados: ${attachments.length}`);

    if (attachments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum anexo encontrado no GSPN para esta OS',
          total_gspn: 0,
          total_sincronizados: 0,
          total_ja_existentes: existingKeys.size,
          debug: {
            response_keys: Object.keys(listData),
            raw_attachments_count: rawAttachments.length,
            response_preview: JSON.stringify(listData).substring(0, 500)
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newAttachments = attachments.filter(a => !existingKeys.has(a.Fileobjkey));
    console.log(`[SYNC] Novos anexos a sincronizar: ${newAttachments.length}`);

    if (newAttachments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todos os anexos ja estao sincronizados',
          total_gspn: attachments.length,
          total_sincronizados: 0,
          total_ja_existentes: attachments.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sincronizados = 0;
    const erros: string[] = [];

    for (const attachment of newAttachments) {
      try {
        console.log(`[SYNC] Baixando anexo: ${attachment.Filename} (${attachment.Fileobjkey})`);

        const filePayload = {
          IvSvcOrderNo: os.numero_os_samsung,
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
              'Authorization': `Bearer ${unidade.samsung_token}`
            },
            body: JSON.stringify(filePayload)
          }
        );

        if (!fileResponse.ok) {
          const errText = await fileResponse.text();
          console.error(`[SYNC] Erro ao baixar ${attachment.Filename}:`, errText);
          erros.push(`Erro ao baixar ${attachment.Filename}: HTTP ${fileResponse.status}`);
          continue;
        }

        const fileData: AttachmentFileResponse = await fileResponse.json();

        if (!fileData.Return?.EvFileStream) {
          console.error(`[SYNC] Arquivo vazio: ${attachment.Filename}`, JSON.stringify(fileData));
          erros.push(`Arquivo vazio: ${attachment.Filename}`);
          continue;
        }

        const fileBytes = base64ToUint8Array(fileData.Return.EvFileStream);
        const fileName = `${os_id}/gspn_${attachment.Fileobjkey}_${attachment.Filename}`;
        const mimeType = getMimeType(attachment.Filename);

        const { error: uploadError } = await supabase.storage
          .from('os-anexos')
          .upload(fileName, fileBytes, {
            contentType: mimeType,
            upsert: false
          });

        if (uploadError) {
          console.error(`[SYNC] Erro ao fazer upload de ${attachment.Filename}:`, uploadError);
          erros.push(`Erro ao salvar ${attachment.Filename}: ${uploadError.message}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(fileName);

        const gspnCreatedAt = parseGspnDate(attachment.CreatedDt, attachment.CreatedTm);

        const { error: insertError } = await supabase
          .from('os_anexos')
          .insert({
            os_id: os_id,
            nome_arquivo: attachment.Filename,
            url: publicUrl,
            tamanho_bytes: parseInt(attachment.FileSize) || fileBytes.length,
            tipo: getFileType(attachment.Filename, attachment.Filetype),
            origem: 'gspn_sync',
            gspn_fileobjkey: attachment.Fileobjkey,
            gspn_description: attachment.Description || null,
            gspn_created_at: gspnCreatedAt?.toISOString() || null,
            gspn_created_by: attachment.CreatedBy || null,
            usuario_id: usuario.id
          });

        if (insertError) {
          console.error(`[SYNC] Erro ao registrar anexo ${attachment.Filename}:`, insertError);
          erros.push(`Erro ao registrar ${attachment.Filename}: ${insertError.message}`);
          continue;
        }

        sincronizados++;
        console.log(`[SYNC] Anexo sincronizado: ${attachment.Filename}`);

      } catch (error) {
        console.error(`[SYNC] Erro ao processar anexo ${attachment.Filename}:`, error);
        erros.push(`Erro ao processar ${attachment.Filename}: ${error.message}`);
      }
    }

    if (sincronizados > 0) {
      await supabase.from('os_comentarios').insert({
        os_id: os_id,
        usuario_id: usuario.id,
        comentario: `Sincronizados ${sincronizados} anexo(s) do GSPN`,
        is_system: true
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_gspn: attachments.length,
        total_sincronizados: sincronizados,
        total_ja_existentes: existingKeys.size,
        erros: erros.length > 0 ? erros : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC] Erro geral:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
