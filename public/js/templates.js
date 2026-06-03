const TemplatesManager = {
  async render() {
    const app = document.getElementById('app');
    try {
      const templates = await App.api('/tarefas/templates');
      app.innerHTML = this.html(templates);
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p><button class="btn btn-primary mt-2" onclick="App.navigate('/')">Voltar</button></div>`;
    }
  },

  html(templates) {
    const nomesMacro = { 0: 'Sem macro', 1: 'Cadastro', 2: 'Fiscal', 3: 'Produtos', 4: 'Abate', 5: 'Desossa', 6: 'Câmaras', 7: 'Embalagens', 8: 'Mercados', 9: 'Metas', 10: 'Precificação', 11: 'Produção', 12: 'Expedição', 13: 'Financeiro', 14: 'Comex', 15: 'Go-Live', 16: 'Testes' };

    const grupos = {};
    for (const t of templates) {
      const m = t.macroprocesso_id || 0;
      if (!grupos[m]) grupos[m] = [];
      grupos[m].push(t);
    }

    const total = templates.length;
    const vinculados = templates.filter(t => t.projetos_vinculados > 0).length;

    return `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-xl font-bold">Templates de Tarefas</h1>
            <p class="text-sm text-muted">${total} templates — ${vinculados} em uso por projetos</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="TemplatesManager._novo()"><i class="bi bi-plus"></i> Novo Template</button>
        </div>

        <div class="grid grid-cols-4 mb-4">
          <div class="stat-card text-center">
            <div class="text-2xl font-bold text-primary">${total}</div>
            <div class="text-xs text-muted mt-1">Total de Templates</div>
          </div>
          <div class="stat-card text-center">
            <div class="text-2xl font-bold text-accent">${vinculados}</div>
            <div class="text-xs text-muted mt-1">Em Uso</div>
          </div>
          <div class="stat-card text-center">
            <div class="text-2xl font-bold text-warning">${total - vinculados}</div>
            <div class="text-xs text-muted mt-1">Não Vinculados</div>
          </div>
          <div class="stat-card text-center">
            <div class="text-2xl font-bold text-secondary">${Object.keys(grupos).length}</div>
            <div class="text-xs text-muted mt-1">Macroprocessos</div>
          </div>
        </div>

        ${Object.entries(grupos).length === 0 ? `
        <div class="empty-state">
          <i class="bi bi-inbox"></i>
          <p>Nenhum template cadastrado</p>
          <p class="text-xs text-muted">Crie tarefas em um projeto marcando como "Tornar padrão" ou use o botão "Novo Template"</p>
        </div>` : Object.entries(grupos).sort((a, b) => a[0] - b[0]).map(([macro, tasks]) => {
          const nome = nomesMacro[macro] || `Macro ${macro}`;
          const emUso = tasks.filter(t => t.projetos_vinculados > 0).length;
          return `
          <div class="card mb-2">
            <div class="card-header py-2" style="cursor:pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
              <div class="flex items-center gap-2">
                <i class="bi bi-chevron-down text-xs text-muted"></i>
                <strong class="text-sm">${nome}</strong>
                <span class="badge badge-primary">${tasks.length}</span>
                ${emUso < tasks.length ? `<span class="badge badge-muted">${tasks.length - emUso} não vinculados</span>` : ''}
              </div>
            </div>
            <div class="list-group border-0">
              ${tasks.map(t => `
              <div class="list-group-item">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-sm font-medium">${App.esc(t.titulo)}</span>
                      <span class="badge badge-muted badge-xs ms-1">${nomesMacro[t.macroprocesso_id] || 'Sem macro'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="badge ${t.projetos_vinculados > 0 ? 'badge-accent' : 'badge-muted'}">${t.projetos_vinculados} projeto${t.projetos_vinculados !== 1 ? 's' : ''}</span>
                      <button class="btn btn-xs btn-ghost p-1" onclick="TemplatesManager._editar(${t.id})"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-xs btn-ghost p-1 text-danger" onclick="TemplatesManager._excluir(${t.id})"><i class="bi bi-x-circle"></i></button>
                    </div>
                  </div>
                  ${t.descricao ? `<div class="text-xs text-muted mt-0.5 truncate">${App.esc(t.descricao)}</div>` : ''}
                </div>
              </div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  },

  _novo() {
    this._modal('Novo Template', null, async (dados) => {
      await App.api('/tarefas/templates', { method: 'POST', body: dados });
      App.toast('Template criado!');
      this.render();
    });
  },

  async _editar(id) {
    try {
      const templates = await App.api('/tarefas/templates');
      const t = templates.find(x => x.id === id);
      if (!t) { App.toast('Template não encontrado', 'danger'); return; }
      this._modal('Editar Template', t, async (dados) => {
        await App.api(`/tarefas/templates/${id}`, { method: 'PUT', body: dados });
        App.toast('Template atualizado!');
        this.render();
      });
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  _modal(titulo, dados, onSave) {
    const nomesMacro = { '': 'Selecione...', 0: 'Sem macro', 1: 'Cadastro', 2: 'Fiscal', 3: 'Produtos', 4: 'Abate', 5: 'Desossa', 6: 'Câmaras', 7: 'Embalagens', 8: 'Mercados', 9: 'Metas', 10: 'Precificação', 11: 'Produção', 12: 'Expedição', 13: 'Financeiro', 14: 'Comex', 15: 'Go-Live', 16: 'Testes' };
    const isEdit = !!dados;
    const t = dados || { titulo: '', descricao: '', macroprocesso_id: '' };
    const opts = Object.entries(nomesMacro).map(([v, n]) => `<option value="${v}" ${String(t.macroprocesso_id || '') === v ? 'selected' : ''}>${n}</option>`).join('');

    const body = `
      <div class="form-group">
        <label class="form-label">Título <span class="text-danger">*</span></label>
        <input class="input" id="modalTmplTitulo" value="${App.esc(t.titulo)}">
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="input" id="modalTmplDesc" rows="2">${App.esc(t.descricao)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Macroprocesso</label>
        <select class="input" id="modalTmplMacro">${opts}</select>
      </div>`;

    TemplatesManager._modalOnSave = onSave;
    const modalId = 'modal-' + Date.now();
    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal('${modalId}')">Cancelar</button>
      <button class="btn btn-primary" onclick="TemplatesManager._salvar('${modalId}')"><i class="bi bi-check"></i> ${isEdit ? 'Atualizar' : 'Criar'}</button>`;
    App.modal(titulo, body, footer);
  },

  _modalOnSave: null,

  async _salvar(modalId) {
    const titulo = document.getElementById('modalTmplTitulo')?.value.trim();
    if (!titulo) { App.toast('Título obrigatório', 'warning'); return; }
    const descricao = document.getElementById('modalTmplDesc')?.value.trim();
    const macro = document.getElementById('modalTmplMacro')?.value;
    try {
      await this._modalOnSave({ titulo, descricao: descricao || null, macroprocesso_id: macro !== '' ? parseInt(macro) : null });
      App.closeModal(modalId);
    } catch (e) { App.toast('Erro ao salvar', 'danger'); }
  },

  _excluir(id) {
    if (!confirm('Excluir este template?\n\nTarefas vinculadas em projetos serão mantidas, mas deixarão de ser padrão.')) return;
    App.api(`/tarefas/templates/${id}`, { method: 'DELETE' })
      .then(() => {
        App.toast('Template removido');
        this.render();
      })
      .catch(e => App.toast(e.message, 'danger'));
  }
};
