const { query } = require('../config/database');
const { locationSchema } = require('../schemas/location');
const { authenticate, requireRole } = require('../middleware/auth');

async function locationsRoutes(fastify, options) {

  // GET /api/locations - получение списка локаций
  fastify.get('/', {
    preHandler: [authenticate, requireRole(['admin', 'manager', 'user'])]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      let locationsQuery;
      let queryParams = [];
      
      if (userRole === 'admin' || userRole === 'manager') {
        // Админы и менеджеры видят все локации
        locationsQuery = 'SELECT * FROM locations ORDER BY created_at DESC';
      } else {
        // Обычные пользователи видят только свои локации
        locationsQuery = 'SELECT * FROM locations WHERE user_id = $1 ORDER BY created_at DESC';
        queryParams = [userId];
      }
      
      const result = await query(locationsQuery, queryParams);
      
      reply.send({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
      
    } catch (error) {
      fastify.log.error('Ошибка получения локаций:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении списка локаций'
      });
    }
  });

  // GET /api/locations/:id - получение конкретной локации
  fastify.get('/:id', {
    preHandler: [authenticate, requireRole(['admin', 'manager', 'user'])]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      let locationQuery;
      let queryParams = [id];
      
      if (userRole === 'admin' || userRole === 'manager') {
        locationQuery = 'SELECT * FROM locations WHERE id = $1';
      } else {
        locationQuery = 'SELECT * FROM locations WHERE id = $1 AND user_id = $2';
        queryParams.push(userId);
      }
      
      const result = await query(locationQuery, queryParams);
      
      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена'
        });
        return;
      }
      
      reply.send({
        success: true,
        data: result.rows[0]
      });
      
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
    preHandler: [authenticate, requireRole(['admin', 'manager'])]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const locationData = request.body;
      
      // Валидация обязательных полей
      if (!locationData.название_лк || !locationData.email) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Поля название_лк и email обязательны'
        });
        return;
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
      body: locationSchema.update
    },
    preHandler: [authenticate, requireRole(['admin', 'manager', 'editor'])]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      const userRole = request.user.role;
      const updateData = request.body;
      
      // Проверяем существование локации и права доступа
      let checkQuery;
      let checkParams = [id];
      
      if (userRole === 'admin' || userRole === 'manager') {
        checkQuery = 'SELECT id, user_id FROM locations WHERE id = $1';
      } else {
        checkQuery = 'SELECT id, user_id FROM locations WHERE id = $1 AND user_id = $2';
        checkParams.push(userId);
      }
      
      const existingLocation = await query(checkQuery, checkParams);
      
      if (existingLocation.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена или у вас нет прав для её изменения'
        });
        return;
      }
      
      // Обновляем запись
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      
      const updateQuery = `
        UPDATE locations 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(updateQuery, [id, ...values]);
      
      fastify.log.info(`Обновлена локация: ${id} пользователем ${userId}`);
      
      reply.send({
        success: true,
        data: result.rows[0],
        message: 'Локация успешно обновлена'
      });
      
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
    preHandler: [authenticate, requireRole(['admin', 'manager'])]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      // Проверяем существование локации и права доступа
      let checkQuery;
      let checkParams = [id];
      
      if (userRole === 'admin') {
        checkQuery = 'SELECT id FROM locations WHERE id = $1';
      } else {
        checkQuery = 'SELECT id FROM locations WHERE id = $1 AND user_id = $2';
        checkParams.push(userId);
      }
      
      const existingLocation = await query(checkQuery, checkParams);
      
      if (existingLocation.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена или у вас нет прав для её удаления'
        });
        return;
      }
      
      // Удаляем запись
      await query('DELETE FROM locations WHERE id = $1', [id]);
      
      fastify.log.info(`Удалена локация: ${id} пользователем ${userId}`);
      
      reply.send({
        success: true,
        message: 'Локация успешно удалена'
      });
      
    } catch (error) {
      fastify.log.error('Ошибка удаления локации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при удалении локации'
      });
    }
  });
}

module.exports = locationsRoutes;
