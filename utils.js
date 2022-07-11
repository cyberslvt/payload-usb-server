function stringValidation(str){
    const invalid = "<>,.\"';:{}%$=+`";
    for (var i = 0; i < str.length; i++) {
        if(str.includes(invalid.charAt(i))){
            return false;
        }
    }
    return true;
}

var exports = {stringValidation};
module.exports = exports;