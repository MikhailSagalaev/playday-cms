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
  fastify.post('/tilda', {
    schema: {
      body: {
        type: 'array',
        items: {
          type: 'object'
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body;
      
      // Проверяем, что это тестовый запрос от Tilda
      if (Array.isArray(data) && data.length === 1 && data[0].test === 'true') {
        fastify.log.info('Получен тестовый запрос от Tilda');
        return reply.send({
          success: true,
          message: 'Тестовый запрос успешно обработан'
        });
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Ожидается массив данных от Tilda'
        });
      }
      
      const results = [];
      
      for (const item of data) {
        // Маппинг полей из Tilda в поля базы данных
        const locationData = {
          название: item['Название'] || null,
          email: item['Email'] || null,
          адрес: item['Адрес'] || null,
          
          // Тайм-карты (стоимость в рублях)
          тайм_карта_1_час: safeParseInt(item['тайм-карта_1_часа']),
          тайм_карта_2_часа: safeParseInt(item['тайм-карта_2_часа']),
          тайм_карта_3_часа: safeParseInt(item['тайм-карта_3_часа']),
          тайм_карта_4_часа: safeParseInt(item['тайм-карта_4_часа']),
          тайм_карта_5_часов: safeParseInt(item['тайм-карта_5_часов']),
          
          // Призы
          приз_1_текст: item['Приз_1_текст'] || null,
          приз_2_текст: item['Приз_2_текст'] || null,
          приз_3_текст: item['Приз_3_текст'] || null,
          приз_1_картинка: item['Приз_1_картинка'] || null,
          приз_2_картинка: item['Приз_2_картинка'] || null,
          приз_3_картинка: item['Приз_3_картинка'] || null,
          призы_текст: item['Призы_текст'] || null,
          
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
        
        if (existingRecord && existingRecord.rows.length > 0) {
          // Обновляем существующую запись
          const id = existingRecord.rows[0].id;
          const fields = [];
          const values = [];
          let paramIndex = 1;
          
          for (const [key, value] of Object.entries(locationData)) {
            if (key !== 'record_id') {
              fields.push(`${key} = $${paramIndex}`);
              values.push(value);
              paramIndex++;
            }
          }
          
          const updateQuery = `
            UPDATE locations 
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
          `;
          
          values.push(id);
          result = await query(updateQuery, values);
          
          fastify.log.info(`✅ Обновлена локация: ${locationData.record_id} (ID: ${id})`);
          results.push({
            record_id: locationData.record_id,
            id: id,
            action: 'updated'
          });
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
          
          fastify.log.info(`✅ Создана новая локация: ${locationData.record_id} (ID: ${result.rows[0].id})`);
          results.push({
            record_id: locationData.record_id,
            id: result.rows[0].id,
            action: 'created'
          });
        }
      }
      
      reply.send({
        success: true,
        message: 'Данные от Tilda успешно обработаны',
        results: results
      });
      
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