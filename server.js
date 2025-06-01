const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.svg': 'image/svg+xml'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = mime[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/dashboard') {
    return sendFile(res, path.join(__dirname, 'dashboard', 'index.html'));
  }
  if (url.startsWith('/dashboard/')) {
    return sendFile(res, path.join(__dirname, url));
  }
  if (url.startsWith('/build/')) {
    return sendFile(res, path.join(__dirname, url));
  }
  if (url === '/api/data') {
    return sendFile(res, path.join(__dirname, 'data', 'Results_v2 3.xlsx'));
  }
  if (url === '/api/structure') {
    return sendFile(res, path.join(__dirname, 'data', 'structure.json'));
  }
  if (url.startsWith('/examples/')) {
    return sendFile(res, path.join(__dirname, url));
  }
  res.writeHead(404);
  res.end('Not found');
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
