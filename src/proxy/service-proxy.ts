import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { config } from '../config.js';

export type ServiceName = 'userService' | 'contentService' | 'notificationService';

export function getServiceUrl(service: ServiceName): string {
  return config.services[service];
}

export function createServiceProxy(service: ServiceName, pathRewrite?: Record<string, string>) {
  const options: Options = {
    target: 'http://placeholder',
    router: () => getServiceUrl(service),
    changeOrigin: true,
    pathRewrite,
    on: {
      proxyReq: (proxyReq, req) => {
        const incomingReq = req as Request;
        const requestId = incomingReq.headers['x-request-id'];
        if (requestId) {
          proxyReq.setHeader('X-Request-Id', requestId as string);
        }
      },
      error: (err, _req, res) => {
        console.error(`[Proxy Error] ${service}: ${err.message}`);
        const response = res as Response;
        if (!response.headersSent) {
          response.status(502).json({
            success: false,
            error: {
              code: 'BAD_GATEWAY',
              message: `Service ${service} is unavailable`,
            },
          });
        }
      },
    },
  };

  return createProxyMiddleware(options);
}
