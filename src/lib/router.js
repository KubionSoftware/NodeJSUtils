const IO = require("../netjs/io.js");
const Log = require("../netjs/log.js");

class Router {

	constructor (options) {
		this.routes = options.routes || [];
		this.hosts = options.hosts || [];
		this.hostFolder = options.hostFolder || "";

		for (const route of this.routes) {
			route.path = route.path.split("/").filter(p => p.length > 0);
		}
	}

	route (req, res) {
		let status = 200;
		let headers = {};
	
		let mimeTypes = {
			"": "application/json",
			"jpg": "image/jpeg",
			"png": "image/png",
			"svg": "image/svg+xml",
			"html": "text/html",
			"js": "application/javascript",
			"css": "text/css",
			"ico": "image/x-icon"
		}
	
		function end (str, extension) {
			headers["Content-Type"] = mimeTypes[(extension || "" ).toLowerCase()] || "text/plain";
			res.writeHead(status, headers);
			res.end(str);
		}

		if (req.method == "OPTIONS") {
			headers = this.optionHeaders || {};
			end("");
		}

		// Determine the path by discarding the query (after ?) and splitting on slashes, then remove all empty parts
		const url = this.hosts.reduce((a, v) => a.replace(v, ""), req.url);
		const urlParts = url.split("?");	

		const path = urlParts[0].split("/").filter(p => p.length > 0);
		
		// Get query parameters from url
		const queryParams = {};
		if (urlParts.length > 1) {
			const queries = urlParts[1].split('&');
			for (const query of queries) {
				const pair = query.split('=');
				queryParams[pair[0]] = decodeURIComponent(pair[1]);
			}
		}

		req.on("error", error => {
			Log.write(error);
		});
	
		const body = [];
	
		req.on("data", chunk => {
			body.push(chunk);
		});

		req.on("end", () => {
			const content = Buffer.concat(body);

			for (const route of this.routes) {
				if (route.before) continue;

				const parameters = [];
				let matched = true;

				for (let i = 0; i < route.path.length; i++) {
					if (route.path[i].startsWith("{")) {
						parameters.push(path[i]);
					} else {
						if (path[i] != route.path[i]) {
							matched = false;
							break;
						}
					}
				}

				if (matched) {
					route.action(req, end, content.toString(route.format), ...parameters, queryParams);
					return;
				}
			}

			if (this.hostFolder) {
				if (path.length == 0) path.push("index.html");
				const file = path.join("/");
				const extension = file.split(".").slice(-1)[0];

				IO.readBytes(this.hostFolder + "/" + file).then(bytes => end(bytes, extension)).catch(e => {
					status = 302;
					headers["Location"] = "/";
					end("");
				});
			}
		});
	}
}

module.exports = Router;