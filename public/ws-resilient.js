// public/ws-resilient.js
(function () {
  const DEFAULT_OPTIONS = {
    heartbeatInterval: 10000,   // 10s: envia ping
    watchdogInterval: 5000,     // 5s: checa se está "parado"
    inactivityTimeout: 25000,   // 25s sem mensagem => força reconnect
    initialReconnectDelay: 1000,
    maxReconnectDelay: 10000,
    maxRetries: Infinity        // pode limitar se quiser
  };

  function createResilientWebSocket(url, handlers = {}, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let ws = null;
    let isManuallyClosed = false;
    let reconnectDelay = opts.initialReconnectDelay;
    let retries = 0;
    let heartbeatTimer = null;
    let watchdogTimer = null;
    let lastActivity = Date.now();

    const safeHandlers = {
      onOpen: handlers.onOpen || (() => {}),
      onMessage: handlers.onMessage || (() => {}),
      onClose: handlers.onClose || (() => {}),
      onError: handlers.onError || (() => {})
    };

    function clearTimers() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
    }

    function startHeartbeat() {
      clearTimers();
      lastActivity = Date.now();

      heartbeatTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(JSON.stringify({ type: "__ping" }));
        } catch (_) {}
      }, opts.heartbeatInterval);

      watchdogTimer = setInterval(() => {
        const now = Date.now();
        if (now - lastActivity > opts.inactivityTimeout) {
          try {
            ws && ws.close();
          } catch (_) {}
        }
      }, opts.watchdogInterval);
    }

    function attachWebSocketEvents() {
      if (!ws) return;

      ws.onopen = (ev) => {
        reconnectDelay = opts.initialReconnectDelay;
        retries = 0;
        lastActivity = Date.now();
        startHeartbeat();
        safeHandlers.onOpen(ev);
      };

      ws.onmessage = (ev) => {
        lastActivity = Date.now();

        // Ignora nosso ping interno se o servidor ecoar
        try {
          const data = JSON.parse(ev.data);
          if (data && data.type === "__pong") return;
        } catch (_) {}

        safeHandlers.onMessage(ev);
      };

      ws.onerror = (ev) => {
        safeHandlers.onError(ev);
      };

      ws.onclose = (ev) => {
        clearTimers();
        safeHandlers.onClose(ev);

        if (isManuallyClosed) return;
        if (retries >= opts.maxRetries) return;

        retries += 1;
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, opts.maxReconnectDelay);
      };
    }

    function connect() {
      if (isManuallyClosed) return;

      try {
        ws = new WebSocket(url);
        attachWebSocketEvents();
      } catch (err) {
        if (retries >= opts.maxRetries) return;
        retries += 1;
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, opts.maxReconnectDelay);
      }
    }

    connect();

    return {
      send(data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        try {
          ws.send(data);
          return true;
        } catch (_) {
          return false;
        }
      },
      close(code, reason) {
        isManuallyClosed = true;
        clearTimers();
        try {
          ws && ws.close(code, reason);
        } catch (_) {}
      },
      get readyState() {
        return ws ? ws.readyState : WebSocket.CLOSED;
      },
      get raw() {
        return ws;
      }
    };
  }

  window.createResilientWebSocket = createResilientWebSocket;
})();
