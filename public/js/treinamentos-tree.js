const TreinTree = {
  projetoId: null,
  allTasks: [],
  expanded: new Set(),

  _api(path, opts = {}) {
    const url = this.projetoId ? `${path}?projeto_id=${this.projetoId}` : path;
    return App.api(url, opts);
  },

  async render(projetoId) {
    this.projetoId = projetoId || null;
    const app = document.getElementById('app');
    app.innerHTML = `<div class="flex items-center justify-center py-20"><i class="bi bi-arrow-repeat text-3xl text-primary spin"></i></div>`;
    try {
      const data = await this._api('/treinamentos/tasks');
      this.allTasks = data.tasks || [];
      app.innerHTML = this.html();
      this.renderTree();
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p></div>`;
    }
  },

  html() {
    const baseUrl = this.projetoId ? `#/projeto/${this.projetoId}/treinamentos` : '#/treinamentos';
    const counts = {};
    for (const t of this.allTasks) counts[t.status] = (counts[t.status] || 0) + 1;
    const statuses = Object.keys(counts).sort();

    return `
      <div class="fade-in">
        ${this.projetoId ? `<div class="flex items-center gap-2 mb-3"><button class="btn btn-ghost btn-sm" onclick="App.navigate('/projeto/${this.projetoId}/treinamentos')"><i class="bi bi-arrow-left"></i> Voltar</button></div>` : ''}
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-lg font-bold">Árvore de Treinamentos</h1>
            <p class="text-sm text-muted">${this.allTasks.length} tarefas</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          <div class="flex-1" style="min-width:180px">
            <div class="flex items-center gap-2">
              <i class="bi bi-search text-muted"></i>
              <input class="input" id="treeSearch" placeholder="Buscar tarefa...">
            </div>
          </div>
          <select class="input" id="treeStatusFilter" style="width:auto;min-width:150px">
            <option value="">Todos</option>
            ${statuses.map(s => `<option value="${s}">${s} (${counts[s]})</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="TreinTree.expandAll()"><i class="bi bi-arrows-expand"></i> Expandir</button>
          <button class="btn btn-secondary btn-sm" onclick="TreinTree.collapseAll()"><i class="bi bi-arrows-collapse"></i> Recolher</button>
        </div>

        <div class="card overflow-hidden">
          <div id="treeContainer" class="divide-y" style="border-bottom:1px solid var(--border)"></div>
        </div>
      </div>`;
  },

  expandAll() {
    for (const t of this.allTasks) if (t.nivel < 4) this.expanded.add(t.id);
    this.renderTree();
  },

  collapseAll() {
    this.expanded.clear();
    this.renderTree();
  },

  renderTree() {
    const container = document.getElementById('treeContainer');
    if (!container) return;

    const search = (document.getElementById('treeSearch')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('treeStatusFilter')?.value || '';
    const baseUrl = this.projetoId ? `#/projeto/${this.projetoId}/treinamentos` : '#/treinamentos';

    let filtered = this.allTasks;
    if (search) filtered = filtered.filter(t => t.titulo.toLowerCase().includes(search) || t.codigo.toLowerCase().includes(search));
    if (statusFilter) filtered = filtered.filter(t => t.status === statusFilter);

    const roots = filtered.filter(t => t.nivel === 1);
    container.innerHTML = roots.map(r => this.node(r, filtered, 0, baseUrl)).join('');

    document.getElementById('treeSearch')?.addEventListener('input', () => this.renderTree());
    document.getElementById('treeStatusFilter')?.addEventListener('change', () => this.renderTree());
  },

  node(task, allTasks, depth, baseUrl) {
    const children = allTasks.filter(t => t.parent_id === task.id);
    const expanded = this.expanded.has(task.id);
    const hasChildren = children.length > 0;
    const pl = 0.75 + depth * 1.25;
    const icons = { 1: 'bi-house-fill text-primary', 2: 'bi-folder', 3: 'bi-file-earmark-text text-muted', 4: 'bi-file-text text-muted' };
    const icon = icons[task.nivel] || 'bi-file-earmark';

    return `
      <div>
        <div class="tree-node" style="padding-left:${pl}rem">
          <span class="flex-shrink-0" style="width:16px;text-align:center">
            ${hasChildren ? `<i class="bi bi-chevron-right text-xs ${expanded ? 'rotated' : ''}" style="cursor:pointer;color:var(--primary);transition:transform 0.15s;${expanded ? 'transform:rotate(90deg)' : ''}" onclick="TreinTree.toggle(${task.id})"></i>` : ''}
          </span>
          <i class="bi ${icon} text-sm flex-shrink-0"></i>
          <span class="text-xs font-semibold text-primary flex-shrink-0" style="font-family:monospace">${App.esc(task.codigo)}</span>
          <span class="flex-1 min-w-0 truncate text-sm">${App.esc(task.titulo)}</span>
          <span class="flex-shrink-0 hidden sm:block">${App.Priority(task.prioridade)}</span>
          ${App.Badge(task.status)}
          <a href="${baseUrl}/task/${task.id}" class="btn btn-xs btn-ghost"><i class="bi bi-eye"></i></a>
        </div>
        ${expanded && hasChildren ? `<div class="tree-children">${children.map(c => this.node(c, allTasks, depth + 1, baseUrl)).join('')}</div>` : ''}
      </div>`;
  },

  toggle(id) {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    this.renderTree();
  }
};