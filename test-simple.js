/**
 * Простое тестирование PlayDay CMS без базы данных
 * Запуск: node test-simple.js
 */

const fastify = require('fastify')({ logger: true });

// Регистрируем плагины
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'PlayDay CMS API',
      description: 'API для системы управления контентом развлекательных центров',
      version: '1.0.0'
    },
    host: 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs'
});

// Простые маршруты для тестирования
fastify.get('/', async (request, reply) => {
  return { 
    message: 'PlayDay CMS API работает!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
});

fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    database: 'not_connected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
});

// API маршруты
fastify.get('/api/locations', async (request, reply) => {
  return {
    message: 'API работает! (без базы данных)',
    locations: [
      {
        id: 1,
        название: 'Тестовая локация',
        email: 'test@example.com',
        статус: 'демо'
      }
    ]
  };
});

fastify.post('/api/tilda/fetch-content', async (request, reply) => {
  return {
    message: 'Tilda интеграция работает!',
    content: {
      название: 'Демо контент',
      описание: 'Это тестовый контент для Tilda'
    }
  };
});

// Запуск сервера
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 PlayDay CMS запущен!');
    console.log('📡 URL: http://localhost:3000');
    console.log('📚 API Docs: http://localhost:3000/docs');
    console.log('❤️  Health: http://localhost:3000/health');
    console.log('🌐 API: http://localhost:3000/api/locations');
    console.log('');
    console.log('💡 Нажмите Ctrl+C для остановки');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
