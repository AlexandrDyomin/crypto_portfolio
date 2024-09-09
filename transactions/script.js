var table = document.querySelector('.info');
var menu = document.querySelector('.context-menu');
var [ delBtn, editBtn ] = menu.children;
["contextmenu", "touchstart"].forEach((event) => table.addEventListener(event, showMenu));

function showMenu(e) {
    if(e.type === 'touchstart') {
        var clientXStart = e.changedTouches[0].clientX;
        var clientYStart = e.changedTouches[0].clientY;
        table.addEventListener('touchend', (e) => {
            var clientXEnd = e.changedTouches[0].clientX;
            var clientYEnd = e.changedTouches[0].clientY;
            if (clientXStart === clientXEnd & clientYStart === clientYEnd) {
                show();
            }
        }, { once: true });
        return;
    }
    show();

    function show() {
        e.preventDefault();
        var transaction = e.target.closest('.data-row');
        var delUrl = new URL(`?id=${transaction.dataset.id}` , delBtn.href)
        delBtn.href = delUrl.href;
        
        var [cryptoPair, date, type, amount, price] = [...transaction.children]
            .map((item) => item.textContent);
        var formatDate = `${date.slice(-4)}-${date.slice(3,5)}-${date.slice(0,2)}`;
        var editUrl = new URL(
            `?id=${transaction.dataset.id}&crypto-pair=${cryptoPair}&date=${formatDate}&type=${type}&amount=${amount}&price=${price}`, 
            editBtn.href
        );
        editBtn.href = editUrl.href;
        menu.removeAttribute('data-display');
    
        var rect = transaction.getBoundingClientRect();
        var documentWidth = document.documentElement.clientWidth;
        var menuWidth = menu.offsetWidth;
        menu.style.top = rect.top + rect.height + 'px';
        menu.style.left = `${(documentWidth / 2) - (menuWidth / 2)}px`;
    
        ['keydown', 'pointerdown']
            .forEach((event) => document.addEventListener(event, close, { once: true }));
    }

    function close(e) {
        if (e.code === 'Escape') {
            menu.dataset.display = 'hidden';
            return;
        }
    
        if (e.buttons === 1 && !/edit|del/.test(e.target.className)) {
            menu.dataset.display = 'hidden';
        }
    }
}