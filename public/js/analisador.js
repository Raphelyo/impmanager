const Analisador = {
  projetoId: null,

  render(projetoId) {
    this.projetoId = projetoId;
    const c = document.getElementById('projContent');
    c.innerHTML = `
      <div class="grid grid-cols-2 mb-4">
        <div class="card p-4">
          <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-file-earmark-binary text-primary"></i> Arquivo FDB</h3>
          <div class="form-group">
            <div class="flex gap-2">
              <input class="input" id="fdbPathInput" placeholder="C:\\Backups\\CLIENTE.FDB" value="${Projeto.projeto?.fdb_path || ''}">
              <button class="btn btn-secondary btn-sm" onclick="Analisador._atualizarCaminho()"><i class="bi bi-check"></i></button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Upload de arquivo</label>
            <input class="input" type="file" id="fdbFileInput" accept=".fdb,.gdb,.fbk">
          </div>
          <button class="btn btn-primary w-full mt-1" onclick="Analisador._analisar()">
            <i class="bi bi-search"></i> Analisar Agora
          </button>
        </div>
        <div class="card p-4">
          <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-clock-history text-primary"></i> Últimas Análises</h3>
          <div id="listaAnalises">
            <div class="empty-state py-4"><i class="bi bi-arrow-repeat spin"></i></div>
          </div>
        </div>
      </div>
      <div id="resultadoAnalise"></div>
    `;

    this._carregarAnalises();
    document.getElementById('fdbFileInput')?.addEventListener('change', (e) => {
      if (e.target.files[0]) this._upload(e.target.files[0]);
    });
  },

  async _atualizarCaminho() {
    const path = document.getElementById('fdbPathInput')?.value.trim();
    if (!path) return;
    try {
      await App.api(`/projetos/${this.projetoId}`, { method: 'PUT', body: { fdb_path: path } });
      document.getElementById('projFdbPath').textContent = path;
      App.toast('Caminho atualizado');
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  async _upload(file) {
    const fd = new FormData();
    fd.append('fdb', file);
    try {
      const r = await fetch(`/api/upload/${this.projetoId}`, { method: 'POST', body: fd });
      const data = await r.json();
      document.getElementById('fdbPathInput').value = data.fdb_path;
      document.getElementById('projFdbPath').textContent = data.fdb_path;
      App.toast('FDB enviado!');
    } catch (e) { App.toast('Erro no upload', 'danger'); }
  },

  async _analisar() {
    const path = document.getElementById('fdbPathInput')?.value.trim() || Projeto.projeto?.fdb_path;
    if (!path) { App.toast('Informe o caminho do FDB', 'warning'); return; }

    const resultDiv = document.getElementById('resultadoAnalise');
    resultDiv.innerHTML = `<div class="card p-6 text-center"><i class="bi bi-arrow-repeat text-3xl text-primary spin mb-3" style="display:block"></i><p class="font-medium">Analisando banco de dados...</p><p class="text-xs text-muted mt-1">Conectando ao Firebird e executando queries</p></div>`;

    try {
      const r = await fetch(`/api/analisar/${this.projetoId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fdb_path: path }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.erro || 'Erro'); }
      const data = await r.json();
      this._mostrarResultado(data.relatorio);
      this._carregarAnalises();
      App.toast('Análise concluída!');
    } catch (e) {
      resultDiv.innerHTML = `<div class="card p-4"><div class="flex items-center gap-2 text-danger"><i class="bi bi-exclamation-triangle-fill"></i><strong>Erro:</strong> ${e.message}</div></div>`;
    }
  },

  async _carregarAnalises() {
    const container = document.getElementById('listaAnalises');
    if (!container) return;
    try {
      const analises = await App.api(`/analises/${this.projetoId}`);
      if (analises.length === 0) { container.innerHTML = `<p class="text-xs text-muted text-center py-4">Nenhuma análise ainda</p>`; return; }
      container.innerHTML = analises.map(a => `
        <div class="flex items-center justify-between p-2 rounded" style="cursor:pointer" onclick="Analisador._verAnalise(${a.id})">
          <span class="text-xs"><i class="bi bi-file-text me-1 text-primary"></i>${App.formatDate(a.data_analise)}</span>
          <span class="badge badge-indigo">${a.total_tabelas || '?'} tb</span>
        </div>
      `).join('');
    } catch (e) { if (container) container.innerHTML = `<p class="text-xs text-danger text-center">Erro ao carregar</p>`; }
  },

  _mostrarResultado(rel) {
    const resultDiv = document.getElementById('resultadoAnalise');
    const score = rel.score_geral || 0;
    const scoreClass = score >= 80 ? 'badge-emerald' : score >= 50 ? 'badge-amber' : 'badge-red';
    const alertas = (rel.alertas || []).map(a => {
      const cls = a.tipo === 'critico' ? 'text-danger' : a.tipo === 'alerta' ? 'text-warning' : 'text-muted';
      const icn = a.tipo === 'critico' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';
      return `<div class="flex items-center gap-1 text-xs ${cls} mb-1"><i class="bi ${icn}"></i>${a.mensagem}</div>`;
    }).join('');

    resultDiv.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="text-sm font-semibold"><i class="bi bi-file-earmark-check text-primary me-1"></i> Resultado da Análise</span>
          <span class="badge ${scoreClass}">Score: ${score}%</span>
        </div>
        <div class="card-body">
          <div class="grid grid-cols-4 mb-4">
            <div class="text-center p-2" style="background:var(--surface-hover);border-radius:var(--radius-sm)">
              <div class="text-xs text-muted">Tamanho</div>
              <div class="font-bold">${rel.info_arquivo?.tamanho_mb || '?'} MB</div>
            </div>
            <div class="text-center p-2" style="background:var(--surface-hover);border-radius:var(--radius-sm)">
              <div class="text-xs text-muted">Tabelas</div>
              <div class="font-bold">${rel.total_tabelas || '?'}</div>
            </div>
            <div class="text-center p-2" style="background:var(--surface-hover);border-radius:var(--radius-sm)">
              <div class="text-xs text-muted">Queries OK</div>
              <div class="font-bold text-success">${rel.resultados?.length || 0}</div>
            </div>
            <div class="text-center p-2" style="background:var(--surface-hover);border-radius:var(--radius-sm)">
              <div class="text-xs text-muted">Alertas</div>
              <div class="font-bold ${(rel.alertas || []).length > 0 ? 'text-warning' : 'text-success'}">${rel.alertas?.length || 0}</div>
            </div>
          </div>

          <div class="section-title"><i class="bi bi-bar-chart"></i> Categorias</div>
          <div class="mb-3">${Object.entries(rel.resumo_por_categoria || {}).map(([cat, info]) => {
            const ok = info.status === 'ok' ? 'text-success' : info.status === 'parcial' ? 'text-warning' : 'text-danger';
            const pc = info.total_queries > 0 ? Math.round((info.sucesso / info.total_queries) * 100) : 0;
            return `<div class="flex items-center justify-between mb-1"><span class="text-xs"><i class="bi ${ok === 'text-success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'} me-1 ${ok}"></i>${cat}</span><span class="text-xs text-muted">${info.sucesso}/${info.total_queries} <span class="badge ${pc === 100 ? 'badge-emerald' : pc > 50 ? 'badge-amber' : 'badge-red'}">${pc}%</span></span></div>`;
          }).join('')}</div>

          <div class="section-title"><i class="bi bi-exclamation-triangle"></i> Alertas (${rel.alertas?.length || 0})</div>
          <div class="mb-3">${alertas || '<span class="text-xs text-muted">Nenhum alerta</span>'}</div>

          ${this._renderDetalhes(rel.resultados)}

          <div class="text-xs text-muted mt-2"><i class="bi bi-clock me-1"></i>${App.formatDate(rel.data_analise)}</div>
        </div>
      </div>`;
  },

  _renderDetalhes(resultados) {
    if (!resultados?.length) return '';
    const porCat = {};
    for (const r of resultados) {
      const cat = r.categoria || 'Outros';
      if (!porCat[cat]) porCat[cat] = [];
      porCat[cat].push(r);
    }
    return Object.entries(porCat).slice(0, 5).map(([cat, items]) => `
      <div class="section-title mt-3"><i class="bi bi-table"></i> ${cat}</div>
      <div class="table-wrap mb-3">
        <table>
          <thead><tr><th>Query</th><th>Tabela</th><th>Resultado</th></tr></thead>
          <tbody>${items.slice(0, 10).map(item => `
            <tr>
              <td class="text-xs">${item.titulo || item.id}</td>
              <td><code class="text-xs">${item.tabela || ''}</code></td>
              <td class="text-xs">${this._fmt(item)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `).join('');
  },

  _fmt(item) {
    if (!item.dados?.length) return '<span class="text-muted">vazio</span>';
    if (item.dados.length === 1) {
      const vals = Object.values(item.dados[0]);
      if (vals.length === 1) return `<strong>${vals[0]}</strong>`;
      return `<strong>${vals[0]}</strong> <span class="text-muted">(+${vals.length - 1})</span>`;
    }
    return `<strong>${item.dados.length}</strong> registros`;
  },

  async _verAnalise(id) {
    try {
      const a = await App.api(`/analise/${id}`);
      if (a.resultado_json && typeof a.resultado_json === 'object') this._mostrarResultado(a.resultado_json);
    } catch (e) { App.toast('Erro ao carregar análise', 'danger'); }
  }
};
