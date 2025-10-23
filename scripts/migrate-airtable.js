/**
 * Скрипт миграции данных из Airtable в PostgreSQL
 * 
 * Использование:
 * 1. Установите переменные окружения AIRTABLE_API_KEY и AIRTABLE_BASE_ID
 * 2. Запустите: npm run migrate:airtable
 */

require('dotenv').config();
const Airtable = require('airtable');
const { query, testConnection } = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Маппинг полей Airtable -> PostgreSQL
const fieldMapping = {
  // Базовые поля
  'Название ЛК': 'название_лк',
  'Название': 'название',
  'Описание': 'описание',
  'Email': 'email',
  'Номер телефона': 'номер_телефона',
  'Картинка': 'картинка',
  'Адрес': 'адрес',
  
  // Тайм-карты (оригинальные цены)
  'тайм-карта 1 часа': 'тайм_карта_1_час',
  'тайм-карта 2 часа': 'тайм_карта_2_часа',
  'тайм-карта 3 часа': 'тайм_карта_3_часа',
  'тайм-карта 4 часа': 'тайм_карта_4_часа',
  'тайм-карта 5 часов': 'тайм_карта_5_часов',
  
  // Призы
  'Приз 1 текст': 'приз_1_текст',
  'Приз 1 картинка': 'приз_1_картинка',
  'Приз 2 текст': 'приз_2_текст',
  'Приз 2 картинка': 'приз_2_картинка',
  'Приз 3 текст': 'приз_3_текст',
  'Приз 3 картинка': 'приз_3_картинка',
  'Призы текст': 'призы_текст',
  'Розыгрыш тайм карт на __ час': 'розыгрыш_тайм_карт_текст',
  'Пополнить карту на сумму': 'пополнить_карту_сумма',
  'Дата следующего розыгрыша': 'дата_следующего_розыгрыша',
  
  // Акции
  'Заголовок каждый четверг ПО 30': 'заголовок_четверг_по_30',
  'Каждый четверг все по': 'каждый_четверг_текст',
  'Скидка_1': 'скидка_1',
  'Скидка_2': 'скидка_2',
  
  // Тайм-карты (цены для отображения)
  'Тайм карта (1 час)': 'тайм_карта_1_час_цена',
  'Тайм карта (2 час)': 'тайм_карта_2_часа_цена',
  'Тайм карта (3 час)': 'тайм_карта_3_часа_цена',
  'Тайм карта (4 час)': 'тайм_карта_4_часа_цена',
  'Тайм карта (5 час)': 'тайм_карта_5_часов_цена',
  
  // Система лояльности: Пополнения
  'Пополнение 1': 'пополнение_1',
  'Пополнение 2': 'пополнение_2',
  'Пополнение 3': 'пополнение_3',
  'Пополнение 4': 'пополнение_4',
  'Пополнение 5': 'пополнение_5',
  'Пополнение 6': 'пополнение_6',
  
  // Система лояльности: Бонусы
  'Бонус 1': 'бонус_1',
  'Бонус 2': 'бонус_2',
  'Бонус 3': 'бонус_3',
  'Бонус 4': 'бонус_4',
  'Бонус 5': 'бонус_5',
  'Бонус 6': 'бонус_6',
  
  // Система накопления и привилегий
  'Накопление 1': 'накопление_1',
  'Привилегия 1': 'привилегия_1',
  'Накопление 2': 'накопление_2',
  'Привилегия 2': 'привилегия_2',
  'Накопление 3': 'накопление_3',
  'Привилегия 3': 'привилегия_3',
  'Накопление 4': 'накопление_4',
  'Привилегия 4': 'привилегия_4'
};

/**
 * Основная функция миграции
 */
