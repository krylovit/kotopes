// Работа с данными Binance API
async function fetchData(symbol, interval, limit = 100) {
    try {
        const url = `${CONFIG.API_URL}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            // Пробуем альтернативный endpoint
            const altUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            const altResponse = await fetch(altUrl);
            
            if (!altResponse.ok) throw new Error(`HTTP ${response.status}`);
            
            const klines = await altResponse.json();
            return processKlines(klines);
        }
        
        const klines = await response.json();
        return processKlines(klines);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        
        // Генерация тестовых данных при ошибке
        if (state.priceData.length === 0) {
            addLog('Используем тестовые данные', 'warning', 'Binance API недоступен');
            return generateTestData(limit);
        }
        
        addLog(`Ошибка загрузки: ${error.message}`, 'warning');
        return null;
    }
}

function processKlines(klines) {
    return klines.map(k => ({
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
}

function generateTestData(count) {
    const data = [];
    let price = 50000;
    const now = Date.now();
    
    for (let i = 0; i < count; i++) {
        // Случайное движение цены (-2% до +2%)
        const change = (Math.random() * 0.04 - 0.02);
        price *= (1 + change);
        
        const high = price * (1 + Math.random() * 0.01);
        const low = price * (1 - Math.random() * 0.01);
        const open = price * (1 + (Math.random() * 0.02 - 0.01));
        
        data.push({
            time: now - (count - i) * 60000,
            open: open,
            high: high,
            low: low,
            close: price,
            volume: Math.random() * 1000 + 500
        });
    }
    
    return data;
}

function evaluatePrediction(prediction, actualPrice) {
    // Используем скорректированный размер ставки
    const betSize = prediction.adjustedBetSize || 
                   parseFloat(document.getElementById('betSize').value) || 
                   CONFIG.DEFAULT_BET;
    
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
    
    // Сохраняем опыт
    const marketContext = analyzeMarketContext();
    saveExperience(prediction, prediction.result, marketContext);
    
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
    
    // Анализируем результат для обучения
    analyzeResultForLearning(prediction, isCorrect);
    
    // Логируем результат
    logPredictionResult(prediction, actualPrice, isCorrect, betSize);
    
    // Автоотчет каждые 20 прогнозов
    if (state.predictions.length % 20 === 0 && state.predictions.length > 0) {
        generateAutoReport();
    }
}

function analyzeResultForLearning(prediction, isCorrect) {
    // Анализируем, была ли уверенность адекватной
    const confidence = prediction.probability;
    const wasConfident = confidence > 0.7;
    const wasWrongConfident = wasConfident && !isCorrect;
    const wasRightConfident = wasConfident && isCorrect;
    
    if (wasWrongConfident) {
        // Нейросеть была уверена, но ошиблась - важный урок
        addLog('⚠️ Нейросеть была уверена, но ошиблась - корректируем веса', 'warning',
               `Уверенность: ${(confidence*100).toFixed(1)}% | Решение: ${prediction.decision}`);
    } else if (wasRightConfident) {
        // Нейросеть была уверена и права - укрепляем паттерн
        addLog('✅ Высокая уверенность подтвердилась - укрепляем паттерн', 'info',
               `Уверенность: ${(confidence*100).toFixed(1)}% | Решение: ${prediction.decision}`);
    }
    
    // Анализируем баланс BUY/SELL
    const total = experienceDB.decisions.length;
    const buyCount = experienceDB.decisions.filter(d => d.decision === 'BUY').length;
    const sellCount = experienceDB.decisions.filter(d => d.decision === 'SELL').length;
    
    if (total >= 20) {
        const buySellRatio = buyCount / total;
        if (buySellRatio > 0.8) {
            addLog('📊 Дисбаланс: слишком много BUY решений', 'warning',
                   `BUY: ${buyCount}, SELL: ${sellCount}, соотношение: ${(buySellRatio*100).toFixed(1)}%`);
        } else if (buySellRatio < 0.2) {
            addLog('📊 Дисбаланс: слишком много SELL решений', 'warning',
                   `BUY: ${buyCount}, SELL: ${sellCount}, соотношение: ${(100 - buySellRatio*100).toFixed(1)}%`);
        }
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
    
    if (prediction.classBalanceCorrection && Math.abs(prediction.classBalanceCorrection) > 0.1) {
        const correctionType = prediction.classBalanceCorrection > 0 ? 'BUY→' : 'SELL→';
        analysis += `⚖️ Баланс ${correctionType} | `;
    }
    
    // Определяем уровень важности
    const profitLoss = Math.abs(prediction.result.profit);
    let importance = 'normal';
    if (profitLoss > betSize * 2) importance = 'high';
    if (!isCorrect && prediction.probability > 0.7) importance = 'critical';
    
    const logEntry = {
        time: new Date().toLocaleTimeString(),
        decision: prediction.decision,
        confidence: confidence,
        priceFrom: prediction.price.toFixed(2),
        priceTo: actualPrice.toFixed(2),
        change: `${changeSign}${changePercent}%`,
        result: isCorrect ? '✅' : '❌',
        profit: prediction.result.profit.toFixed(2),
        balance: state.balance.toFixed(2),
        analysis: analysis,
        importance: importance
    };
    
    addLog(
        `${isCorrect ? '✅' : '❌'} ${prediction.decision} | ` +
        `Цена: ${prediction.price.toFixed(2)} → ${actualPrice.toFixed(2)} | ` +
        `Изменение: ${changeSign}${changePercent}% | ` +
        `Уверенность: ${confidence}% | ` +
        `Прибыль: ${isCorrect ? '+' : ''}${prediction.result.profit.toFixed(2)} USDT | ` +
        `Баланс: ${state.balance.toFixed(2)} USDT`,
        isCorrect ? 'profit' : 'loss',
        analysis + (isCorrect ? 'Нейросеть учится на успехе' : 'Анализируем ошибку для улучшения')
    );
    
    return logEntry;
}

function generateAutoReport() {
    const total = state.predictions.length;
    if (total < 10) return;
    
    const recent = state.predictions.slice(-20);
    const recentCorrect = recent.filter(p => p.result && p.result.isCorrect).length;
    const recentAccuracy = recent.length > 0 ? (recentCorrect / recent.length * 100).toFixed(1) : 0;
    
    const buyPredictions = state.predictions.filter(p => p.decision === 'BUY');
    const sellPredictions = state.predictions.filter(p => p.decision === 'SELL');
    
    const buyAccuracy = buyPredictions.length > 0 ? 
        (buyPredictions.filter(p => p.result && p.result.isCorrect).length / buyPredictions.length * 100).toFixed(1) : 0;
    
    const sellAccuracy = sellPredictions.length > 0 ? 
        (sellPredictions.filter(p => p.result && p.result.isCorrect).length / sellPredictions.length * 100).toFixed(1) : 0;
    
    const patternsFound = experienceDB.patterns.length;
    const memoryUsage = experienceDB.memoryUsage > 0 ? 
        ((experienceDB.memoryUsage / 1024).toFixed(1) + 'KB') : '0KB';
    
    const report = `
📊 АВТООТЧЕТ ОБУЧЕНИЯ (прогнозов: ${total})
=========================================

🎯 ТОЧНОСТЬ:
• Последние 20: ${recentAccuracy}%
• Все время: ${(state.accuracyHistory[state.accuracyHistory.length-1]?.accuracy || 0).toFixed(1)}%
• BUY: ${buyAccuracy}% (${buyPredictions.length} раз)
• SELL: ${sellAccuracy}% (${sellPredictions.length} раз)

🧠 ПАМЯТЬ ОБУЧЕНИЯ:
• Паттернов найдено: ${patternsFound}
• Использовано памяти: ${memoryUsage}
• Соотношение BUY/SELL: ${buyPredictions.length}:${sellPredictions.length}

💰 ФИНАНСЫ:
• Баланс: ${state.balance.toFixed(2)} USDT
• Прибыль: ${(state.balance - CONFIG.INITIAL_BALANCE).toFixed(2)} USDT
• Средняя ставка: ${calculateAverageBet().toFixed(2)} USDT

${getLearningRecommendations()}
`;
    
    addLog('📊 Автоотчет обучения', 'info', report);
}

function calculateAverageBet() {
    if (state.predictions.length === 0) return CONFIG.DEFAULT_BET;
    
    const totalBet = state.predictions.reduce((sum, pred) => {
        return sum + (pred.result?.betSize || CONFIG.DEFAULT_BET);
    }, 0);
    
    return totalBet / state.predictions.length;
}

function getLearningRecommendations() {
    const recommendations = [];
    const total = state.predictions.length;
    
    if (total < 30) {
        recommendations.push('• Нужно больше данных для точного анализа');
    }
    
    const buyCount = state.predictions.filter(p => p.decision === 'BUY').length;
    const sellCount = state.predictions.filter(p => p.decision === 'SELL').length;
    const ratio = buyCount / (buyCount + sellCount);
    
    if (ratio > 0.7) {
        recommendations.push('• Слишком много BUY решений, нейросеть смещена');
    } else if (ratio < 0.3) {
        recommendations.push('• Слишком много SELL решений, нейросеть смещена');
    }
    
    const recentAccuracy = state.accuracyHistory.length > 0 ? 
        state.accuracyHistory[state.accuracyHistory.length-1].accuracy : 0;
    
    if (recentAccuracy < 45) {
        recommendations.push('• Точность низкая, рассмотрите смену таймфрейма или валютной пары');
    } else if (recentAccuracy > 60) {
        recommendations.push('• Нейросеть обучается эффективно, продолжайте в том же духе');
    }
    
    if (recommendations.length === 0) {
        recommendations.push('• Все параметры в норме, обучение идет стабильно');
    }
    
    return '💡 РЕКОМЕНДАЦИИ:\n' + recommendations.join('\n');
}
