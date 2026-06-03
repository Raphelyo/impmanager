const MainDashboard = {
  async render() {
    const app = document.getElementById('app');
    try {
      const projetos = await App.api('/projetos');
      app.innerHTML = this.html(projetos);
      if (projetos.length > 0) {
        setTimeout(() => this.renderCharts(projetos), 100);
        projetos.forEach(p => {
          const bar = document.getElementById(`pb-${p.id}`);
          if (bar) setTimeout(() => bar.style.width = `${Math.round(p.progresso_medio || 0)}%`, 200);
        });
      }
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p class="text-danger">${e.message}</p><button class="btn btn-primary mt-4" onclick="MainDashboard.render()">Tentar novamente</button></div>`;
    }
  },

  html(projetos) {
    const total = projetos.length;
    const concluidas = projetos.reduce((s, p) => s + (p.tarefas_concluidas || 0), 0);
    const totalTarefas = projetos.reduce((s, p) => s + (p.total_tarefas || 0), 0);
    const progressoGeral = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

    return `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 class="text-xl font-bold">Visão Geral</h1>
            <p class="text-sm text-muted">${total} projeto${total !== 1 ? 's' : ''} de implantação</p>
          </div>
          <button class="btn btn-primary" onclick="MainDashboard.novoProjeto()">
            <i class="bi bi-plus-lg"></i> Novo Projeto
          </button>
        </div>

        <div class="grid grid-cols-4 mb-6">
          <div class="stat-card">
            <div class="flex items-center gap-3">
              <div class="stat-icon" style="background:rgba(99,102,241,0.1);color:var(--primary)"><i class="bi bi-building"></i></div>
              <div>
                <div class="stat-value">${total}</div>
                <div class="text-xs text-muted">Projetos</div>
              </div>
            </div>
          </div>
          <div class="stat-card">
            <div class="flex items-center gap-3">
              <div class="stat-icon" style="background:rgba(20,184,166,0.1);color:var(--accent)"><i class="bi bi-check-circle"></i></div>
              <div>
                <div class="stat-value">${concluidas}</div>
                <div class="text-xs text-muted">Tarefas Concluídas</div>
              </div>
            </div>
          </div>
          <div class="stat-card">
            <div class="flex items-center gap-3">
              <div class="stat-icon" style="background:rgba(245,158,11,0.1);color:var(--warning)"><i class="bi bi-list-task"></i></div>
              <div>
                <div class="stat-value">${totalTarefas}</div>
                <div class="text-xs text-muted">Total de Tarefas</div>
              </div>
            </div>
          </div>
          <div class="stat-card">
            <div class="flex items-center gap-3">
              <div class="stat-icon" style="background:rgba(139,92,246,0.1);color:var(--secondary)"><i class="bi bi-graph-up"></i></div>
              <div>
                <div class="stat-value">${progressoGeral}%</div>
                <div class="text-xs text-muted">Progresso Geral</div>
              </div>
            </div>
          </div>
        </div>

        ${projetos.length > 0 ? `
        <div class="grid grid-cols-2 mb-6">
          <div class="card p-4">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-bar-chart text-primary"></i> Progresso por Projeto</h3>
            <div class="chart-container"><canvas id="dashChartProgresso"></canvas></div>
          </div>
          <div class="card p-4">
            <h3 class="text-sm font-semibold mb-3 flex items-center gap-2"><i class="bi bi-pie-chart text-primary"></i> Tarefas por Status</h3>
            <div class="chart-container"><canvas id="dashChartStatus"></canvas></div>
          </div>
        </div>
        ` : ''}

        <div class="section-title"><i class="bi bi-building"></i> Projetos</div>
        <div class="grid grid-cols-2">
          ${projetos.length === 0 ? `
          <div class="empty-state" style="grid-column:1/-1">
            <i class="bi bi-folder-plus"></i>
            <p>Nenhum projeto ainda</p>
            <button class="btn btn-primary mt-2" onclick="MainDashboard.novoProjeto()">Criar primeiro projeto</button>
          </div>` : projetos.map(p => this.cardHTML(p)).join('')}
        </div>
      </div>`;
  },

  cardHTML(p) {
    const progress = Math.round(p.progresso_medio || 0);
    const barColor = App.progressColor(progress);
    return `
      <div class="card card-hover" style="cursor:pointer" onclick="App.navigate('/projeto/${p.id}')">
        <div class="card-body">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h3 class="font-semibold text-sm">${App.esc(p.empresa)}</h3>
              <span class="text-xs text-muted">${App.esc(p.nome)}</span>
            </div>
            <span class="badge badge-primary">${p.total_tarefas || 0} tarefas</span>
          </div>
          <div class="flex items-center gap-2 mt-3">
            <div class="progress flex-1" style="height:6px">
              <div class="progress-bar ${barColor}" id="pb-${p.id}" style="width:0%"></div>
            </div>
            <span class="text-xs font-semibold" style="min-width:36px;text-align:right">${progress}%</span>
          </div>
          <div class="flex items-center justify-between mt-2 text-xs text-muted">
            <span><i class="bi bi-check-circle"></i> ${p.tarefas_concluidas || 0}/${p.total_tarefas || 0}</span>
            <span><i class="bi bi-search"></i> ${p.total_analises || 0} análises</span>
          </div>
        </div>
        <div class="card-footer flex justify-between">
          <span class="text-xs text-muted">Criado ${App.formatDate(p.created_at)}</span>
          <i class="bi bi-chevron-right text-xs text-muted"></i>
        </div>
      </div>`;
  },

  renderCharts(projetos) {
    const cores = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];
    const nomes = projetos.map(p => p.empresa);
    const progressos = projetos.map(p => Math.round(p.progresso_medio || 0));

    const ctx1 = document.getElementById('dashChartProgresso');
    if (ctx1) {
      new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: nomes,
          datasets: [{
            label: 'Progresso (%)',
            data: progressos,
            backgroundColor: progressos.map(v => v >= 80 ? '#14b8a6' : v >= 50 ? '#6366f1' : v >= 25 ? '#f59e0b' : '#ef4444'),
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } }
        }
      });
    }

    const ctx2 = document.getElementById('dashChartStatus');
    if (ctx2) {
      const totalConc = projetos.reduce((s, p) => s + (p.tarefas_concluidas || 0), 0);
      const totalPend = projetos.reduce((s, p) => s + ((p.total_tarefas || 0) - (p.tarefas_concluidas || 0)), 0);
      const totalAndamento = projetos.reduce((s, p) => s + 0, 0);

      new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['Concluídas', 'Pendentes'],
          datasets: [{
            data: [totalConc, totalPend],
            backgroundColor: ['#14b8a6', '#e2e8f0'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } }
          }
        }
      });
    }
  },

  novoProjeto() {
    const body = `
      <div class="form-group">
        <label class="form-label">Nome do projeto <span class="text-danger">*</span></label>
        <input class="input" id="modalProjNome" placeholder="Ex: Implantação FrigoMaster">
      </div>
      <div class="form-group">
        <label class="form-label">Empresa <span class="text-danger">*</span></label>
        <input class="input" id="modalProjEmpresa" placeholder="Ex: FrigoMaster Ltda">
      </div>
      <div class="form-group">
        <label class="form-label">Caminho do FDB (opcional)</label>
        <input class="input" id="modalProjFdb" placeholder="D:\\Backups\\CLIENTE.FDB">
      </div>
      <div id="modalProjResult"></div>`;

    const footer = `
      <button class="btn btn-secondary" onclick="App.closeModal('modalNovoProjeto')">Cancelar</button>
      <button class="btn btn-primary" onclick="MainDashboard._criar()"><i class="bi bi-check-lg"></i> Criar</button>`;

    const id = App.modal('Novo Projeto', body, footer);
    if (id) document.getElementById(id).id = 'modalNovoProjeto';
  },

  async _criar() {
    const nome = document.getElementById('modalProjNome')?.value.trim();
    const empresa = document.getElementById('modalProjEmpresa')?.value.trim();
    const fdbPath = document.getElementById('modalProjFdb')?.value.trim() || null;

    if (!nome || !empresa) {
      App.toast('Preencha nome e empresa', 'warning');
      return;
    }

    try {
      const projeto = await App.api('/projetos', {
        method: 'POST',
        body: { nome, empresa, fdb_path: fdbPath }
      });
      App.closeModal('modalNovoProjeto');
      App.toast(`Projeto "${projeto.nome}" criado!`);
      App.navigate(`/projeto/${projeto.id}`);
    } catch (e) {
      App.toast(e.message, 'danger');
    }
  }
};

window.MainDashboard = MainDashboard;
