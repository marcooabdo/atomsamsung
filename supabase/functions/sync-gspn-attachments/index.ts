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

interface AttachmentListResponse {
  EtFileInfo: {
    results: AttachmentInfo[];
  };
  Return?: {
    EsCommonResult?: {
      Code: string;
      Codedesc: string;
    };
  };
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

    console.log(`Buscando anexos da OS Samsung ${os.numero_os_samsung}...`);

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

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Erro ao buscar lista de anexos:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar anexos do GSPN', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listData: AttachmentListResponse = await listResponse.json();
    const attachments = listData.EtFileInfo?.results || [];

    console.log(`Total de anexos encontrados no GSPN: ${attachments.length}`);

    const newAttachments = attachments.filter(a => !existingKeys.has(a.Fileobjkey));
    console.log(`Novos anexos a sincronizar: ${newAttachments.length}`);

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
        console.log(`Baixando anexo: ${attachment.Filename} (${attachment.Fileobjkey})`);

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
          erros.push(`Erro ao baixar ${attachment.Filename}: HTTP ${fileResponse.status}`);
          continue;
        }

        const fileData: AttachmentFileResponse = await fileResponse.json();

        if (!fileData.Return?.EvFileStream) {
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
          console.error(`Erro ao fazer upload de ${attachment.Filename}:`, uploadError);
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
          console.error(`Erro ao registrar anexo ${attachment.Filename}:`, insertError);
          erros.push(`Erro ao registrar ${attachment.Filename}: ${insertError.message}`);
          continue;
        }

        sincronizados++;
        console.log(`Anexo sincronizado: ${attachment.Filename}`);

      } catch (error) {
        console.error(`Erro ao processar anexo ${attachment.Filename}:`, error);
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
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
