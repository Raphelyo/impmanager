const path = require('path');
const fs = require('fs');

const QUERIES_DIR = path.join(__dirname, '..', 'templates-analise');

function carregarQueries() {
  const files = [
    'queries-cadastros.json',
    'queries-parametros.json',
    'queries-regras.json',
    'queries-estado.json',
    'queries-fiscal.json'
  ];

  const todas = [];

  for (const file of files) {
    const filePath = path.join(QUERIES_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const queries = (content.queries || []).map(q => ({
        ...q,
        categoria: content.categoria
      }));
      todas.push(...queries);
    }
  }

  return todas;
}

module.exports = { carregarQueries };
