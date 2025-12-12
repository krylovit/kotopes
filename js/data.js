// Работа с данными Binance API
async function fetchData(symbol, interval, limit = 100) {
    console.log(`Fetching data: ${symbol}, ${interval}, ${limit}`);
    
    try {
        // Используем прокси для избежания CORS ошибок
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const apiUrl = `${CONFIG.API_URL}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const url = proxyUrl + apiUrl;
        
        console.log(`Fetching from: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const klines = await response.json();
        console.log('Received klines:', klines.length);
        
        // Проверяем, что данные есть
        if (!klines || klines.length === 0) {
            console.log('No data received, generating test data');
            return generateTestData(limit);
        }
        
        return klines.map((k, index) => ({
            time: parseInt(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: parseInt(k[6]),
            quoteVolume: parseFloat(k[7]),
            trades: parseInt(k[8]),
            takerBuyBaseVolume: parseFloat(k[9]),
            takerBuyQuoteVolume: parseFloat(k[10])
        }));
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        addLog(`Ошибка загрузки: ${error.message}`, 'warning');
        
        // Генерация тестовых данных при ошибке
        console.log('Generating test data due to error');
        return generateTestData(limit);
    }
}

function generateTestData(count) {
    console.log(`Generating ${count} test candles`);
    
    const data = [];
    let price = 50000;
    const now = Date.now();
    const interval = 60000; // 1 минута в миллисекундах
    
    for (let i = 0; i < count; i++) {
        // Случайное движение цены (-2% до +2%)
        const change = (Math.random() * 0.04 - 0.02);
        price *= (1 + change);
        
        const high = price * (1 + Math.random() * 0.01);
        const low = price * (1 - Math.random() * 0.01);
        const open = price * (1 + (Math.random() * 0.02 - 0.01));
        const volume = Math.random() * 1000 + 500;
        
        data.push({
            time: now - (count - i) * interval,
            open: open,
            high: high,
            low: low,
            close: price,
            volume: volume,
            closeTime: now - (count - i - 1) * interval,
            quoteVolume: volume * price,
            trades: Math.floor(Math.random() * 1000),
            takerBuyBaseVolume: volume * 0.6,
            takerBuyQuoteVolume: volume * price * 0.6
        });
    }
    
    console.log('Generated test data:', data.length, 'candles');
    return data;
}

function evaluatePrediction(prediction, actualPrice) {
    console.log('Evaluating prediction:', prediction, 'actual:', actualPrice);
    
    if (!prediction || !prediction.decision) {
        console.error('Invalid prediction object');
        return;
    }

    // Используем скорректированный размер ставки
    const betSize = prediction.adjustedBetSize || 
                   parseFloat(document.getElementById('betSize').value) || 
                   CONFIG.DEFAULT_BET;
    
    const priceChange = actualPrice - prediction.price;
    
    let isCorrect = false;
    if (prediction.decision === 'BUY' && priceChange > 0) isCorrect = true;
    if (prediction.decision === 'SELL' && priceChange < 0) isCorrect = true;
    
    console.log(`Decision: ${prediction.decision}, Price change: ${priceChange}, Correct: ${isCorrect}`);
    
    // Обновляем баланс
    if (isCorrect) {
        state.balance += betSize * 0.95;
    } else {
        state.balance -= betSize;
    }
    
    console.log('New balance:', state.balance);
    
    // Сохраняем результат
    prediction.result = {
        actualPrice,
        isCorrect,
        profit: isCorrect ? betSize * 0.95 : -betSize,
        time: Date.now(),
        betSize: betSize,
        riskFactor: prediction.riskFactor || 1,
        priceChange: priceChange,
        priceChangePercent: (priceChange / prediction.price * 100).toFixed(2)
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
        isCorrect: isCorrect,
        adjustedConfidence: prediction.adjustedConfidence * 100 || prediction.probability * 100,
        decision: prediction.decision
    });
    
    // Логируем результат
    logPredictionResult(prediction, actualPrice, isCorrect, betSize);
    
    // Автоотчет каждые 10 прогнозов
    if (state.predictions.length % 10 === 0 && state.predictions.length > 0) {
        generateAutoReport();
    }
    
    // Ограничиваем размер массивов
    if (state.predictions.length > 1000) {
        state.predictions = state.predictions.slice(-500);
    }
    if (state.balanceHistory.length > 500) {
        state.balanceHistory = state.balanceHistory.slice(-250);
    }
    if (state.accuracyHistory.length > 500) {
        state.accuracyHistory = state.accuracyHistory.slice(-250);
    }
}

function logPredictionResult(prediction, actualPrice, isCorrect, betSize) {
    const confidence = (prediction.probability * 100).toFixed(1);
    const changePercent = ((actualPrice - prediction.price) / prediction.price * 100).toFixed(2);
    const changeSign = (actualPrice - prediction.price) >= 0 ? '+' : '';
    
    let analysis = '';
    if (prediction.experienceBased) {
        analysis += '📚 На основе опыта | ';
    }
    
    if (prediction.riskFactor && prediction.riskFactor !== 1) {
        analysis += `⚖️ Ставка ×${prediction.riskFactor.toFixed(2)} | `;
    }
    
    addLog(
        `${isCorrect ? '✅' : '❌'} ${prediction.decision} | ` +
        `Цена: ${prediction.price.toFixed(2)} → ${actualPrice.toFixed(2)} | ` +
        `Изменение: ${changeSign}${changePercent}% | ` +
        `Уверенность: ${confidence}% | ` +
        `Прибыль: ${isCorrect ? '+' : ''}${(isCorrect ? betSize * 0.95 : -betSize).toFixed(2)} USDT | ` +
        `Баланс: ${state.balance.toFixed(2)} USDT`,
        isCorrect ? 'profit' : 'loss',
        analysis + (isCorrect ? 'Нейросеть учится на успехе' : 'Анализируем ошибку для улучшения')
    );
}

function generateAutoReport() {
    const total = state.predictions.length;
    if (total < 5) return;
    
    const recent = state.predictions.slice(-10);
    const recentCorrect = recent.filter(p => p.result && p.result.isCorrect).length;
    const recentAccuracy = recent.length > 0 ? (recentCorrect / recent.length * 100).toFixed(1) : 0;
    
    const report = `
📊 АВТООТЧЕТ (прогнозов: ${total})
• Точность последние 10: ${recentAccuracy}%
• Баланс: ${state.balance.toFixed(2)} USDT
• Прибыль: ${(state.balance - CONFIG.INITIAL_BALANCE).toFixed(2)} USDT
• BUY/SELL: ${state.predictions.filter(p => p.decision === 'BUY').length}/${state.predictions.filter(p => p.decision === 'SELL').length}
`;
    
    addLog('📊 Автоотчет', 'info', report);
}
