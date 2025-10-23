const { query } = require('../config/database');
const { locationSchema, sanitizeHtml, validateImageUrl } = require('../schemas/location');
const { authenticate, requireRole, checkResourceAccess, logActivity, checkUserLimits } = require('../middleware/auth');

async function locationsRoutes(fastify, options) {
  
  // GET /api/locations - получение списка локаций
  fastify.get('/', {
    schema: {
      querystring: locationSchema.query
    },
    preHandler: [authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const userRole = request.user.role;
      const { page = 1, limit = 20, search, название_лк, sort_by = 'created_at', sort_order = 'desc' } = request.query;
      
      const offset = (page - 1) * limit;
      
      // Базовый запрос
      let whereClause = '';
      let queryParams = [];
      let paramIndex = 1;
      
      // Админы видят все локации, остальные - только свои
      if (userRole !== 'admin') {
        whereClause = `WHERE user_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }
      
      // Поиск по названию
      if (search) {
        const searchCondition = `AND (название ILIKE $${paramIndex} OR название_лк ILIKE $${paramIndex})`;
        whereClause += whereClause ? searchCondition : `WHERE (название ILIKE $${paramIndex} OR название_лк ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }
      
      // Фильтр по названию_лк
      if (название_лк) {
        const filterCondition = `AND название_лк = $${paramIndex}`;
        whereClause += whereClause ? filterCondition : `WHERE название_лк = $${paramIndex}`;
        queryParams.push(название_лк);
        paramIndex++;
      }
      
      // Подсчет общего количества
      const countQuery = `SELECT COUNT(*) as total FROM locations ${whereClause}`;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);
      
      // Получение данных
      const dataQuery = `
        SELECT 
          id, record_id, название_лк, название, описание, email, 
          номер_телефона, картинка, адрес, created_at, updated_at
        FROM locations 
        ${whereClause}
        ORDER BY ${sort_by} ${sort_order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      
      const result = await query(dataQuery, queryParams);
      
      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      fastify.log.error('Ошибка получения списка локаций:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении списка локаций'
      });
    }
  });
  
  // GET /api/locations/:id - получение конкретной локации
  fastify.get('/:id', {
    schema: {
      params: locationSchema.params
    },
    preHandler: [authenticate, checkResourceAccess]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      const result = await query(`
        SELECT * FROM locations WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена'
        });
        return;
      }
      
      const location = result.rows[0];
      
      // Генерируем JS код для Tilda (аналогично Airtable)
      const jsCode = generateJSCode(location);
      
      return {
        ...location,
        js_code: jsCode
      };
      
    } catch (error) {
      fastify.log.error('Ошибка получения локации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении локации'
      });
    }
  });
  
  // POST /api/locations - создание новой локации
  fastify.post('/', {
    schema: {
      body: locationSchema.create
    },
    preHandler: [authenticate, checkUserLimits, logActivity('create', 'locations')]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const locationData = request.body;
      
      // Санитизация HTML в описании
      if (locationData.описание) {
        locationData.описание = sanitizeHtml(locationData.описание);
      }
      
      // Валидация URL изображений
      const imageFields = ['картинка', 'приз_1_картинка', 'приз_2_картинка', 'приз_3_картинка'];
      for (const field of imageFields) {
        if (locationData[field] && !validateImageUrl(locationData[field])) {
          reply.code(400).send({
            error: 'Bad Request',
            message: `Некорректный URL изображения в поле ${field}`
          });
          return;
        }
      }
      
      // Проверяем уникальность название_лк для пользователя
      const existingLocation = await query(
        'SELECT id FROM locations WHERE название_лк = $1 AND user_id = $2',
        [locationData.название_лк, userId]
      );
      
      if (existingLocation.rows.length > 0) {
        reply.code(409).send({
          error: 'Conflict',
          message: 'Локация с таким названием уже существует'
        });
        return;
      }
      
      // Создаем запись
      const fields = Object.keys(locationData);
      const values = Object.values(locationData);
      const placeholders = fields.map((_, index) => `$${index + 2}`).join(', ');
      const fieldNames = fields.join(', ');
      
      const insertQuery = `
        INSERT INTO locations (user_id, ${fieldNames})
        VALUES ($1, ${placeholders})
        RETURNING *
      `;
      
      const result = await query(insertQuery, [userId, ...values]);
      
      fastify.log.info(`Создана новая локация: ${result.rows[0].id} для пользователя ${userId}`);
      
      reply.code(201).send({
        success: true,
        data: result.rows[0],
        message: 'Локация успешно создана'
      });
      
    } catch (error) {
      fastify.log.error('Ошибка создания локации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при создании локации'
      });
    }
  });
  
  // PUT /api/locations/:id - обновление локации
  fastify.put('/:id', {
    schema: {
      params: locationSchema.params,
      body: locationSchema.update
    },
    preHandler: [authenticate, checkResourceAccess, logActivity('update', 'locations')]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const updateData = request.body;
      
      // Санитизация HTML в описании
      if (updateData.описание) {
        updateData.описание = sanitizeHtml(updateData.описание);
      }
      
      // Валидация URL изображений
      const imageFields = ['картинка', 'приз_1_картинка', 'приз_2_картинка', 'приз_3_картинка'];
      for (const field of imageFields) {
        if (updateData[field] && !validateImageUrl(updateData[field])) {
          reply.code(400).send({
            error: 'Bad Request',
            message: `Некорректный URL изображения в поле ${field}`
          });
          return;
        }
      }
      
      // Проверяем, что локация существует
      const existingLocation = await query(
        'SELECT id, user_id FROM locations WHERE id = $1',
        [id]
      );
      
      if (existingLocation.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена'
        });
        return;
      }
      
      // Проверяем уникальность название_лк (если изменяется)
      if (updateData.название_лк) {
        const userId = request.user.userId;
        const duplicateLocation = await query(
          'SELECT id FROM locations WHERE название_лк = $1 AND user_id = $2 AND id != $3',
          [updateData.название_лк, userId, id]
        );
        
        if (duplicateLocation.rows.length > 0) {
          reply.code(409).send({
            error: 'Conflict',
            message: 'Локация с таким названием уже существует'
          });
          return;
        }
      }
      
      // Обновляем запись
      const fields = Object.keys(updateData);
      if (fields.length === 0) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Нет данных для обновления'
        });
        return;
      }
      
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const values = Object.values(updateData);
      
      const updateQuery = `
        UPDATE locations 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(updateQuery, [id, ...values]);
      
      fastify.log.info(`Обновлена локация: ${id}`);
      
      return {
        success: true,
        data: result.rows[0],
        message: 'Локация успешно обновлена'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка обновления локации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при обновлении локации'
      });
    }
  });
  
  // DELETE /api/locations/:id - удаление локации
  fastify.delete('/:id', {
    schema: {
      params: locationSchema.params
    },
    preHandler: [authenticate, checkResourceAccess, logActivity('delete', 'locations')]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Проверяем, что локация существует
      const existingLocation = await query(
        'SELECT id FROM locations WHERE id = $1',
        [id]
      );
      
      if (existingLocation.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена'
        });
        return;
      }
      
      // Удаляем локацию (каскадное удаление файлов)
      await query('DELETE FROM locations WHERE id = $1', [id]);
      
      fastify.log.info(`Удалена локация: ${id}`);
      
      return {
        success: true,
        message: 'Локация успешно удалена'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка удаления локации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при удалении локации'
      });
    }
  });
}

// Функция генерации JS кода для Tilda (аналогично Airtable)
function generateJSCode(location) {
  const jsTemplate = `
