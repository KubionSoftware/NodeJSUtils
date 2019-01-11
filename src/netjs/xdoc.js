const edge = require('edge-js');
const createXDoc = edge.func({ assemblyFile: './bin/XDocServices.dll', typeName: 'XDocServices.XDocServiceFactory', methodName: 'CreateXDoc' });

class XDoc {
	//	var xDoc = new xdoc({ AppCache: 1, SVCache: 1});
	//	xDoc.run(command, (error, result) => res.end(result));

	constructor(options) {
		options = options || {};
		this._xDocRun = createXDoc(options, true);	
	}

	run(template, cb) {
		this._xDocRun(template, (error, result) => cb(error, result));
	}

}

module.exports = XDoc;

