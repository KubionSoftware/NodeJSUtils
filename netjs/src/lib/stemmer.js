function isVowel(x) {
  return x == "e" || x == "a" || x == "o" || x == "i" || x == "u" || x == "y";
}


// * Return longest matching suffixes for a token or '' if no suffix match
const endsinArr = function(s, suffixes) {
var i, longest = '';
for (i = 0; i < suffixes.length; i++) {
  if (endsin(s, suffixes[i]) && suffixes[i].length > longest.length)
    longest = suffixes[i];
}

return longest;
};


// Returns true if token has suffix
const endsin = function(s, suffix) {
if (s.length < suffix.length) return false;
for (let i = 0; i < suffix.length; i++) {
    if (s[s.length - (suffix.length - i)] != suffix[i]) return false;
}
return true;
};


// Removes a suffix of len characters and returns the string
const removeSuffix = function(s, len) {
return s.substr(0, s.length - len);
};


// Define undoubling the ending as removing the last letter if the word ends kk, dd or tt.
const undoubleEnding = function(s) {
if (endsin(s, "kk") || endsin(s, "tt") || endsin(s, "dd")) {
    return s.substr(0, s.length - 1);
}
else {
  return s;
}
}


class PorterStemmer {
constructor() {
}

replaceAccentedCharacters(word) {
  var accentedCharactersMapping = {
    "ä": "a",
    "ë": "e",
    "ï": "i",
    "ö": "o",
    "ü": "u",
    "á": "a",
    "é": "e",
    "í": "i",
    "ó": "o",
    "ú": "u"
  }
  var result = word;
  for (var x in accentedCharactersMapping) {
    result = result.replace(new RegExp(x, "g"), accentedCharactersMapping[x]);
  }

  return result;
}

// Determines R1 and R2; adapted from the French Porter Stemmer
markRegions(token) {
  var r1, r2, len;

  r1 = r2 = len = token.length;

  // R1 is the region after the first non-vowel following a vowel,
  for (var i = 0; i < len - 1 && r1 == len; i++) {
    if (isVowel(token[i]) && !isVowel(token[i + 1])) {
      r1 = i + 2;
    }
  }
  // Or is the null region at the end of the word if there is no such non-vowel.

  // R1 is adjusted such that the region before it contains at least 3 characters
  if (r1 != len) {
    // R1 is not null
    if (r1 < 3) {
      // Region before does not contain at least 3 characters
      if (len > 3) {
        r1 = 3;
        // Now R1 contains at least 3 characters
      }
      else {
        // It is not possible to make the region before long enough
        r1 = len;
      }
    }
  }

  // R2 is the region after the first non-vowel following a vowel in R1
  for (i = r1; i < len - 1 && r2 == len; i++) {
    if (isVowel(token[i]) && !isVowel(token[i + 1])) {
      r2 = i + 2;
    }
  }
  // Or is the null region at the end of the word if there is no such non-vowel.


  this.r1 = r1;
  this.r2 = r2;
}


prelude(word) {
  this.markRegions(word);
  return word;
}


// (1b) en   ene => delete if in R1 and preceded by a valid en-ending, and then undouble the ending
// Define a valid en-ending as a non-vowel, and not gem.
// Define undoubling the ending as removing the last letter if the word ends kk, dd or tt.
step1b(word, suffixes) {
  var result = word;
  
  var match = endsinArr(result, suffixes);
  if (match != "") {
    var pos = result.length - match.length;
    if (pos >= this.r1) {
      // check the character before the matched en/ene AND check for gem
      if (!isVowel(result[pos - 1]) && result.substr(pos - 3, 3) !== "gem") {
        // delete
        result = removeSuffix(result, match.length);
        // Undouble the ending
        result = undoubleEnding(result);
      }
    }
  }

  return result;
}


step1(word) {
  var result = word;
  // (1a) heden => replace with heid if in R1
  if (endsin(result, "heden") && result.length - 5 >= this.r1) {
    result = removeSuffix(result, 5);
    result += "heid";
  }

  result = this.step1b(result, ["en", "ene"]);

  // (1c) s   se => delete if in R1 and preceded by a valid s-ending
  // Define a valid s-ending as a non-vowel other than j.
  var match = endsinArr(result, ["se", "s"]);
  if (match != "") {
    var pos = result.length - match.length;
    if (pos >= this.r1) {
      // check the character before the matched s/se
      // HtD: if there is a s before the s/se the suffix should stay
      //if (!isVowel(result[pos - 1]) && result[pos - 1] != "j") {
      if (!isVowel(result[pos - 1]) && !result.match(/[js]se?$/)) {
        result = removeSuffix(result, match.length);
      }
    }  
  }

  return result;
}


// Delete suffix e if in R1 and preceded by a non-vowel, and then undouble the ending
step2(word) {
  var result = word;
  if (endsin(result, "e") && this.r1 < result.length) {
    if (result.length > 1 && !isVowel(result[result.length - 2])) {
      // Delete
      result = removeSuffix(result, 1);
      this.suffixeRemoved = true;
      // Undouble the ending
      result = undoubleEnding(result);
    }
  }

  return result;
}


// Step 3a: heid => delete heid if in R2 and not preceded by c, and treat a preceding en as in step 1(b)
step3a(word) {
  var result = word;
  if (endsin(result, "heid") && result.length - 4 >= this.r2 && result[result.length - 5] != "c") {
    // Delete
    result = removeSuffix(result, 4);
    // Treat a preceding en as in step 1b
    result = this.step1b(result, ["en"]);
  }

  return result;
}


// d suffixes: Search for the longest among the following suffixes, and perform the action indicated.
step3b(word) {
  var result = word;

  // end   ing => delete if in R2; if preceded by ig, delete if in R2 and not preceded by e, otherwise undouble the ending
  var suf = "";
  if (suf = endsinArr(result, ["end", "ing"])) {
    if ((result.length - 3) >= this.r2) {
      // Delete suffix
      result = removeSuffix(result, 3);
      //this.regions(result);
      if (endsin(result, "ig") && (result.length - 2 >= this.r2) && result[result.length - 3] != "e") {
        // Delete suffix
        result = removeSuffix(result, 2);
      }
      else {
        result = undoubleEnding(result);
      }
    }
  }
    
  // ig => delete if in R2 and not preceded by e
  if (endsin(result, "ig") && this.r2 <= result.length - 2 && result[result.length - 3] != "e") {
    result = removeSuffix(result, 2);
  }
      
  // lijk => delete if in R2, and then repeat step 2
  if (endsin(result, "lijk") && this.r2 <= result.length - 4) {
    result = removeSuffix(result, 4);
    // repeat step 2
    result = this.step2(result);
  }

  // baar => delete if in R2
  if (endsin(result, "baar") && this.r2 <= result.length - 4) {
    result = removeSuffix(result, 4);
  }    

  // bar => delete if in R2 and if step 2 actually removed an e
  if (endsin(result, "bar") && this.r2 <= result.length - 3 && this.suffixeRemoved) {
    result = removeSuffix(result, 3);
  }    
  
  return result;
}


// undouble vowel => If the words ends CVD, where C is a non-vowel,
// D is a non-vowel other than I, and V is double a, e, o or u,
// remove one of the vowels from V (for example, maan -> man, brood -> brod)
step4(word) {
  var result = word;
  
  if (result.match(/[bcdfghjklmnpqrstvwxz](aa|ee|oo|uu)[bcdfghjklmnpqrstvwxz]$/)) {
    result = result.substr(0, result.length - 2) + result[result.length - 1];
  }
  
  return result;
}

stem(word) {
  return this.step4(this.step3b(this.step3a(this.step2(this.step1(this.prelude(word))))));
}
}


module.exports = new PorterStemmer();