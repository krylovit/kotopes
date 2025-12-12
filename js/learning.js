// Система мониторинга обучения
function updateLearningMetrics() {
    console.log('Обновление метрик обучения...');
    
    const predictions = state.predictions;
    const total = predictions.length;
    
    if (total === 0) {
        console.log('Нет прогнозов для анализа');
        return;
    }
    
    // Рассчитываем метрики
    const recent = predictions.slice(-50);
    const recentAccuracy = recent.filter(p => p.result?.isCorrect).length / recent.length * 100;
    const totalAccuracy = predictions.filter(p => p.result?.isCorrect).length / total * 100;
    
    // Определяем стадию обучения
    let stage = 'data_gathering';
    let stageText = 'Сбор данных';
    
    if (total < 10) {
        stage = 'data_gathering';
        stageText = 'Сбор данных';
    } else if (total < 30) {
        stage = 'initial_learning';
        stageText = 'Начальное обучение';
    } else if (recentAccuracy > 55) {
        stage = 'pattern_recognition';
        stageText = 'Распознавание паттернов';
    } else if (recentAccuracy > totalAccuracy) {
        stage = 'improving';
        stageText = 'Улучшение';
    } else {
        stage = 'adjusting';
        stageText = 'Корректировка';
    }
    
    // Рассчитываем понимание рынка
    let understanding = 0;
    if (total >= 10) understanding = 25;
    if (total >= 30) understanding = 50;
    if (total >= 100) understanding = 75;
    if (recentAccuracy > 60) understanding += 15;
    if (recentAccuracy > 70) understanding += 10;
    understanding = Math.min(understanding, 100);
    
    // Обновляем UI
    const learningStage = document.getElementById('learningStage');
    const marketUnderstanding = document.getElementById('marketUnderstanding');
    const neuronEfficiency = document.getElementById('neuronEfficiency');
    const learningMemory = document.getElementById('learningMemory');
    
    if (learningStage) learningStage.textContent = stageText;
    if (marketUnderstanding) marketUnderstanding.textContent = understanding + '%';
    if (neuronEfficiency) neuronEfficiency.textContent = recentAccuracy.toFixed(1) + '%';
    if (learningMemory) learningMemory.textContent = total + '/1000';
    
    // Обновляем прогресс-бары
    const learningProgress = document.getElementById('learningProgress');
    const understandingProgress = document.getElementById('understandingProgress');
    const efficiencyProgress = document.getElementById('efficiencyProgress');
    const memoryProgress = document.getElementById('memoryProgress');
    
    if (learningProgress) learningProgress.style.width = (total / 1000 * 100) + '%';
    if (understandingProgress) understandingProgress.style.width = understanding + '%';
    if (efficiencyProgress) efficiencyProgress.style.width = recentAccuracy + '%';
    if (memoryProgress) memoryProgress.style.width = (total / 1000 * 100) + '%';
    
    state.learningMetrics = {
        stage: stage,
        understanding: understanding,
        efficiency: recentAccuracy,
        memoryUsed: total,
        patternsFound: Math.floor(total / 10)
    };
    
    console.log('Метрики обновлены:', state.learningMetrics);
}

