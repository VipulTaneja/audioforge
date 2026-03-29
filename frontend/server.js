const http = require('http');
const httpProxy = require('http-proxy');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const proxy = httpProxy.createProxyServer({
  target: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  changeOrigin: true,
});

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    if (pathname.startsWith('/api/v1')) {
      // Proxy API requests
      proxy.web(req, res, { target: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000' });
    } else {
      // Handle Next.js requests
      handle(req, res, parsedUrl);
    }
  });

  const port = process.env.PORT || 3000;
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
