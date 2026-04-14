// scan_tree.js
const fs = require('fs');
const path = require('path');

// Игнорируем тяжелые и системные папки
const IGNORE = ['node_modules', '.git', '.next', 'dist', 'build', '.DS_Store', 'uploads', 'logs'];

function buildTree(dir, prefix = '') {
  let result = '';
  let files;
  
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return '';
  }

  // Сортируем: сначала папки, потом файлы
  files.sort((a, b) => {
    const isDirA = fs.statSync(path.join(dir, a)).isDirectory();
    const isDirB = fs.statSync(path.join(dir, b)).isDirectory();
    if (isDirA && !isDirB) return -1;
    if (!isDirA && isDirB) return 1;
    return a.localeCompare(b);
  });

  files.forEach((file, index) => {
    if (IGNORE.includes(file)) return;

    const filePath = path.join(dir, file);
    const isLast = index === files.length - 1;
    const marker = isLast ? '└── ' : '├── ';

    result += `${prefix}${marker}${file}\n`;

    if (fs.statSync(filePath).isDirectory()) {
      result += buildTree(filePath, prefix + (isLast ? '    ' : '│   '));
    }
  });
  return result;
}

const tree = buildTree(__dirname);
fs.writeFileSync('project_tree.txt', tree);
console.log('✅ project_tree.txt успешно создан!');