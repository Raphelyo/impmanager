const path = require('path');
const fs = require('fs');

const DB_PATH = '/data/db/sistec_implantacao.db';
let db = null;
let SQL = null;

function createWrapper(sqlDb) {
  return {
    prepare(sql) {
      let currentStmt = null;
      function prep() {
        if (currentStmt) try { currentStmt.free(); } catch (e) {}
        currentStmt = sqlDb.prepare(sql);
        return currentStmt;
      }
      return {
        all(...params) {
          const s = prep();
          if (params.length) s.bind(params);
          const rows = [];
          while (s.step()) rows.push(s.getAsObject());
          s.free(); currentStmt = null;
          return rows;
        },
        get(...params) {
          const s = prep();
          if (params.length) s.bind(params);
          let row = null;
          if (s.step()) row = s.getAsObject();
          s.free(); currentStmt = null;
          return row;
        },
        run(...params) {
          const s = prep();
          if (params.length) s.bind(params);
          s.step();
          const changes = sqlDb.getRowsModified();
          const idResult = sqlDb.exec('SELECT last_insert_rowid() AS id');
          s.free(); currentStmt = null;
          return {
            lastInsertRowid: idResult[0]?.values[0][0] || 0,
            changes
          };
        }
      };
    },
    exec(sql) { return sqlDb.exec(sql); },
    run(sql, params) {
      if (params) sqlDb.run(sql, params);
      else sqlDb.exec(sql);
      return { changes: sqlDb.getRowsModified(), lastInsertRowid: 0 };
    },
    getRowsModified() { return sqlDb.getRowsModified(); },
    close() { sqlDb.close(); },
    save() { fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export())); }
  };
}

async function initDatabase() {
  if (db) return db;

  if (!SQL) {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  }

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
    console.log('[DB] Banco existente carregado');
  } else {
    sqlDb = new SQL.Database();
    console.log('[DB] Novo banco criado em memória');
  }

  db = createWrapper(sqlDb);
  db.run('PRAGMA foreign_keys = ON');

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='projetos'"
  ).get();

  if (!tables) {
    console.log('[DB] Inicializando schema...');
    initSchema();
    seedTemplates();
    seedTestes();
    db.save();
    console.log('[DB] Schema criado e salvo em disco');
  } else {
    // Migração: criar tabelas de treinamentos se não existirem (para bancos existentes)
    migrateTreinamentos();
    migrateTarefasTemplate();
    db.save();
  }

  return db;
}

function migrateTreinamentos() {
  const hasTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='treinamentos_tasks'"
  ).get();

  if (!hasTable) {
    console.log('[DB] Migração: criando tabelas de treinamentos...');
    db.exec(`
      CREATE TABLE treinamentos_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
        codigo TEXT NOT NULL,
        titulo TEXT NOT NULL,
        parent_id INTEGER,
        nivel INTEGER NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pendente',
        responsavel TEXT,
        data_inicio TEXT,
        data_fim TEXT,
        duracao TEXT,
        prioridade TEXT DEFAULT 'Nenhum',
        ordem INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES treinamentos_tasks(id) ON DELETE SET NULL
      );
      CREATE TABLE treinamentos_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        conteudo TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES treinamentos_tasks(id) ON DELETE CASCADE
      );
      CREATE TABLE treinamentos_materiais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        tipo TEXT DEFAULT 'link',
        url TEXT,
        descricao TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES treinamentos_tasks(id) ON DELETE CASCADE
      );
    `);
    console.log('[DB] Migração de treinamentos concluída');
    return;
  }

  // Migração v2: adicionar projeto_id se não existir
  const cols = db.prepare("PRAGMA table_info(treinamentos_tasks)").all();
  const hasProjetoId = cols.some(c => c.name === 'projeto_id');
  if (!hasProjetoId) {
    console.log('[DB] Migração v2: adicionando projeto_id...');
    db.run("ALTER TABLE treinamentos_tasks ADD COLUMN projeto_id INTEGER NOT NULL DEFAULT 0");
    db.run("DELETE FROM treinamentos_tasks WHERE projeto_id = 0");
    console.log('[DB] Dados globais de treinamentos removidos');
  }
}

