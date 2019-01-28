const MongoClient = require("mongodb").MongoClient;
const Log = require("./log.js");

class MongoDB {

	static addConnection (name, url, database) {
		return new Promise((resolve, reject) => {
			MongoClient.connect(url, {
				useNewUrlParser: true 
			}, function (err, db) {
				if (err) {
					reject(err);
				} else {
					MongoDB[name] = db.db(database);
					resolve(db);
				}
			});
		});
	}
	
	static conn (name) {
		if (!(name in MongoDB)) {
			Log.write("Trying to get unknown connection: " + name);
			return;
		}

		return MongoDB[name];
	}
}

module.exports = MongoDB;