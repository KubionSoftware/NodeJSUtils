class Format {

    static formatDate (time, todayText) {
        // Returns the day since year 0
        const getDay = d => d.getDate() + 12 * d.getMonth() + 365 * d.getYear();

        const date = new Date(time);
        const day = getDay(date);
        const today = getDay(new Date());

        if (day == today) {
            return todayText ? "vandaag" : Format.formatTime(date);
        } else if (today - day == 1) {
            return "gisteren";
        } else if (today - day < 7) {
            const days = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
            return days[date.getDay()];
        } else {
            const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
            return date.getDate() + " " + months[date.getMonth()];
        }
    }

    static formatTime (time){
        if (typeof(time) == "number" || typeof(time) == "string") time = new Date(time);
    
        // Make double digit
        const dd = n => n.toString().length == 1 ? "0" + n : n.toString();
    
        return dd(time.getHours()) + ":" + dd(time.getMinutes());
    }
}

module.exports = Format;