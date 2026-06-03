const TreinStudy = {
  projetoId: null,
  allTasks: [],
  currentIndex: 0,
  studyList: [],

  _api(path, opts = {}) {
    const url = this.projetoId ? `${path}?projeto_id=${this.projetoId}` : path;
    return App.api(url, opts);
  },

  _baseUrl() {
    return this.projetoId ? `#/projeto/${this.projetoId}/treinamentos` : '#/treinamentos';
  },

  async render(projetoId) {
    this.projetoId = projetoId || null;
    const app = document.getElementById('app');
    app.innerHTML = `<div class="flex items-center justify-center py-20"><i class="bi bi-arrow-repeat text-3xl text-primary spin"></i></div>`;
    try {
      const data = await this._api('/treinamentos/tasks');
      this.allTasks = data.tasks || [];
      this.studyList = this.allTasks.filter(t => (t.nivel === 3 || t.nivel === 4) && t.status !== 'Concluído' && t.status !== 'Cancelado');
      this.studyList.sort((a, b) => a.codigo.localeCompare(b.codigo));
      app.innerHTML = this.html();
      if (this.studyList.length > 0) this.showTask(0);
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p></div>`;
    }
  },

  html() {
    const baseUrl = this._baseUrl();
    const total = this.studyList.length;
    const todas = this.allTasks.filter(t => t.nivel >= 3);
    const concluidas = todas.filter(t => t.status === 'Concluído').length;
    const totalDet = todas.length;
    const pct = totalDet > 0 ? Math.round((concluidas / totalDet) * 100) : 0;

    if (total === 0) {
      return `
        <div class="flex flex-col items-center justify-center py-20 text-center fade-in">
          ${this.projetoId ? `<button class="btn btn-ghost btn-sm mb-3" onclick="App.navigate('/projeto/${this.projetoId}/treinamentos')"><i class="bi bi-arrow-left"></i> Voltar</button>` : ''}
          <div style="width:64px;height:64px;background:rgba(20,184,166,0.1);border-radius:99px;display:flex;align-items:center;justify-content:center;margin-bottom:1rem">
            <i class="bi bi-emoji-smile text-3xl text-success"></i>
          </div>
          <h2 class="text-lg font-bold mb-1">Todas as tarefas foram estudadas!</h2>
          <p class="text-muted mb-4">Parabéns! Você concluiu o estudo de todas as tarefas.</p>
          <a href="${baseUrl}" class="btn btn-primary">Voltar ao Dashboard</a>
        </div>`;
    }

    return `
      <div class="fade-in" style="max-width:700px;margin:0 auto">
        ${this.projetoId ? `<div class="flex items-center gap-2 mb-3"><button class="btn btn-ghost btn-sm" onclick="App.navigate('/projeto/${this.projetoId}/treinamentos')"><i class="bi bi-arrow-left"></i> Voltar</button></div>` : ''}
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 class="text-lg font-bold"><i class="bi bi-eyeglasses text-primary me-2"></i>Modo Estudo</h1>
            <p class="text-sm text-muted">Foco nas tarefas pendentes</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-emerald">${concluidas} concluídas</span>
            <span class="badge badge-amber">${total} pendentes</span>
            <span class="badge badge-muted">${totalDet} total</span>
          </div>
        </div>

        <div class="progress mb-4" style="height:6px"><div class="progress-bar progress-bar-accent" style="width:${pct}%"></div></div>

        <div class="card p-3 mb-4" style="position:sticky;top:4rem;z-index:10">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-xs text-muted">Tarefa <strong>${this.currentIndex + 1}</strong> de ${total}</span>
            <div class="flex items-center gap-2">
              <button class="btn btn-secondary btn-sm" onclick="TreinStudy.prevTask()" ${this.currentIndex === 0 ? 'disabled style="opacity:0.4"' : ''}><i class="bi bi-chevron-left"></i></button>
              <select class="input" id="studySelect" onchange="TreinStudy.goToTask(parseInt(this.value))" style="width:auto;min-width:160px;font-size:0.78rem">
                ${this.studyList.map((t, i) => `<option value="${i}" ${i === this.currentIndex ? 'selected' : ''}>${t.codigo} — ${t.titulo.substring(0, 30)}</option>`).join('')}
              </select>
              <button class="btn btn-secondary btn-sm" onclick="TreinStudy.nextTask()" ${this.currentIndex === total - 1 ? 'disabled style="opacity:0.4"' : ''}><i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
        </div>

        <div id="studyContent"></div>
      </div>`;
  },

  async showTask(index) {
    this.currentIndex = index;
    const container = document.getElementById('studyContent');
    if (!container) return;
    const task = this.studyList[index];
    if (!task) return;
    const select = document.getElementById('studySelect');
    if (select) select.value = index;

    try {
      const data = await this._api(`/treinamentos/tasks/${task.id}`);
      container.innerHTML = `
        <div class="card p-5 mb-4">
          <div class="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 class="font-bold">${App.esc(data.titulo)}</h2>
              <span class="text-xs font-semibold text-primary" style="font-family:monospace">${App.esc(data.codigo)}</span>
            </div>
            <div class="flex items-center gap-2">${App.Badge(data.status)} ${App.Priority(data.prioridade)}</div>
          </div>
          <div class="grid grid-cols-4 gap-2 mb-3 text-xs">
            <div><span class="text-muted">Início:</span> <span class="font-medium">${App.date(data.data_inicio)}</span></div>
            <div><span class="text-muted">Fim:</span> <span class="font-medium">${App.date(data.data_fim)}</span></div>
            <div><span class="text-muted">Duração:</span> <span class="font-medium">${App.date(data.duracao)}</span></div>
            <div><span class="text-muted">Resp.:</span> <span class="font-medium">${App.esc(data.responsavel || '—')}</span></div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="TreinStudy.markConcluded(${data.id})"><i class="bi bi-check-lg"></i> Marcar estudado</button>
            <a href="${this._baseUrl()}/task/${data.id}" class="btn btn-secondary btn-sm"><i class="bi bi-box-arrow-up-right"></i> Detalhes</a>
          </div>
        </div>

        <div class="card p-5">
          <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-pencil-square text-primary"></i> Anotações</h3>
          <textarea id="studyNoteEditor" rows="5" class="input" style="resize:vertical;min-height:120px" placeholder="O que você aprendeu? Anote pontos importantes...">${data.notes?.[0] ? App.esc(data.notes[0].conteudo) : ''}</textarea>
          <div class="flex justify-end mt-2">
            <button class="btn btn-primary btn-sm" onclick="TreinStudy.saveNote(${data.id})"><i class="bi bi-save"></i> Salvar anotações</button>
          </div>
        </div>`;
      this._updateNav();
    } catch (e) {
      container.innerHTML = `<div class="card p-4 text-center text-danger"><i class="bi bi-exclamation-triangle text-2xl" style="display:block;margin-bottom:0.5rem"></i>${e.message}</div>`;
    }
  },

  _updateNav() {
    const total = this.studyList.length;
    const strong = document.querySelector('.card strong');
    if (strong) strong.textContent = this.currentIndex + 1;
  },

  prevTask() { if (this.currentIndex > 0) this.showTask(this.currentIndex - 1); },
  nextTask() { if (this.currentIndex < this.studyList.length - 1) this.showTask(this.currentIndex + 1); },
  goToTask(index) { this.showTask(index); },

  async markConcluded(id) {
    try {
      await App.api(`/treinamentos/tasks/${id}`, { method: 'PUT', body: { status: 'Concluído' } });
      App.toast('Tarefa marcada como estudada!');
      this.studyList = this.studyList.filter(t => t.id !== id);
      if (this.studyList.length === 0) { this.render(this.projetoId); return; }
      this.currentIndex = Math.min(this.currentIndex, this.studyList.length - 1);
      const app = document.getElementById('app');
      app.innerHTML = this.html();
      this.showTask(this.currentIndex);
    } catch (e) { App.toast(e.message, 'danger'); }
  },

  async saveNote(id) {
    const editor = document.getElementById('studyNoteEditor');
    if (!editor) return;
    try {
      await App.api(`/treinamentos/tasks/${id}/notes`, { method: 'POST', body: { conteudo: editor.value } });
      App.toast('Anotações salvas!');
    } catch (e) { App.toast(e.message, 'danger'); }
  }
};