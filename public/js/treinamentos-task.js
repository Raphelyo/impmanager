const TreinTask = {
  projetoId: null,
  currentTask: null,

  _api(path, opts = {}) {
    const url = this.projetoId ? `${path}?projeto_id=${this.projetoId}` : path;
    return App.api(url, opts);
  },

  async render(id, projetoId) {
    this.projetoId = projetoId || null;
    const app = document.getElementById('app');
    app.innerHTML = `<div class="flex items-center justify-center py-20"><i class="bi bi-arrow-repeat text-3xl text-primary spin"></i></div>`;
    try {
      const data = await this._api(`/treinamentos/tasks/${id}`);
      this.currentTask = data;
      app.innerHTML = this.html(data);
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p><a href="${this._baseUrl()}/tree" class="btn btn-primary mt-2">Voltar</a></div>`;
    }
  },

  _baseUrl() {
    return this.projetoId ? `#/projeto/${this.projetoId}/treinamentos` : '#/treinamentos';
  },

  html(data) {
    const t = data;
    const baseUrl = this._baseUrl();
    return `
      <div class="fade-in" style="max-width:800px">
        <nav class="flex items-center gap-2 text-xs text-muted mb-4">
          <a href="${baseUrl}" class="hover:text-primary">Dashboard</a>
          <i class="bi bi-chevron-right"></i>
          <a href="${baseUrl}/tree" class="hover:text-primary">Árvore</a>
          <i class="bi bi-chevron-right"></i>
          <span class="text-sm font-medium" style="color:var(--text)">${App.esc(t.codigo)}</span>
        </nav>

        <div class="card p-5 mb-4">
          <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <h1 class="text-lg font-bold">${App.esc(t.titulo)}</h1>
              <span class="text-xs font-semibold text-primary" style="font-family:monospace">${App.esc(t.codigo)}</span>
            </div>
            <div class="flex items-center gap-2">${App.Badge(t.status)} ${App.Priority(t.prioridade)}</div>
          </div>

          <div class="grid grid-cols-4 gap-3 mb-4">
            <div><span class="text-xs text-muted">Início</span><p class="text-sm font-medium">${App.date(t.data_inicio)}</p></div>
            <div><span class="text-xs text-muted">Fim</span><p class="text-sm font-medium">${App.date(t.data_fim)}</p></div>
            <div><span class="text-xs text-muted">Duração</span><p class="text-sm font-medium">${App.date(t.duracao)}</p></div>
            <div><span class="text-xs text-muted">Responsável</span><p class="text-sm font-medium">${App.esc(t.responsavel || '—')}</p></div>
          </div>

          <div class="flex flex-wrap gap-2">
            ${['Concluído', 'Não iniciado', 'Em espera', 'Cancelado'].map(s => `
              <button onclick="TreinTask.updateStatus(${t.id}, '${s}')" class="btn btn-xs ${t.status === s ? 'btn-primary' : 'btn-secondary'}">
                <i class="bi ${s === 'Concluído' ? 'bi-check-lg' : s === 'Cancelado' ? 'bi-x-lg' : s === 'Em espera' ? 'bi-pause' : 'bi-hourglass'}"></i> ${s}
              </button>
            `).join('')}
          </div>
        </div>

        ${data.children?.length ? `
        <div class="card overflow-hidden mb-4">
          <div class="card-header"><span class="text-sm font-medium"><i class="bi bi-diagram-2 text-primary me-1"></i> Subtarefas (${data.children.length})</span></div>
          <div class="list-group border-0">
            ${data.children.map(c => `
              <a href="${baseUrl}/task/${c.id}" class="list-group-item" style="cursor:pointer">
                <span class="text-xs font-semibold text-primary" style="font-family:monospace">${App.esc(c.codigo)}</span>
                <span class="flex-1 text-sm">${App.esc(c.titulo)}</span>
                ${App.Badge(c.status)}
                <i class="bi bi-chevron-right text-xs text-muted"></i>
              </a>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="card overflow-hidden mb-4">
          <div class="card-header">
            <span class="text-sm font-medium"><i class="bi bi-pencil-square text-primary me-1"></i> Anotações</span>
            ${data.notes?.[0] ? `<span class="text-xs text-muted">${new Date(data.notes[0].updated_at + 'Z').toLocaleString('pt-BR')}</span>` : ''}
          </div>
          <div class="p-4">
            <textarea id="noteEditor" rows="4" class="input" style="resize:vertical;min-height:100px" placeholder="Escreva suas anotações...">${data.notes?.[0] ? App.esc(data.notes[0].conteudo) : ''}</textarea>
            <div class="flex justify-end mt-2">
              <button class="btn btn-primary btn-sm" onclick="TreinTask.saveNote(${t.id})"><i class="bi bi-save"></i> Salvar</button>
            </div>
          </div>
        </div>

        <div class="card overflow-hidden mb-4">
          <div class="card-header">
            <span class="text-sm font-medium"><i class="bi bi-link-45deg text-primary me-1"></i> Materiais de Estudo</span>
            <button class="btn btn-primary btn-sm" onclick="TreinTask.showAddMaterial(${t.id})"><i class="bi bi-plus"></i> Adicionar</button>
          </div>
          <div class="list-group border-0">
            ${data.materiais?.length ? data.materiais.map(m => `
              <div class="list-group-item">
                <i class="bi ${m.tipo === 'video' ? 'bi-play-circle text-danger' : 'bi-link-45deg text-primary'}"></i>
                <a href="${App.esc(m.url)}" target="_blank" class="flex-1 text-sm text-primary">${App.esc(m.descricao || m.url)}</a>
                <button class="btn btn-xs btn-ghost text-danger" onclick="TreinTask.deleteMaterial(${m.id})"><i class="bi bi-trash"></i></button>
              </div>
            `).join('') : `
            <div class="empty-state py-4"><i class="bi bi-inbox"></i><p>Nenhum material adicionado</p></div>`}
          </div>
        </div>
      </div>`;
  },

  async updateStatus(id, status) {
    try {
      await App.api(`/treinamentos/tasks/${id}`, { method: 'PUT', body: { status } });
      App.toast(`Status alterado para "${status}"`);
      this.render(id, this.projetoId);
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  async saveNote(id) {
    const editor = document.getElementById('noteEditor');
    if (!editor) return;
    try {
      await App.api(`/treinamentos/tasks/${id}/notes`, { method: 'POST', body: { conteudo: editor.value } });
      App.toast('Anotações salvas!');
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  async deleteMaterial(id) {
    if (!confirm('Remover este material?')) return;
    try {
      await App.api(`/treinamentos/materiais/${id}`, { method: 'DELETE' });
      App.toast('Material removido');
      if (this.currentTask?.id) this.render(this.currentTask.id, this.projetoId);
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  showAddMaterial(taskId) {
    const url = prompt('URL do material:');
    if (!url) return;
    const descricao = prompt('Descrição:') || url;
    const tipo = prompt('Tipo (link/video):') || 'link';
    App.api(`/treinamentos/tasks/${taskId}/materiais`, { method: 'POST', body: { tipo, url, descricao } })
      .then(() => { App.toast('Material adicionado!'); if (this.currentTask?.id) this.render(this.currentTask.id, this.projetoId); })
      .catch(e => App.toast(e.message, 'danger'));
  }
};