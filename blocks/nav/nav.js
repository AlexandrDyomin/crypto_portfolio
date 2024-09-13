var nav = document.querySelector('.navigation');
var burger = nav.querySelector('.burger');

['keydown', 'pointerdown'].forEach((event) => burger.addEventListener(event, toggleMenu));

function toggleMenu(e) {
    if (e.code === 'Enter' || e.buttons === 1) {
        if (nav.dataset.status === 'open') {
            nav.removeAttribute('data-status');
    
        } else {
            nav.dataset.status = 'open';
            ['keydown', 'pointerdown']
                .forEach((event) => document.addEventListener(event, closeNav));
        } 
    }
    
    function closeNav(e) {
        if (e.code === 'Escape') {
            nav.removeAttribute('data-status');
            ['keydown', 'pointerdown']
                .forEach((event) => document.addEventListener(event, closeNav));
            return;
        }

        if (e.buttons === 1 && (!e.target.closest('.navigation') && e.target.className !== 'navigation')) {
            nav.removeAttribute('data-status');
            ['keydown', 'pointerdown']
                .forEach((event) => document.addEventListener(event, closeNav));
            return;
        } 

        if (e.target.nodeName === 'A' && e.target.closest('.navigation')) {
            document.addEventListener('pointerdown', closeNav);
        }
    }
}

