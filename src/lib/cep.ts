export interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string; // cidade
  uf: string; // estado
  erro?: boolean;
}

export async function buscarCEP(cep: string): Promise<EnderecoViaCEP | null> {
  // Remove caracteres não numéricos
  const cepLimpo = cep.replace(/\D/g, '');

  // Valida formato do CEP (8 dígitos)
  if (cepLimpo.length !== 8) {
    throw new Error('CEP deve conter 8 dígitos');
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

    if (!response.ok) {
      throw new Error('Erro ao consultar CEP');
    }

    const data: EnderecoViaCEP = await response.json();

    // API retorna campo "erro" se CEP não encontrado
    if (data.erro) {
      throw new Error('CEP não encontrado');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

export function formatarCEP(cep: string): string {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return cep;
  return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
}
