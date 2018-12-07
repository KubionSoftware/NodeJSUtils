const fs = require("fs");

class IO {

	static readText (file) {
		return new Promise((resolve, reject) => {
			fs.readFile(file, function (error, res) {
				if (error) {
					reject(error);
				} else {
					resolve(res.toString());
				}
			});
		});
	}

	static writeText (file, text) {
		return new Promise((resolve, reject) => {
			fs.writeFile(file, text, function (error) {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}
	
	static appendText (file, text) {
		return new Promise((resolve, reject) => {
			fs.appendFile(file, text, function (error) {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	static readBytes (file) {
		return new Promise((resolve, reject) => {
			fs.readFile(file, function (error, res) {
				if (error) {
					reject(error);
				} else {
					resolve(res);
				}
			});
		});
	}

	static writeBytes (file, bytes) {
		return new Promise((resolve, reject) => {
			fs.writeFile(file, bytes, function (error) {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}

	static fileExists (file) {
		return new Promise((resolve, reject) => {
			fs.access(file, fs.F_OK, error => {
				if (error) {
					resolve(false);
				} else {
					resolve(true);
				}
			})
		});
	}

	static rename (oldPath, newPath) {
		return new Promise((resolve, reject) => {
			fs.rename(oldPath, newPath, error => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			})
		});
	}

	static getFiles (directory) {
		return new Promise((resolve, reject) => {
			fs.readdir(directory, (error, files) => {
				if (error) {
					reject(error);
				} else {
					resolve(files);
				}
			});
		});
	}
}

module.exports = IO;