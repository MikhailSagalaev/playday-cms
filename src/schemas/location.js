// JSON Schema для валидации полей локаций
// Соответствует структуре Airtable с 50+ полями

const locationSchema = {
  // Схема для создания локации
  create: {
    type: 'object',
    required: ['название_лк'],
    properties: {
      // Базовая информация
      название_лк: { 
        type: 'string', 
        minLength: 1, 
        maxLength: 255,
        description: 'Название личного кабинета (идентификатор филиала)'
      },
      название: { 
        type: 'string', 
        maxLength: 500,
        description: 'Название развлекательного центра'
      },
      описание: { 
        type: 'string',
        description: 'Описание центра (поддерживает HTML)'
      },
      email: { 
        type: 'string', 
        format: 'email',
        maxLength: 255,
        description: 'Email для связи'
      },
      номер_телефона: { 
        type: 'string', 
        maxLength: 50,
        pattern: '^[+]?[0-9\\s\\-\\(\\)]+$',
        description: 'Номер телефона'
      },
      картинка: { 
        type: 'string', 
        format: 'uri',
        maxLength: 500,
        description: 'URL главного изображения'
      },
      адрес: { 
        type: 'string',
        description: 'Адрес развлекательного центра'
      },
      
      // Тайм-карты (оригинальные цены)
      тайм_карта_1_час: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 1 час'
      },
      тайм_карта_2_часа: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 2 часа'
      },
      тайм_карта_3_часа: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 3 часа'
      },
      тайм_карта_4_часа: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 4 часа'
      },
      тайм_карта_5_часов: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 5 часов'
      },
      
      // Призы
      приз_1_текст: { 
        type: 'string',
        description: 'Текст первого приза'
      },
      приз_1_картинка: { 
        type: 'string', 
        format: 'uri',
        maxLength: 500,
        description: 'URL изображения первого приза'
      },
      приз_2_текст: { 
        type: 'string',
        description: 'Текст второго приза'
      },
      приз_2_картинка: { 
        type: 'string', 
        format: 'uri',
        maxLength: 500,
        description: 'URL изображения второго приза'
      },
      приз_3_текст: { 
        type: 'string',
        description: 'Текст третьего приза'
      },
      приз_3_картинка: { 
        type: 'string', 
        format: 'uri',
        maxLength: 500,
        description: 'URL изображения третьего приза'
      },
      призы_текст: { 
        type: 'string',
        description: 'Общий текст о призах'
      },
      розыгрыш_тайм_карт_текст: { 
        type: 'string',
        description: 'Текст о розыгрыше тайм-карт'
      },
      пополнить_карту_сумма: { 
        type: 'integer', 
        minimum: 0,
        description: 'Сумма для пополнения карты'
      },
      дата_следующего_розыгрыша: { 
        type: 'string', 
        maxLength: 100,
        description: 'Дата следующего розыгрыша'
      },
      
      // Акции и скидки
      заголовок_четверг_по_30: { 
        type: 'string', 
        maxLength: 50,
        description: 'Заголовок акции "каждый четверг"'
      },
      каждый_четверг_текст: { 
        type: 'string',
        description: 'Текст акции "каждый четверг"'
      },
      скидка_1: { 
        type: 'string', 
        maxLength: 50,
        description: 'Первая скидка'
      },
      скидка_2: { 
        type: 'string', 
        maxLength: 50,
        description: 'Вторая скидка'
      },
      
      // Тайм-карты (цены для отображения)
      тайм_карта_1_час_цена: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 1 час (для отображения)'
      },
      тайм_карта_2_часа_цена: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 2 часа (для отображения)'
      },
      тайм_карта_3_часа_цена: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 3 часа (для отображения)'
      },
      тайм_карта_4_часа_цена: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 4 часа (для отображения)'
      },
      тайм_карта_5_часов_цена: { 
        type: 'integer', 
        minimum: 0,
        description: 'Цена тайм-карты на 5 часов (для отображения)'
      },
      
      // Система лояльности: Пополнения и бонусы
      пополнение_1: { type: 'integer', minimum: 0 },
      бонус_1: { type: 'integer', minimum: 0 },
      пополнение_2: { type: 'integer', minimum: 0 },
      бонус_2: { type: 'integer', minimum: 0 },
      пополнение_3: { type: 'integer', minimum: 0 },
      бонус_3: { type: 'integer', minimum: 0 },
      пополнение_4: { type: 'integer', minimum: 0 },
      бонус_4: { type: 'integer', minimum: 0 },
      пополнение_5: { type: 'integer', minimum: 0 },
      бонус_5: { type: 'integer', minimum: 0 },
      пополнение_6: { type: 'integer', minimum: 0 },
      бонус_6: { type: 'integer', minimum: 0 },
      
      // Система накопления и привилегий
      накопление_1: { type: 'integer', minimum: 0 },
      привилегия_1: { type: 'string' },
      накопление_2: { type: 'integer', minimum: 0 },
      привилегия_2: { type: 'string' },
      накопление_3: { type: 'integer', minimum: 0 },
      привилегия_3: { type: 'string' },
      накопление_4: { type: 'integer', minimum: 0 },
      привилегия_4: { type: 'string' }
    },
    additionalProperties: false
  },
  
  // Схема для обновления локации (все поля опциональны)
  update: {
    type: 'object',
    properties: {
      // Копируем все свойства из create, но делаем их опциональными
      название_лк: { type: 'string', minLength: 1, maxLength: 255 },
      название: { type: 'string', maxLength: 500 },
      описание: { type: 'string' },
      email: { type: 'string', format: 'email', maxLength: 255 },
      номер_телефона: { type: 'string', maxLength: 50, pattern: '^[+]?[0-9\\s\\-\\(\\)]+$' },
      картинка: { type: 'string', format: 'uri', maxLength: 500 },
      адрес: { type: 'string' },
      
      // Тайм-карты
      тайм_карта_1_час: { type: 'integer', minimum: 0 },
      тайм_карта_2_часа: { type: 'integer', minimum: 0 },
      тайм_карта_3_часа: { type: 'integer', minimum: 0 },
      тайм_карта_4_часа: { type: 'integer', minimum: 0 },
      тайм_карта_5_часов: { type: 'integer', minimum: 0 },
      
      // Призы
      приз_1_текст: { type: 'string' },
      приз_1_картинка: { type: 'string', format: 'uri', maxLength: 500 },
      приз_2_текст: { type: 'string' },
      приз_2_картинка: { type: 'string', format: 'uri', maxLength: 500 },
      приз_3_текст: { type: 'string' },
      приз_3_картинка: { type: 'string', format: 'uri', maxLength: 500 },
      призы_текст: { type: 'string' },
      розыгрыш_тайм_карт_текст: { type: 'string' },
      пополнить_карту_сумма: { type: 'integer', minimum: 0 },
      дата_следующего_розыгрыша: { type: 'string', maxLength: 100 },
      
      // Акции
      заголовок_четверг_по_30: { type: 'string', maxLength: 50 },
      каждый_четверг_текст: { type: 'string' },
      скидка_1: { type: 'string', maxLength: 50 },
      скидка_2: { type: 'string', maxLength: 50 },
      
      // Цены для отображения
      тайм_карта_1_час_цена: { type: 'integer', minimum: 0 },
      тайм_карта_2_часа_цена: { type: 'integer', minimum: 0 },
      тайм_карта_3_часа_цена: { type: 'integer', minimum: 0 },
      тайм_карта_4_часа_цена: { type: 'integer', minimum: 0 },
      тайм_карта_5_часов_цена: { type: 'integer', minimum: 0 },
      
      // Лояльность
      пополнение_1: { type: 'integer', minimum: 0 },
      бонус_1: { type: 'integer', minimum: 0 },
      пополнение_2: { type: 'integer', minimum: 0 },
      бонус_2: { type: 'integer', minimum: 0 },
      пополнение_3: { type: 'integer', minimum: 0 },
      бонус_3: { type: 'integer', minimum: 0 },
      пополнение_4: { type: 'integer', minimum: 0 },
      бонус_4: { type: 'integer', minimum: 0 },
      пополнение_5: { type: 'integer', minimum: 0 },
      бонус_5: { type: 'integer', minimum: 0 },
      пополнение_6: { type: 'integer', minimum: 0 },
      бонус_6: { type: 'integer', minimum: 0 },
      
      // Привилегии
      накопление_1: { type: 'integer', minimum: 0 },
      привилегия_1: { type: 'string' },
      накопление_2: { type: 'integer', minimum: 0 },
      привилегия_2: { type: 'string' },
      накопление_3: { type: 'integer', minimum: 0 },
      привилегия_3: { type: 'string' },
      накопление_4: { type: 'integer', minimum: 0 },
      привилегия_4: { type: 'string' }
    },
    additionalProperties: false
  },
  
  // Схема для параметров запроса
  query: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      search: { type: 'string', maxLength: 255 },
      название_лк: { type: 'string', maxLength: 255 },
      sort_by: { 
        type: 'string', 
        enum: ['created_at', 'updated_at', 'название_лк', 'название'],
        default: 'created_at'
      },
      sort_order: { 
        type: 'string', 
        enum: ['asc', 'desc'],
        default: 'desc'
      }
    },
    additionalProperties: false
  },
  
  // Схема для параметров пути
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    },
    additionalProperties: false
  }
};

// Функция для санитизации HTML в описаниях
function sanitizeHtml(html) {
  if (!html) return html;
  
  // Простая санитизация - удаляем опасные теги
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}

// Функция для валидации URL изображений
// Принимает любые валидные URL (с любого домена)
function validateImageUrl(url) {
  if (!url) return true;
  
  try {
    // Проверяем, что это валидный URL
    const urlObj = new URL(url);
    
    // Проверяем, что протокол http или https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // Дополнительная проверка: если URL не содержит расширение изображения,
    // но это не критично - принимаем любые валидные URL
    return true;
  } catch (error) {
    // Если не удалось распарсить URL, это невалидный URL
    return false;
  }
}

module.exports = {
  locationSchema,
  sanitizeHtml,
  validateImageUrl
};
