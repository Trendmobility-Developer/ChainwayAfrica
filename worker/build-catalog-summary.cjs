const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'catalog.json'), 'utf8'));
const lines = data.map(p => '- ' + p.model + ' | ' + p.name + ' | ' + p.categories.join(', ') + ' | ' + p.description);
fs.writeFileSync(path.join(__dirname, 'catalog-summary.txt'), lines.join('\n'), 'utf8');
console.log('Lines:', lines.length);
console.log('Chars:', lines.join('\n').length);
