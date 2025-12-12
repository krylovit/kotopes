// Обновление интерфейса
function updateUI() {
    console.log('Обновление UI...');
    
    // Статус
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (statusDot && statusText) {
        statusDot.className = 'status-dot ' + state.status;
        statusText.textContent =
            state.status === 'running' ? 'Обучение' :
            state.status === 'paused' ? 'Пауза' : 'Остановлено';
    }

    // Баланс и статистика
    const balanceValue = document.getElementById('balanceValue');
    if (balanceValue) {
        balanceValue.textContent = state.balance.toFixed(2);
    }

    const profitValue = document.getElementById('profitValue');
    if (profitValue) {
        const profit = state.balance - CONFIG.INITIAL_BALANCE;
        profitValue.textContent = (profit >= 0 ? '+' : '') + profit.toFixed(2);
        if (profitValue.parentElement) {
            profitValue.parentElement.className =
                'stat-item ' + (profit >= 0 ? 'green' : 'red');
        }
    }

    const predictionsCount = document.getElementById('predictionsCount');
    if (predictionsCount) {
        predictionsCount.textContent = state.predictions.length;
    }

    // Точность
    const accuracyValue = document.getElementById('accuracyValue');
    if (accuracyValue) {
        const recent = state.predictions.slice(-100);
        const correct = recent.filter(p => p.result && p.result.isCorrect).length;
        const accuracy = recent.length > 0 ? (correct / recent.length) * 100 : 0;
        accuracyValue.textContent = accuracy.toFixed(1) + '%';
    }

    const errorsCount = document.getElementById('errorsCount');
    if (errorsCount) {
        const errors = state.predictions.filter(p => p.result && !p.result.isCorrect).length;
        errorsCount.textContent = errors;
    }

    // Уверенность
    const confidenceValue = document.getElementById('confidenceValue');
    if (confidenceValue && state.lastPrediction) {
        confidenceValue.textContent = 
            (state.lastPrediction.probability * 100).toFixed(1) + '%';
    }

    // Таймер сессии
    const sessionTimer = document.getElementById('sessionTimer');
    if (sessionTimer && state.sessionStart) {
        const elapsed = Date.now() - state.sessionStart;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        sessionTimer.textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Прогресс обучения
    const trainingProgress = document.getElementById('trainingProgress');
    if (trainingProgress) {
        const progress = Math.min(state.predictions.length / 1000 * 100, 100);
        trainingProgress.style.width = progress + '%';
    }
}

// Экспортируем функцию
window.updateUI = updateUI;
