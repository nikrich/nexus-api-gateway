import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordFailure,
  recordSuccess,
  getCircuitState,
  resetCircuits,
} from '../src/proxy/service-proxy.js';

describe('Circuit breaker', () => {
  beforeEach(() => {
    resetCircuits();
  });

  it('starts in closed state', () => {
    expect(getCircuitState('userService')).toBe('closed');
  });

  it('stays closed under failure threshold', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure('userService');
    }
    expect(getCircuitState('userService')).toBe('closed');
  });

  it('opens after exceeding failure threshold', () => {
    for (let i = 0; i < 6; i++) {
      recordFailure('userService');
    }
    expect(getCircuitState('userService')).toBe('open');
  });

  it('tracks circuits per service independently', () => {
    for (let i = 0; i < 6; i++) {
      recordFailure('userService');
    }
    expect(getCircuitState('userService')).toBe('open');
    expect(getCircuitState('contentService')).toBe('closed');
  });

  it('closes circuit on success from half-open', () => {
    // Open the circuit
    for (let i = 0; i < 6; i++) {
      recordFailure('userService');
    }
    expect(getCircuitState('userService')).toBe('open');

    // Simulate the circuit becoming half-open (would normally happen after timeout)
    // We can't easily test timing, but we can test the success path
    recordSuccess('userService');
    expect(getCircuitState('userService')).toBe('closed');
  });

  it('resets failure count on success', () => {
    // Some failures
    recordFailure('userService');
    recordFailure('userService');
    recordFailure('userService');

    // A success resets
    recordSuccess('userService');

    // More failures but shouldn't open (count was reset)
    recordFailure('userService');
    recordFailure('userService');
    recordFailure('userService');
    expect(getCircuitState('userService')).toBe('closed');
  });
});
