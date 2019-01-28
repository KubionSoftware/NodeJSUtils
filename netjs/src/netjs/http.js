const http = require('follow-redirects').http;
const https = require('follow-redirects').https;
const url = require("url");
const Log = require("./log.js");

class HTTP {

	static executeUrl(link, options) {
		options = options || {};
		
		return new Promise((resolve, reject) => {
			const parsedUrl = url.parse(link);
			const isSecure = link.startsWith("https");

			const headers = options.headers || {};

			const contentBuffer = Buffer.from(options.content || "", "utf8");
			headers["Content-Length"] = contentBuffer.length;

			if (parsedUrl.auth) {
				headers["Authorization"] = "Basic " + new Buffer(parsedUrl.auth).toString("base64");
			}

			if (options.cookies) {
				headers["Cookie"] = Object.keys(options.cookies).map(key => key + "=" + options.cookies[key]).join("; ");
			}

			const httpOptions = {
				hostname: parsedUrl.host,
				port: isSecure ? 443 : 80,
				path: parsedUrl.pathname + (parsedUrl.search || ""),
				method: options.method || "GET",
				headers: headers
			};

			const req = (isSecure ? https : http).request(httpOptions, res => {
				let body = [];

				res.on("data", (d) => {
					body.push(d);
				});

				res.on("error", (error) => {
					Log.write(error);
				})

				res.on("end", () => {
					let content;

					if (options.output == "bytes") {
						content = Buffer.concat(body);
					} else {
						content = Buffer.concat(body).toString();
					}

					let result;

					if (options.extendedOutput) {
						const responseHeaders = res.headers;
						const responseCookies = {};

						const parseCookie = function (cookie) {
							const parts = cookie.split("; ")[0].split("=");
							if (parts.length == 2) {
								responseCookies[parts[0]] = parts[1];
							}
						}

						if ("set-cookie" in res.headers) {
							const cookieHeader = res.headers["set-cookie"];

							if (Array.isArray(cookieHeader)) {
								for (const cookie of cookieHeader) {
									parseCookie(cookie);
								}
							} else if (typeof cookieHeader == "string") {
								parseCookie(cookieHeader);
							}
						}

						result = {
							content: content,
							headers: responseHeaders,
							cookies: responseCookies
						};
					} else {
						result = content;
					}

					resolve(result);
				});
			});
		
			req.on("error", error => {
				reject(error);
			});
			
			if ("content" in options) req.write(contentBuffer);
	
			req.end();
		});
	}

	static get (link, options) {
		options = options || {};
		options.method = options.method || "GET";
		return this.executeUrl(link, options);
	}

	static post (link, options) {
		options = options || {};
		options.method = options.method || "POST";
		return this.executeUrl(link, options);
	}

	static put (link, options) {
		options = options || {};
		options.method = options.method || "PUT";
		return this.executeUrl(link, options);
	}

	static patch (link, options) {
		options = options || {};
		options.method = options.method || "PATCH";
		return this.executeUrl(link, options);
	}

	static delete (link, options) {
		options = options || {};
		options.method = options.method || "DELETE";
		return this.executeUrl(link, options);
	}
}

module.exports = HTTP;