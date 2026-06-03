const App = {
  route: null,

  init() {
    window.addEventListener('hashchange', () => this.router());
    this.router();
  },

  router() {
    const hash = window.location.hash.replace('#', '') || '/';
    this.route = hash;

    if (hash === '/') {
      this.setPageTitle('Dashboard', 'speedometer2');
      this.renderView(() => MainDashboard.render());
    } else if (hash.startsWith('/projeto/') && hash.includes('/treinamentos')) {
      this._routeProjetoTreinamentos(hash);
    } else if (hash.startsWith('/projeto/')) {
      const id = parseInt(hash.split('/')[2]);
      if (id) {
        this.setPageTitle('Projeto', 'building');
        this.renderView(() => Projeto.render(id));
      } else this.navigate('/');
    } else if (hash === '/treinamentos') {
      this.setPageTitle('Treinamentos', 'book');
      this.renderView(() => TreinDashboard.render());
    } else if (hash === '/treinamentos/tree') {
      this.setPageTitle('Árvore de Treinamentos', 'diagram-3');
      this.renderView(() => TreinTree.render());
    } else if (hash.startsWith('/treinamentos/task/')) {
      const id = parseInt(hash.split('/')[3]);
      if (id) {
        this.setPageTitle('Tarefa', 'file-text');
        this.renderView(() => TreinTask.render(id));
      } else this.navigate('/treinamentos');
    } else if (hash === '/treinamentos/study') {
      this.setPageTitle('Modo Estudo', 'eyeglasses');
      this.renderView(() => TreinStudy.render());
    } else if (hash === '/projetos') {
      this.setPageTitle('Projetos', 'building');
      this.renderView(() => ProjetosList.render());
    } else if (hash === '/templates') {
      this.setPageTitle('Templates', 'clipboard-data');
      this.renderView(() => TemplatesManager.render());
    } else {
      this.navigate('/');
    }
  },

  _routeProjetoTreinamentos(hash) {
    const parts = hash.split('/');
    const projetoId = parseInt(parts[2]);
    if (!projetoId) { this.navigate('/'); return; }
    const subroute = parts.slice(4).join('/');

    if (!subroute || subroute === '/') {
      this.setPageTitle('Treinamentos', 'book');
      this.renderView(() => TreinDashboard.render(projetoId));
    } else if (subroute === '/tree') {
      this.setPageTitle('Árvore de Treinamentos', 'diagram-3');
      this.renderView(() => TreinTree.render(projetoId));
    } else if (subroute.startsWith('/task/')) {
      const taskId = parseInt(subroute.split('/')[2]);
      if (taskId) {
        this.setPageTitle('Tarefa', 'file-text');
        this.renderView(() => TreinTask.render(taskId, projetoId));
      } else this.navigate(`/projeto/${projetoId}/treinamentos`);
    } else if (subroute === '/study') {
      this.setPageTitle('Modo Estudo', 'eyeglasses');
      this.renderView(() => TreinStudy.render(projetoId));
    } else {
      this.navigate(`/projeto/${projetoId}/treinamentos`);
    }
  },

  setPageTitle(title, icon) {
    document.title = `${title} - Sistec Implantação`;
    const el = document.getElementById('pageTitle');
    if (el) el.innerHTML = `<i class="bi bi-${icon}"></i> ${title}`;
  },

  renderView(fn) {
    const app = document.getElementById('app');
    app.innerHTML = `<div class="flex items-center justify-center py-20"><i class="bi bi-arrow-repeat text-3xl text-primary spin"></i></div>`;
    setTimeout(() => {
      try { fn(); } catch (e) {
        app.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle text-danger"></i><p class="text-danger">${e.message}</p></div>`;
      }
    }, 50);
  },

  navigate(hash) { window.location.hash = hash; },

  async api(path, opts = {}) {
    const url = `/api${path}`;
    const cfg = { headers: { 'Content-Type': 'application/json' }, ...opts };
    if (opts.body) cfg.body = JSON.stringify(opts.body);
    const res = await fetch(url, cfg);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ erro: res.statusText }));
      throw new Error(err.erro || 'Erro na requisição');
    }
    return res.json();
  },

  toast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    el.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i> ${msg}`;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
  },

  Badge(status) {
    const m = {
      'Concluído': 'badge-emerald', 'Cancelado': 'badge-red',
      'Não iniciado': 'badge-slate', 'Em espera': 'badge-amber',
      'pendente': 'badge-slate', 'andamento': 'badge-sky',
      'concluido': 'badge-emerald', 'falhou': 'badge-red'
    };
    return `<span class="badge ${m[status] || 'badge-muted'}">${status}</span>`;
  },

  Priority(p) {
    const m = { 'Alta': 'text-danger', 'Média': 'text-warning', 'Baixa': 'text-success' };
    return `<span class="text-xs font-medium ${m[p] || 'text-muted-light'}"><i class="bi bi-flag-fill"></i> ${p || 'Nenhum'}</span>`;
  },

  esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

  date(d) { return d || '—'; },

  progressColor(v) {
    if (v >= 80) return 'progress-bar-accent';
    if (v >= 50) return 'progress-bar-primary';
    if (v >= 25) return 'progress-bar-warning';
    return 'progress-bar-danger';
  },

  formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'Z');
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  modal(title, bodyHTML, footerHTML) {
    const id = 'modal-' + Date.now();
    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.id = id;
    div.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="App.closeModal('${id}')">&times;</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>`;
    document.body.appendChild(div);
    div.addEventListener('click', (e) => { if (e.target === div) App.closeModal(id); });
    return id;
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.remove(); }
  }
};
