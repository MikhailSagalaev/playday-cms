const fastify = require('fastify')({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    } : undefined
  }
});

// Регистрация плагинов
async function registerPlugins() {
  // CORS для интеграции с Tilda
  await fastify.register(require('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN || true,
    credentials: process.env.CORS_CREDENTIALS === 'true'
  });

  // Безопасность
  await fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false // Отключаем для интеграции с Tilda
  });

  // Rate limiting
  await fastify.register(require('@fastify/rate-limit'), {
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW) || 60000
  });

  // JWT аутентификация
  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
  });

  // Поддержка application/x-www-form-urlencoded для вебхуков Tilda
  await fastify.register(require('@fastify/formbody'));

  // Multipart для загрузки файлов
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB
    }
  });

  // Swagger документация API
  await fastify.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'PlayDay CMS API',
        description: 'API для системы управления контентом развлекательных центров',
        version: '1.0.0'
      },
      host: process.env.HOST || 'localhost:3000',
      schemes: ['http', 'https'],
      consumes: ['application/json', 'multipart/form-data'],
      produces: ['application/json']
    }
  });

  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    }
  });
}

// Регистрация маршрутов
async function registerRoutes() {
  // Аутентификация
  await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
  
  // Управление локациями
  await fastify.register(require('./routes/locations'), { prefix: '/api/locations' });
  
  // Управление файлами
  await fastify.register(require('./routes/files'), { prefix: '/api/files' });
  
  // Вебхуки
  await fastify.register(require('./routes/webhook'), { prefix: '/api/webhook' });
  
  // Интеграция с Tilda
  await fastify.register(require('./routes/tilda'), { prefix: '/api/tilda' });
  
  // Публичный API (без авторизации)
  await fastify.register(require('./routes/public'), { prefix: '/api/public' });
  
  // Здоровье системы
  fastify.get('/health', async (request, reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };
  });

  // Корневой маршрут
  fastify.get('/', async (request, reply) => {
    return { 
      message: 'PlayDay CMS API',
      version: '1.0.0',
      docs: '/docs'
    };
  });
}

// Обработка ошибок
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  // Валидация ошибок
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    });
  }

  // JWT ошибки
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Токен авторизации не предоставлен'
    });
  }

  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Недействительный токен авторизации'
    });
  }

  // Ошибки базы данных
  if (error.code === '23505') { // Unique constraint violation
    return reply.status(409).send({
      error: 'Conflict',
      message: 'Запись с такими данными уже существует'
    });
  }

  if (error.code === '23503') { // Foreign key constraint violation
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Нарушение связей между таблицами'
    });
  }

  // Общие ошибки сервера
  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Внутренняя ошибка сервера' 
    : error.message;

  reply.status(statusCode).send({
    error: 'Internal Server Error',
    message
  });
});

// Обработка 404
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: 'Not Found',
    message: `Маршрут ${request.method} ${request.url} не найден`
  });
});

// Запуск сервера
async function start() {
  try {
    // Загружаем переменные окружения
    require('dotenv').config();

    // Регистрируем плагины
    await registerPlugins();

    // Регистрируем маршруты
    await registerRoutes();

    // Запускаем сервер
    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT) || 3000;

    await fastify.listen({ port, host });
    
    fastify.log.info(`🚀 Сервер запущен на http://${host}:${port}`);
    fastify.log.info(`📚 Документация API: http://${host}:${port}/docs`);
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('Получен сигнал SIGTERM, завершаем работу...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  fastify.log.info('Получен сигнал SIGINT, завершаем работу...');
  await fastify.close();
  process.exit(0);
});

// Запуск
if (require.main === module) {
  start();
}

module.exports = fastify;
