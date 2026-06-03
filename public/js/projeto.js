const Projeto = {
  projeto: null,
  _filtroStatus: '',
  _filtroMacro: '',

  async render(id) {
    const app = document.getElementById('app');
    try {
      const resp = await fetch(`/api/projetos/${id}`);
      if (!resp.ok) throw new Error('Projeto não encontrado');
      this.projeto = await resp.json();

      app.innerHTML = this.html(this.projeto);
      this._atualizarKPI();
      this._renderTab('analise');
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p><button class="btn btn-primary mt-2" onclick="App.navigate('/')">Voltar</button></div>`;
    }
  },

  html(p) {
    return `
      <div class="fade-in">
        <div class="flex items-center gap-2 mb-4">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('/')"><i class="bi bi-arrow-left"></i></button>
          <div>
            <h1 class="text-lg font-bold">${App.esc(p.empresa)}</h1>
            <span class="text-xs text-muted">${App.esc(p.nome)}</span>
          </div>
          <div class="ml-auto"></div>
        </div>

        <div class="grid grid-cols-4 mb-4">
          <div class="stat-card">
            <div class="text-xs text-muted mb-1">Progresso</div>
            <div class="stat-value" id="projProgresso">0%</div>
            <div class="progress mt-1" style="height:5px"><div class="progress-bar" id="projProgressBar" style="width:0%"></div></div>
          </div>
          <div class="stat-card">
            <div class="text-xs text-muted mb-1">Tarefas</div>
            <div class="stat-value" id="projTarefas">0/0</div>
          </div>
          <div class="stat-card">
            <div class="text-xs text-muted mb-1">Análises FDB</div>
            <div class="stat-value" id="projAnalises">0</div>
          </div>
          <div class="stat-card">
            <div class="text-xs text-muted mb-1">FDB Path</div>
            <div class="text-sm font-medium truncate" id="projFdbPath">Não definido</div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab active" data-tab="analise" onclick="Projeto._switchTab('analise')"><i class="bi bi-search me-1"></i>Análise FDB</button>
          <button class="tab" data-tab="tarefas" onclick="Projeto._switchTab('tarefas')"><i class="bi bi-check2-square me-1"></i>Tarefas</button>
          <button class="tab" data-tab="treinamentos" onclick="Projeto._switchTab('treinamentos')"><i class="bi bi-book me-1"></i>Treinamentos</button>
          <button class="tab" data-tab="config" onclick="Projeto._switchTab('config')"><i class="bi bi-gear me-1"></i>Configurações</button>
        </div>

        <div id="projContent"></div>
      </div>`;
  },

  _switchTab(tab) {
    document.querySelectorAll('.tabs .tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.tabs .tab[data-tab="${tab}"]`)?.classList.add('active');
    if (tab === 'treinamentos') {
      App.navigate(`/projeto/${this.projeto.id}/treinamentos`);
      return;
    }
    if (tab === 'analise') Analisador.render(this.projeto.id);
    else if (tab === 'config') this._renderConfig();
    else this._renderTarefas();
  },

  _renderTab(tab) {
    const c = document.getElementById('projContent');
    if (tab === 'treinamentos') {
      App.navigate(`/projeto/${this.projeto.id}/treinamentos`);
      return;
    }
    if (tab === 'analise') Analisador.render(this.projeto.id);
    else if (tab === 'config') this._renderConfig();
    else this._renderTarefas();
  },

  async _atualizarKPI() {
    try {
      const p = await App.api(`/projetos/${this.projeto.id}`);
      this.projeto = p;
      document.getElementById('projProgresso').textContent = `${Math.round(p.progresso_medio || 0)}%`;
      const bar = document.getElementById('projProgressBar');
      if (bar) { bar.style.width = `${p.progresso_medio || 0}%`; bar.className = `progress-bar ${App.progressColor(p.progresso_medio || 0)}`; }
      document.getElementById('projTarefas').textContent = `${p.tarefas_concluidas || 0}/${p.total_tarefas || 0}`;
      document.getElementById('projFdbPath').textContent = p.fdb_path || 'Não definido';
    } catch (e) {}
  },

  _renderConfig() {
    const c = document.getElementById('projContent');
    const p = this.projeto;
    c.innerHTML = `
      <div class="fade-in">
        <div class="section-title"><i class="bi bi-pencil-square"></i> Dados do Projeto</div>
        <div class="card p-4 mb-4">
          <div class="form-group">
            <label class="form-label">Nome do Projeto</label>
            <input class="input" id="cfgNome" value="${App.esc(p.nome)}">
          </div>
          <div class="form-group">
            <label class="form-label">Empresa</label>
            <input class="input" id="cfgEmpresa" value="${App.esc(p.empresa)}">
          </div>
          <div class="form-group">
            <label class="form-label">Caminho do FDB</label>
            <input class="input" id="cfgFdb" value="${App.esc(p.fdb_path || '')}" placeholder="D:\\Backups\\CLIENTE.FDB">
          </div>
          <div class="flex gap-2 mt-4">
            <button class="btn btn-primary" onclick="Projeto._salvarConfig()"><i class="bi bi-check-lg"></i> Salvar Alterações</button>
          </div>
        </div>

        <div class="section-title text-danger"><i class="bi bi-exclamation-triangle"></i> Zona de Perigo</div>
        <div class="card p-4" style="border-color:var(--danger)">
          <p class="text-sm text-muted mb-3">Excluir este projeto remove todas as tarefas, análises e treinamentos vinculados. Esta ação não pode ser desfeita.</p>
          <button class="btn btn-danger" onclick="Projeto._excluir()"><i class="bi bi-trash"></i> Excluir Projeto</button>
        </div>
      </div>`;
  },

  async _salvarConfig() {
    const nome = document.getElementById('cfgNome')?.value.trim();
    const empresa = document.getElementById('cfgEmpresa')?.value.trim();
    const fdb_path = document.getElementById('cfgFdb')?.value.trim() || null;
    if (!nome || !empresa) { App.toast('Nome e empresa obrigatórios', 'warning'); return; }
    try {
      await App.api(`/projetos/${this.projeto.id}`, { method: 'PUT', body: { nome, empresa, fdb_path } });
      App.toast('Projeto atualizado!');
      App.navigate(`/projeto/${this.projeto.id}`);
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  async _renderTarefas() {
    const c = document.getElementById('projContent');
    const nomesMacro = { 0: 'Sem macro', 1: 'Cadastro', 2: 'Fiscal', 3: 'Produtos', 4: 'Abate', 5: 'Desossa', 6: 'Câmaras', 7: 'Embalagens', 8: 'Mercados', 9: 'Metas', 10: 'Precificação', 11: 'Produção', 12: 'Expedição', 13: 'Financeiro', 14: 'Comex', 15: 'Go-Live' };
    const macroBtns = Object.entries(nomesMacro).map(([id, nome]) =>
      `<button class="btn btn-xs ${this._filtroMacro === id ? 'btn-primary' : 'btn-secondary'} macro-filtro" data-macro="${id}" onclick="Projeto._filtrarMacro('${id}')">${nome}</button>`
    ).join('');

    c.innerHTML = `
      <div class="flex flex-wrap justify-between items-center mb-3 gap-2">
        <div class="flex flex-wrap gap-1">
          <button class="btn btn-xs ${this._filtroStatus === '' ? 'btn-primary' : 'btn-secondary'}" onclick="Projeto._filtrarStatus('')">Todos</button>
          <button class="btn btn-xs ${this._filtroStatus === 'pendente' ? 'btn-primary' : 'btn-secondary'}" onclick="Projeto._filtrarStatus('pendente')">Pendentes</button>
          <button class="btn btn-xs ${this._filtroStatus === 'andamento' ? 'btn-primary' : 'btn-secondary'}" onclick="Projeto._filtrarStatus('andamento')">Andamento</button>
          <button class="btn btn-xs ${this._filtroStatus === 'concluido' ? 'btn-primary' : 'btn-secondary'}" onclick="Projeto._filtrarStatus('concluido')">Concluídas</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Projeto._novaTarefa()"><i class="bi bi-plus"></i> Nova</button>
      </div>
      <div class="flex flex-wrap gap-1 mb-3">${macroBtns}</div>
      <div id="tarefasList"><div class="empty-state"><i class="bi bi-arrow-repeat spin"></i></div></div>
    `;
    this._carregarTarefas();
  },

  async _carregarTarefas() {
    const container = document.getElementById('tarefasList');
    try {
      const params = new URLSearchParams();
      if (this._filtroMacro) params.set('macroprocesso_id', this._filtroMacro);
      if (this._filtroStatus) params.set('status', this._filtroStatus);
      const data = await App.api(`/tarefas/projeto/${this.projeto.id}?${params.toString()}`);
      this._renderList(data.tarefas, data.totais);
    } catch (e) {
      if (container) container.innerHTML = `<div class="empty-state text-danger"><i class="bi bi-exclamation-triangle"></i><p>${e.message}</p></div>`;
    }
  },

  _filtrarStatus(s) { this._filtroStatus = this._filtroStatus === s ? '' : s; this._carregarTarefas(); },
  _filtrarMacro(m) { this._filtroMacro = this._filtroMacro === m ? '' : m; this._carregarTarefas(); },

  _renderList(tarefas) {
    const container = document.getElementById('tarefasList');
    const grupos = {};
    for (const t of tarefas) {
      const m = t.macroprocesso_id || 0;
      if (!grupos[m]) grupos[m] = [];
      grupos[m].push(t);
    }
    const nomesMacro = { 0: 'Sem macro', 1: 'Cadastro de Clientes e Fornecedores', 2: 'Parametrização Fiscal', 3: 'Cadastro de Produtos', 4: 'Recebimento e Abate', 5: 'Desossa e Cortes', 6: 'Câmaras e Estoque', 7: 'Embalagens e Kits', 8: 'Mercados e Habilitações', 9: 'Produção e Metas', 10: 'Precificação', 11: 'Ordens de Produção', 12: 'Expedição e Logística', 13: 'Financeiro', 14: 'Comex', 15: 'Go-Live e Encerramento' };

    if (Object.keys(grupos).length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="bi bi-inbox"></i><p>Nenhuma tarefa encontrada</p></div>`;
      return;
    }

    container.innerHTML = Object.entries(grupos).map(([macro, tasks]) => {
      const nome = nomesMacro[macro] || `Macro ${macro}`;
      const conc = tasks.filter(t => t.status === 'concluido').length;
      const progress = tasks.length > 0 ? Math.round(tasks.reduce((s, t) => s + t.progresso, 0) / tasks.length) : 0;
      return `
        <div class="card mb-2">
          <div class="card-header py-2" style="cursor:pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
            <div class="flex items-center gap-2">
              <i class="bi bi-chevron-down text-xs text-muted"></i>
              <strong class="text-sm">${nome}</strong>
              <span class="badge badge-primary">${conc}/${tasks.length}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="progress" style="width:80px;height:6px"><div class="progress-bar ${App.progressColor(progress)}" style="width:${progress}%"></div></div>
              <span class="text-xs text-muted">${progress}%</span>
            </div>
          </div>
          <div class="list-group border-0">
            ${tasks.map(t => this._itemHTML(t)).join('')}
          </div>
        </div>`;
    }).join('');
  },

  _itemHTML(t) {
    const icons = { pendente: 'bi-circle', andamento: 'bi-arrow-repeat text-warning', concluido: 'bi-check-circle-fill text-success' };
    return `
      <div class="list-group-item" data-id="${t.id}">
        <i class="bi ${icons[t.status] || 'bi-circle'}" style="cursor:pointer;font-size:1rem" onclick="Projeto._alternarStatus(${t.id},'${t.status}')"></i>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-sm ${t.status === 'concluido' ? 'text-muted' : ''}" style="${t.status === 'concluido' ? 'text-decoration:line-through' : ''}">${App.esc(t.titulo)}${t.template_ref_id ? ' <span class="badge badge-primary badge-xs">📌 Padrão</span>' : ''}</span>
            <div class="flex items-center gap-2">
              <div class="progress" style="width:50px;height:4px"><div class="progress-bar ${App.progressColor(t.progresso)}" style="width:${t.progresso}%"></div></div>
              <span class="text-xs text-muted" style="min-width:28px">${t.progresso}%</span>
              <button class="btn btn-xs btn-ghost p-1" onclick="event.stopPropagation();Projeto._editarTarefa(${t.id})"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-xs btn-ghost p-1 text-danger" onclick="event.stopPropagation();Projeto._excluirTarefa(${t.id})"><i class="bi bi-x-circle"></i></button>
            </div>
          </div>
          ${t.descricao ? `<div class="text-xs text-muted mt-0.5 truncate">${App.esc(t.descricao)}</div>` : ''}
        </div>
      </div>`;
  },

  async _alternarStatus(id, statusAtual) {
    const map = { concluido: ['pendente', 0], andamento: ['concluido', 100], pendente: ['andamento', 50] };
    const [novoStatus, novoProgresso] = map[statusAtual] || ['pendente', 0];
    try {
      await App.api(`/tarefas/${id}`, { method: 'PUT', body: { status: novoStatus, progresso: novoProgresso } });
      this._carregarTarefas();
      this._atualizarKPI();
    } catch (e) { App.toast('Erro ao atualizar', 'danger'); }
  },

  async _editarTarefa(id) {
    try {
      const t = await App.api(`/tarefas/${id}`);
      this._modalTarefa('Editar Tarefa', t, async (dados) => {
        const status = dados.progresso === 100 ? 'concluido' : dados.progresso > 0 ? 'andamento' : 'pendente';
        await App.api(`/tarefas/${id}`, { method: 'PUT', body: { ...dados, status } });
        this._carregarTarefas();
        this._atualizarKPI();
      });
    } catch (e) { App.toast('Erro ao carregar tarefa', 'danger'); }
  },

  _novaTarefa() {
    this._modalTarefa('Nova Tarefa', { titulo: '', descricao: '', macroprocesso_id: '', progresso: 0, is_template: false }, async (dados) => {
      await App.api(`/tarefas/projeto/${this.projeto.id}`, { method: 'POST', body: dados });
      this._carregarTarefas();
      App.toast('Tarefa criada!');
    });
  },

  _modalTarefa(titulo, dados, onSave) {
    const nomesMacro = { '': 'Selecione...', 0: 'Sem macro', 1: 'Cadastro', 2: 'Fiscal', 3: 'Produtos', 4: 'Abate', 5: 'Desossa', 6: 'Câmaras', 7: 'Embalagens', 8: 'Mercados', 9: 'Metas', 10: 'Precificação', 11: 'Produção', 12: 'Expedição', 13: 'Financeiro', 14: 'Comex', 15: 'Go-Live' };
    const opts = Object.entries(nomesMacro).map(([v, n]) => `<option value="${v}" ${String(dados.macroprocesso_id || '') === v ? 'selected' : ''}>${n}</option>`).join('');

    const body = `
      <div class="form-group">
        <label class="form-label">Título</label>
        <input class="input" id="modalTarefaTitulo" value="${App.esc(dados.titulo)}">
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="input" id="modalTarefaDesc" rows="2">${App.esc(dados.descricao)}</textarea>
      </div>
      <div class="grid grid-cols-2">
        <div class="form-group">
          <label class="form-label">Macroprocesso</label>
          <select class="input" id="modalTarefaMacro">${opts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Progresso (0-100)</label>
          <input class="input" type="number" id="modalTarefaProg" min="0" max="100" value="${dados.progresso || 0}">
        </div>
      </div>
      <div class="form-group">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" id="modalTarefaTemplate" ${dados.is_template ? 'checked' : ''}>
          <span class="text-sm font-medium">Tornar padrão para todos os projetos</span>
        </label>
      </div>`;

    Projeto._modalOnSave = onSave;
    const _id = 'modal-' + Date.now();
    App.modal(titulo, body, `
      <button class="btn btn-secondary" onclick="App.closeModal('${_id}')">Cancelar</button>
      <button class="btn btn-primary" onclick="Projeto._salvarTarefa('${_id}')"><i class="bi bi-check"></i> Salvar</button>`);
  },

  _modalOnSave: null,

  async _salvarTarefa(modalId) {
    const titulo = document.getElementById('modalTarefaTitulo')?.value.trim();
    if (!titulo) { App.toast('Título obrigatório', 'warning'); return; }
    const progresso = Math.min(100, Math.max(0, parseInt(document.getElementById('modalTarefaProg')?.value) || 0));
    const macro = document.getElementById('modalTarefaMacro')?.value;
    const descricao = document.getElementById('modalTarefaDesc')?.value.trim();
    const is_template = document.getElementById('modalTarefaTemplate')?.checked || false;
    try {
      await this._modalOnSave({ titulo, descricao: descricao || null, macroprocesso_id: macro !== '' ? parseInt(macro) : null, progresso, is_template });
      App.closeModal(modalId);
    } catch (e) { App.toast('Erro ao salvar', 'danger'); }
  },

  async _excluirTarefa(id) {
    try {
      const t = await App.api(`/tarefas/${id}`);
      let url = `/tarefas/${id}`;
      if (t.template_ref_id) {
        if (confirm('Esta tarefa é padrão para todos os projetos. Remover também dos templates?')) {
          url += '?remove_template=true';
        }
      }
      await App.api(url, { method: 'DELETE' });
      this._carregarTarefas();
      this._atualizarKPI();
    } catch (e) { App.toast('Erro ao excluir', 'danger'); }
  },

  _excluir() {
    if (!confirm(`Excluir "${this.projeto.nome}"? Esta ação não pode ser desfeita.`)) return;
    App.api(`/projetos/${this.projeto.id}`, { method: 'DELETE' })
      .then(() => { App.toast('Projeto excluído', 'warning'); App.navigate('/'); })
      .catch(e => App.toast(e.message, 'danger'));
  }
};
