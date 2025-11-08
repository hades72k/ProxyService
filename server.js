// Dependencies
const proxy = require('http-proxy');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// Constants
const PORT = process.env.PORT || 10000;
const ACCESS_KEY = process.env.ACCESS_KEY && Buffer.from(process.env.ACCESS_KEY) || Buffer.from('roblox123');

// Create proxy servers
const httpsProxy = proxy.createProxyServer({ agent: new https.Agent({ rejectUnauthorized: false }), changeOrigin: true });
const httpProxy = proxy.createProxyServer({ changeOrigin: true });

// Helper to send errors
const writeErr = (res, status, message) => {
    res.writeHead(status, { 'Content-Type': 'text/plain' });
    res.end(message);
};

// Proxy error handler
const onProxyError = (err, req, res) => {
    console.error(err);
    writeErr(res, 500, 'Proxying failed');
};

httpsProxy.on('error', onProxyError);
httpProxy.on('error', onProxyError);

// Remove unnecessary headers before proxying
const onProxyReq = (proxyReq) => {
    proxyReq.removeHeader('proxy-access-key');
    proxyReq.removeHeader('proxy-target');
};
httpsProxy.on('proxyReq', onProxyReq);
httpProxy.on('proxyReq', onProxyReq);

// Function to proxy the request
const doProxy = (parsedTarget, req, res) => {
    const options = { target: parsedTarget.origin };
    if (parsedTarget.protocol === 'https:') {
        httpsProxy.web(req, res, options);
    } else {
        httpProxy.web(req, res, options);
    }
};

// Main server
const server = http.createServer((req, res) => {
    const accessKey = req.headers['proxy-access-key'];
    const requestedTarget = req.headers['proxy-target'];

    if (!accessKey || !requestedTarget) {
        writeErr(res, 400, 'proxy-access-key and proxy-target headers are both required');
        return;
    }

    const keyBuffer = Buffer.from(accessKey);
    if (keyBuffer.length !== ACCESS_KEY.length || !crypto.timingSafeEqual(keyBuffer, ACCESS_KEY)) {
        writeErr(res, 403, 'Invalid access key');
        return;
    }

    let parsedTarget;
    try {
        // ✅ Allow full URLs including https:// and query parameters
        parsedTarget = new URL(requestedTarget);
    } catch (e) {
        writeErr(res, 400, 'Invalid target URL');
        return;
    }

    doProxy(parsedTarget, req, res);
});

// Start server
server.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
