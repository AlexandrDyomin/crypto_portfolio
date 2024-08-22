var cancelBtn = document.querySelector('.cancel');
cancelBtn.addEventListener('click', back);

function back() {
    window.navigation.back();
}