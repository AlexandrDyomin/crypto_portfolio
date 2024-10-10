export function calcBalance(coins, coin = 'USDT') { 
    return new Promise((resolve, reject) => {
        var balance = 0;
        var data = coins.map(
            ({ coinName }, i) => fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coinName}${coin}`)
                .then((response) => response.json())
                .then((data) => {
                    var price = data.price || 0;
                    var { amount } = coins[i];
                    return balance += price * amount;
                })
                .catch((error) => {
                    console.error(error);
                    reject(error);
                })
        );
        Promise.allSettled(data)
            .then(() => resolve(balance));
    });
}