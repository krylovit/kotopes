// Технические индикаторы
function calculateIndicators(data) {
    if (data.length < 20) return data;

    // SMA 7
    for (let i = 6; i < data.length; i++) {
        let sum = 0;
        for (let j = i-6; j <= i; j++) sum += data[j].close;
        data[i].sma7 = sum / 7;
    }

    // RSI
    for (let i = 14; i < data.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i-13; j <= i; j++) {
            const change = data[j].close - data[j-1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        data[i].rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }

    // Простое изменение
    for (let i = 1; i < data.length; i++) {
        data[i].change = ((data[i].close - data[i-1].close) / data[i-1].close) * 100;
    }

    return data;
}

function updateIndicatorsTable() {
    if (state.priceData.length === 0) return;

    const last = state.priceData[state.priceData.length - 1];
    const table = document.getElementById('indicatorsBody');

    const indicators = [
        {name: 'Цена', value: last.close.toFixed(2), signal: '—', timeframe: 'Текущая'},
        {name: 'Объем', value: (last.volume / 1000).toFixed(1) + 'K', signal: last.volume > 1000000 ? 'Высокий' : 'Низкий', timeframe: '24ч'},
        {name: 'RSI', value: last.rsi ? last.rsi.toFixed(1) : '—', signal: last.rsi > 70 ? 'Перекуплен' : last.rsi < 30 ? 'Перепродан' : 'Нейтрально', timeframe: '14'},
        {name: 'SMA 7', value: last.sma7 ? last.sma7.toFixed(2) : '—', signal: last.close > last.sma7 ? 'Бычий' : 'Медвежий', timeframe: '7'},
        {name: 'Изменение', value: last.change ? last.change.toFixed(2) + '%' : '—', signal: last.change > 0 ? 'Рост' : 'Падение', timeframe: '1'},
        {name: 'Волатильность', value: '—', signal: 'Средняя', timeframe: '24ч'},
        {name: 'Точность НС', value: state.accuracyHistory.length > 0 ? state.accuracyHistory[state.accuracyHistory.length-1].accuracy.toFixed(1) + '%' : '—', signal: 'Обучение', timeframe: '100'},
        {name: 'Баланс НС', value: state.balance.toFixed(0), signal: state.balance > CONFIG.INITIAL_BALANCE ? 'Прибыль' : 'Убыток', timeframe: 'Сессия'}
    ];

    let html = '';
    indicators.forEach(ind => {
        html += `
            <tr>
                <td>${ind.name}</td>
                <td>${ind.value}</td>
                <td>${ind.signal}</td>
                <td>${ind.timeframe}</td>
            </tr>
        `;
    });

    table.innerHTML = html;
}
