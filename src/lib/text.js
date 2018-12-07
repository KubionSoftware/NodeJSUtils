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
}