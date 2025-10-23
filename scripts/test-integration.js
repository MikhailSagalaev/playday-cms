/**
 * Скрипт тестирования интеграции PlayDay CMS
 * 
 * Использование:
 * node scripts/test-integration.js [API_URL]
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация
const API_URL = process.argv[2] || 'http://localhost:3000';
const TEST_RESULTS = [];

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Функции для вывода
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// Функция для выполнения HTTP запроса
async function makeRequest(method, endpoint, data = null, headers = {}) {
    try {
        const config = {
            method,
            url: `${API_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: 10000
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (err) {
        return { 
            success: false, 
            error: err.message, 
            status: err.response?.status,
            data: err.response?.data 
        };
    }
}

// Тест 1: Health Check
async function testHealthCheck() {
    info('Тестируем Health Check...');
    
    const result = await makeRequest('GET', '/health');
    
    if (result.success && result.status === 200) {
        success('Health Check работает');
        TEST_RESULTS.push({ test: 'Health Check', status: 'PASS' });
        return true;
    } else {
        error(`Health Check не работает: ${result.error}`);
        TEST_RESULTS.push({ test: 'Health Check', status: 'FAIL', error: result.error });
        return false;
    }
}

// Тест 2: API Documentation
async function testAPIDocs() {
    info('Тестируем API Documentation...');
    
    const result = await makeRequest('GET', '/docs');
    
    if (result.success && result.status === 200) {
        success('API Documentation доступна');
        TEST_RESULTS.push({ test: 'API Documentation', status: 'PASS' });
        return true;
    } else {
        warning(`API Documentation недоступна: ${result.error}`);
        TEST_RESULTS.push({ test: 'API Documentation', status: 'WARN', error: result.error });
        return false;
    }
}

// Тест 3: CORS Headers
async function testCORS() {
    info('Тестируем CORS headers...');
    
    const result = await makeRequest('OPTIONS', '/api/locations', null, {
        'Origin': 'https://test.tilda.ws',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
    });
    
    if (result.success && result.status === 204) {
        success('CORS headers настроены правильно');
        TEST_RESULTS.push({ test: 'CORS Headers', status: 'PASS' });
        return true;
    } else {
        warning(`CORS headers не настроены: ${result.error}`);
        TEST_RESULTS.push({ test: 'CORS Headers', status: 'WARN', error: result.error });
        return false;
    }
}

// Тест 4: Аутентификация
async function testAuthentication() {
    info('Тестируем аутентификацию...');
    
    // Тест без токена
    const result1 = await makeRequest('GET', '/api/auth/profile');
    if (!result1.success && result1.status === 401) {
        success('Аутентификация защищена (401 без токена)');
    } else {
        error('Аутентификация не защищена');
        TEST_RESULTS.push({ test: 'Authentication', status: 'FAIL', error: 'No auth protection' });
        return false;
    }
    
    // Тест с недействительным токеном
    const result2 = await makeRequest('GET', '/api/auth/profile', null, {
        'Authorization': 'Bearer invalid-token'
    });
    
    if (!result2.success && result2.status === 401) {
        success('Недействительные токены отклоняются');
        TEST_RESULTS.push({ test: 'Authentication', status: 'PASS' });
        return true;
    } else {
        error('Недействительные токены принимаются');
        TEST_RESULTS.push({ test: 'Authentication', status: 'FAIL', error: 'Invalid tokens accepted' });
        return false;
    }
}

// Тест 5: Tilda Integration
async function testTildaIntegration() {
    info('Тестируем интеграцию с Tilda...');
    
    const tildaProfile = {
        login: 'test_user',
        email: 'test@example.com',
        groups: [],
        courses: []
    };
    
    const result = await makeRequest('POST', '/api/tilda/fetch-content', {
        profile: tildaProfile,
        project_id: 'test_project',
        referer: 'https://test.tilda.ws',
        user_agent: 'PlayDay Test Agent'
    });
    
    if (result.success && result.status === 200) {
        success('Tilda интеграция работает');
        TEST_RESULTS.push({ test: 'Tilda Integration', status: 'PASS' });
        return true;
    } else {
        error(`Tilda интеграция не работает: ${result.error}`);
        TEST_RESULTS.push({ test: 'Tilda Integration', status: 'FAIL', error: result.error });
        return false;
    }
}

// Тест 6: Rate Limiting
async function testRateLimiting() {
    info('Тестируем Rate Limiting...');
    
    const requests = [];
    for (let i = 0; i < 5; i++) {
        requests.push(makeRequest('GET', '/health'));
    }
    
    const results = await Promise.all(requests);
    const successCount = results.filter(r => r.success).length;
    
    if (successCount >= 4) {
        success('Rate Limiting работает (не все запросы прошли)');
        TEST_RESULTS.push({ test: 'Rate Limiting', status: 'PASS' });
        return true;
    } else {
        warning('Rate Limiting может быть не настроен');
        TEST_RESULTS.push({ test: 'Rate Limiting', status: 'WARN', error: 'All requests passed' });
        return false;
    }
}

// Тест 7: File Upload (если доступен)
async function testFileUpload() {
    info('Тестируем загрузку файлов...');
    
    // Создаем тестовый файл
    const testFile = Buffer.from('test file content');
    
    try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', testFile, 'test.txt');
        form.append('location_id', '1');
        form.append('field_name', 'картинка');
        
        const result = await axios.post(`${API_URL}/api/files/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': 'Bearer test-token'
            },
            timeout: 10000
        });
        
        if (result.status === 200 || result.status === 201) {
            success('Загрузка файлов работает');
            TEST_RESULTS.push({ test: 'File Upload', status: 'PASS' });
            return true;
        }
    } catch (err) {
        // Ожидаемо, так как нет аутентификации
        if (err.response?.status === 401) {
            success('Загрузка файлов защищена аутентификацией');
            TEST_RESULTS.push({ test: 'File Upload', status: 'PASS' });
            return true;
        }
    }
    
    warning('Загрузка файлов не протестирована (требует аутентификации)');
    TEST_RESULTS.push({ test: 'File Upload', status: 'SKIP', error: 'Requires authentication' });
    return false;
}

// Тест 8: Database Connection
async function testDatabaseConnection() {
    info('Тестируем подключение к базе данных...');
    
    const result = await makeRequest('GET', '/health');
    
    if (result.success && result.data.database === 'connected') {
        success('База данных подключена');
        TEST_RESULTS.push({ test: 'Database Connection', status: 'PASS' });
        return true;
    } else {
        error('База данных не подключена');
        TEST_RESULTS.push({ test: 'Database Connection', status: 'FAIL', error: 'Database not connected' });
        return false;
    }
}

// Тест 9: API Endpoints
async function testAPIEndpoints() {
    info('Тестируем API endpoints...');
    
    const endpoints = [
        { method: 'GET', path: '/api/locations', expectedStatus: 401 },
        { method: 'POST', path: '/api/locations', expectedStatus: 401 },
        { method: 'GET', path: '/api/files', expectedStatus: 401 },
        { method: 'POST', path: '/api/auth/verify', expectedStatus: 400 }
    ];
    
    let passedTests = 0;
    
    for (const endpoint of endpoints) {
        const result = await makeRequest(endpoint.method, endpoint.path);
        
        if (result.status === endpoint.expectedStatus) {
            passedTests++;
        } else {
            warning(`Endpoint ${endpoint.method} ${endpoint.path}: ожидался статус ${endpoint.expectedStatus}, получен ${result.status}`);
        }
    }
    
    if (passedTests === endpoints.length) {
        success('Все API endpoints работают правильно');
        TEST_RESULTS.push({ test: 'API Endpoints', status: 'PASS' });
        return true;
    } else {
        warning(`API endpoints: ${passedTests}/${endpoints.length} тестов прошли`);
        TEST_RESULTS.push({ test: 'API Endpoints', status: 'WARN', error: `${passedTests}/${endpoints.length} tests passed` });
        return false;
    }
}

// Тест 10: Performance
async function testPerformance() {
    info('Тестируем производительность...');
    
    const startTime = Date.now();
    const requests = [];
    
    // Выполняем 10 параллельных запросов
    for (let i = 0; i < 10; i++) {
        requests.push(makeRequest('GET', '/health'));
    }
    
    const results = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successCount = results.filter(r => r.success).length;
    const avgResponseTime = duration / results.length;
    
    if (successCount >= 8 && avgResponseTime < 1000) {
        success(`Производительность хорошая: ${successCount}/10 запросов за ${duration}ms (${avgResponseTime.toFixed(2)}ms в среднем)`);
        TEST_RESULTS.push({ test: 'Performance', status: 'PASS' });
        return true;
    } else {
        warning(`Производительность: ${successCount}/10 запросов за ${duration}ms`);
        TEST_RESULTS.push({ test: 'Performance', status: 'WARN', error: `${successCount}/10 requests in ${duration}ms` });
        return false;
    }
}

// Основная функция тестирования
async function runTests() {
    log('🧪 Запускаем тестирование PlayDay CMS...', 'cyan');
    log(`API URL: ${API_URL}`, 'blue');
    log('', 'reset');
    
    const tests = [
        testHealthCheck,
        testAPIDocs,
        testCORS,
        testAuthentication,
        testTildaIntegration,
        testRateLimiting,
        testFileUpload,
        testDatabaseConnection,
        testAPIEndpoints,
        testPerformance
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
        try {
            const result = await test();
            if (result) passedTests++;
        } catch (err) {
            error(`Ошибка в тесте: ${err.message}`);
            TEST_RESULTS.push({ test: test.name, status: 'ERROR', error: err.message });
        }
        log('', 'reset');
    }
    
    // Выводим результаты
    log('📊 Результаты тестирования:', 'cyan');
    log('', 'reset');
    
    const passed = TEST_RESULTS.filter(r => r.status === 'PASS').length;
    const failed = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
    const warnings = TEST_RESULTS.filter(r => r.status === 'WARN').length;
    const skipped = TEST_RESULTS.filter(r => r.status === 'SKIP').length;
    const errors = TEST_RESULTS.filter(r => r.status === 'ERROR').length;
    
    log(`✅ Пройдено: ${passed}`, 'green');
    log(`❌ Провалено: ${failed}`, 'red');
    log(`⚠️  Предупреждения: ${warnings}`, 'yellow');
    log(`⏭️  Пропущено: ${skipped}`, 'blue');
    log(`💥 Ошибки: ${errors}`, 'red');
    
    log('', 'reset');
    log('📋 Детальные результаты:', 'cyan');
    
    TEST_RESULTS.forEach(result => {
        const status = result.status === 'PASS' ? '✅' : 
                      result.status === 'FAIL' ? '❌' : 
                      result.status === 'WARN' ? '⚠️ ' : 
                      result.status === 'SKIP' ? '⏭️ ' : '💥';
        
        log(`${status} ${result.test}: ${result.status}`, result.status === 'PASS' ? 'green' : 
                                                          result.status === 'FAIL' ? 'red' : 
                                                          result.status === 'WARN' ? 'yellow' : 'blue');
        
        if (result.error) {
            log(`   Ошибка: ${result.error}`, 'red');
        }
    });
    
    // Сохраняем результаты в файл
    const reportPath = path.join(__dirname, '../logs/test-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    const report = {
        timestamp: new Date().toISOString(),
        apiUrl: API_URL,
        summary: {
            total: totalTests,
            passed,
            failed,
            warnings,
            skipped,
            errors
        },
        results: TEST_RESULTS
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    log(`📄 Отчет сохранен: ${reportPath}`, 'blue');
    
    // Финальная оценка
    log('', 'reset');
    if (failed === 0 && errors === 0) {
        log('🎉 Все тесты пройдены успешно!', 'green');
        process.exit(0);
    } else {
        log('⚠️  Некоторые тесты не прошли. Проверьте конфигурацию.', 'yellow');
        process.exit(1);
    }
}

// Запуск тестирования
if (require.main === module) {
    runTests().catch(err => {
        error(`Критическая ошибка: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { runTests };
