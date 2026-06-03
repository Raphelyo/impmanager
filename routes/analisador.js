const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const { executarQueries, getDatabaseInfo } = require('../services/firebird-connector');
const { carregarQueries } = require('../services/analisador-queries');
const { gerarRelatorio } = require('../services/analisador-report');

// Analisar FDB (disparo manual)
router.post('/analisar/:projetoId', async (req, res) => {
  const db = getDatabase();
  const projeto = db.prepare('SELECT * FROM projetos WHERE id = ?').get(req.params.projetoId);
  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' });

  const fdbPath = req.body.fdb_path || projeto.fdb_path;
  if (!fdbPath) {
    return res.status(400).json({ erro: 'Caminho do FDB não informado. Defina no projeto ou envie no body.' });
  }

  try {
    const queries = carregarQueries();
    const { resultados, erros } = await executarQueries(fdbPath, queries);
    const info = await getDatabaseInfo(fdbPath);

    let totalTabelas = 0;
    const tabelaResult = resultados.find(r => r.id === 'E9');
    if (tabelaResult && tabelaResult.dados[0]) {
      totalTabelas = parseInt(tabelaResult.dados[0].TOTAL || tabelaResult.dados[0].total || 0);
    }

    const relatorio = gerarRelatorio(resultados, erros, info, totalTabelas);

    // Salvar no banco
    db.prepare(`
      INSERT INTO analises_fdb (projeto_id, caminho_fdb, tamanho_fdb, total_tabelas, resultado_json, alertas_json, resumo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.projetoId, fdbPath, info.tamanho_bytes, totalTabelas,
      JSON.stringify(relatorio), JSON.stringify(relatorio.alertas), relatorio.resumo_texto);

    db.prepare('UPDATE projetos SET fdb_path = COALESCE(?, fdb_path), fdb_ultima_analise = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(fdbPath, req.params.projetoId);

    res.json({
      mensagem: 'Análise concluída',
      analise_id: db.prepare('SELECT last_insert_rowid() AS id').get().id,
      relatorio: {
        ...relatorio,
        resultados: relatorio.resultados.slice(0, 5), // só primeiros 5 no resumo
        alertas: relatorio.alertas,
        resumo_por_categoria: relatorio.resumo_por_categoria,
        score_geral: relatorio.score_geral,
        resumo_texto: relatorio.resumo_texto
      }
    });
  } catch (err) {
    res.status(500).json({ erro: `Erro ao analisar FDB: ${err.message}` });
  }
});

// Listar análises de um projeto
router.get('/analises/:projetoId', (req, res) => {
  const db = getDatabase();
  const analises = db.prepare(`
    SELECT id, projeto_id, data_analise, caminho_fdb, tamanho_fdb, total_tabelas, resumo
    FROM analises_fdb WHERE projeto_id = ?
    ORDER BY data_analise DESC
  `).all(req.params.projetoId);

  res.json(analises);
});

// Obter análise específica (completa)
router.get('/analise/:analiseId', (req, res) => {
  const db = getDatabase();
  const analise = db.prepare('SELECT * FROM analises_fdb WHERE id = ?').get(req.params.analiseId);
  if (!analise) return res.status(404).json({ erro: 'Análise não encontrada' });

  analise.resultado_json = JSON.parse(analise.resultado_json || '{}');
  analise.alertas_json = JSON.parse(analise.alertas_json || '[]');

  res.json(analise);
});

// Verificar conexão Firebird (testar antes de analisar)
router.post('/testar-conexao', async (req, res) => {
  const { fdb_path } = req.body;
  if (!fdb_path) return res.status(400).json({ erro: 'Caminho do FDB é obrigatório' });

  try {
    const info = await getDatabaseInfo(fdb_path);
    const { connect, close, query } = require('../services/firebird-connector');
    const db_fdb = await connect(fdb_path);
    const rows = await query(db_fdb, 'SELECT COUNT(*) AS total FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_TYPE = 0');
    await close(db_fdb);

    const totalTabelas = rows[0]?.TOTAL || rows[0]?.total || 0;

    res.json({
      conectado: true,
      info,
      total_tabelas: totalTabelas
    });
  } catch (err) {
    res.status(500).json({ conectado: false, erro: err.message });
  }
});

// Upload de arquivo FDB
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = '/data/uploads/fdb';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const projetoId = req.params.projetoId || 'temp';
    const ext = path.extname(file.originalname) || '.fdb';
    cb(null, `${projetoId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.fdb', '.gdb', '.fbk'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .FDB, .GDB ou .FBK são permitidos'));
    }
  }
});

router.post('/upload/:projetoId', upload.single('fdb'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const db = getDatabase();
  const projeto = db.prepare('SELECT * FROM projetos WHERE id = ?').get(req.params.projetoId);
  if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' });

  const fdbPath = path.resolve(req.file.path);
  db.prepare('UPDATE projetos SET fdb_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(fdbPath, req.params.projetoId);

  res.json({
    mensagem: 'FDB enviado com sucesso',
    fdb_path: fdbPath
  });
});

module.exports = router;
