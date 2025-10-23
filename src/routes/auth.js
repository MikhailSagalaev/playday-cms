const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

// Схема валидации для аутентификации
const authSchema = {
  verify: {
    body: {
      type: 'object',
      required: ['profile'],
      properties: {
        profile: {
          type: 'object',
          required: ['login', 'email'],
          properties: {
            login: { type: 'string', minLength: 1 },
            email: { type: 'string', format: 'email' },
            groups: { type: 'array', items: { type: 'string' } },
            courses: { type: 'array', items: { type: 'string' } }
          }
        },
        project_id: { type: 'string' },
        referer: { type: 'string' },
        user_agent: { type: 'string' }
      }
    }
  }
};

async function authRoutes(fastify, options) {
  // POST /api/auth/verify - проверка токена Tilda Members
  fastify.post('/verify', {
    schema: authSchema.verify,
    preHandler: async (request, reply) => {
      // Дополнительная валидация профиля Tilda
      if (!request.body.profile.login || !request.body.profile.email) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Неполный профиль пользователя'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const { profile, project_id, referer, user_agent } = request.body;
      
      // Создаем уникальный ID пользователя на основе данных Tilda
      const tildaUserId = `${project_id}_${profile.login}`;
      
      // Проверяем, существует ли пользователь
      let user = await query(
        'SELECT * FROM users WHERE tilda_user_id = $1',
        [tildaUserId]
      );
      
      if (user.rows.length === 0) {
        // Создаем нового пользователя
        const newUser = await query(`
          INSERT INTO users (tilda_user_id, email, role)
          VALUES ($1, $2, $3)
          RETURNING id, tilda_user_id, email, role, created_at
        `, [tildaUserId, profile.email, 'user']);
        
        user = newUser;
        fastify.log.info(`Создан новый пользователь: ${tildaUserId}`);
      } else {
        // Обновляем email если изменился
        if (user.rows[0].email !== profile.email) {
          await query(
            'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2',
            [profile.email, user.rows[0].id]
          );
          user.rows[0].email = profile.email;
        }
      }
      
      const userData = user.rows[0];
      
      // Создаем JWT токен
      const token = fastify.jwt.sign({
        userId: userData.id,
        tildaUserId: userData.tilda_user_id,
        email: userData.email,
        role: userData.role
      }, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      
      // Логируем вход
      await query(`
        INSERT INTO activity_logs (user_id, action, table_name, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        userData.id,
        'login',
        'users',
        request.ip,
        user_agent
      ]);
      
      return {
        success: true,
        token,
        user: {
          id: userData.id,
          tilda_user_id: userData.tilda_user_id,
          email: userData.email,
          role: userData.role
        }
      };
      
    } catch (error) {
      fastify.log.error('Ошибка аутентификации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при аутентификации пользователя'
      });
    }
  });
  
  // GET /api/auth/profile - получение профиля пользователя
  fastify.get('/profile', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Недействительный токен авторизации'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      
      const user = await query(
        'SELECT id, tilda_user_id, email, role, created_at FROM users WHERE id = $1',
        [userId]
      );
      
      if (user.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Пользователь не найден'
        });
        return;
      }
      
      return {
        user: user.rows[0]
      };
      
    } catch (error) {
      fastify.log.error('Ошибка получения профиля:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении профиля пользователя'
      });
    }
  });
  
  // POST /api/auth/refresh - обновление токена
  fastify.post('/refresh', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Недействительный токен авторизации'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      
      // Проверяем, что пользователь все еще существует
      const user = await query(
        'SELECT id, tilda_user_id, email, role FROM users WHERE id = $1',
        [userId]
      );
      
      if (user.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Пользователь не найден'
        });
        return;
      }
      
      const userData = user.rows[0];
      
      // Создаем новый токен
      const token = fastify.jwt.sign({
        userId: userData.id,
        tilda_user_id: userData.tilda_user_id,
        email: userData.email,
        role: userData.role
      }, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      
      return {
        success: true,
        token,
        user: {
          id: userData.id,
          tilda_user_id: userData.tilda_user_id,
          email: userData.email,
          role: userData.role
        }
      };
      
    } catch (error) {
      fastify.log.error('Ошибка обновления токена:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при обновлении токена'
      });
    }
  });
  
  // POST /api/auth/logout - выход из системы
  fastify.post('/logout', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Недействительный токен авторизации'
        });
      }
    }
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      
      // Логируем выход
      await query(`
        INSERT INTO activity_logs (user_id, action, table_name, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        'logout',
        'users',
        request.ip,
        request.headers['user-agent']
      ]);
      
      return {
        success: true,
        message: 'Выход выполнен успешно'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка выхода:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при выходе из системы'
      });
    }
  });
}

module.exports = authRoutes;
