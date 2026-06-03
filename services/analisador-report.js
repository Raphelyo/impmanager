function gerarRelatorio(resultados, erros, infoArquivo, totalTabelas) {
  const porCategoria = {};
  const alertas = [];

  for (const r of resultados) {
    if (!porCategoria[r.categoria]) {
      porCategoria[r.categoria] = { itens: [], total_queries: 0, sucesso: 0, erro: 0 };
    }
    porCategoria[r.categoria].itens.push(r);
    porCategoria[r.categoria].total_queries++;
    porCategoria[r.categoria].sucesso++;
  }

  for (const e of erros) {
    if (!porCategoria[e.categoria]) {
      porCategoria[e.categoria] = { itens: [], total_queries: 0, sucesso: 0, erro: 0 };
    }
    porCategoria[e.categoria].total_queries++;
    porCategoria[e.categoria].erro++;
  }

  // Gerar alertas automáticos
  for (const r of resultados) {
    if (r.id === 'C1' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'critico', mensagem: 'Nenhum cliente/fornecedor cadastrado — base vazia' });
      else if (total < 10) alertas.push({ tipo: 'alerta', mensagem: `Apenas ${total} clientes/fornecedores — verificar se cadastro foi migrado` });
    }
    if (r.id === 'C3' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'critico', mensagem: 'Nenhum produto ativo cadastrado' });
    }
    if (r.id === 'C5' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'critico', mensagem: 'Nenhuma balança cadastrada — expedição manual inviável' });
    }
    if (r.id === 'C7' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'critico', mensagem: 'Nenhuma câmara frigorífica ativa' });
    }
    if (r.id === 'C9' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'alerta', mensagem: 'Nenhum mercado destino configurado — apenas operação interna?' });
      if (total === 1) alertas.push({ tipo: 'info', mensagem: 'Apenas 1 mercado configurado — cliente não opera exportação?' });
    }
    if (r.id === 'C10' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'alerta', mensagem: 'Nenhuma habilitação de mercado — sem requisito sanitário configurado' });
    }
    if (r.id === 'P4' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'alerta', mensagem: 'Nenhum critério de acabamento (gordura) configurado' });
    }
    if (r.id === 'P5' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'alerta', mensagem: 'Nenhum critério de conformação (músculo) configurado' });
    }
    if (r.id === 'P6' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'info', mensagem: 'Nenhum checklist de qualidade configurado' });
    }
    if (r.id === 'R1' && Array.isArray(r.dados)) {
      if (r.dados.length === 0) alertas.push({ tipo: 'alerta', mensagem: 'Mix de desossa vazio — cliente não usa produção própria?' });
    }
    if (r.id === 'R5' && Array.isArray(r.dados)) {
      if (r.dados.length === 0) alertas.push({ tipo: 'alerta', mensagem: 'Nenhuma tabela de preço cadastrada' });
    }
    if (r.id === 'E1' && r.dados[0]) {
      const total = parseInt(r.dados[0].TOTAL || r.dados[0].total || 0);
      if (total === 0) alertas.push({ tipo: 'info', mensagem: 'Nenhum abate programado atualmente' });
    }
  }

  // Contar total de queries por categoria
  const resumoPorCategoria = {};
  for (const [cat, data] of Object.entries(porCategoria)) {
    const sucesso = data.sucesso || 0;
    const total = data.total_queries || 0;
    resumoPorCategoria[cat] = {
      total_queries: total,
      sucesso,
      erro: total - sucesso,
      status: sucesso === total ? 'ok' : sucesso > 0 ? 'parcial' : 'erro'
    };
  }

  // Calcular score geral (0-100)
  const totalQueries = resultados.length + erros.length;
  const totalSucesso = resultados.length;
  const scoreGeral = totalQueries > 0 ? Math.round((totalSucesso / totalQueries) * 100) : 0;

  // Gerar resumo texto
  const resumoTexto = gerarResumoTexto(resultados, alertas, infoArquivo);

  return {
    data_analise: new Date().toISOString(),
    info_arquivo: infoArquivo,
    total_tabelas: totalTabelas,
    score_geral: scoreGeral,
    resumo_por_categoria: resumoPorCategoria,
    resultados,
    erros,
    alertas,
    resumo_texto: resumoTexto
  };
}

function gerarResumoTexto(resultados, alertas, infoArquivo) {
  let totalClientes = '?', totalProdutos = '?', totalBalanças = '?';
  let totalCâmaras = '?', totalMercados = '?';

  for (const r of resultados) {
    if (r.id === 'C1' && r.dados[0]) totalClientes = r.dados[0].TOTAL || r.dados[0].total || '?';
    if (r.id === 'C3' && r.dados[0]) totalProdutos = r.dados[0].TOTAL || r.dados[0].total || '?';
    if (r.id === 'C5' && r.dados[0]) totalBalanças = r.dados[0].TOTAL || r.dados[0].total || '?';
    if (r.id === 'C7' && r.dados[0]) totalCâmaras = r.dados[0].TOTAL || r.dados[0].total || '?';
    if (r.id === 'C9' && r.dados[0]) totalMercados = r.dados[0].TOTAL || r.dados[0].total || '?';
  }

  const criticos = alertas.filter(a => a.tipo === 'critico').length;
  const alerts = alertas.filter(a => a.tipo === 'alerta').length;
  const infos = alertas.filter(a => a.tipo === 'info').length;

  return `${infoArquivo.tamanho_mb}MB | ${totalClientes} clientes, ${totalProdutos} produtos | ${totalBalanças} balanças, ${totalCâmaras} câmaras | ${criticos} críticos, ${alerts} alertas, ${infos} info`;
}

module.exports = { gerarRelatorio };
