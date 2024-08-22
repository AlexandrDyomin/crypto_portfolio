// var btn = document.querySelector('.add-transaction');
// btn.addEventListener('click', addTransaction);

// function addTransaction() {
//     var modal = createModal('Добавить транзакцию');
//     var container = document.querySelector('.container');
//     [...container.children].forEach((element) => element.classList.toggle('hidden'));
//     container.append(modal);
// }

// function createModal(title, values = {}) {
//     var modal = document.querySelector('#modal').content.cloneNode(true);
//     var h2 = modal.querySelector('h2')
//     Object.keys(values).forEach((key) => {
//         var input = modal.querySelector(`#${key}`);
//         input.value = values[key];
//     })
//     h2.textContent = title;

//     var cancelBtn = modal.querySelector('.cancel');
//     cancelBtn.addEventListener('click', cancel);

//     function cancel() {
//         var modal = document.querySelector('.transaction-modal');
//         modal.remove();
//         [...document.querySelector('.container').children]
//             .forEach((element) => element.classList.toggle('hidden'));
//     }

//     return modal;
// }