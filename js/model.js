// Создание и работа с LSTM моделью
async function createModel() {
    console.log('Создание LSTM модели...');
    showLoader(true, 'Создание нейросети...');
    
    try {
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js не загружен');
        }
        
        // Создаем новую последовательную модель
        const newModel = tf.sequential();
        
        // Первый LSTM слой
        newModel.add(tf.layers.lstm({
            units: 64,
            inputShape: [CONFIG.LOOKBACK, CONFIG.FEATURES],
            returnSequences: true
        }));
        
        // Второй LSTM слой
        newModel.add(tf.layers.lstm({
            units: 32
        }));
        
        // Полносвязные слои
        newModel.add(tf.layers.dense({
            units: 16,
            activation: 'relu'
        }));
        
        newModel.add(tf.layers.dropout({
            rate: 0.3
        }));
        
        newModel.add(tf.layers.dense({
            units: 8,
            activation: 'relu'
        }));
        
        // Выходной слой
        newModel.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid'
        }));
        
        // Компиляция модели
        newModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });
        
        model = newModel;
        
        // Инициализируем веса случайными данными
        const dummyInput = tf.randomNormal([1, CONFIG.LOOKBACK, CONFIG.FEATURES]);
        const dummyOutput = model.predict(dummyInput);
        dummyInput.dispose();
        dummyOutput.dispose();
        
        console.log('Модель успешно создана');
        addLog('LSTM модель создана', 'info', '64LSTM → 32LSTM → 16Dense → 8Dense → 1Output');
        
        return model;
        
    } catch (error) {
        console.error('Ошибка создания модели:', error);
        addLog('Ошибка создания модели', 'error', error.message);
        return null;
    } finally {
        showLoader(false);
    }
}

// Подготовка входных данных для модели
function prepareInput(data) {
    if (!data || data.length < CONFIG.LOOKBACK) {
        console.log('Недостаточно данных для предсказания:', data?.length);
        return null;
    }
    
    const sequence = data.slice(-CONFIG.LOOKBACK);
    const features = sequence.map(candle => {
        // Нормализуем данные для лучшей работы нейросети
        return [
            (candle.close || 0) / 100000,          // Цена
            (candle.volume || 0) / 1000000,        // Объем
            (candle.sma7 || candle.close || 0) / 100000, // SMA7
            (candle.rsi || 50) / 100,              // RSI (нормализованный 0-1)
            (candle.change || 0) / 10,             // Изменение цены
            (candle.volatility || 0) / 1000,       // Волатильность
            Math.random() * 0.1,                   // Случайный шум для регуляризации
            0                                       // Запасной параметр
        ];
    });
    
    return tf.tensor3d([features]);
}

// Анализ рыночных условий
function analyzeMarketContext() {
    if (!state || !state.priceData || state.priceData.length < 10) {
        return {
            trend: 'unknown',
            volatility: 'unknown',
            rsiExtreme: 'normal',
            volume: 'normal'
        };
    }
    
    const recentData = state.priceData.slice(-20);
    const priceChanges = [];
    
    for (let i = 1; i < recentData.length; i++) {
        const change = (recentData[i].close - recentData[i-1].close) / recentData[i-1].close;
        priceChanges.push(change);
    }
    
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    
    let trend = 'neutral';
    if (avgChange > 0.001) trend = 'bullish';
    if (avgChange < -0.001) trend = 'bearish';
    
    // Расчет волатильности
    const variance = priceChanges.reduce((acc, change) => acc + Math.pow(change - avgChange, 2), 0) / priceChanges.length;
    const volatility = Math.sqrt(variance);
    
    let volatilityLevel = 'medium';
    if (volatility > 0.02) volatilityLevel = 'high';
    if (volatility < 0.005) volatilityLevel = 'low';
    
    const lastCandle = recentData[recentData.length - 1];
    let rsiExtreme = 'normal';
    if (lastCandle.rsi > 70) rsiExtreme = 'overbought';
    if (lastCandle.rsi < 30) rsiExtreme = 'oversold';
    
    return {
        trend: trend,
        volatility: volatilityLevel,
        rsiExtreme: rsiExtreme,
        volume: lastCandle.volume > 1000000 ? 'high' : 'normal'
    };
}

