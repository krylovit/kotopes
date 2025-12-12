// Утилиты
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.getElementById('notification');
    if (!notification) {
        console.log('Уведомление:', message, type);
        return;
    }
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');

    setTimeout(() => notification.classList.remove('show'), duration);
}

function showLoader(show, text = 'Загрузка...') {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');

    if (!loader || !loaderText) return;

    if (show) {
        loaderText.textContent = text;
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

function addLog(message, type = 'info', details = null) {
    const logContent = document.getElementById('logContent');
    if (!logContent) {
        console.log(`[${type}] ${message}: ${details}`);
        return;
    }
    
    const time = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    let messageHTML = message;
    if (details) {
        messageHTML += `<div style="margin-top: 5px; padding-left: 10px; border-left: 2px solid #475569; color: #94a3b8; font-size: 11px;">${details}</div>`;
    }

    entry.innerHTML = `
        <div class="log-time">${time}</div>
        <div class="log-message log-${type}">${messageHTML}</div>
    `;

    logContent.prepend(entry);

    // Ограничиваем лог
    if (logContent.children.length > 50) {
        logContent.removeChild(logContent.lastChild);
    }

    // Автопрокрутка
    logContent.scrollTop = 0;
}

// Экспортируем функции для глобального использования
window.showNotification = showNotification;
window.showLoader = showLoader;
window.addLog = addLog;
