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

    // Волатильность
    for (let i = 9; i < data.length; i++) {
        let sum = 0;
        for (let j = i-9; j <= i; j++) sum += data[j].high - data[j].low;
        data[i].volatility = sum / 10;
    }

    return data;
}

function updateIndicatorsTable() {
    if (state.priceData.length === 0) return;

    const last = state.priceData[state.priceData.length - 1];
    const table = document.getElementById('indicatorsBody');

    const indicators = [
        {
            param: 'Цена',
            value: last.close.toFixed(2),
            meaning: 'Основной показатель для анализа',
            influence: 'Прямое влияние на решение BUY/SELL'
        },
        {
            param: 'RSI',
            value: last.rsi ? last.rsi.toFixed(1) : '—',
            meaning: last.rsi > 70 ? 'Перекупленность' : last.rsi < 30 ? 'Перепроданность' : 'Нейтрально',
            influence: last.rsi > 70 ? 'Склоняет к SELL' : last.rsi < 30 ? 'Склоняет к BUY' : 'Нейтрально'
        },
        {
            param: 'Изменение цены',
            value: last.change ? last.change.toFixed(2) + '%' : '—',
            meaning: last.change > 0 ? 'Рост' : 'Падение',
            influence: last.change > 0 ? 'Склоняет к BUY' : 'Склоняет к SELL'
        },
        {
            param: 'Объем',
            value: (last.volume / 1000).toFixed(1) + 'K',
            meaning: last.volume > 1000000 ? 'Высокая активность' : 'Средняя активность',
            influence: 'Высокий объем усиливает сигналы'
        },
        {
            param: 'SMA 7',
            value: last.sma7 ? last.sma7.toFixed(2) : '—',
            meaning: 'Краткосрочный тренд',
            influence: last.close > last.sma7 ? 'Бычий сигнал' : 'Медвежий сигнал'
        },
        {
            param: 'Волатильность',
            value: last.volatility ? last.volatility.toFixed(4) : '—',
            meaning: 'Изменчивость цены',
            influence: 'Высокая волатильность = выше риск'
        },
        {
            param: 'История точности',
            value: state.accuracyHistory.length > 0 ? 
                   state.accuracyHistory[state.accuracyHistory.length-1].accuracy.toFixed(1) + '%' : '—',
            meaning: 'Насколько нейросеть права сейчас',
            influence: 'Высокая точность = больше уверенности'
        },
        {
            param: 'Стадия обучения',
            value: state.learningMetrics.stage.replace('_', ' '),
            meaning: 'Текущая фаза обучения нейросети',
            influence: 'Влияет на агрессивность решений'
        }
    ];

    let html = '';
    indicators.forEach(ind => {
        html += `
            <tr>
                <td><strong>${ind.param}</strong></td>
                <td>${ind.value}</td>
                <td>${ind.meaning}</td>
                <td>${ind.influence}</td>
            </tr>
        `;
    });

    table.innerHTML = html;
}
