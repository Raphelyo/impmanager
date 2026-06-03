const ProjetosList = {
  async render() {
    const app = document.getElementById('app');
    try {
      const projetos = await App.api('/projetos');
      app.innerHTML = this.html(projetos);
    } catch (e) {
      app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p>${e.message}</p><button class="btn btn-primary mt-2" onclick="ProjetosList.render()">Tentar novamente</button></div>`;
    }
  },

  html(projetos) {
    const nomesMacroMap = { 0: 'Sem macro', 1: 'Cadastro', 2: 'Fiscal', 3: 'Produtos', 4: 'Abate', 5: 'Desossa', 6: 'Câmaras', 7: 'Embalagens', 8: 'Mercados', 9: 'Metas', 10: 'Precificação', 11: 'Produção', 12: 'Expedição', 13: 'Financeiro', 14: 'Comex', 15: 'Go-Live' };

    return `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-xl font-bold">Projetos</h1>
            <p class="text-sm text-muted">${projetos.length} projeto${projetos.length !== 1 ? 's' : ''} cadastrado${projetos.length !== 1 ? 's' : ''}</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="MainDashboard.novoProjeto()"><i class="bi bi-plus-lg"></i> Novo Projeto</button>
        </div>

        ${projetos.length === 0 ? `
        <div class="empty-state">
          <i class="bi bi-folder-plus"></i>
          <p>Nenhum projeto cadastrado</p>
          <button class="btn btn-primary mt-2" onclick="MainDashboard.novoProjeto()">Criar primeiro projeto</button>
        </div>` : `
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Projeto</th>
                <th>Progresso</th>
                <th>Tarefas</th>
                <th>Análises</th>
                <th>Criado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${projetos.map(p => {
                const progress = Math.round(p.progresso_medio || 0);
                const barColor = App.progressColor(progress);
                return `
                <tr class="clickable" onclick="App.navigate('/projeto/${p.id}')">
                  <td><span class="font-medium">${App.esc(p.empresa)}</span></td>
                  <td><span class="text-xs text-muted">${App.esc(p.nome)}</span></td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="progress" style="width:80px;height:6px"><div class="progress-bar ${barColor}" style="width:${progress}%"></div></div>
                      <span class="text-xs font-medium">${progress}%</span>
                    </div>
                  </td>
                  <td><span class="badge badge-primary">${p.tarefas_concluidas || 0}/${p.total_tarefas || 0}</span></td>
                  <td><span class="text-xs text-muted">${p.total_analises || 0}</span></td>
                  <td><span class="text-xs text-muted">${App.formatDate(p.created_at)}</span></td>
                  <td><i class="bi bi-chevron-right text-muted"></i></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}
      </div>`;
  }
};
