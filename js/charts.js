// Управление графиками
function updateCharts() {
    console.log('Обновление графиков...');
    
    // График цены
    if (state.priceData.length > 0) {
        const priceCtx = document.getElementById('priceChart');
        if (!priceCtx) {
            console.log('Элемент priceChart не найден');
            return;
        }
        
        const ctx = priceCtx.getContext('2d');
        const labels = state.priceData.slice(-50).map(d =>
            new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        );
        const prices = state.priceData.slice(-50).map(d => d.close);

        if (!charts.price) {
            console.log('Создаем график цены');
            charts.price = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Цена',
                        data: prices,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8', maxRotation: 0 }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        } else {
            console.log('Обновляем график цены');
            charts.price.data.labels = labels;
            charts.price.data.datasets[0].data = prices;
            charts.price.update('none');
        }
    }

    // График баланса
    if (state.balanceHistory.length > 0) {
        const balanceCtx = document.getElementById('balanceChart');
        if (balanceCtx) {
            const ctx = balanceCtx.getContext('2d');
            const labels = state.balanceHistory.slice(-50).map(d =>
                new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
            );
            const balances = state.balanceHistory.slice(-50).map(d => d.balance);

            if (!charts.balance) {
                console.log('Создаем график баланса');
                charts.balance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Баланс',
                            data: balances,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { display: false },
                            y: {
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#94a3b8' }
                            }
                        }
                    }
                });
            } else {
                console.log('Обновляем график баланса');
                charts.balance.data.labels = labels;
                charts.balance.data.datasets[0].data = balances;
                charts.balance.update('none');
            }
        }
    }

    // График точности
    if (state.accuracyHistory.length > 0) {
        const accuracyCtx = document.getElementById('accuracyChart');
        if (accuracyCtx) {
            const ctx = accuracyCtx.getContext('2d');
            const labels = state.accuracyHistory.slice(-50).map(d =>
                new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
            );
            const accuracies = state.accuracyHistory.slice(-50).map(d => d.accuracy);

            if (!charts.accuracy) {
                console.log('Создаем график точности');
                charts.accuracy = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Точность %',
                            data: accuracies,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { display: false },
                            y: {
                                min: 0,
                                max: 100,
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#94a3b8' }
                            }
                        }
                    }
                });
            } else {
                console.log('Обновляем график точности');
                charts.accuracy.data.labels = labels;
                charts.accuracy.data.datasets[0].data = accuracies;
                charts.accuracy.update('none');
            }
        }
    }

    // График уверенности
    if (state.confidenceHistory.length > 0) {
        const confidenceCtx = document.getElementById('confidenceChart');
        if (confidenceCtx) {
            const ctx = confidenceCtx.getContext('2d');
            
            const correct = state.confidenceHistory.filter(d => d.isCorrect).slice(-20);
            const wrong = state.confidenceHistory.filter(d => !d.isCorrect).slice(-20);

            if (!charts.confidence) {
                console.log('Создаем график уверенности');
                charts.confidence = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Правильные', 'Ошибки'],
                        datasets: [{
                            label: 'Средняя уверенность',
                            data: [
                                correct.reduce((a, b) => a + b.confidence, 0) / (correct.length || 1),
                                wrong.reduce((a, b) => a + b.confidence, 0) / (wrong.length || 1)
                            ],
                            backgroundColor: ['#10b981', '#ef4444'],
                            borderColor: ['#10b981', '#ef4444'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                min: 0,
                                max: 100,
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                ticks: { color: '#94a3b8' }
                            }
                        }
                    }
                });
            } else {
                console.log('Обновляем график уверенности');
                charts.confidence.data.datasets[0].data = [
                    correct.reduce((a, b) => a + b.confidence, 0) / (correct.length || 1),
                    wrong.reduce((a, b) => a + b.confidence, 0) / (wrong.length || 1)
                ];
                charts.confidence.update('none');
            }
        }
    }
}

// Экспортируем функцию
window.updateCharts = updateCharts;