function migrateTarefasTemplate() {
  const cols = db.prepare("PRAGMA table_info(tarefas)").all();
  const hasRef = cols.some(c => c.name === 'template_ref_id');
  if (!hasRef) {
    console.log('[DB] Migração v3: adicionando template_ref_id em tarefas...');
    db.run("ALTER TABLE tarefas ADD COLUMN template_ref_id INTEGER DEFAULT NULL REFERENCES templates_tarefa(id) ON DELETE SET NULL");
    console.log('[DB] Migração v3 concluída');
  }
}

function copyTreinamentosTemplates(projetoId) {
  const seedPath = path.join(__dirname, 'data', 'seed.json');
  if (!fs.existsSync(seedPath)) {
    console.log('[DB] seed.json não encontrado, pulando cópia de treinamentos');
    return;
  }

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const tasks = JSON.parse(raw);

  const insert = db.prepare(`
    INSERT INTO treinamentos_tasks (projeto_id, codigo, titulo, parent_id, nivel, status, responsavel, data_inicio, data_fim, duracao, prioridade, ordem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const idMap = {};

  db.run('BEGIN');
  try {
    for (const t of tasks) {
      const parentId = t.parent_codigo ? idMap[t.parent_codigo] : null;
      const result = insert.run(
        projetoId, t.codigo, t.titulo, parentId, t.nivel,
        'Não iniciado', null, null, null, null,
        t.prioridade || 'Nenhum', t.ordem || 0
      );
      idMap[t.codigo] = result.lastInsertRowid;
    }
    db.run('COMMIT');
    console.log(`[DB] ${tasks.length} treinamentos copiados para projeto ${projetoId}`);
  } catch (e) {
    db.run('ROLLBACK');
    console.error('[DB] Erro ao copiar treinamentos:', e.message);
  }
}

function getDatabase() {
  if (!db) throw new Error('Database not initialized yet');
  return db;
}

function saveDatabase() {
  if (db) try { db.save(); } catch (e) { console.error('[DB] Erro ao salvar:', e.message); }
}

let saveInterval = null;
function startAutoSave() {
  if (saveInterval) clearInterval(saveInterval);
  saveInterval = setInterval(() => saveDatabase(), 30000);
}

process.on('SIGINT', () => {
  if (saveInterval) clearInterval(saveInterval);
  saveDatabase();
  console.log('[DB] Banco salvo. Encerrando.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (saveInterval) clearInterval(saveInterval);
  saveDatabase();
  process.exit(0);
});

function initSchema() {
  db.exec(`
    CREATE TABLE projetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      empresa TEXT NOT NULL,
      logo_path TEXT,
      fdb_path TEXT,
      fdb_ultima_analise DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE templates_tarefa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      macroprocesso_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      ordem INTEGER
    );
    CREATE TABLE tarefas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      macroprocesso_id INTEGER,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','andamento','concluido')),
      progresso INTEGER DEFAULT 0 CHECK(progresso >= 0 AND progresso <= 100),
      ordem INTEGER,
      template_ref_id INTEGER DEFAULT NULL REFERENCES templates_tarefa(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
    );
    CREATE TABLE analises_fdb (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL,
      data_analise DATETIME DEFAULT CURRENT_TIMESTAMP,
      caminho_fdb TEXT,
      tamanho_fdb INTEGER,
      total_tabelas INTEGER,
      resultado_json TEXT,
      alertas_json TEXT,
      resumo TEXT,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
    );
    CREATE TABLE testes_implantacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL,
      test_id INTEGER NOT NULL,
      test_nome TEXT,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','andamento','concluido','falhou')),
      resultado_json TEXT,
      data_execucao DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE
    );
    CREATE TABLE treinamentos_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      codigo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      parent_id INTEGER,
      nivel INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      responsavel TEXT,
      data_inicio TEXT,
      data_fim TEXT,
      duracao TEXT,
      prioridade TEXT DEFAULT 'Nenhum',
      ordem INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES treinamentos_tasks(id) ON DELETE SET NULL
    );
    CREATE TABLE treinamentos_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      conteudo TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES treinamentos_tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE treinamentos_materiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      tipo TEXT DEFAULT 'link',
      url TEXT,
      descricao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES treinamentos_tasks(id) ON DELETE CASCADE
    );
  `);
}

function seedTemplates() {
  const insert = db.prepare(
    'INSERT INTO templates_tarefa (macroprocesso_id, titulo, descricao, ordem) VALUES (?, ?, ?, ?)'
  );

  const templates = [
    [1, 'Levantar cadastro de clientes ativos', 'Verificar TABELA_CLI_FOR, clientes ativos, CNPJs, regimes tributários', 1],
    [1, 'Validar cadastro de fornecedores', 'Conferir fornecedores de insumos, transportadoras, prestadores de serviço', 2],
    [1, 'Configurar tipos de cliente', 'Classificar clientes por mercado (interno, externo, industrial)', 3],
    [1, 'Migrar cadastro básico', 'Importar/validar clientes e fornecedores no Sistec', 4],
    [2, 'Configurar CFOPs de operação triangular', 'CFOPs 5.118/6.118, 5.923/6.923, 5.120/6.120 CJ->BigBoi->FrigoMaster', 1],
    [2, 'Validar regimes tributários', 'Simples nacional, lucro presumido, lucro real por cliente', 2],
    [2, 'Configurar CST/PIS/COFINS', 'Parametrização fiscal padrão do cliente', 3],
    [2, 'Testar emissão de notas fiscais', 'NF de venda interna, externa e triangular', 4],
    [3, 'Mapear produtos ativos', 'Listar produtos com PRODUTO_ATIVO=S', 1],
    [3, 'Classificar por tipo', 'Associar produtos aos tipos do Sistec', 2],
    [3, 'Configurar NCMs', 'Validar NCM por produto para emissão fiscal', 3],
    [3, 'Migrar tabela de produtos', 'Importar produtos com todas as classificações', 4],
    [4, 'Configurar balanças rodoviárias', 'CONFRI_BALANCA porta, baud, marca', 1],
    [4, 'Configurar programação de abate', 'ABATE_PROGRAMACAO agendamento de lotes', 2],
    [4, 'Validar compradores de gado', 'ABATE_COMPRADOR', 3],
    [4, 'Testar pesagem de entrada', 'Pesagem de bois vivos na balança rodoviária', 4],
    [4, 'Testar romaneio de abate', 'Romaneio por lote e rendimentos', 5],
    [5, 'Configurar mix de desossa', 'CONFRI_MIX_DESOSSA cortes do cliente', 1],
    [5, 'Configurar metas de rendimento', 'CONFRI_MIX_RENDIMENTO percentuais por corte', 2],
    [5, 'Cadastrar fateiros/desossadores', 'CONFRI_DESOSSADORES', 3],
    [5, 'Testar ordem de desossa', 'Ordem de desossa, pesos e rendimentos', 4],
    [5, 'Validar classificação interna', 'AC acabamento e CF conformação', 5],
    [6, 'Cadastrar câmaras frigoríficas', 'CONFRI_CAMARA capacidade, ocupação', 1],
    [6, 'Configurar endereçamento', 'CONFRI_CAMARA_ENDERECAMENTO', 2],
    [6, 'Validar grupos de MP e PA', 'CONFRI_GRUPO_MATERIA_PRIMA e PROD_ACABADO', 3],
    [6, 'Testar entrada em câmara', 'Estocagem e endereços', 4],
    [7, 'Cadastrar embalagens', 'CONFRI_EMBALAGEM', 1],
    [7, 'Configurar kits de expedição', 'CONFRI_KIT_EXPEDICAO por mercado', 2],
    [7, 'Validar etiquetas', 'Impressão por produto/embalagem/peso', 3],
    [8, 'Configurar mercados destino', 'CONFRI_MERCADO interno, UE, China, Rússia', 1],
    [8, 'Configurar habilitações', 'CONFRI_HABILITACAO_MERCADO', 2],
    [8, 'Validar rastreabilidade', 'Produtos UE/China com rastreabilidade completa', 3],
    [8, 'Testar fechamento por mercado', 'Relatório segregado por habilitação', 4],
    [9, 'Configurar metas de abate', 'CONFRI_META_ABATE diárias/mensais', 1],
    [9, 'Configurar metas de produção', 'CONFRI_META_PRODUCAO', 2],
    [9, 'Configurar projeção de compra', 'CONFRI_PROJECAO_COMPRA', 3],
    [9, 'Configurar projeção de desossa', 'CONFRI_PROJECAO_DESOSSA', 4],
    [10, 'Configurar tabela de preços', 'CONFRI_TABELA_PRECO por produto/mercado', 1],
    [10, 'Configurar tipos de custo', 'CONFRI_TIPO_CUSTO MP, MOD, embalagem', 2],
    [10, 'Testar fechamento de custo', 'CONFRI_FECHAMENTO_CUSTO', 3],
    [11, 'Configurar mix de serração', 'CONFRI_MIX_SERRACAO e PRODUTO', 1],
    [11, 'Testar fluxo completo de produção', 'Desossa até produto final embalado', 2],
    [11, 'Validar apontamento de produção', 'Pesos, rendimentos e refugos', 3],
    [12, 'Configurar expedição por kit', 'Montagem de kits por pedido', 1],
    [12, 'Validar emissão de NF na expedição', 'NF reflete peso/kit/produto correto', 2],
    [12, 'Testar carga e saída', 'Saída de caminhão com romaneio', 3],
    [13, 'Configurar contas a receber', 'FrigoMaster gerencia recebíveis', 1],
    [13, 'Configurar fluxo de pagamentos', 'Contas a pagar por centro de custo', 2],
    [13, 'Testar integração fiscal-financeiro', 'NF gera título automaticamente', 3],
    [14, 'Configurar processos de exportação', 'Módulo COMEX mercados internacionais', 1],
    [14, 'Configurar documentos de exportação', 'Certificado sanitário, BL, invoice', 2],
    [14, 'Testar rastreabilidade internacional', 'Lote->produto->mercado->cliente', 3],
    [15, 'Executar checklist de go-live', 'Revisar todos os pontos por macroprocesso', 1],
    [15, 'Realizar treinamento da equipe', 'Treinar operadores em cada módulo', 2],
    [15, 'Validar backup e contingência', 'Rotina de backup do Sistec', 3],
    [15, 'Finalizar documento de implantação', 'Assinar termo de aceite com cliente', 4],
  ];

  for (const t of templates) insert.run(t[0], t[1], t[2], t[3]);
  console.log(`[DB] Seed: ${templates.length} templates inseridos`);
}

function seedTestes() {
  const insertTeste = db.prepare(
    'INSERT INTO templates_tarefa (macroprocesso_id, titulo, descricao, ordem) VALUES (?, ?, ?, ?)'
  );
  // also seed testes_implantacao templates
  const insertTesteImpl = db.prepare(
    'INSERT INTO testes_implantacao (projeto_id, test_id, test_nome, status, resultado_json) VALUES (?, ?, ?, ?, ?)'
  );

  // Para seed de templates de testes (não associados a projeto)
  // Na verdade, os templates de teste T1-T10 serão usados como templates_tarefa especiais
  const testes = [
    [16, 'T1 - Validação de Cadastros', 'Verificar TABELA_CLI_FOR, TABELA_PRODUTO, TABELA_FILIAL - consistência dos cadastros base', 1],
    [16, 'T2 - Parametrização Fiscal', 'Validar CFOPs, CST, regimes tributários, operação triangular CJ-BigBoi-FrigoMaster', 2],
    [16, 'T3 - Configuração de Balanças', 'Testar leitura de peso, portas COM, balanças rodoviárias e de expedição', 3],
    [16, 'T4 - Programação e Execução de Abate', 'Criar programação, executar abate, conferir romaneio e rendimentos', 4],
    [16, 'T5 - Desossa e Rendimentos', 'Criar ordem de desossa, conferir mix de cortes, metas de rendimento', 5],
    [16, 'T6 - Estoque e Câmaras', 'Testar entrada/saída de câmaras, endereçamento, saldo de estoque', 6],
    [16, 'T7 - Embalagem e Kits', 'Montar kits de expedição, validar etiquetas por produto/embalagem', 7],
    [16, 'T8 - Mercados e Habilitações', 'Testar produção segregada por mercado, rastreabilidade UE/China', 8],
    [16, 'T9 - Precificação e Custo', 'Validar tabela de preços, executar fechamento de custo', 9],
    [16, 'T10 - Fluxo Completo (Fim-a-Fim)', 'Executar rota completa: abate → desossa → estoque → kit → expedição → NF', 10],
  ];

  for (const t of testes) {
    insertTeste.run(t[0], t[1], t[2], t[3]);
  }
  console.log(`[DB] Seed: ${testes.length} templates de teste inseridos`);
}

module.exports = { initDatabase, getDatabase, saveDatabase, startAutoSave, copyTreinamentosTemplates };
