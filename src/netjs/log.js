var IO = require("./io.js");

class Log {

	static write (o) {
		const type = typeof o;
		let text = "";

		if (type == "string") {
			text = o;
		} else if (type == "object") {
			text = JSON.stringify(o);
		} else {
			text = o.toString();
		}

		IO.appendText("log.txt", (new Date().toString()) + ": " + text + "\n").catch(console.log);
		console.log(text);
	}
}

module.exports = Log;