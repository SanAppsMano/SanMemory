import { Room } from "./room.js";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/ws/")) {
      const roomId = url.pathname.split("/")[2];
      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      return stub.fetch(req);
    }

    return env.ASSETS.fetch(req);
  }
};
