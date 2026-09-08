export const formatarObservacoes = (obsCrua: string | undefined | null) => {
  if (!obsCrua || typeof obsCrua !== 'string') return { texto: '', fotos: [] };

  // Extrai tudo que está após "[Fotos:" até o final da string (ou fechamento de colchete)
  const fotosMatch = obsCrua.match(/\[Fotos:\s*(.*?)\]/i) || obsCrua.match(/\[Fotos:\s*(.*)/i);
  let fotos: string[] = [];
  if (fotosMatch && fotosMatch[1]) {
    // Separa as URLs por vírgula e limpa os espaços
    fotos = fotosMatch[1]
      .replace(/\]$/, '')
      .split(',')
      .map(url => url.trim())
      .filter(url => url.startsWith('http'));
  }

  // Remove metadados serializados como [Fotos:...], [Motivo:...], [Centro de Custo:...], [Categoria:...], [Critérios:...]
  let textoLimpo = obsCrua
    .replace(/\[Fotos:.*?\]/gi, '')
    .replace(/\[Motivo:.*?\]/gi, '')
    .replace(/\[Centro de Custo:.*?\]/gi, '')
    .replace(/\[Categoria:.*?\]/gi, '')
    .replace(/\[Critérios:.*?\]/gi, '')
    .trim();

  return { texto: textoLimpo, fotos };
};

export const getChecklistPhotos = (chk: any): string[] => {
  if (!chk) return [];
  if (Array.isArray(chk?.fotos_evidencia) && chk.fotos_evidencia.length > 0) {
    return chk.fotos_evidencia;
  }
  if (typeof chk?.fotos_evidencia === 'string') {
    try {
      const parsed = JSON.parse(chk.fotos_evidencia);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      if (chk.fotos_evidencia.startsWith('http')) {
        return chk.fotos_evidencia.split(',').map((s: string) => s.trim());
      }
    }
  }
  if (chk?.observacoes_tecnicas && typeof chk.observacoes_tecnicas === 'string') {
    const match = chk.observacoes_tecnicas.match(/\[Fotos:\s*([^\]]+)\]/);
    if (match && match[1]) {
      return match[1].split(',').map((s: string) => s.trim()).filter((s: string) => s.startsWith('http'));
    }
  }
  return [];
};

export const parseNewFields = (chk: any) => {
  const data = {
    motivo_inspecao: chk?.motivo_inspecao || '',
    extintor: chk?.extintor || '',
    bateria: chk?.bateria || '',
    tensao_equipamento: chk?.tensao_equipamento || '',
    centro_de_custo: chk?.centro_de_custo || '',
    categoria_equipamento: chk?.categoria_equipamento || '',
    modelo: chk?.modelo || '',
    fornecedor: chk?.fornecedor || '',
    criterios: (chk?.respostas || chk?.criterios || {}) as Record<string, string>,
    tipo_assinatura: chk?.tipo_assinatura || '',
    nome_validador: chk?.nome_validador || chk?.eletricista_responsavel || chk?.inspetor || '',
    assinatura_base64: chk?.assinatura_base64 || '',
    biometria_confianca: chk?.biometria_confianca || null
  };

  if (typeof data.criterios === 'string') {
    try {
      data.criterios = JSON.parse(data.criterios);
    } catch {
      data.criterios = {};
    }
  }

  // If not present in direct keys, try parsing from observacoes_tecnicas
  if (chk?.observacoes_tecnicas && typeof chk.observacoes_tecnicas === 'string') {
    const match = chk.observacoes_tecnicas.match(/\[Motivo: (.*?) \| Extintor: (.*?) \| Bateria: (.*?) \| Tensão: (.*?)\]/);
    if (match) {
      if (!data.motivo_inspecao) data.motivo_inspecao = match[1];
      if (!data.extintor) data.extintor = match[2];
      if (!data.bateria) data.bateria = match[3];
      if (!data.tensao_equipamento) data.tensao_equipamento = match[4];
    }

    const matchCC = chk.observacoes_tecnicas.match(/\[Centro de Custo: (.*?)\]/);
    if (matchCC && !data.centro_de_custo) {
      data.centro_de_custo = matchCC[1];
    }

    const matchCat = chk.observacoes_tecnicas.match(/\[Categoria: (.*?) \| Modelo: (.*?) \| Fornecedor: (.*?)\]/);
    if (matchCat) {
      if (!data.categoria_equipamento) data.categoria_equipamento = matchCat[1];
      if (!data.modelo) data.modelo = matchCat[2];
      if (!data.fornecedor) data.fornecedor = matchCat[3];
    }

    const matchCrit = chk.observacoes_tecnicas.match(/\[Critérios: (.*?)\]/);
    if (matchCrit && Object.keys(data.criterios || {}).length === 0) {
      try {
        data.criterios = JSON.parse(matchCrit[1]);
      } catch {
        // ignore
      }
    }

    const matchAssinatura = chk.observacoes_tecnicas.match(/\[Assinatura: (.*?) \| Validador: (.*?)(?: \| Confiança: (.*?))?\]/);
    if (matchAssinatura) {
      if (!data.tipo_assinatura) data.tipo_assinatura = matchAssinatura[1];
      if (!data.nome_validador) data.nome_validador = matchAssinatura[2];
      if (matchAssinatura[3] && !data.biometria_confianca) data.biometria_confianca = parseFloat(matchAssinatura[3]);
    }

    const matchBase64 = chk.observacoes_tecnicas.match(/\[AssinaturaBase64: (.*?)\]/);
    if (matchBase64 && !data.assinatura_base64) {
      data.assinatura_base64 = matchBase64[1];
    }
  }

  return data;
};
