const Firebird = require('node-firebird');
const path = require('path');
const fs = require('fs');

function connect(caminhoArquivo) {
  return new Promise((resolve, reject) => {
    const fullPath = path.resolve(caminhoArquivo);

    if (!fs.existsSync(fullPath)) {
      return reject(new Error(`Arquivo não encontrado: ${fullPath}`));
    }

    const options = {
      host: '127.0.0.1',
      port: 3050,
      database: fullPath,
      user: 'SYSDBA',
      password: 'masterkey',
      lowercase_keys: true,
      pageSize: 4096
    };

    Firebird.attach(options, (err, db) => {
      if (err) return reject(new Error(`Erro ao conectar Firebird: ${err.message}`));
      resolve(db);
    });
  });
}

function query(db, sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, rows) => {
      if (err) return reject(new Error(`Erro na query: ${err.message}`));
      resolve(rows || []);
    });
  });
}

function close(db) {
  return new Promise((resolve) => {
    if (db && db.detach) {
      try { db.detach(); } catch (e) { /* ignore */ }
    }
    resolve();
  });
}

async function executarQueries(caminhoArquivo, queries) {
  const resultados = [];
  const erros = [];

  let db;
  try {
    db = await connect(caminhoArquivo);

    for (const q of queries) {
      try {
        const rows = await query(db, q.query);
        resultados.push({
          id: q.id,
          titulo: q.titulo,
          categoria: q.categoria,
          tabela: q.tabela,
          interpretacao: q.interpretacao,
          dados: rows,
          total: rows.length > 0 ? Object.keys(rows[0]).length : 0
        });
      } catch (err) {
        erros.push({ id: q.id, titulo: q.titulo, erro: err.message });
      }
    }
  } catch (err) {
    throw err;
  } finally {
    if (db) await close(db);
  }

  return { resultados, erros };
}

async function getDatabaseInfo(caminhoArquivo) {
  const fullPath = path.resolve(caminhoArquivo);
  const stats = fs.statSync(fullPath);

  return {
    caminho: fullPath,
    tamanho_bytes: stats.size,
    tamanho_mb: (stats.size / (1024 * 1024)).toFixed(2),
    ultima_modificacao: stats.mtime
  };
}

module.exports = { connect, query, close, executarQueries, getDatabaseInfo };
