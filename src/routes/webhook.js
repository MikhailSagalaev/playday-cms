const { query } = require('../config/database');

// Функция для безопасного преобразования строки в число
function safeParseInt(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

async function webhookRoutes(fastify, options) {
  
  // POST /api/webhook/tilda - обработка вебхука от Tilda
  fastify.post('/tilda', async (request, reply) => {
    try {
      const rawData = request.body;
      
      fastify.log.info('📥 Получены данные от Tilda:', {
        contentType: request.headers['content-type'],
        data: rawData
      });
      
      // Проверяем, что это тестовый запрос от Tilda
      if (rawData && rawData.test === 'test') {
        fastify.log.info('✅ Получен тестовый запрос от Tilda');
        return reply.code(200).send('OK');
      }
      
      // Проверяем, что данные получены
      if (!rawData || Object.keys(rawData).length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Нет данных от Tilda'
        });
      }
      
      // Tilda отправляет данные как form-urlencoded, а не массив
      // Преобразуем полученные данные в нужный формат
      const item = rawData;
      // Маппинг полей из Tilda в поля базы данных
      const locationData = {
        название: item['Название'] || item['Name'] || null,
        email: item['Email'] || null,
        адрес: item['Адрес'] || null,
        
        // Главная картинка (поддержка разных вариантов названия)
        картинка: item['Картинка_1'] || item['картинка'] || item['Картинка'] || item['Картинка 1'] || null,
        
        // Тайм-карты (стоимость в рублях)
        тайм_карта_1_час: safeParseInt(item['тайм-карта_1_часа']),
        тайм_карта_2_часа: safeParseInt(item['тайм-карта_2_часа']),
        тайм_карта_3_часа: safeParseInt(item['тайм-карта_3_часа']),
        тайм_карта_4_часа: safeParseInt(item['тайм-карта_4_часа']),
        тайм_карта_5_часов: safeParseInt(item['тайм-карта_5_часов']),
        
        // Призы (поддержка вариантов с _2 и без, с заглавной/строчной буквой)
        приз_1_текст: item['Приз_1_текст'] || item['приз_1_текст'] || null,
        приз_2_текст: item['Приз_2_текст'] || item['приз_2_текст'] || null,
        приз_3_текст: item['Приз_3_текст'] || item['приз_3_текст'] || null,
        приз_1_картинка: item['Приз_1_картинка_2'] || item['Приз_1_картинка'] || item['приз_1_картинка_2'] || item['приз_1_картинка'] || null,
        приз_2_картинка: item['Приз_2_картинка_2'] || item['Приз_2_картинка'] || item['приз_2_картинка_2'] || item['приз_2_картинка'] || null,
        приз_3_картинка: item['Приз_3_картинка_2'] || item['Приз_3_картинка'] || item['приз_3_картинка_2'] || item['приз_3_картинка'] || null,
        призы_текст: item['Призы_текст'] || item['призы_текст'] || null,
        
        // Розыгрыш
        пополнить_карту_сумма: safeParseInt(item['Пополнить_карту_на_сумму']),
        дата_следующего_розыгрыша: item['Дата_следующего_розыгрыша'] || null,
        
        // Акции
        заголовок_четверг_по_30: item['Заголовок_каждый_четверг_ПО_30'] || null,
        каждый_четверг_текст: item['Каждый_четверг_все_по'] || null,
        
        // Тайм-карты (цены для отображения)
        тайм_карта_1_час_цена: safeParseInt(item['Тайм_карта_1_час']),
        тайм_карта_2_часа_цена: safeParseInt(item['Тайм_карта_2_час']),
        тайм_карта_3_часа_цена: safeParseInt(item['Тайм_карта_3_час']),
        тайм_карта_4_часа_цена: safeParseInt(item['Тайм_карта_4_час']),
        тайм_карта_5_часов_цена: safeParseInt(item['Тайм_карта_5_час']),
        
        // Пополнения и бонусы
        пополнение_1: safeParseInt(item['Пополнение_1']),
        бонус_1: safeParseInt(item['Бонус_1']),
        пополнение_2: safeParseInt(item['Пополнение_2']),
        бонус_2: safeParseInt(item['Бонус_2']),
        пополнение_3: safeParseInt(item['Пополнение_3']),
        бонус_3: safeParseInt(item['Бонус_3']),
        пополнение_4: safeParseInt(item['Пополнение_4']),
        бонус_4: safeParseInt(item['Бонус_4']),
        пополнение_5: safeParseInt(item['Пополнение_5']),
        бонус_5: safeParseInt(item['Бонус_5']),
        пополнение_6: safeParseInt(item['Пополнение_6']),
        бонус_6: safeParseInt(item['Бонус_6']),
        
        // Накопления и привилегии
        накопление_1: safeParseInt(item['Накопление_1']),
        привилегия_1: item['Привилегия_1'] || null,
        накопление_2: safeParseInt(item['Накопление_2']),
        привилегия_2: item['Привилегия_2'] || null,
        накопление_3: safeParseInt(item['Накопление_3']),
        привилегия_3: item['Привилегия_3'] || null,
        накопление_4: safeParseInt(item['Накопление_4']),
        привилегия_4: item['Привилегия_4'] || null,
        
        // Метаданные от Tilda
        record_id: item['record_id'] || null,
        ma_name: item['ma_name'] || null,
        ma_email: item['ma_email'] || null,
        tranid: item['tranid'] || null,
        formid: item['formid'] || null
      };
      
      // Проверяем, существует ли запись с таким record_id
      let existingRecord = null;
      if (locationData.record_id) {
        existingRecord = await query(
          'SELECT id FROM locations WHERE record_id = $1',
          [locationData.record_id]
        );
      }
      
      let result;
      let action;
      
      if (existingRecord && existingRecord.rows.length > 0) {
        // Обновляем существующую запись
        const id = existingRecord.rows[0].id;
        const fields = [];
        const values = [];
        let paramIndex = 1;
        
        for (const [key, value] of Object.entries(locationData)) {
          if (key === 'record_id') continue;
          // Пропускаем пустые значения, чтобы не затирать существующие данные
          const isEmptyString = value === '';
          const isNullish = value === null || value === undefined;
          if (isNullish || isEmptyString) continue;
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }

        // Если нет ни одного поля для обновления — просто подтверждаем приём
        if (fields.length === 0) {
          fastify.log.info(`ℹ️ Нет изменений для ${locationData.record_id} — пустые поля пропущены`);
          return reply.code(200).send('OK');
        }
        
        const updateQuery = `
          UPDATE locations 
          SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        
        values.push(id);
        result = await query(updateQuery, values);
        action = 'updated';
        
        fastify.log.info(`✅ Обновлена локация: ${locationData.record_id} (ID: ${id})`);
      } else {
        // Создаем новую запись
        const fields = Object.keys(locationData);
        const values = Object.values(locationData);
        const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
        const fieldNames = fields.join(', ');
        
        const insertQuery = `
          INSERT INTO locations (${fieldNames})
          VALUES (${placeholders})
          RETURNING *
        `;
        
        result = await query(insertQuery, values);
        action = 'created';
        
        fastify.log.info(`✅ Создана новая локация: ${locationData.record_id} (ID: ${result.rows[0].id})`);
      }
      
      reply.code(200).send('OK');
      
    } catch (error) {
      fastify.log.error('❌ Ошибка обработки вебхука от Tilda:', error);
      fastify.log.error('Детали ошибки:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при обработке данных от Tilda',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}

module.exports = webhookRoutes;