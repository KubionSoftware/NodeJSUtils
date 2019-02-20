const zlib = require("zlib");

class Gzip {

    static async compress (str) {
        return new Promise((resolve, reject) => {
            zlib.gzip(new Buffer(str, "utf-8"), (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }
    
    static async uncompress (buffer) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(buffer, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.toString("utf-8"));
                }
            });
        });
    }
}

module.exports = Gzip;