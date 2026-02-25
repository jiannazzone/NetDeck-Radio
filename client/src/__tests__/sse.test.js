import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSEClient } from '../sse.js';

class MockEventSource {
  constructor() {
    this.listeners = {};
    this.onopen = null;
    this.onerror = null;
    this.readyState = 0;
  }
  addEventListener(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  removeEventListener(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((c) => c !== cb);
    }
  }
  close() {
    this.readyState = 2;
  }
}

describe('SSEClient', () => {
  let client;

  beforeEach(() => {
    globalThis.EventSource = vi.fn(() => new MockEventSource());
    client = new SSEClient();
  });

  it('starts in disconnected state', () => {
    expect(client.state).toBe('disconnected');
  });

  it('transitions to connecting on connect()', () => {
    const states = [];
    client.onStateChange = (s) => states.push(s);
    client.connect({ subscribe: 'nets' });
    expect(states).toContain('connecting');
  });

  it('transitions to connected on EventSource open', () => {
    client.connect({ subscribe: 'nets' });
    client.eventSource.onopen();
    expect(client.state).toBe('connected');
  });

  it('transitions to reconnecting on first error', () => {
    client.connect({ subscribe: 'nets' });
    client.eventSource.onopen();
    client.eventSource.onerror();
    expect(client.state).toBe('reconnecting');
  });

  it('resets error count on successful open', () => {
    client.connect({ subscribe: 'nets' });
    client.eventSource.onerror();
    client.eventSource.onerror();
    client.eventSource.onopen();
    // Should reset — verify by doing 4 more errors (not reaching 5)
    for (let i = 0; i < 4; i++) {
      client.eventSource.onerror();
    }
    expect(client.state).toBe('reconnecting');
  });

  it('transitions to failed after 5 consecutive errors', () => {
    client.connect({ subscribe: 'nets' });
    for (let i = 0; i < 5; i++) {
      client.eventSource.onerror();
    }
    expect(client.state).toBe('failed');
  });

  it('closes EventSource after max errors', () => {
    client.connect({ subscribe: 'nets' });
    for (let i = 0; i < 5; i++) {
      client.eventSource.onerror();
    }
    expect(client.eventSource.readyState).toBe(2);
  });

  it('transitions to disconnected on disconnect()', () => {
    client.connect({ subscribe: 'nets' });
    client.eventSource.onopen();
    client.disconnect();
    expect(client.state).toBe('disconnected');
  });

  it('fires onStateChange callback on transitions', () => {
    const states = [];
    client.onStateChange = (s) => states.push(s);
    client.connect({ subscribe: 'nets' });
    client.eventSource.onopen();
    client.disconnect();
    expect(states).toEqual(['disconnected', 'connecting', 'connected', 'disconnected']);
  });
});
