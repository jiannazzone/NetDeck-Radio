export class SSEClient {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.state = 'disconnected';
    this._onStateChange = null;
    this._params = null;
  }

  set onStateChange(cb) {
    this._onStateChange = cb;
    if (cb) cb(this.state);
  }

  _setState(state) {
    if (this.state !== state) {
      this.state = state;
      if (this._onStateChange) this._onStateChange(state);
    }
  }

  connect(params) {
    this.disconnect();

    this._params = params;
    this._setState('connecting');
    const query = new URLSearchParams(params).toString();
    this.eventSource = new EventSource(`/api/events?${query}`);

    this.eventSource.onopen = () => {
      this._setState('connected');
    };

    this.eventSource.onerror = () => {
      this._setState('reconnecting');
      console.warn('[SSE] Connection error, will auto-reconnect');
    };

    // Re-attach listeners
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        this.eventSource.addEventListener(event, cb);
      }
    }
  }

  reconnect() {
    if (this._params) {
      this.connect(this._params);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this._setState('disconnected');
  }

  on(event, callback) {
    const wrapped = (e) => callback(JSON.parse(e.data));

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(wrapped);

    if (this.eventSource) {
      this.eventSource.addEventListener(event, wrapped);
    }

    return wrapped;
  }

  off(event, wrapped) {
    if (this.eventSource) {
      this.eventSource.removeEventListener(event, wrapped);
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const idx = callbacks.indexOf(wrapped);
      if (idx !== -1) callbacks.splice(idx, 1);
    }
  }

  removeAllListeners() {
    if (this.eventSource) {
      for (const [event, callbacks] of this.listeners) {
        for (const cb of callbacks) {
          this.eventSource.removeEventListener(event, cb);
        }
      }
    }
    this.listeners.clear();
  }
}

export const sse = new SSEClient();
