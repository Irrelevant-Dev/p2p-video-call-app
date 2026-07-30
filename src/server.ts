import { createServer as createHttpsServer } from 'https';
import { parse } from 'url';
import next from 'next';
import selfsigned from 'selfsigned';
import { setupSignalingServer } from './lib/signaling';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname: 'localhost', port });
const handle = app.getRequestHandler();

// Generate in-memory self-signed SSL cert for HTTPS
const attrs = [{ name: 'commonName', value: '192.168.1.37' }];
const pems = (selfsigned as any).generate(attrs, {
  days: 365,
  altNames: [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '192.168.1.37' },
  ],
});

app.prepare().then(() => {
  const serverOptions = {
    key: pems.private,
    cert: pems.cert,
  };

  const httpsServer = createHttpsServer(serverOptions, (req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  setupSignalingServer(httpsServer);

  httpsServer.listen(port, hostname, () => {
    console.log(`> 🔒 Native HTTPS Server ready on https://localhost:${port}`);
    console.log(`> 🔒 Native HTTPS LAN access on https://192.168.1.37:${port}`);
    console.log(`> ⚡ Socket.io WebRTC signaling server active over HTTPS`);
  });
});
