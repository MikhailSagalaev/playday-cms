const { query } = require('../config/database');

// Схемы валидации для Tilda интеграции
const tildaSchemas = {
  fetchContent: {
    body: {
      type: 'object',
      required: ['profile'],
      properties: {
        profile: {
          type: 'object',
          required: ['login', 'email'],
          properties: {
            login: { type: 'string' },
            email: { type: 'string', format: 'email' },
            groups: { type: 'array', items: { type: 'string' } },
            courses: { type: 'array', items: { type: 'string' } }
          }
        },
        project_id: { type: 'string' },
        referer: { type: 'string' },
        user_agent: { type: 'string' },
        filters: { type: 'string' }
      }
    }
  }
};

async function tildaRoutes(fastify, options) {
  
  // POST /api/tilda/fetch-content - получение контента для Tilda (замена Collabza)
  fastify.post('/fetch-content', {
    schema: tildaSchemas.fetchContent
  }, async (request, reply) => {
    try {
      const { profile, project_id, referer, user_agent, filters } = request.body;
      
      // Создаем уникальный ID пользователя на основе данных Tilda
      const tildaUserId = `${project_id}_${profile.login}`;
      
      // Получаем пользователя
      const user = await query(
        'SELECT id, tilda_user_id, email, role FROM users WHERE tilda_user_id = $1',
        [tildaUserId]
      );
      
      if (user.rows.length === 0) {
        // Создаем пользователя если не существует
        const newUser = await query(`
          INSERT INTO users (tilda_user_id, email, role)
          VALUES ($1, $2, $3)
          RETURNING id, tilda_user_id, email, role
        `, [tildaUserId, profile.email, 'user']);
        
        const userId = newUser.rows[0].id;
        
        // Логируем создание пользователя
        await query(`
          INSERT INTO activity_logs (user_id, action, table_name, ip_address, user_agent)
          VALUES ($1, $2, $3, $4, $5)
        `, [userId, 'create', 'users', request.ip, user_agent]);
        
        fastify.log.info(`Создан новый пользователь Tilda: ${tildaUserId}`);
        
        // Возвращаем пустой результат для нового пользователя
        return {
          records: []
        };
      }
      
      const userId = user.rows[0].id;
      
      // Получаем локации пользователя
      let whereClause = 'WHERE user_id = $1';
      let queryParams = [userId];
      let paramIndex = 2;
      
      // Применяем фильтры если есть
      if (filters) {
        try {
          const filterData = JSON.parse(filters);
          if (filterData.название_лк) {
            whereClause += ` AND название_лк = $${paramIndex}`;
            queryParams.push(filterData.название_лк);
            paramIndex++;
          }
        } catch (error) {
          fastify.log.warn('Ошибка парсинга фильтров:', error);
        }
      }
      
      const locations = await query(`
        SELECT * FROM locations 
        ${whereClause}
        ORDER BY created_at DESC
      `, queryParams);
      
      if (locations.rows.length === 0) {
        return {
          records: []
        };
      }
      
      // Преобразуем данные в формат, совместимый с Collabza
      const records = locations.rows.map(location => {
        const record = {
          // Базовые поля
          title: location.название || '',
          description: location.описание || '',
          email: location.email || '',
          phone: location.номер_телефона || '',
          cover_image: location.картинка || '',
          address: location.адрес || '',
          
          // Тайм-карты (оригинальные цены)
          '1h-card': location.тайм_карта_1_час || '',
          '2h-card': location.тайм_карта_2_часа || '',
          '3h-card': location.тайм_карта_3_часа || '',
          '4h-card': location.тайм_карта_4_часа || '',
          '5h-card': location.тайм_карта_5_часов || '',
          
          // Призы
          'prizetxt1': location.приз_1_текст || '',
          'prizetxt2': location.приз_2_текст || '',
          'prizetxt3': location.приз_3_текст || '',
          'prizeimg1': location.приз_1_картинка || '',
          'prizeimg2': location.приз_2_картинка || '',
          'prizeimg3': location.приз_3_картинка || '',
          'prizealltxt': location.призы_текст || '',
          'rozegrishtxt': location.розыгрыш_тайм_карт_текст || '',
          '600': location.пополнить_карту_сумма || '',
          'nextdate': location.дата_следующего_розыгрыша || '',
          
          // Акции
          'akciatxt': location.каждый_четверг_текст || '',
          'skidka1': location.скидка_1 || '',
          'skidka2': location.скидка_2 || '',
          
          // Цены для отображения
          'time-card1': location.тайм_карта_1_час_цена || '',
          'time-card2': location.тайм_карта_2_часа_цена || '',
          'time-card3': location.тайм_карта_3_часа_цена || '',
          'time-card4': location.тайм_карта_4_часа_цена || '',
          'time-card5': location.тайм_карта_5_часов_цена || '',
          'every30': location.заголовок_четверг_по_30 || '',
          
          // Система лояльности
          'vznos1': location.пополнение_1 || '',
          'vznos2': location.пополнение_2 || '',
          'vznos3': location.пополнение_3 || '',
          'vznos4': location.пополнение_4 || '',
          'vznos5': location.пополнение_5 || '',
          'vznos6': location.пополнение_6 || '',
          'bonus1': location.бонус_1 || '',
          'bonus2': location.бонус_2 || '',
          'bonus3': location.бонус_3 || '',
          'bonus4': location.бонус_4 || '',
          'bonus5': location.бонус_5 || '',
          'bonus6': location.бонус_6 || '',
          
          // Привилегии
          'privilege1': location.привилегия_1 || '',
          'privilege2': location.привилегия_2 || '',
          'privilege3': location.привилегия_3 || '',
          'privilege4': location.привилегия_4 || '',
          
          // Метаданные
          id: location.id,
          record_id: location.record_id,
          created_at: location.created_at,
          updated_at: location.updated_at
        };
        
        return record;
      });
      
      // Логируем запрос
      await query(`
        INSERT INTO activity_logs (user_id, action, table_name, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, 'fetch_content', 'locations', request.ip, user_agent]);
      
      return {
        records
      };
      
    } catch (error) {
      fastify.log.error('Ошибка получения контента для Tilda:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении контента'
      });
    }
  });
  
  // GET /api/tilda/health - проверка здоровья интеграции
  fastify.get('/health', async (request, reply) => {
    try {
      // Проверяем подключение к БД
      const dbCheck = await query('SELECT NOW() as current_time');
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        version: '1.0.0'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка проверки здоровья Tilda интеграции:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка проверки здоровья системы'
      });
    }
  });
  
  // POST /api/tilda/webhook - webhook для получения данных из форм Tilda
  fastify.post('/webhook', {
    schema: {
      body: {
        type: 'object',
        properties: {
          form_id: { type: 'string' },
          form_name: { type: 'string' },
          fields: {
            type: 'object',
            additionalProperties: true
          },
          user: {
            type: 'object',
            properties: {
              login: { type: 'string' },
              email: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { form_id, form_name, fields, user } = request.body;
      
      fastify.log.info(`Получен webhook от Tilda: форма ${form_name} (${form_id})`);
      
      // Здесь можно добавить логику обработки данных из форм Tilda
      // Например, создание новых локаций или обновление существующих
      
      return {
        success: true,
        message: 'Webhook обработан успешно'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка обработки webhook Tilda:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при обработке webhook'
      });
    }
  });
}

module.exports = tildaRoutes;