function generateLearningReport() {
    const predictions = state.predictions;
    const total = predictions.length;
    
    if (total < 10) {
        return "Нейросеть только начала обучение. Нужно больше данных для анализа.";
    }
    
    const recent = predictions.slice(-50);
    const recentAccuracy = recent.filter(p => p.result?.isCorrect).length / recent.length * 100;
    const totalAccuracy = predictions.filter(p => p.result?.isCorrect).length / total * 100;
    
    const buyPredictions = predictions.filter(p => p.decision === 'BUY');
    const sellPredictions = predictions.filter(p => p.decision === 'SELL');
    const buyAccuracy = buyPredictions.filter(p => p.result?.isCorrect).length / buyPredictions.length * 100 || 0;
    const sellAccuracy = sellPredictions.filter(p => p.result?.isCorrect).length / sellPredictions.length * 100 || 0;
    
    const confidenceCorrect = recent
        .filter(p => p.result?.isCorrect)
        .reduce((sum, p) => sum + p.probability, 0) / recent.filter(p => p.result?.isCorrect).length || 0;
    
    const confidenceWrong = recent
        .filter(p => p.result && !p.result.isCorrect)
        .reduce((sum, p) => sum + p.probability, 0) / recent.filter(p => p.result && !p.result.isCorrect).length || 0;
    
    let analysis = "";
    
    if (recentAccuracy > 60) {
        analysis = "✅ Нейросеть эффективно обучается и выявляет рыночные закономерности";
    } else if (recentAccuracy > 55) {
        analysis = "⚠️ Нейросеть учится, но нужны дополнительные данные для стабильности";
    } else if (recentAccuracy > 50) {
        analysis = "🔍 Нейросеть находится в процессе обучения, точность чуть выше случайной";
    } else {
        analysis = "🎯 Нейросеть изучает рынок, пока не выявила четких закономерностей";
    }
    
    if (Math.abs(buyAccuracy - sellAccuracy) > 20) {
        analysis += "\n📊 Нейросеть лучше работает с " + (buyAccuracy > sellAccuracy ? "BUY" : "SELL") + " сигналами";
    }
    
    if (confidenceCorrect > 0.7 && confidenceWrong < 0.5) {
        analysis += "\n🧠 Нейросеть уверена в правильных решениях и сомневается в ошибках - хороший признак";
    }
    
    const report = `
🧠 ОТЧЕТ ОБ ОБУЧЕНИИ НЕЙРОСЕТИ
===============================

📊 ОСНОВНЫЕ МЕТРИКИ:
• Всего прогнозов: ${total}
• Точность (все время): ${totalAccuracy.toFixed(1)}%
• Точность (последние 50): ${recentAccuracy.toFixed(1)}%
• Баланс: ${state.balance.toFixed(2)} USDT (${state.balance > CONFIG.INITIAL_BALANCE ? '+' : ''}${(state.balance - CONFIG.INITIAL_BALANCE).toFixed(2)})

🎯 ДЕТАЛЬНАЯ СТАТИСТИКА:
• Точность BUY: ${buyAccuracy.toFixed(1)}% (прогнозов: ${buyPredictions.length})
• Точность SELL: ${sellAccuracy.toFixed(1)}% (прогнозов: ${sellPredictions.length})
• Средняя уверенность (правильные): ${(confidenceCorrect * 100).toFixed(1)}%
• Средняя уверенность (ошибки): ${(confidenceWrong * 100).toFixed(1)}%

🔍 АНАЛИЗ ОБУЧЕНИЯ:
${analysis}

💡 РЕКОМЕНДАЦИИ:
${recentAccuracy < 55 ? '• Увеличьте размер обучающего окна (Lookback)' : '• Текущие настройки эффективны'}
${Math.abs(buyAccuracy - sellAccuracy) > 30 ? '• Нейросеть имеет смещение, рассмотрите балансировку данных' : '• Баланс сигналов в норме'}

📈 СТАДИЯ ОБУЧЕНИЯ: ${state.learningMetrics.stage === 'pattern_recognition' ? 'РАСПОЗНАВАНИЕ ПАТТЕРНОВ' : 'ОБУЧЕНИЕ'}
`;
    
    return report;
}

function analyzeLastDecision() {
    if (!state.lastPrediction) {
        return "Нет данных о последнем решении";
    }
    
    const pred = state.lastPrediction;
    const confidence = (pred.probability * 100).toFixed(1);
    
    let analysis = "";
    
    if (pred.probability > 0.7) {
        analysis = "🧠 Нейросеть ВЫСОКО уверена в этом решении";
    } else if (pred.probability > 0.6) {
        analysis = "🤔 Нейросеть умеренно уверена";
    } else {
        analysis = "🎯 Нейросеть НЕУВЕРЕННА, решение на грани";
    }
    
    if (pred.result) {
        analysis += pred.result.isCorrect ? 
            "\n✅ Прогноз был ПРАВИЛЬНЫМ - нейросеть запомнит этот успех" :
            "\n❌ Прогноз был ОШИБОЧНЫМ - нейросеть скорректирует веса";
    }
    
    return `
🔍 АНАЛИЗ ПОСЛЕДНЕГО РЕШЕНИЯ НЕЙРОСЕТИ
======================================

📊 РЕШЕНИЕ:
• Тип: ${pred.decision}
• Уверенность: ${confidence}%
• Цена в момент решения: ${pred.price.toFixed(2)}
${pred.result ? `• Реальная цена: ${pred.result.actualPrice.toFixed(2)}` : ''}
${pred.result ? `• Результат: ${pred.result.isCorrect ? '✅ ПРАВИЛЬНО' : '❌ ОШИБКА'}` : ''}

🤔 КАК НЕЙРОСЕТЬ ПРИНЯЛА РЕШЕНИЕ:
1. Проанализировала ${CONFIG.LOOKBACK} последних свечей
2. Увидела паттерны в данных
3. Рассчитала вероятность роста: ${confidence}%
4. Приняла решение: ${pred.decision}

${analysis}

💡 ЧТО ЭТО ЗНАЧИТ ДЛЯ ОБУЧЕНИЯ:
${pred.result && pred.result.isCorrect ? 
    '• Веса нейросети будут усилены в сторону этого типа решений' :
    '• Веса нейросети будут скорректированы для избежания подобных ошибок'}
`;
}

// Экспортируем функции
window.updateLearningMetrics = updateLearningMetrics;
window.generateLearningReport = generateLearningReport;
window.analyzeLastDecision = analyzeLastDecision;
