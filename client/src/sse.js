const MAX_ERRORS = 5;

export class SSEClient {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.state = 'disconnected';
    this._onStateChange = null;
    this._params = null;
    this._errorCount = 0;
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
    this._errorCount = 0;
    this._setState('connecting');
    const query = new URLSearchParams(params).toString();
    this.eventSource = new EventSource(`/api/events?${query}`);

    this.eventSource.onopen = () => {
      this._errorCount = 0;
      this._setState('connected');
    };

    this.eventSource.onerror = () => {
      this._errorCount++;
      if (this._errorCount >= MAX_ERRORS) {
        this.eventSource.close();
        this._setState('failed');
        console.error('[SSE] Connection failed after', MAX_ERRORS, 'attempts');
      } else {
        this._setState('reconnecting');
        console.warn('[SSE] Connection error, will auto-reconnect');
      }
    };

    // Re-attach listeners
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        this.eventSource.addEventListener(event, cb);
      }
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
    const wrapped = (e) => {
      try {
        callback(JSON.parse(e.data));
      } catch (err) {
        console.error('[SSE] Failed to parse event data:', err);
      }
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(wrapped);

    if (this.eventSource) {
      this.eventSource.addEventListener(event, wrapped);
    }

    return wrapped;
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
