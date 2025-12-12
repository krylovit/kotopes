// Технические индикаторы
function calculateIndicators(data) {
    if (!data || data.length < 20) return data;

    // Простая копия чтобы не мутировать исходные данные
    const processedData = [...data];

    // SMA 7 (простая скользящая средняя)
    for (let i = 6; i < processedData.length; i++) {
        let sum = 0;
        for (let j = i-6; j <= i; j++) sum += processedData[j].close;
        processedData[i].sma7 = sum / 7;
    }

    // RSI (индекс относительной силы)
    for (let i = 14; i < processedData.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i-13; j <= i; j++) {
            const change = processedData[j].close - processedData[j-1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        processedData[i].rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }

    // Простое изменение цены в процентах
    for (let i = 1; i < processedData.length; i++) {
        processedData[i].change = ((processedData[i].close - processedData[i-1].close) / processedData[i-1].close) * 100;
    }

    // Волатильность (средний диапазон свечей)
    for (let i = 9; i < processedData.length; i++) {
        let sum = 0;
        for (let j = i-9; j <= i; j++) {
            sum += processedData[j].high - processedData[j].low;
        }
        processedData[i].volatility = sum / 10;
    }

    return processedData;
}

function updateIndicatorsTable() {
    if (!state || !state.priceData || state.priceData.length === 0) return;

    const table = document.getElementById('indicatorsBody');
    if (!table) return;

    const last = state.priceData[state.priceData.length - 1];
    
    const indicators = [
        {
            param: 'Цена',
            value: last.close.toFixed(2),
            meaning: 'Текущая цена актива',
            influence: 'Основной фактор для принятия решений'
        },
        {
            param: 'RSI',
            value: last.rsi ? last.rsi.toFixed(1) : '—',
            meaning: last.rsi > 70 ? 'Перекупленность' : last.rsi < 30 ? 'Перепроданность' : 'Нейтрально',
            influence: last.rsi > 70 ? 'Сигнал к продаже' : last.rsi < 30 ? 'Сигнал к покупке' : 'Нейтрально'
        },
        {
            param: 'Изменение',
            value: last.change ? last.change.toFixed(2) + '%' : '—',
            meaning: last.change > 0 ? 'Рост за период' : 'Падение за период',
            influence: last.change > 0 ? 'Бычий сигнал' : 'Медвежий сигнал'
        },
        {
            param: 'Объем',
            value: (last.volume / 1000).toFixed(1) + 'K',
            meaning: last.volume > 1000000 ? 'Высокая активность' : 'Средняя активность',
            influence: 'Высокий объем подтверждает тренд'
        },
        {
            param: 'SMA 7',
            value: last.sma7 ? last.sma7.toFixed(2) : '—',
            meaning: 'Краткосрочный тренд',
            influence: last.close > last.sma7 ? 'Цена выше среднего' : 'Цена ниже среднего'
        },
        {
            param: 'Волатильность',
            value: last.volatility ? last.volatility.toFixed(4) : '—',
            meaning: 'Изменчивость цены',
            influence: 'Высокая волатильность = выше риск и потенциальная прибыль'
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

// Экспортируем функции
window.calculateIndicators = calculateIndicators;
window.updateIndicatorsTable = updateIndicatorsTable;
