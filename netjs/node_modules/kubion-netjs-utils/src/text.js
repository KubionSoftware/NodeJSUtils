class Text {

    static stripHtml (html) {
        html = html.replace(/<\/(h1|h2|h3|h4|h5|p|div)>|<br ?\/?>/g, "\n");
        html = html.replace(/<[^>]*>/g, "");
        html = html.replace(/&nbsp;/, " ");

        // Remove all whitespace before and after text
        html = html.trim();

        // Remove all triple newlines
        html = html.replace(/\n \n/g, "\n\n");
        html = html.replace(/\n\n\n/g, "\n\n");
        
        return html;
    }

    static encodeEntities (str) {
        return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
            return '&#'+i.charCodeAt(0)+';';
        });
    }

    static decodeEntities (encodedString) {
        var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
        var translate = {
            "nbsp":" ",
            "amp" : "&",
            "quot": "\"",
            "lt"  : "<",
            "gt"  : ">"
        };
        return encodedString.replace(translate_re, function(match, entity) {
            return translate[entity];
        }).replace(/&#(x?[0-9A-F]+);/gi, function(match, numStr) {
            var num = numStr.startsWith("x") ? parseInt(numStr.substr(1), 16) : parseInt(numStr, 10);
            return String.fromCharCode(num);
        });
    }
}

module.exports = Text;