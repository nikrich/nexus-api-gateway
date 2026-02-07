import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export type ServiceName = 'userService' | 'contentService' | 'notificationService';

// Circuit breaker states
type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  openedAt: number;
}

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 30_000;   // 30 seconds
const OPEN_DURATION_MS = 15_000;    // 15 seconds

const circuits = new Map<ServiceName, CircuitBreaker>();

function getCircuit(service: ServiceName): CircuitBreaker {
  let circuit = circuits.get(service);
  if (!circuit) {
    circuit = { state: 'closed', failures: 0, lastFailureTime: 0, openedAt: 0 };
    circuits.set(service, circuit);
  }
  return circuit;
}

export function recordFailure(service: ServiceName): void {
  const circuit = getCircuit(service);
  const now = Date.now();

  // Reset failures if outside the window
  if (now - circuit.lastFailureTime > FAILURE_WINDOW_MS) {
    circuit.failures = 0;
  }

  circuit.failures++;
  circuit.lastFailureTime = now;

  if (circuit.failures > FAILURE_THRESHOLD) {
    circuit.state = 'open';
    circuit.openedAt = now;
    console.log(`[Circuit Breaker] ${service}: circuit OPENED after ${circuit.failures} failures`);
  }
}

export function recordSuccess(service: ServiceName): void {
  const circuit = getCircuit(service);
  if (circuit.state === 'half-open') {
    console.log(`[Circuit Breaker] ${service}: circuit CLOSED after successful probe`);
  }
  circuit.state = 'closed';
  circuit.failures = 0;
}

export function getCircuitState(service: ServiceName): CircuitState {
  const circuit = getCircuit(service);
  const now = Date.now();

  if (circuit.state === 'open' && now - circuit.openedAt >= OPEN_DURATION_MS) {
    circuit.state = 'half-open';
    console.log(`[Circuit Breaker] ${service}: circuit HALF-OPEN, allowing probe request`);
  }

  return circuit.state;
}

// For testing
export function resetCircuits(): void {
  circuits.clear();
}

export function getServiceUrl(service: ServiceName): string {
  return config.services[service];
}

export function createServiceProxy(service: ServiceName, pathRewrite?: Record<string, string>) {
  const proxyMiddleware = createProxyMiddleware({
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
      proxyRes: () => {
        recordSuccess(service);
      },
      error: (err, _req, res) => {
        console.error(`[Proxy Error] ${service}: ${err.message}`);
        recordFailure(service);
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
  } as Options);

  // Wrap with circuit breaker check
  return (req: Request, res: Response, next: NextFunction) => {
    const state = getCircuitState(service);

    if (state === 'open') {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `Service ${service} circuit is open. Try again later.`,
        },
      });
      return;
    }

    // For half-open, allow the request through (probe)
    proxyMiddleware(req, res, next);
  };
}
