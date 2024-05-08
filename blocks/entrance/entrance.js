var entrance = document.querySelector('.entrance');
entrance.addEventListener('input', handleInputForm);
var inputs = [...document.querySelectorAll('.c-input')];
var button = document.querySelector('.c-button');

function handleInputForm(e) {
    for(let field of inputs) {
        let value = field.value;
        if (value.length < +field.minLength) {
            button.setAttribute('disabled', true);
            return;
        }
    };

    button.removeAttribute('disabled');
}