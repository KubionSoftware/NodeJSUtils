class Random {

    static generateId (length) {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
        let id = "";

        for (let i = 0; i < length; i++) {
            id += Random.choose(chars);
        }

        return id;
    }

    static choose (list) {
        return list[parseInt(Math.random() * list.length)];
    }
}

module.exports = Random;