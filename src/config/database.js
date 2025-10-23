const { Pool } = require('pg');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

// Конфигурация подключения к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'playday_cms',
  user: process.env.DB_USER || 'playday',
  password: process.env.DB_PASSWORD,
  max: 20, // максимальное количество соединений в пуле
  idleTimeoutMillis: 30000, // время ожидания перед закрытием неактивного соединения
  connectionTimeoutMillis: 2000, // время ожидания подключения
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  logger.error('Неожиданная ошибка клиента PostgreSQL:', err);
  process.exit(-1);
});

// Функция для выполнения запросов
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Выполнен запрос', { 
      text: text.substring(0, 100) + '...', 
      duration: `${duration}ms`,
      rows: res.rowCount 
    });
    return res;
  } catch (error) {
    logger.error('Ошибка выполнения запроса:', { 
      text: text.substring(0, 100) + '...',
      error: error.message,
      code: error.code
    });
    throw error;
  }
}

// Функция для получения одного клиента (для транзакций)
async function getClient() {
  return await pool.connect();
}

// Функция для проверки подключения
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    logger.info('Подключение к базе данных успешно:', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Ошибка подключения к базе данных:', error);
    return false;
  }
}

// Функция для закрытия всех соединений
async function closePool() {
  try {
    await pool.end();
    logger.info('Пул соединений с базой данных закрыт');
  } catch (error) {
    logger.error('Ошибка при закрытии пула соединений:', error);
  }
}

// Функция для выполнения миграций
async function runMigrations() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Проверяем, существует ли таблица миграций
    const migrationTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);
    
    if (!migrationTableExists.rows[0].exists) {
      // Создаем таблицу миграций
      await client.query(`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT NOW()
        );
      `);
      logger.info('Таблица миграций создана');
    }
    
    // Читаем и выполняем миграции
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '../../migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      for (const file of files) {
        // Проверяем, была ли миграция уже выполнена
        const executed = await client.query(
          'SELECT id FROM migrations WHERE filename = $1',
          [file]
        );
        
        if (executed.rows.length === 0) {
          logger.info(`Выполняем миграцию: ${file}`);
          
          const migrationSQL = fs.readFileSync(
            path.join(migrationsDir, file), 
            'utf8'
          );
          
          await client.query(migrationSQL);
          
          // Записываем выполненную миграцию
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          
          logger.info(`Миграция ${file} выполнена успешно`);
        } else {
          logger.debug(`Миграция ${file} уже выполнена`);
        }
      }
    }
    
    await client.query('COMMIT');
    logger.info('Все миграции выполнены успешно');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Ошибка при выполнении миграций:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  getClient,
  testConnection,
  closePool,
  runMigrations,
  pool
};
