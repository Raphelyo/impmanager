const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');

function projetoFilter(req) {
  const projeto_id = req.query.projeto_id;
  if (!projeto_id) return { sql: '', params: [] };
  return { sql: ' AND projeto_id = ?', params: [parseInt(projeto_id)] };
}

// GET /api/treinamentos/tasks/tree - árvore hierárquica
router.get('/tasks/tree', (req, res) => {
  const db = getDatabase();
  const pf = projetoFilter(req);
  const tasks = db.prepare(`SELECT * FROM treinamentos_tasks WHERE 1=1${pf.sql} ORDER BY ordem, codigo`).all(...pf.params);
  res.json(tasks);
});

// GET /api/treinamentos/tasks - lista plana com filtros
router.get('/tasks', (req, res) => {
  const db = getDatabase();
  const { status, nivel, search } = req.query;
  const pf = projetoFilter(req);
  let sql = `SELECT * FROM treinamentos_tasks WHERE 1=1${pf.sql}`;
  const params = [...pf.params];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (nivel) { sql += ' AND nivel = ?'; params.push(parseInt(nivel)); }
  if (search) { sql += ' AND (titulo LIKE ? OR codigo LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY ordem, codigo';
  const tasks = db.prepare(sql).all(...params);

  const totais = db.prepare(`SELECT status, COUNT(*) AS total FROM treinamentos_tasks WHERE 1=1${pf.sql} GROUP BY status`).all(...pf.params);

  res.json({ tasks, totais });
});

// GET /api/treinamentos/tasks/stats - estatísticas
router.get('/tasks/stats', (req, res) => {
  const db = getDatabase();
  const pf = projetoFilter(req);
  const stats = {
    por_status: db.prepare(`SELECT status, COUNT(*) AS total FROM treinamentos_tasks WHERE 1=1${pf.sql} GROUP BY status ORDER BY total DESC`).all(...pf.params),
    por_nivel: db.prepare(`SELECT nivel, COUNT(*) AS total FROM treinamentos_tasks WHERE 1=1${pf.sql} GROUP BY nivel ORDER BY nivel`).all(...pf.params),
    por_prioridade: db.prepare(`SELECT prioridade, COUNT(*) AS total FROM treinamentos_tasks WHERE 1=1${pf.sql} GROUP BY prioridade`).all(...pf.params),
    resumo: db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) AS concluidas,
        SUM(CASE WHEN status = 'Cancelado' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN status = 'Não iniciado' THEN 1 ELSE 0 END) AS nao_iniciadas,
        SUM(CASE WHEN status = 'Em espera' THEN 1 ELSE 0 END) AS em_espera
      FROM treinamentos_tasks WHERE 1=1${pf.sql}
    `).get(...pf.params)
  };
  res.json(stats);
});

// GET /api/treinamentos/tasks/:id
router.get('/tasks/:id', (req, res) => {
  const db = getDatabase();
  const pf = projetoFilter(req);
  const task = db.prepare(`SELECT * FROM treinamentos_tasks WHERE id = ?${pf.sql}`).get(req.params.id, ...pf.params);
  if (!task) return res.status(404).json({ erro: 'Task não encontrada' });
  const children = db.prepare(`SELECT * FROM treinamentos_tasks WHERE parent_id = ?${pf.sql} ORDER BY ordem, codigo`).all(req.params.id, ...pf.params);
  const notes = db.prepare('SELECT * FROM treinamentos_notes WHERE task_id = ? ORDER BY updated_at DESC').all(req.params.id);
  const materiais = db.prepare('SELECT * FROM treinamentos_materiais WHERE task_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ ...task, children, notes, materiais });
});

// PUT /api/treinamentos/tasks/:id - atualizar task
router.put('/tasks/:id', (req, res) => {
  const db = getDatabase();
  const task = db.prepare('SELECT * FROM treinamentos_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ erro: 'Task não encontrada' });

  const { status, responsavel, prioridade, data_inicio, data_fim, duracao } = req.body;
  db.prepare(`
    UPDATE treinamentos_tasks SET
      status = COALESCE(?, status),
      responsavel = COALESCE(?, responsavel),
      prioridade = COALESCE(?, prioridade),
      data_inicio = COALESCE(?, data_inicio),
      data_fim = COALESCE(?, data_fim),
      duracao = COALESCE(?, duracao),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status || null, responsavel || null, prioridade || null,
    data_inicio || null, data_fim || null, duracao || null, req.params.id);

  const updated = db.prepare('SELECT * FROM treinamentos_tasks WHERE id = ?').get(req.params.id);
  saveDatabase();
  res.json(updated);
});

// POST /api/treinamentos/tasks/:id/notes - criar/atualizar nota
router.post('/tasks/:id/notes', (req, res) => {
  const db = getDatabase();
  const { conteudo } = req.body;
  if (conteudo === undefined) return res.status(400).json({ erro: 'Conteúdo é obrigatório' });

  const existing = db.prepare('SELECT * FROM treinamentos_notes WHERE task_id = ?').get(req.params.id);
  if (existing) {
    db.prepare('UPDATE treinamentos_notes SET conteudo = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?')
      .run(conteudo, req.params.id);
  } else {
    db.prepare('INSERT INTO treinamentos_notes (task_id, conteudo) VALUES (?, ?)')
      .run(req.params.id, conteudo);
  }
  const note = db.prepare('SELECT * FROM treinamentos_notes WHERE task_id = ?').get(req.params.id);
  saveDatabase();
  res.json(note);
});

// POST /api/treinamentos/tasks/:id/materiais - adicionar material
router.post('/tasks/:id/materiais', (req, res) => {
  const db = getDatabase();
  const { tipo, url, descricao } = req.body;
  if (!url) return res.status(400).json({ erro: 'URL é obrigatória' });

  const result = db.prepare('INSERT INTO treinamentos_materiais (task_id, tipo, url, descricao) VALUES (?, ?, ?, ?)')
    .run(req.params.id, tipo || 'link', url, descricao || null);
  const material = db.prepare('SELECT * FROM treinamentos_materiais WHERE id = ?').get(result.lastInsertRowid);
  saveDatabase();
  res.status(201).json(material);
});

// DELETE /api/treinamentos/materiais/:id
router.delete('/materiais/:id', (req, res) => {
  const db = getDatabase();
  db.prepare('DELETE FROM treinamentos_materiais WHERE id = ?').run(req.params.id);
  saveDatabase();
  res.json({ mensagem: 'Material removido' });
});

module.exports = router;
