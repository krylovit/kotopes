// Работа с LSTM моделью
async function createModel() {
    showLoader(true, 'Создание LSTM модели...');

    try {
        const model = tf.sequential();

        // Первый LSTM слой
        model.add(tf.layers.lstm({
            units: 64,
            inputShape: [CONFIG.LOOKBACK, CONFIG.FEATURES],
            returnSequences: true
        }));

        // Второй LSTM слой
        model.add(tf.layers.lstm({
            units: 32
        }));

        // Dense слои
        model.add(tf.layers.dense({units: 16, activation: 'relu'}));
        model.add(tf.layers.dropout({rate: 0.3}));
        model.add(tf.layers.dense({units: 8, activation: 'relu'}));

        // Выходной слой
        model.add(tf.layers.dense({units: 1, activation: 'sigmoid'}));

        // Компиляция
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        console.log('Модель создана');
        addLog('LSTM модель создана успешно', 'info');
        return model;
    } catch (error) {
        console.error('Ошибка создания модели:', error);
        addLog('Ошибка создания модели', 'warning');
        return null;
    } finally {
        showLoader(false);
    }
}

function prepareInput(data) {
    if (data.length < CONFIG.LOOKBACK) return null;

    const sequence = data.slice(-CONFIG.LOOKBACK);
    const features = sequence.map(candle => [
        candle.close / 100000,
        candle.volume / 1000000,
        (candle.sma7 || candle.close) / 100000,
        (candle.rsi || 50) / 100,
        candle.change ? candle.change / 10 : 0,
        Math.random() * 0.1,
        0, 0
    ]);

    return tf.tensor3d([features]);
}

async function makePrediction() {
    if (!model || state.priceData.length < CONFIG.LOOKBACK) return null;

    try {
        const input = prepareInput(state.priceData);
        if (!input) return null;

        const prediction = model.predict(input);
        const probability = (await prediction.data())[0];

        const currentPrice = state.priceData[state.priceData.length - 1].close;

        input.dispose();
        prediction.dispose();

        return {
            time: Date.now(),
            price: currentPrice,
            probability,
            decision: probability > 0.5 ? 'BUY' : 'SELL',
            result: null
        };
    } catch (error) {
        console.error('Ошибка прогноза:', error);
        return null;
    }
}

async function saveModel() {
    showLoader(true, 'Сохранение модели...');
    try {
        if (model) {
            await model.save('localstorage://neuro-trader-model');
        }

        localStorage.setItem(CONFIG.MODEL_KEY, JSON.stringify({
            balance: state.balance,
            predictions: state.predictions.slice(-100),
            balanceHistory: state.balanceHistory.slice(-50),
            accuracyHistory: state.accuracyHistory.slice(-50),
            savedAt: Date.now()
        }));

        addLog('Модель и данные сохранены', 'info');
        showNotification('Модель сохранена успешно', 'info');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        addLog('Ошибка сохранения модели', 'warning');
    } finally {
        showLoader(false);
    }
}

async function loadModel() {
    showLoader(true, 'Загрузка модели...');
    try {
        const models = await tf.io.listModels();
        if (models['localstorage://neuro-trader-model']) {
            model = await tf.loadLayersModel('localstorage://neuro-trader-model');
            addLog('Модель загружена из памяти', 'info');
        }

        const saved = localStorage.getItem(CONFIG.MODEL_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            state.balance = data.balance || CONFIG.INITIAL_BALANCE;
            state.predictions = data.predictions || [];
            state.balanceHistory = data.balanceHistory || [{time: Date.now(), balance: state.balance}];
            state.accuracyHistory = data.accuracyHistory || [];

            updateUI();
            updateCharts();
            updateIndicatorsTable();

            addLog('Данные загружены', 'info');
            showNotification('Модель загружена успешно', 'info');
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        addLog('Модель не найдена, создаем новую', 'warning');
    } finally {
        showLoader(false);
    }
}