// Основная функция прогноза
async function makePrediction() {
    console.log('makePrediction вызван');
    
    if (!model) {
        console.log('Модель не создана, пропускаем предсказание');
        return null;
    }
    
    if (!state || !state.priceData || state.priceData.length < CONFIG.LOOKBACK) {
        console.log(`Недостаточно данных: ${state.priceData?.length || 0}/${CONFIG.LOOKBACK}`);
        return null;
    }
    
    try {
        const input = prepareInput(state.priceData);
        if (!input) {
            console.log('Не удалось подготовить входные данные');
            return null;
        }
        
        console.log('Делаем предсказание...');
        const prediction = model.predict(input);
        const rawProbability = (await prediction.data())[0];
        
        const currentPrice = state.priceData[state.priceData.length - 1].close;
        const marketContext = analyzeMarketContext();
        
        const baseDecision = {
            time: Date.now(),
            price: currentPrice,
            probability: rawProbability,
            decision: rawProbability > 0.5 ? 'BUY' : 'SELL',
            result: null,
            rawProbability: rawProbability,
            marketContext: marketContext
        };
        
        // Очищаем тензоры
        input.dispose();
        prediction.dispose();
        
        console.log('Предсказание успешно:', baseDecision);
        
        return baseDecision;
        
    } catch (error) {
        console.error('Ошибка при предсказании:', error);
        addLog('Ошибка предсказания', 'warning', error.message);
        return null;
    }
}

// Балансировка классов
function applyClassBalance(prediction) {
    if (!experienceDB || experienceDB.decisions.length < 10) {
        return prediction;
    }
    
    const buyCount = experienceDB.decisions.filter(d => d.decision === 'BUY').length;
    const sellCount = experienceDB.decisions.filter(d => d.decision === 'SELL').length;
    const total = buyCount + sellCount;
    
    if (total === 0) return prediction;
    
    const currentRatio = buyCount / total;
    const imbalance = currentRatio - 0.5; // Целевое соотношение 50/50
    
    let adjustedProbability = prediction.probability;
    
    if (imbalance > 0.2) { // Слишком много BUY
        if (prediction.decision === 'BUY') {
            adjustedProbability -= 0.05 * imbalance;
        } else {
            adjustedProbability += 0.05 * imbalance;
        }
    } else if (imbalance < -0.2) { // Слишком много SELL
        if (prediction.decision === 'SELL') {
            adjustedProbability -= 0.05 * Math.abs(imbalance);
        } else {
            adjustedProbability += 0.05 * Math.abs(imbalance);
        }
    }
    
    adjustedProbability = Math.max(0.1, Math.min(0.9, adjustedProbability));
    
    return {
        ...prediction,
        probability: adjustedProbability,
        classBalanceCorrection: imbalance
    };
}

// Сохранение модели
async function saveModel() {
    if (!model) {
        showNotification('Нет модели для сохранения', 'warning');
        return;
    }
    
    showLoader(true, 'Сохранение модели...');
    
    try {
        // Сохраняем модель в localStorage
        await model.save('localstorage://neuro-trader-model-v5');
        
        // Сохраняем состояние
        const saveData = {
            balance: state.balance,
            predictions: state.predictions.slice(-100),
            balanceHistory: state.balanceHistory.slice(-50),
            accuracyHistory: state.accuracyHistory.slice(-50),
            confidenceHistory: state.confidenceHistory.slice(-50),
            savedAt: Date.now()
        };
        
        localStorage.setItem(CONFIG.MODEL_KEY, JSON.stringify(saveData));
        
        addLog('Модель и данные сохранены', 'info');
        showNotification('Модель успешно сохранена', 'info');
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        addLog('Ошибка сохранения модели', 'error');
        showNotification('Ошибка сохранения', 'error');
    } finally {
        showLoader(false);
    }
}

// Загрузка модели
async function loadModel() {
    showLoader(true, 'Загрузка модели...');
    
    try {
        // Проверяем, есть ли сохраненная модель
        const savedModels = await tf.io.listModels();
        
        if (savedModels['localstorage://neuro-trader-model-v5']) {
            model = await tf.loadLayersModel('localstorage://neuro-trader-model-v5');
            console.log('Модель загружена из памяти');
            addLog('Модель загружена из памяти', 'info');
        } else {
            console.log('Сохраненной модели не найдено, создадим новую');
        }
        
        // Загружаем данные состояния
        const savedData = localStorage.getItem(CONFIG.MODEL_KEY);
        if (savedData) {
            const data = JSON.parse(savedData);
            
            state.balance = data.balance || CONFIG.INITIAL_BALANCE;
            state.predictions = data.predictions || [];
            state.balanceHistory = data.balanceHistory || [{time: Date.now(), balance: state.balance}];
            state.accuracyHistory = data.accuracyHistory || [];
            state.confidenceHistory = data.confidenceHistory || [];
            
            addLog('Данные обучения загружены', 'info');
        }
        
        showNotification('Модель загружена', 'info');
        
    } catch (error) {
        console.error('Ошибка загрузки модели:', error);
        addLog('Не удалось загрузить модель', 'warning');
    } finally {
        showLoader(false);
    }
}

// Экспортируем функции
window.createModel = createModel;
window.makePrediction = makePrediction;
window.saveModel = saveModel;
window.loadModel = loadModel;
window.model = model;
