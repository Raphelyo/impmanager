const express = require('express');
const router = express.Router();
const { getDatabase, saveDatabase } = require('../database');

router.get('/projeto/:projetoId', (req, res) => {
  const db = getDatabase();
  const { macroprocesso_id, status } = req.query;

  let sql = 'SELECT * FROM tarefas WHERE projeto_id = ?';
  const params = [req.params.projetoId];

  if (macroprocesso_id) {
    sql += ' AND macroprocesso_id = ?';
    params.push(macroprocesso_id);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY macroprocesso_id, ordem';

  const tarefas = db.prepare(sql).all(...params);
  const totalTarefas = db.prepare('SELECT COUNT(*) AS total FROM tarefas WHERE projeto_id = ?').get(req.params.projetoId);
  const concluidas = db.prepare("SELECT COUNT(*) AS total FROM tarefas WHERE projeto_id = ? AND status = 'concluido'").get(req.params.projetoId);
  const progresso = db.prepare('SELECT COALESCE(AVG(progresso), 0) AS media FROM tarefas WHERE projeto_id = ?').get(req.params.projetoId);

  res.json({
    tarefas,
    totais: {
      total: totalTarefas.total,
      concluidas: concluidas.total,
      progresso_medio: Math.round(progresso.media)
    }
  });
});

router.post('/projeto/:projetoId', (req, res) => {
  const db = getDatabase();
  const { titulo, descricao, macroprocesso_id, is_template } = req.body;

  if (!titulo) {
    return res.status(400).json({ erro: 'Título é obrigatório' });
  }

  const maxOrdem = db.prepare(
    'SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM tarefas WHERE projeto_id = ?'
  ).get(req.params.projetoId);

  let templateRefId = null;

  // Se marcado como padrão, inserir também em templates_tarefa
  if (is_template) {
    const existing = db.prepare(
      'SELECT id FROM templates_tarefa WHERE titulo = ? AND macroprocesso_id = ?'
    ).get(titulo, macroprocesso_id || null);

    if (existing) {
      templateRefId = existing.id;
    } else {
      const maxOrdemTmpl = db.prepare(
        'SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM templates_tarefa'
      ).get();
      const tmplResult = db.prepare(
        'INSERT INTO templates_tarefa (macroprocesso_id, titulo, descricao, ordem) VALUES (?, ?, ?, ?)'
      ).run(macroprocesso_id || null, titulo, descricao || null, maxOrdemTmpl.max_ordem + 1);
      templateRefId = tmplResult.lastInsertRowid;
    }
  }

  const result = db.prepare(`
    INSERT INTO tarefas (projeto_id, titulo, descricao, macroprocesso_id, status, progresso, ordem, template_ref_id)
    VALUES (?, ?, ?, ?, 'pendente', 0, ?, ?)
  `).run(req.params.projetoId, titulo, descricao || null, macroprocesso_id || null, maxOrdem.max_ordem + 1, templateRefId);

  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tarefa);
});

// --- Rotas de Templates (antes de /:id para evitar conflito) ---

router.get('/templates', (req, res) => {
  const db = getDatabase();
  const templates = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM tarefas tr WHERE tr.template_ref_id = t.id) AS projetos_vinculados
    FROM templates_tarefa t
    ORDER BY t.macroprocesso_id, t.ordem
  `).all();
  res.json(templates);
});

router.post('/templates', (req, res) => {
  const db = getDatabase();
  const { titulo, descricao, macroprocesso_id } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título é obrigatório' });

  const maxOrdem = db.prepare('SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM templates_tarefa').get();
  const result = db.prepare(
    'INSERT INTO templates_tarefa (macroprocesso_id, titulo, descricao, ordem) VALUES (?, ?, ?, ?)'
  ).run(macroprocesso_id || null, titulo, descricao || null, maxOrdem.max_ordem + 1);

  const tmpl = db.prepare('SELECT * FROM templates_tarefa WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tmpl);
});

router.put('/templates/:id', (req, res) => {
  const db = getDatabase();
  const tmpl = db.prepare('SELECT * FROM templates_tarefa WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ erro: 'Template não encontrado' });

  const { titulo, descricao, macroprocesso_id } = req.body;
  db.prepare(`
    UPDATE templates_tarefa SET
      titulo = COALESCE(?, titulo),
      descricao = COALESCE(?, descricao),
      macroprocesso_id = COALESCE(?, macroprocesso_id)
    WHERE id = ?
  `).run(titulo || null, descricao ?? null, macroprocesso_id != null ? macroprocesso_id : null, req.params.id);

  const updated = db.prepare('SELECT * FROM templates_tarefa WHERE id = ?').get(req.params.id);
  saveDatabase();
  res.json(updated);
});

router.delete('/templates/:id', (req, res) => {
  const db = getDatabase();
  const tmpl = db.prepare('SELECT * FROM templates_tarefa WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ erro: 'Template não encontrado' });

  // Desvincula tarefas que referenciam este template
  db.prepare('UPDATE tarefas SET template_ref_id = NULL WHERE template_ref_id = ?').run(req.params.id);
  db.prepare('DELETE FROM templates_tarefa WHERE id = ?').run(req.params.id);
  saveDatabase();
  res.json({ mensagem: 'Template removido' });
});

router.get('/:id', (req, res) => {
  const db = getDatabase();
  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(req.params.id);
  if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada' });
  res.json(tarefa);
});

router.put('/:id', (req, res) => {
  const db = getDatabase();
  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(req.params.id);
  if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada' });

  const { titulo, descricao, status, progresso } = req.body;

  db.prepare(`
    UPDATE tarefas SET
      titulo = COALESCE(?, titulo),
      descricao = COALESCE(?, descricao),
      status = COALESCE(?, status),
      progresso = COALESCE(?, progresso),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(titulo || null, descricao || null, status || null, progresso != null ? progresso : null, req.params.id);

  const updated = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(req.params.id);

  db.prepare('UPDATE projetos SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(tarefa.projeto_id);

  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(req.params.id);
  if (!tarefa) return res.status(404).json({ erro: 'Tarefa não encontrada' });

  // Se solicitou remover também dos templates
  if (req.query.remove_template === 'true' && tarefa.template_ref_id) {
    db.prepare('DELETE FROM templates_tarefa WHERE id = ?').run(tarefa.template_ref_id);
  }

  db.prepare('DELETE FROM tarefas WHERE id = ?').run(req.params.id);
  db.prepare('UPDATE projetos SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(tarefa.projeto_id);

  res.json({ mensagem: 'Tarefa removida' });
});

router.put('/reordenar/:projetoId', (req, res) => {
  const db = getDatabase();
  const { ordens } = req.body;

  if (!Array.isArray(ordens)) {
    return res.status(400).json({ erro: 'Lista de ordens é obrigatória' });
  }

  const update = db.prepare('UPDATE tarefas SET ordem = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  db.run('BEGIN');
  try {
    for (const item of ordens) {
      update.run(item.ordem, item.id);
    }
    db.run('COMMIT');
    saveDatabase();
    res.json({ mensagem: 'Ordens atualizadas' });
  } catch (e) {
    db.run('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao reordenar tarefas' });
  }
});

module.exports = router;
