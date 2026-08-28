// Server-Sent Events hub for the live broadcast channel.
//
// SSE over stdlib http, not a websocket library: the stream is server to client
// only (viewer counts, floating comments, reactions, gift alerts, chat), which
// is exactly what SSE is for, and it costs zero dependencies.

export function createHub(runtime, { historySize = 50 } = {}) {
  const clients = new Map(); // id -> { write, topics }
  const history = [];        // recent events, replayed to reconnecting clients

  const encode = (event) =>
    `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

  return {
    subscribe(write, { topics = ['*'], lastEventId = null } = {}) {
      const id = runtime.uuid();
      clients.set(id, { write, topics });

      if (lastEventId) {
        const from = history.findIndex((e) => e.id === lastEventId);
        if (from >= 0) {
          for (const e of history.slice(from + 1)) {
            if (topics.includes('*') || topics.includes(e.type)) write(encode(e));
          }
        }
      }
      return () => clients.delete(id);
    },

    publish(type, data) {
      const event = { id: `${runtime.now()}-${runtime.seq()}`, type, data, at: runtime.now() };
      history.push(event);
      if (history.length > historySize) history.shift();
      const frame = encode(event);
      for (const [id, client] of clients) {
        if (!(client.topics.includes('*') || client.topics.includes(type))) continue;
        try { client.write(frame); } catch { clients.delete(id); }
      }
      return event;
    },

    heartbeat() {
      for (const [id, client] of clients) {
        try { client.write(': keepalive\n\n'); } catch { clients.delete(id); }
      }
    },

    clientCount: () => clients.size,
    recent: (n = 20) => history.slice(-n),
  };
}
