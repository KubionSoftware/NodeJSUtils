var IO = require("./io.js");

class Log {

	static async write (o) {
		const type = typeof o;
		let text = "";

		if (type == "string") {
			text = o;
		} else if (type == "object") {
			text = JSON.stringify(o);
		} else {
			text = o.toString();
		}

		await IO.appendText("log.txt", (new Date().toString()) + ": " + text + "\n");
		console.log(text);
	}
}

module.exports = Log;