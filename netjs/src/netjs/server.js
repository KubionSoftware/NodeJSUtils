const http = require('http');
const formidable = require('formidable');
const WebSocket = require("./websocket.js");
const Random = require("../lib/random.js");
const IO = require("./io.js");

class Server {

	static create (callback) {
		const server = http.createServer(callback).listen(process.env.PORT || 8080);
		WebSocket.init(server);
		return server;
	}

	static upload (req) {
		return new Promise((resolve, reject) => {
			var form = new formidable.IncomingForm();
			form.uploadDir = "files";
			form.parse(req, function (err, fields, files) {
				if (err) reject(err);

				const file = files.file;
				const extension = file.name.split(".").slice(-1)[0];
				const path = "files/" + Random.generateId(32) + "." + extension;
				IO.rename(file.path, path).then(() => {
					resolve(path);
				}).catch(reject);
			});
		});
	}
}

module.exports = Server;