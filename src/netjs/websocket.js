const ws = require("ws");
const Random = require("../lib/random.js");
var Log = require("./log.js");

class WebSocket {

	static on (type, callback) {
		if (!["connection", "message", "close"].some(t => type == t)) throw new Error("Invalid WebSocket event type " + type);
		WebSocket[type] = callback;
	}

	static send (id, message) {
		if (!(id in WebSocket.connections)) {
			Log.write("Websocket with id " + id + " does not exist");
			return;
		}

		try {
			WebSocket.connections[id].send(message);
		} catch (e) {
			Log.write("Could not send message to websocket: " + e);
		}
	}

	static init (server) {
		const wss = new ws.Server({server: server});

		wss.on("connection", function (ws) {
			const id = Random.generateId(16);
			WebSocket.connections[id] = ws;

			if ("connection" in WebSocket) WebSocket.connection(id);

			ws.on("message", function (message) {
				if ("message" in WebSocket) WebSocket.message(id, message);
			});

			ws.on("close", function () {
				if ("close" in WebSocket) WebSocket.close(id);
				if (id in WebSocket.connections) delete WebSocket.connections[id];
			});
		});
	}
}

WebSocket.connections = [];

module.exports = WebSocket;