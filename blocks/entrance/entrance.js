var entrance = document.querySelector('.entrance');
entrance.addEventListener('input', handleInputForm);
var inputs = [...document.querySelectorAll('.c-input')];
var button = document.querySelector('.c-button');

function handleInputForm(e) {
    var valuesOfFields = inputs.map((item) => item.value.trim());
    if (valuesOfFields.includes('')) {
        button.setAttribute('disabled', true);
        return;
    }
    button.removeAttribute('disabled');
}