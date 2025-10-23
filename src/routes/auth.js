const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

async function authRoutes(fastify, options) {
  
  // POST /api/auth/register - регистрация пользователя
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          role: { type: 'string', enum: ['user', 'editor', 'admin'], default: 'user' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password, role = 'user' } = request.body;
      
      // Проверяем, существует ли пользователь
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Пользователь с таким email уже существует'
        });
      }
      
      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Создаем пользователя
      const newUser = await query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at',
        [email, hashedPassword, role]
      );
      
      // Генерируем JWT токен
      const token = fastify.jwt.sign({
        id: newUser.rows[0].id,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role
      });
      
      reply.send({
        success: true,
        message: 'Пользователь успешно зарегистрирован',
        user: {
          id: newUser.rows[0].id,
          email: newUser.rows[0].email,
          role: newUser.rows[0].role
        },
        token
      });
      
    } catch (error) {
      fastify.log.error('Ошибка регистрации:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при регистрации пользователя'
      });
    }
  });
  
  // POST /api/auth/login - вход в систему
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = request.body;
      
      // Находим пользователя
      const user = await query(
        'SELECT id, email, password, role FROM users WHERE email = $1',
        [email]
      );
      
      if (user.rows.length === 0) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Неверный email или пароль'
        });
      }
      
      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.rows[0].password);
      
      if (!isValidPassword) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Неверный email или пароль'
        });
      }
      
      // Генерируем JWT токен
      const token = fastify.jwt.sign({
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role
      });
      
      reply.send({
        success: true,
        message: 'Успешный вход в систему',
        user: {
          id: user.rows[0].id,
          email: user.rows[0].email,
          role: user.rows[0].role
        },
        token
      });
      
    } catch (error) {
      fastify.log.error('Ошибка входа:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при входе в систему'
      });
    }
  });
  
  // GET /api/auth/profile - получение профиля пользователя
  fastify.get('/profile', {
    preHandler: [fastify.jwt.verify]
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      
      const user = await query(
        'SELECT id, email, role, created_at FROM users WHERE id = $1',
        [userId]
      );
      
      if (user.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Пользователь не найден'
        });
      }
      
      reply.send({
        success: true,
        user: user.rows[0]
      });
      
    } catch (error) {
      fastify.log.error('Ошибка получения профиля:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении профиля'
      });
    }
  });
  
  // POST /api/auth/verify - проверка токена Tilda Members
  fastify.post('/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['tilda_token'],
        properties: {
          tilda_token: { type: 'string' },
          tilda_user_id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { tilda_token, tilda_user_id } = request.body;
      
      // Здесь должна быть проверка токена Tilda Members
      // Пока создаем/обновляем пользователя
      let user;
      
      if (tilda_user_id) {
        // Ищем пользователя по tilda_user_id
        const existingUser = await query(
          'SELECT id, email, role FROM users WHERE tilda_user_id = $1',
          [tilda_user_id]
        );
        
        if (existingUser.rows.length > 0) {
          user = existingUser.rows[0];
        } else {
          // Создаем нового пользователя
          const newUser = await query(
            'INSERT INTO users (tilda_user_id, email, role) VALUES ($1, $2, $3) RETURNING id, email, role',
            [tilda_user_id, `user_${tilda_user_id}@tilda.local`, 'user']
          );
          user = newUser.rows[0];
        }
      } else {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Необходим tilda_user_id'
        });
      }
      
      // Генерируем JWT токен
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role
      });
      
      reply.send({
        success: true,
        message: 'Токен Tilda проверен',
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        token
      });
      
    } catch (error) {
      fastify.log.error('Ошибка проверки токена Tilda:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при проверке токена Tilda'
      });
    }
  });
}

module.exports = authRoutes;