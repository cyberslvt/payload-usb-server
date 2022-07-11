function stringValidation(str){
    const invalid = "<>,.\"';:{}%$=+`";
    let valid = true;
    for (var i = 0; i < str.length; i++) {
        if(str.includes(invalid.charAt(i))){
            valid = false;
        }
    }
    return valid;
}

var exports = {stringValidation};