// Работа с данными Binance API
async function fetchData(symbol, interval, limit = 100) {
    try {
        const url = `${CONFIG.API_URL}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const klines = await response.json();

        return klines.map(k => ({
            time: parseInt(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        addLog(`Ошибка загрузки: ${error.message}`, 'warning');
        return null;
    }
}

function evaluatePrediction(prediction, actualPrice) {
    const betSize = parseFloat(document.getElementById('betSize').value) || CONFIG.DEFAULT_BET;
    const priceChange = actualPrice - prediction.price;

    let isCorrect = false;
    if (prediction.decision === 'BUY' && priceChange > 0) isCorrect = true;
    if (prediction.decision === 'SELL' && priceChange < 0) isCorrect = true;

    // Обновляем баланс
    if (isCorrect) {
        state.balance += betSize * 0.95;
    } else {
        state.balance -= betSize;
    }

    // Сохраняем результат
    prediction.result = {
        actualPrice,
        isCorrect,
        profit: isCorrect ? betSize * 0.95 : -betSize,
        time: Date.now()
    };

    state.predictions.push(prediction);
    state.balanceHistory.push({
        time: Date.now(),
        balance: state.balance
    });

    // Рассчитываем точность
    const recent = state.predictions.slice(-100);
    const correct = recent.filter(p => p.result && p.result.isCorrect).length;
    const accuracy = recent.length > 0 ? (correct / recent.length) * 100 : 0;

    state.accuracyHistory.push({
        time: Date.now(),
        accuracy
    });

    // Сохраняем уверенность
    state.confidenceHistory.push({
        time: Date.now(),
        confidence: prediction.probability * 100,
        isCorrect: isCorrect
    });

    // Логируем результат с анализом
    const confidence = (prediction.probability * 100).toFixed(1);
    const changePercent = (priceChange / prediction.price * 100).toFixed(2);

    let analysis = "";
    if (isCorrect && prediction.probability > 0.6) {
        analysis = "✅ Нейросеть была уверена и оказалась права - отличное обучение!";
    } else if (!isCorrect && prediction.probability > 0.7) {
        analysis = "⚠️ Нейросеть была уверена, но ошиблась - важный урок для корректировки весов";
    } else if (!isCorrect && prediction.probability < 0.5) {
        analysis = "🎯 Нейросеть сомневалась и ошиблась - ожидаемый результат при обучении";
    }

    addLog(
        `Результат: ${isCorrect ? '✅ ПРАВИЛЬНО' : '❌ ОШИБКА'} | ` +
        `Цена: ${prediction.price.toFixed(2)} → ${actualPrice.toFixed(2)} | ` +
        `Изменение: ${changePercent}% | ` +
        `Уверенность: ${confidence}% | ` +
        `Баланс: ${state.balance.toFixed(2)} USDT`,
        isCorrect ? 'profit' : 'loss',
        analysis
    );

    // Автоотчет каждые 50 прогнозов
    if (state.predictions.length % 50 === 0) {
        const report = generateLearningReport();
        addLog("📊 АВТООТЧЕТ ОБУЧЕНИЯ", 'info', report);
    }
}
