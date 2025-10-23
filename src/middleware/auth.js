const { query } = require('../config/database');

// Middleware для проверки JWT токена
async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Недействительный токен авторизации'
    });
  }
}

// Middleware для проверки ролей
function requireRole(allowedRoles) {
  return async function(request, reply) {
    try {
      // Проверяем JWT токен
      await request.jwtVerify();
      
      const userRole = request.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Недостаточно прав для выполнения операции'
        });
        return;
      }
      
    } catch (err) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Токен авторизации не предоставлен'
        });
      } else if (err.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Недействительный токен авторизации'
        });
      } else {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Ошибка при проверке авторизации'
        });
      }
    }
  };
}

// Middleware для проверки прав доступа к ресурсу
async function checkResourceAccess(request, reply) {
  try {
    await request.jwtVerify();
    
    const userId = request.user.userId;
    const userRole = request.user.role;
    const resourceId = request.params.id;
    
    // Админы имеют доступ ко всем ресурсам
    if (userRole === 'admin') {
      return;
    }
    
    // Проверяем, принадлежит ли ресурс пользователю
    const resource = await query(
      'SELECT user_id FROM locations WHERE id = $1',
      [resourceId]
    );
    
    if (resource.rows.length === 0) {
      reply.code(404).send({
        error: 'Not Found',
        message: 'Ресурс не найден'
      });
      return;
    }
    
    if (resource.rows[0].user_id !== userId) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'Нет доступа к данному ресурсу'
      });
      return;
    }
    
  } catch (err) {
    if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Токен авторизации не предоставлен'
      });
    } else if (err.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Недействительный токен авторизации'
      });
    } else {
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при проверке доступа к ресурсу'
      });
    }
  }
}

// Middleware для логирования действий
async function logActivity(action, tableName) {
  return async function(request, reply) {
    try {
      const userId = request.user?.userId;
      
      if (userId) {
        await query(`
          INSERT INTO activity_logs (user_id, action, table_name, record_id, ip_address, user_agent)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userId,
          action,
          tableName,
          request.params.id || null,
          request.ip,
          request.headers['user-agent']
        ]);
      }
    } catch (error) {
      // Не прерываем выполнение при ошибке логирования
      console.error('Ошибка логирования активности:', error);
    }
  };
}

// Middleware для проверки лимитов пользователя
async function checkUserLimits(request, reply) {
  try {
    await request.jwtVerify();
    
    const userId = request.user.userId;
    const userRole = request.user.role;
    
    // Админы не имеют ограничений
    if (userRole === 'admin') {
      return;
    }
    
    // Проверяем количество локаций пользователя
    const locationCount = await query(
      'SELECT COUNT(*) as count FROM locations WHERE user_id = $1',
      [userId]
    );
    
    const maxLocations = userRole === 'editor' ? 10 : 5; // Редакторы могут иметь больше локаций
    
    if (parseInt(locationCount.rows[0].count) >= maxLocations) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Превышен лимит локаций (максимум ${maxLocations})`
      });
      return;
    }
    
  } catch (err) {
    if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Токен авторизации не предоставлен'
      });
    } else if (err.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Недействительный токен авторизации'
      });
    } else {
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при проверке лимитов пользователя'
      });
    }
  }
}

module.exports = {
  authenticate,
  requireRole,
  checkResourceAccess,
  logActivity,
  checkUserLimits
};
