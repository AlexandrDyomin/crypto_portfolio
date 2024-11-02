var periods = document.querySelector('.wrapper-periods .periods');
periods.addEventListener('change', handleChangePeriods);
var tBody = document.querySelector('.info tbody');

async function handleChangePeriods(e) {
	var radio = e.target;
	var { value } = radio;
	var today = new Date();
	today.setHours(0, 0, 0);
	var numberMillisecondsDay = 86400000;
	var dates = {
		'1д': { 
			startDate: new Date(today - numberMillisecondsDay).toISOString(), 
			endDate: today.toISOString() 
		},
		'1н': {
			startDate: new Date(today - numberMillisecondsDay * 7).toISOString(), 
			endDate: today.toISOString() 
		},
		'1м': {
			startDate: new Date(today - numberMillisecondsDay * 30).toISOString(), 
			endDate: today.toISOString() 
		},
		'1г': {
			startDate: new Date(today - numberMillisecondsDay * 365).toISOString(), 
			endDate: today.toISOString() 
		},
		'всё время': {
			startDate: '', 
			endDate: ''
		}
	}
	var url = new URL('/realizedPnL', 'http://localhost:8000');

	url.searchParams.set('startDate', dates[value].startDate);
	url.searchParams.set('endDate', dates[value].endDate);
	
	var request = await fetch(url.href);
	var result = await request.json();
	
	var rows = result.map((item) => {
		var tr = document.createElement('tr');
		tr.className = 'data-row';

		var values = Object.values(item);
		
		values.forEach((val) => {
			var td = document.createElement('td');
			td.textContent = val;
			tr.append(td);
		});
		return tr;

	});

	tBody.replaceChildren(...rows);
}