async function migrateData() {
  console.log('🚀 Начинаем миграцию данных из Airtable...');
  
  try {
    // Проверяем подключение к БД
    console.log('📡 Проверяем подключение к базе данных...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    console.log('✅ Подключение к базе данных установлено');
    
    // Получаем все записи из Airtable
    console.log('📥 Загружаем данные из Airtable...');
    const records = await base('Данные').select().all();
    console.log(`📊 Найдено ${records.length} записей в Airtable`);
    
    if (records.length === 0) {
      console.log('⚠️  Нет данных для миграции');
      return;
    }
    
    // Создаем пользователя по умолчанию для миграции
    console.log('👤 Создаем пользователя по умолчанию...');
    const defaultUser = await query(`
      INSERT INTO users (tilda_user_id, email, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (tilda_user_id) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `, ['migration_user', 'migration@playday.com', 'admin']);
    
    const userId = defaultUser.rows[0].id;
    console.log(`✅ Пользователь создан/найден: ID ${userId}`);
    
    // Мигрируем каждую запись
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const [index, record] of records.entries()) {
      try {
        console.log(`📝 Обрабатываем запись ${index + 1}/${records.length}: ${record.id}`);
        
        // Преобразуем данные Airtable в формат PostgreSQL
        const locationData = transformAirtableRecord(record);
        
        // Вставляем запись в БД
        await insertLocationRecord(userId, record.id, locationData);
        
        successCount++;
        console.log(`✅ Запись ${record.id} успешно мигрирована`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Ошибка миграции записи ${record.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    // Выводим статистику
    console.log('\n📊 Статистика миграции:');
    console.log(`✅ Успешно: ${successCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Ошибки:');
      errors.forEach(error => console.log(`  - ${error}`));
      
      // Сохраняем ошибки в файл
      const errorLogPath = path.join(__dirname, '../logs/migration-errors.log');
      await fs.mkdir(path.dirname(errorLogPath), { recursive: true });
      await fs.writeFile(errorLogPath, errors.join('\n'));
      console.log(`📄 Лог ошибок сохранен: ${errorLogPath}`);
    }
    
    console.log('\n🎉 Миграция завершена!');
    
  } catch (error) {
    console.error('💥 Критическая ошибка миграции:', error);
    process.exit(1);
  }
}

/**
 * Преобразование записи Airtable в формат PostgreSQL
 */
function transformAirtableRecord(record) {
  const locationData = {};
  
  // Проходим по всем полям записи
  Object.keys(record.fields).forEach(airtableField => {
    const pgField = fieldMapping[airtableField];
    if (pgField) {
      let value = record.fields[airtableField];
      
      // Обработка специальных типов данных
      if (typeof value === 'number') {
        // Числовые поля
        locationData[pgField] = value;
      } else if (typeof value === 'string') {
        // Строковые поля - обрезаем если слишком длинные
        if (pgField.includes('название') && value.length > 500) {
          value = value.substring(0, 500);
        } else if (pgField.includes('email') && value.length > 255) {
          value = value.substring(0, 255);
        } else if (pgField.includes('телефона') && value.length > 50) {
          value = value.substring(0, 50);
        }
        locationData[pgField] = value;
      } else {
        // Остальные типы - конвертируем в строку
        locationData[pgField] = String(value);
      }
    }
  });
  
  return locationData;
}

/**
 * Вставка записи локации в PostgreSQL
 */
async function insertLocationRecord(userId, airtableId, locationData) {
  // Подготавливаем поля и значения для INSERT
  const fields = Object.keys(locationData);
  const values = Object.values(locationData);
  
  if (fields.length === 0) {
    throw new Error('Нет данных для вставки');
  }
  
  // Создаем плейсхолдеры для SQL
  const placeholders = fields.map((_, index) => `$${index + 3}`).join(', ');
  const fieldNames = fields.join(', ');
  
  const insertQuery = `
    INSERT INTO locations (user_id, record_id, ${fieldNames})
    VALUES ($1, $2, ${placeholders})
    ON CONFLICT (record_id) DO UPDATE SET
    ${fields.map((field, index) => `${field} = $${index + 3}`).join(', ')},
    updated_at = NOW()
    RETURNING id
  `;
  
  const result = await query(insertQuery, [userId, airtableId, ...values]);
  return result.rows[0].id;
}

/**
 * Функция для загрузки изображений из URL
 */
async function downloadImage(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const uploadPath = path.join(uploadDir, year.toString(), month);
    
    await fs.mkdir(uploadPath, { recursive: true });
    const fullPath = path.join(uploadPath, filename);
    
    await fs.writeFile(fullPath, buffer);
    return fullPath;
    
  } catch (error) {
    console.warn(`⚠️  Не удалось загрузить изображение ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Функция для создания бэкапа перед миграцией
 */
async function createBackup() {
  console.log('💾 Создаем бэкап существующих данных...');
  
  try {
    const backupData = await query(`
      SELECT * FROM locations ORDER BY created_at
    `);
    
    const backupPath = path.join(__dirname, '../backups', `pre-migration-${Date.now()}.json`);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(backupData.rows, null, 2));
    
    console.log(`✅ Бэкап создан: ${backupPath}`);
    return backupPath;
    
  } catch (error) {
    console.warn(`⚠️  Не удалось создать бэкап: ${error.message}`);
    return null;
  }
}

// Запуск миграции
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('🎉 Миграция завершена успешно!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Ошибка миграции:', error);
      process.exit(1);
    });
}

module.exports = {
  migrateData,
  transformAirtableRecord,
  insertLocationRecord,
  downloadImage,
  createBackup
};
