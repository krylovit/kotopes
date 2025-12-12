// Основной цикл приложения
async function mainLoop() {
    if (state.status !== 'running') return;

    try {
        const symbol = document.getElementById('symbolSelect').value;
        const interval = document.getElementById('timeframeSelect').value;

        // Загружаем данные
        const newData = await fetchData(symbol, interval, 10);
        if (!newData || newData.length === 0) {
            setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
            return;
        }

        // Обновляем данные
        for (const candle of newData) {
            const exists = state.priceData.find(d => d.time === candle.time);
            if (!exists) {
                state.priceData.push(candle);
            }
        }

        // Ограничиваем размер
        if (state.priceData.length > 200) {
            state.priceData = state.priceData.slice(-200);
        }

        // Рассчитываем индикаторы
        state.priceData = calculateIndicators(state.priceData);

        // Обновляем индикаторы в таблице
        updateIndicatorsTable();

        // Делаем прогноз
        if (state.priceData.length >= CONFIG.LOOKBACK) {
            const prediction = await makePrediction();

            if (prediction) {
                state.lastPrediction = prediction;

                // Ждем следующую свечу для проверки
                setTimeout(async () => {
                    const checkData = await fetchData(symbol, interval, 1);
                    if (checkData && checkData.length > 0) {
                        const actualPrice = checkData[0].close;
                        evaluatePrediction(prediction, actualPrice);
                        updateCharts();
                        updateUI();
                    }
                }, 5000);
            }
        }

        // Обновляем графики
        updateCharts();

        // Обновляем UI
        updateUI();

        // Следующий цикл
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);

    } catch (error) {
        console.error('Ошибка в цикле:', error);
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
    }
}

// Обработчики событий
function initEventHandlers() {
    // Старт
    document.getElementById('startBtn').addEventListener('click', async () => {
        if (state.status === 'running') return;

        if (!model) {
            model = await createModel();
            if (!model) return;
        }

        // Загружаем начальные данные
        const symbol = document.getElementById('symbolSelect').value;
        const interval = document.getElementById('timeframeSelect').value;
        const data = await fetchData(symbol, interval, 100);

        if (data && data.length > 0) {
            state.priceData = calculateIndicators(data);
            state.sessionStart = Date.now();
            state.status = 'running';

            document.getElementById('startBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;

            addLog('Обучение начато', 'info');
            showNotification('Нейросеть начала обучение', 'info');

            mainLoop();
        }
    });

    // Пауза
    document.getElementById('pauseBtn').addEventListener('click', () => {
        if (state.status === 'running') {
            state.status = 'paused';
            document.getElementById('pauseBtn').textContent = '▶ Продолжить';
            addLog('Обучение приостановлено', 'warning');
        } else if (state.status === 'paused') {
            state.status = 'running';
            document.getElementById('pauseBtn').textContent = '⏸ Пауза';
            addLog('Обучение продолжено', 'info');
            mainLoop();
        }
    });

    // Сохранить
    document.getElementById('saveBtn').addEventListener('click', saveModel);

    // Загрузить
    document.getElementById('loadBtn').addEventListener('click', loadModel);

    // Сброс
    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('Сбросить модель и все данные?')) {
            model = null;
            state = {
                status: 'stopped',
                balance: CONFIG.INITIAL_BALANCE,
                predictions: [],
                priceData: [],
                balanceHistory: [{time: Date.now(), balance: CONFIG.INITIAL_BALANCE}],
                accuracyHistory: [],
                sessionStart: null,
                indicators: {},
                lastPrediction: null
            };

            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('pauseBtn').textContent = '⏸ Пауза';

            updateUI();
            updateCharts();
            updateIndicatorsTable();

            addLog('Система сброшена', 'warning');
            showNotification('Система сброшена', 'info');
        }
    });

    // Очистка лога
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        document.getElementById('logContent').innerHTML = '';
        addLog('Лог очищен', 'info');
    });

    // Вкладки
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Прокрутка вверх
    document.getElementById('scrollTopBtn').addEventListener('click', () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
    });

    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });
}

// Инициализация
async function init() {
    console.log('Инициализация системы...');
    addLog('Система инициализируется', 'info');

    showLoader(true, 'Инициализация...');

    try {
        if (!tf) {
            throw new Error('TensorFlow.js не загружен');
        }

        initEventHandlers();
        await loadModel();

        updateUI();
        updateIndicatorsTable();

        addLog('Система готова к работе', 'info');
        showNotification('Нейросеть-трейдер готова', 'info');

    } catch (error) {
        console.error('Ошибка инициализации:', error);
        addLog('Ошибка инициализации: ' + error.message, 'warning');
    } finally {
        showLoader(false);
    }
}

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', init);
