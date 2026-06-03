const express = require('express');
const path = require('path');
const { initDatabase, startAutoSave } = require('./database');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static('/data/uploads'));

  console.log('[Server] Inicializando banco de dados...');
  await initDatabase();
  startAutoSave();
  console.log('[Server] SQLite pronto');

  // Rotas
  app.use('/api/projetos', require('./routes/projetos'));
  app.use('/api/tarefas', require('./routes/tarefas'));
  app.use('/api', require('./routes/analisador'));
  app.use('/api/treinamentos', require('./routes/treinamentos'));

  // SPA fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ erro: 'Rota não encontrada' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('[Server] Erro:', err.message);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Rodando em http://localhost:${PORT}`);
    console.log('[Server] Acessível na rede local também');
  });
}

startServer().catch(err => {
  console.error('[Server] Falha ao iniciar:', err);
  process.exit(1);
});
