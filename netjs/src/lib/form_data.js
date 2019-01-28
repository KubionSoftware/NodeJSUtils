class FormData {

	static encode (json) {
		return Object.keys(json).map(key => key + "=" + encodeURIComponent(json[key])).join("&");
	}
}

module.exports = FormData