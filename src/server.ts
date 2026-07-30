import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { setupSignalingServer } from './lib/signaling';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  setupSignalingServer(httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(`> Server ready on http://localhost:${port}`);
    console.log(`> LAN access on http://192.168.1.37:${port}`);
    console.log(`> Socket.io WebRTC signaling server active`);
  });
});
