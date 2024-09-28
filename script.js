var rows = document.querySelectorAll('.data-row');
rows.forEach((row) => {
    var pair = `${row.children[0].textContent}USDT`;
    var amount = row.children[1].textContent;
    var url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;
    fetch(url)
        .then((response) => response.json())
        .then(({ price }) => {
            var td = document.createElement('td');
            td.textContent = (parseFloat(price) * amount).toFixed(2);
            row.append(td);
        });
});