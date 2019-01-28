const edge = require('edge-js');

class XDoc {
	//	var xDoc = new xdoc({ AppCache: 1, SVCache: 1});
	//	xDoc.run(command, (error, result) => res.end(result));

	constructor(options) {
		options = options || {};
		
		const createXDoc = edge.func({ assemblyFile: './bin/XDocServices.dll', typeName: 'XDocServices.XDocServiceFactory', methodName: 'CreateXDoc' });
		this.xDocRun = createXDoc(options, true);	
	}

	run(template, cb) {
		this.xDocRun(template, (error, result) => cb(error, result));
	}

}

module.exports = XDoc;

