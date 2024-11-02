import { chart } from '../chart/chart.js';

var burger = document.querySelector(".user");
var button = burger.querySelector(".user_button");
button.addEventListener("pointerdown", handlePointerdownUserButton);

var url = `${process.env.PROTOCOL}://${process.env.HOST}:${process.env.PORT}/getBalance`;
fetch(url).then(getBalance).then(formatBalance).then(displayBalance);

var data = [
    ["Ticker", "Percent"],
    ["Work", 1],
    ["Eat", 2],
    ["Commute", 2],
    ["Watch TV", 2],
    ["Sleep", 7],
    ["x", 10],
]

chart(data);


function handlePointerdownUserButton(e) {
    burger.dataset.status = burger.dataset.status ? "" : "open";
    document.body.dataset.overflow = document.body.dataset.overflow
    ? ""
    : "hidden";
}

function getBalance(response) {
    return response.text();
}

function formatBalance(balance) {
    return `$${(+balance).toFixed(2)}`;
}

function displayBalance(balance) {
    var userMoney = burger.querySelector(".user_money");
    userMoney.textContent = balance;
}
