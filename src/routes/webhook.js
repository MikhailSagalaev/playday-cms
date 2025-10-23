const { query } = require('../config/database');

async function webhookRoutes(fastify, options) {
  
  // POST /api/webhook/tilda - обработка вебхука от Tilda
  fastify.post('/tilda', {
    schema: {
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            'Название': { type: 'string' },
            'Email': { type: 'string' },
            'Адрес': { type: 'string' },
            'тайм-карта_2_часа': { type: 'string' },
            'тайм-карта_3_часа': { type: 'string' },
            'тайм-карта_4_часа': { type: 'string' },
            'тайм-карта_5_часов': { type: 'string' },
            'Приз_1_текст': { type: 'string' },
            'Приз_2_текст': { type: 'string' },
            'Приз_3_текст': { type: 'string' },
            'Приз_1_картинка': { type: 'string' },
            'Приз_2_картинка': { type: 'string' },
            'Приз_3_картинка': { type: 'string' },
            'Призы_текст': { type: 'string' },
            'Пополнить_карту_на_сумму': { type: 'string' },
            'Дата_следующего_розыгрыша': { type: 'string' },
            'Заголовок_каждый_четверг_ПО_30': { type: 'string' },
            'Каждый_четверг_все_по': { type: 'string' },
            'Тайм_карта_1_час': { type: 'string' },
            'Тайм_карта_2_час': { type: 'string' },
            'Тайм_карта_3_час': { type: 'string' },
            'Тайм_карта_4_час': { type: 'string' },
            'Тайм_карта_5_час': { type: 'string' },
            'Пополнение_1': { type: 'string' },
            'Бонус_1': { type: 'string' },
            'Пополнение_2': { type: 'string' },
            'Бонус_2': { type: 'string' },
            'Пополнение_3': { type: 'string' },
            'Бонус_3': { type: 'string' },
            'Пополнение_4': { type: 'string' },
            'Бонус_4': { type: 'string' },
            'Пополнение_5': { type: 'string' },
            'Бонус_5': { type: 'string' },
            'Пополнение_6': { type: 'string' },
            'Бонус_6': { type: 'string' },
            'Накопление_1': { type: 'string' },
            'Привилегия_1': { type: 'string' },
            'Накопление_2': { type: 'string' },
            'Привилегия_2': { type: 'string' },
            'Накопление_3': { type: 'string' },
            'Привилегия_3': { type: 'string' },
            'Накопление_4': { type: 'string' },
            'Привилегия_4': { type: 'string' },
            'record_id': { type: 'string' },
            'ma_name': { type: 'string' },
            'ma_email': { type: 'string' },
            'tranid': { type: 'string' },
            'formid': { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body;
      
      if (!Array.isArray(data) || data.length === 0) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Ожидается массив данных от Tilda'
        });
        return;
      }
      
      const results = [];
      
      for (const item of data) {
        // Маппинг полей из Tilda в поля базы данных
        const locationData = {
          название: item['Название'] || '',
          email: item['Email'] || '',
          адрес: item['Адрес'] || '',
          тайм_карта_2_часа: item['тайм-карта_2_часа'] || '',
          тайм_карта_3_часа: item['тайм-карта_3_часа'] || '',
          тайм_карта_4_часа: item['тайм-карта_4_часа'] || '',
          тайм_карта_5_часов: item['тайм-карта_5_часов'] || '',
          приз_1_текст: item['Приз_1_текст'] || '',
          приз_2_текст: item['Приз_2_текст'] || '',
          приз_3_текст: item['Приз_3_текст'] || '',
          приз_1_картинка: item['Приз_1_картинка'] || '',
          приз_2_картинка: item['Приз_2_картинка'] || '',
          приз_3_картинка: item['Приз_3_картинка'] || '',
          призы_текст: item['Призы_текст'] || '',
          пополнить_карту_сумма: item['Пополнить_карту_на_сумму'] || '',
          дата_следующего_розыгрыша: item['Дата_следующего_розыгрыша'] || '',
          заголовок_четверг_по_30: item['Заголовок_каждый_четверг_ПО_30'] || '',
          каждый_четверг_текст: item['Каждый_четверг_все_по'] || '',
          тайм_карта_1_час_цена: item['Тайм_карта_1_час'] || '',
          тайм_карта_2_часа_цена: item['Тайм_карта_2_час'] || '',
          тайм_карта_3_часа_цена: item['Тайм_карта_3_час'] || '',
          тайм_карта_4_часа_цена: item['Тайм_карта_4_час'] || '',
          тайм_карта_5_часов_цена: item['Тайм_карта_5_час'] || '',
          пополнение_1: item['Пополнение_1'] || '',
          бонус_1: item['Бонус_1'] || '',
          пополнение_2: item['Пополнение_2'] || '',
          бонус_2: item['Бонус_2'] || '',
          пополнение_3: item['Пополнение_3'] || '',
          бонус_3: item['Бонус_3'] || '',
          пополнение_4: item['Пополнение_4'] || '',
          бонус_4: item['Бонус_4'] || '',
          пополнение_5: item['Пополнение_5'] || '',
          бонус_5: item['Бонус_5'] || '',
          пополнение_6: item['Пополнение_6'] || '',
          бонус_6: item['Бонус_6'] || '',
          накопление_1: item['Накопление_1'] || '',
          привилегия_1: item['Привилегия_1'] || '',
          накопление_2: item['Накопление_2'] || '',
          привилегия_2: item['Привилегия_2'] || '',
          накопление_3: item['Накопление_3'] || '',
          привилегия_3: item['Привилегия_3'] || '',
          накопление_4: item['Накопление_4'] || '',
          привилегия_4: item['Привилегия_4'] || '',
          record_id: item['record_id'] || '',
          ma_name: item['ma_name'] || '',
          ma_email: item['ma_email'] || '',
          tranid: item['tranid'] || '',
          formid: item['formid'] || ''
        };
        
        // Проверяем, существует ли запись с таким record_id
        const existingRecord = await query(
          'SELECT id FROM locations WHERE record_id = $1',
          [locationData.record_id]
        );
        
        let result;
        
        if (existingRecord.rows.length > 0) {
          // Обновляем существующую запись
          const fields = Object.keys(locationData).filter(key => key !== 'record_id');
          const values = Object.values(locationData).filter((_, index) => Object.keys(locationData)[index] !== 'record_id');
          const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
          
          const updateQuery = `
            UPDATE locations 
            SET ${setClause}, updated_at = NOW()
            WHERE record_id = $1
            RETURNING *
          `;
          
          result = await query(updateQuery, [locationData.record_id, ...values]);
          
          fastify.log.info(`Обновлена локация: ${locationData.record_id} из Tilda`);
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
          
          fastify.log.info(`Создана новая локация: ${locationData.record_id} из Tilda`);
        }
        
        results.push({
          record_id: locationData.record_id,
          id: result.rows[0].id,
          action: existingRecord.rows.length > 0 ? 'updated' : 'created'
        });
      }
      
      reply.send({
        success: true,
        message: 'Данные от Tilda успешно обработаны',
        results: results
      });
      
    } catch (error) {
      fastify.log.error('Ошибка обработки вебхука от Tilda:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при обработке данных от Tilda'
      });
    }
  });
}

module.exports = webhookRoutes;
