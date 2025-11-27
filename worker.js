import { Room } from "./room.js";

export { Room };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // WebSocket para a sala: /ws/<roomId>
    if (url.pathname.startsWith("/ws/")) {
      const upgrade = request.headers.get("Upgrade");
      if (upgrade !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }

      const roomId = url.pathname.split("/").pop() || "default";
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    // Qualquer outra rota: serve arquivos estáticos da pasta public
    return env.ASSETS.fetch(request);
  }
}
