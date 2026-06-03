const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDatabase, saveDatabase, copyTreinamentosTemplates } = require('../database');

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = '/data/uploads/logos';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${req.params.id}_${Date.now()}${ext}`);
  }
});
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const db = getDatabase();
  const projetos = db.prepare(`
    SELECT p.*,
      (SELECT COALESCE(AVG(t.progresso), 0) FROM tarefas t WHERE t.projeto_id = p.id) AS progresso_medio,
      (SELECT COUNT(*) FROM tarefas t WHERE t.projeto_id = p.id) AS total_tarefas,
      (SELECT COUNT(*) FROM tarefas t WHERE t.projeto_id = p.id AND t.status = 'concluido') AS tarefas_concluidas,
      (SELECT COUNT(*) FROM analises_fdb a WHERE a.projeto_id = p.id) AS total_analises
    FROM projetos p
    ORDER BY p.updated_at DESC
  `).all();

  res.json(projetos);
});

router.get('/:id', (req, res) => {
  const db = getDatabase();
  const projeto = db.prepare(`
    SELECT p.*,
      (SELECT COALESCE(AVG(t.progresso), 0) FROM tarefas t WHERE t.projeto_id = p.id) AS progresso_medio,
      (SELECT COUNT(*) FROM tarefas t WHERE t.projeto_id = p.id) AS total_tarefas,
      (SELECT COUNT(*) FROM tarefas t WHERE t.projeto_id = p.id AND t.status = 'concluido') AS tarefas_concluidas
    FROM projetos p WHERE p.id = ?
  `).get(req.params.id);

  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' });
  res.json(projeto);
});

router.post('/', (req, res) => {
  const db = getDatabase();
  const { nome, empresa, fdb_path } = req.body;

  if (!nome || !empresa) {
    return res.status(400).json({ erro: 'Nome e empresa são obrigatórios' });
  }

  const result = db.prepare(
    'INSERT INTO projetos (nome, empresa, fdb_path) VALUES (?, ?, ?)'
  ).run(nome, empresa, fdb_path || null);

  const projetoId = result.lastInsertRowid;

  // Copiar templates de tarefas para o projeto (com transação manual)
  const templates = db.prepare('SELECT * FROM templates_tarefa ORDER BY macroprocesso_id, ordem').all();
  const insertTarefa = db.prepare(
    'INSERT INTO tarefas (projeto_id, titulo, descricao, macroprocesso_id, status, progresso, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  db.run('BEGIN');
  try {
    for (const t of templates) {
      insertTarefa.run(projetoId, t.titulo, t.descricao, t.macroprocesso_id, 'pendente', 0, t.ordem);
    }
    db.run('COMMIT');
    saveDatabase();
  } catch (e) {
    db.run('ROLLBACK');
    db.prepare('DELETE FROM projetos WHERE id = ?').run(projetoId);
    return res.status(500).json({ erro: 'Erro ao criar tarefas padrão' });
  }

  // Copiar templates de treinamento para o projeto
  copyTreinamentosTemplates(projetoId);
  saveDatabase();

  // Análise automática se tiver FDB (assíncrona)
  if (fdb_path) {
    const { executarQueries, getDatabaseInfo } = require('../services/firebird-connector');
    const { carregarQueries } = require('../services/analisador-queries');
    const { gerarRelatorio } = require('../services/analisador-report');

    executarQueries(fdb_path, carregarQueries())
      .then(async ({ resultados, erros }) => {
        try {
          const info = await getDatabaseInfo(fdb_path);
          let totalTabelas = 0;
          const tabelaResult = resultados.find(r => r.id === 'E9');
          if (tabelaResult && tabelaResult.dados[0]) {
            totalTabelas = parseInt(tabelaResult.dados[0].TOTAL || tabelaResult.dados[0].total || 0);
          }
          const relatorio = gerarRelatorio(resultados, erros, info, totalTabelas);
          const db2 = getDatabase();
          db2.prepare(`
            INSERT INTO analises_fdb (projeto_id, caminho_fdb, tamanho_fdb, total_tabelas, resultado_json, alertas_json, resumo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(projetoId, fdb_path, info.tamanho_bytes, totalTabelas,
            JSON.stringify(relatorio), JSON.stringify(relatorio.alertas), relatorio.resumo_texto);
          db2.prepare('UPDATE projetos SET fdb_ultima_analise = CURRENT_TIMESTAMP WHERE id = ?').run(projetoId);
          saveDatabase();
        } catch (e) {
          console.error('[AutoAnalise] Erro relatorio:', e.message);
        }
      })
      .catch(err => {
        console.error('[AutoAnalise] Erro conexao:', err.message);
      });
  }

  const projeto = db.prepare('SELECT * FROM projetos WHERE id = ?').get(projetoId);
  res.status(201).json(projeto);
});

router.put('/:id', (req, res) => {
  const db = getDatabase();
  const { nome, empresa, fdb_path } = req.body;
  const projeto = db.prepare('SELECT * FROM projetos WHERE id = ?').get(req.params.id);
  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' });

  db.prepare(`
    UPDATE projetos SET nome = COALESCE(?, nome), empresa = COALESCE(?, empresa),
    fdb_path = COALESCE(?, fdb_path), updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(nome || null, empresa || null, fdb_path || null, req.params.id);

  const updated = db.prepare('SELECT * FROM projetos WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.post('/:id/logo', uploadLogo.single('logo'), (req, res) => {
  const db = getDatabase();
  const projeto = db.prepare('SELECT * FROM projetos WHERE id = ?').get(req.params.id);
  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' });
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const logo_path = req.file.filename;
  db.prepare('UPDATE projetos SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(logo_path, req.params.id);

  res.json({ logo_path });
});

router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const projeto = db.prepare('SELECT * FROM projetos WHERE id = ?').get(req.params.id);
  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' });

  db.prepare('DELETE FROM projetos WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Projeto removido' });
});

module.exports = router;
