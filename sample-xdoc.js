const express = require('express');
var url = require("url");
const XDoc = require("./src/netjs/xdoc.js");

const app = express();
var port = process.env.PORT || 3000;
var xDoc;

app.get('/xdoc/:path(*)', function (req, res) {
	if (!xDoc) xDoc = new XDoc({ AppCache: 1, SVCache: 1, XFiles: "D:\\Kubion\\Azure\\IRISApp\\XDoc"});
	xDoc.run(req.params.path + (url.parse(req.url).search || ''), (error, result) => {
		if (error) res.end(error.Message);
		else res.end(result)
	});
});

app.listen(port, () => console.log("Node express server listening on port " + port));
