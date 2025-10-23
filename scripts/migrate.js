/**
 * Скрипт для выполнения миграций базы данных
 * 
 * Использование:
 * npm run migrate
 */

require('dotenv').config();
const { runMigrations, testConnection } = require('../src/config/database');

async function main() {
  console.log('🚀 Запуск миграций базы данных...');
  
  try {
    // Проверяем подключение к БД
    console.log('📡 Проверяем подключение к базе данных...');
    const connected = await testConnection();
    
    if (!connected) {
      throw new Error('Не удалось подключиться к базе данных. Проверьте настройки подключения.');
    }
    
    console.log('✅ Подключение к базе данных установлено');
    
    // Выполняем миграции
    console.log('📝 Выполняем миграции...');
    await runMigrations();
    
    console.log('🎉 Все миграции выполнены успешно!');
    
  } catch (error) {
    console.error('💥 Ошибка выполнения миграций:', error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = { main };