<script>
$(document).ready(function() {
  $('.nazvanie .tn-atom').html('${escapeJS(location.название || '')}');
  $('.email .tn-atom').html('${escapeJS(location.email || '')}');
  $('.phone .tn-atom').html('${escapeJS(location.номер_телефона || '')}');
  $('.coverimg .tn-atom__img').attr('src','${escapeJS(location.картинка || '')}');
  $('.address .tn-atom').html('${escapeJS(location.адрес || '')}');
  $('.1h-card .tn-atom').html('${location.тайм_карта_1_час || ''}');
  $('.2h-card .tn-atom').html('${location.тайм_карта_2_часа || ''}');
  $('.3h-card .tn-atom').html('${location.тайм_карта_3_часа || ''}');
  $('.4h-card .tn-atom').html('${location.тайм_карта_4_часа || ''}');
  $('.5h-card .tn-atom').html('${location.тайм_карта_5_часов || ''}');
  $('.prizetxt1 .tn-atom').html('${escapeJS(location.приз_1_текст || '')}');
  $('.prizetxt2 .tn-atom').html('${escapeJS(location.приз_2_текст || '')}');
  $('.prizetxt3 .tn-atom').html('${escapeJS(location.приз_3_текст || '')}');
  $('.prizeimg1 .tn-atom').css('background-image', 'url(${escapeJS(location.приз_1_картинка || '')})');
  $('.prizeimg2 .tn-atom').css('background-image', 'url(${escapeJS(location.приз_2_картинка || '')})');
  $('.prizeimg3 .tn-atom').css('background-image', 'url(${escapeJS(location.приз_3_картинка || '')})');
  $('.prizealltxt .tn-atom').html('${escapeJS(location.призы_текст || '')}');
  $('.rozegrishtxt .tn-atom').html('${escapeJS(location.розыгрыш_тайм_карт_текст || '')}');
  $('.600 .tn-atom').html('${location.пополнить_карту_сумма || ''}');
  $('.nextdate .tn-atom').html('${escapeJS(location.дата_следующего_розыгрыша || '')}');
  $('.akciatxt .tn-atom').html('${escapeJS(location.каждый_четверг_текст || '')}');
  $('.skidka1 .tn-atom').html('${escapeJS(location.скидка_1 || '')}');
  $('.skidka2 .tn-atom').html('${escapeJS(location.скидка_2 || '')}');
  $('.time-card1 .tn-atom').html('${location.тайм_карта_1_час_цена || ''} руб.');
  $('.time-card2 .tn-atom').html('${location.тайм_карта_2_часа_цена || ''} руб.');
  $('.time-card3 .tn-atom').html('${location.тайм_карта_3_часа_цена || ''} руб.');
  $('.time-card4 .tn-atom').html('${location.тайм_карта_4_часа_цена || ''} руб.');
  $('.time-card5 .tn-atom').html('${location.тайм_карта_5_часов_цена || ''} руб.');
  $('.every30 .tn-atom').html('${escapeJS(location.заголовок_четверг_по_30 || '')}');
  $('.vznos1 .tn-atom').html('${location.пополнение_1 || ''} руб.');
  $('.vznos2 .tn-atom').html('${location.пополнение_2 || ''} руб.');
  $('.vznos3 .tn-atom').html('${location.пополнение_3 || ''} руб.');
  $('.vznos4 .tn-atom').html('${location.пополнение_4 || ''} руб.');
  $('.vznos5 .tn-atom').html('${location.пополнение_5 || ''} руб.');
  $('.vznos6 .tn-atom').html('${location.пополнение_6 || ''} руб.');
  $('.bonus1 .tn-atom').html('+${location.бонус_1 || ''}');
  $('.bonus2 .tn-atom').html('+${location.бонус_2 || ''}');
  $('.bonus3 .tn-atom').html('+${location.бонус_3 || ''}');
  $('.bonus4 .tn-atom').html('+${location.бонус_4 || ''}');
  $('.bonus5 .tn-atom').html('+${location.бонус_5 || ''}');
  $('.bonus6 .tn-atom').html('+${location.бонус_6 || ''}');
});
</script>`;

  return jsTemplate.trim();
}

// Функция экранирования для JS
function escapeJS(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

module.exports = locationsRoutes;
