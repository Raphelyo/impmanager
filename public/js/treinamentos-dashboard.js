const TreinDashboard = {
  projetoId: null,
  charts: {},

  _api(path, opts = {}) {
    const url = this.projetoId ? `${path}?projeto_id=${this.projetoId}` : path;
    return App.api(url, opts);
  },

  async render(projetoId) {
    this.projetoId = projetoId || null;
    const app = document.getElementById('app');
    try {
      const [stats, tree] = await Promise.all([
        this._api('/treinamentos/tasks/stats'),
        this._api('/treinamentos/tasks/tree')
      ]);
      app.innerHTML = this.html(stats, tree);
      setTimeout(() => this.renderCharts(stats), 150);
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p><button class="btn btn-primary mt-2" onclick="App.navigate('/')">Voltar</button></div>`;
    }
  },

  html(s, tree) {
    const r = s.resumo || { total: 0, concluidas: 0, canceladas: 0, nao_iniciadas: 0, em_espera: 0 };
    const pct = r.total > 0 ? Math.round((r.concluidas / r.total) * 100) : 0;
    const tarefas = tree.filter(t => t.nivel >= 3);
    const conc = tarefas.filter(t => t.status === 'Concluído').length;
    const pctDet = tarefas.length > 0 ? Math.round((conc / tarefas.length) * 100) : 0;
    const baseUrl = this.projetoId ? `#/projeto/${this.projetoId}/treinamentos` : '#/treinamentos';

    return `
      <div class="fade-in">
        ${this.projetoId ? `<div class="flex items-center gap-2 mb-3"><button class="btn btn-ghost btn-sm" onclick="App.navigate('/projeto/${this.projetoId}')"><i class="bi bi-arrow-left"></i> Voltar ao Projeto</button></div>` : ''}
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 class="text-xl font-bold">Treinamentos</h1>
            <p class="text-sm text-muted">${this.projetoId ? 'Treinamentos do projeto' : 'Módulo de treinamentos do Sistec'}</p>
          </div>
          <a href="${baseUrl}/study" class="btn btn-primary"><i class="bi bi-eyeglasses"></i> Modo Estudo</a>
        </div>

        <div class="grid grid-cols-2 mb-4">
          <div class="card p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-muted">Progresso Geral</span>
              <span class="text-xl font-bold text-success">${pct}%</span>
            </div>
            <div class="progress" style="height:8px"><div class="progress-bar progress-bar-accent" style="width:${pct}%"></div></div>
            <div class="text-xs text-muted mt-1">${r.concluidas} de ${r.total} tarefas</div>
          </div>
          <div class="card p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-muted">Tarefas Detalhadas</span>
              <span class="text-xl font-bold text-primary">${pctDet}%</span>
            </div>
            <div class="progress" style="height:8px"><div class="progress-bar progress-bar-primary" style="width:${pctDet}%"></div></div>
            <div class="text-xs text-muted mt-1">${conc} de ${tarefas.length} concluídas</div>
          </div>
        </div>

        <div class="grid grid-cols-5 mb-4">
          ${this.statCard('Total', r.total, 'bi-list-task', '#6366f1')}
          ${this.statCard('Concluídas', r.concluidas, 'bi-check-circle', '#14b8a6')}
          ${this.statCard('Canceladas', r.canceladas, 'bi-x-circle', '#ef4444')}
          ${this.statCard('Não iniciadas', r.nao_iniciadas, 'bi-hourglass', '#94a3b8')}
          ${this.statCard('Em espera', r.em_espera, 'bi-pause-circle', '#f59e0b')}
        </div>

        <div class="section-title"><i class="bi bi-boxes"></i> Módulos</div>
        <div class="grid grid-cols-2 mb-4">
          ${tree.filter(t => t.nivel === 2).map(m => this.moduloCard(m, tree, baseUrl)).join('')}
        </div>

        <div class="grid grid-cols-2">
          <div class="card p-4">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-pie-chart text-primary"></i> Status</h3>
            <div class="chart-container"><canvas id="treinStatusChart"></canvas></div>
          </div>
          <div class="card p-4">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-bar-chart text-primary"></i> Prioridades</h3>
            <div class="chart-container"><canvas id="treinPriorityChart"></canvas></div>
          </div>
        </div>
      </div>`;
  },

  statCard(label, value, icon, color) {
    return `<div class="stat-card text-center"><div class="text-2xl font-bold" style="color:${color}">${value}</div><div class="text-xs text-muted mt-1"><i class="bi ${icon} me-1"></i>${label}</div></div>`;
  },

  moduloCard(mod, tree, baseUrl) {
    const filhos = tree.filter(t => t.parent_id === mod.id);
    const concluidas = filhos.filter(f => f.status === 'Concluído').length;
    const pct = filhos.length > 0 ? Math.round((concluidas / filhos.length) * 100) : 0;
    return `
      <a href="${baseUrl}/tree" class="card card-hover p-4" style="display:block">
        <div class="flex items-start justify-between mb-2">
          <div>
            <span class="text-xs font-semibold text-primary">${App.esc(mod.codigo)}</span>
            <h3 class="font-medium text-sm mt-0.5">${App.esc(mod.titulo)}</h3>
          </div>
          ${App.Badge(mod.status)}
        </div>
        <div class="flex items-center justify-between text-xs text-muted mb-1">
          <span>${concluidas}/${filhos.length} tarefas</span>
          <span class="font-semibold ${pct === 100 ? 'text-success' : ''}">${pct}%</span>
        </div>
        <div class="progress" style="height:5px"><div class="progress-bar ${pct === 100 ? 'progress-bar-accent' : 'progress-bar-primary'}" style="width:${pct}%"></div></div>
      </a>`;
  },

  renderCharts(s) {
    const colors = { 'Concluído': '#14b8a6', 'Cancelado': '#ef4444', 'Não iniciado': '#94a3b8', 'Em espera': '#f59e0b' };
    const ctx1 = document.getElementById('treinStatusChart');
    if (ctx1) {
      new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: (s.por_status || []).map(x => x.status),
          datasets: [{ data: (s.por_status || []).map(x => x.total), backgroundColor: (s.por_status || []).map(x => colors[x.status] || '#6366f1'), borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } } }
      });
    }
    const ctx2 = document.getElementById('treinPriorityChart');
    if (ctx2) {
      const pColors = { 'Alta': '#ef4444', 'Média': '#f59e0b', 'Baixa': '#14b8a6', 'Nenhum': '#94a3b8' };
      const labels = (s.por_prioridade || []).map(x => x.prioridade || 'Nenhum');
      new Chart(ctx2, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Tarefas', data: (s.por_prioridade || []).map(x => x.total), backgroundColor: labels.map(l => pColors[l] || '#6366f1'), borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
      });
    }
  }
};