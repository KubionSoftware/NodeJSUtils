class Base64 {

	static encodeBytes (bytes) {
		return new Buffer(bytes).toString("base64");
	}

	static decodeToBytes (base64) {
		return new Buffer(base64, 'base64');
	}
}

module.exports = Base64;