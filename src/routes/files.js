const { query } = require('../config/database');
const { authenticate, requireRole, logActivity } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Схемы валидации
const fileSchemas = {
  upload: {
    body: {
      type: 'object',
      required: ['location_id', 'field_name'],
      properties: {
        location_id: { type: 'integer', minimum: 1 },
        field_name: { 
          type: 'string', 
          enum: ['картинка', 'приз_1_картинка', 'приз_2_картинка', 'приз_3_картинка'],
          description: 'Название поля в таблице locations'
        }
      }
    }
  },
  params: {
    type: 'object',
    required: ['filename'],
    properties: {
      filename: { type: 'string', minLength: 1 }
    }
  }
};

async function filesRoutes(fastify, options) {
  
  // POST /api/files/upload - загрузка файла
  fastify.post('/upload', {
    schema: fileSchemas.upload,
    preHandler: [authenticate, logActivity('upload', 'files')]
  }, async (request, reply) => {
    try {
      const { location_id, field_name } = request.body;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      // Проверяем, что локация существует и принадлежит пользователю
      const location = await query(
        'SELECT id, user_id FROM locations WHERE id = $1',
        [location_id]
      );
      
      if (location.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Локация не найдена'
        });
        return;
      }
      
      // Проверяем права доступа
      if (userRole !== 'admin' && location.rows[0].user_id !== userId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Нет доступа к данной локации'
        });
        return;
      }
      
      // Получаем загруженный файл
      const data = await request.file();
      
      if (!data) {
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Файл не предоставлен'
        });
        return;
      }
      
      // Проверяем тип файла
      const allowedMimeTypes = process.env.ALLOWED_MIME_TYPES?.split(',') || [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp'
      ];
      
      if (!allowedMimeTypes.includes(data.mimetype)) {
        reply.code(400).send({
          error: 'Bad Request',
          message: `Неподдерживаемый тип файла. Разрешены: ${allowedMimeTypes.join(', ')}`
        });
        return;
      }
      
      // Проверяем размер файла
      const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB
      if (data.file.bytesRead > maxSize) {
        reply.code(400).send({
          error: 'Bad Request',
          message: `Размер файла превышает лимит ${Math.round(maxSize / 1024 / 1024)}MB`
        });
        return;
      }
      
      // Создаем уникальное имя файла
      const fileExtension = path.extname(data.filename);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      
      // Создаем директорию для загрузок
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const uploadPath = path.join(uploadDir, year.toString(), month);
      
      await fs.mkdir(uploadPath, { recursive: true });
      
      const fullPath = path.join(uploadPath, uniqueFilename);
      
      // Сохраняем файл
      const buffer = await data.toBuffer();
      
      // Оптимизируем изображение с помощью Sharp
      const optimizedBuffer = await sharp(buffer)
        .resize(1920, 1080, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      await fs.writeFile(fullPath, optimizedBuffer);
      
      // Сохраняем информацию о файле в БД
      const fileRecord = await query(`
        INSERT INTO files (location_id, filename, original_name, mime_type, size, path, field_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        location_id,
        uniqueFilename,
        data.filename,
        data.mimetype,
        optimizedBuffer.length,
        fullPath,
        field_name
      ]);
      
      // Обновляем поле в таблице locations
      await query(
        `UPDATE locations SET ${field_name} = $1, updated_at = NOW() WHERE id = $2`,
        [`/api/files/${uniqueFilename}`, location_id]
      );
      
      fastify.log.info(`Загружен файл: ${uniqueFilename} для локации ${location_id}`);
      
      return {
        success: true,
        data: {
          id: fileRecord.rows[0].id,
          filename: uniqueFilename,
          original_name: data.filename,
          url: `/api/files/${uniqueFilename}`,
          size: optimizedBuffer.length,
          mime_type: data.mimetype
        },
        message: 'Файл успешно загружен'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка загрузки файла:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при загрузке файла'
      });
    }
  });
  
  // GET /api/files/:filename - получение файла
  fastify.get('/:filename', {
    schema: {
      params: fileSchemas.params
    }
  }, async (request, reply) => {
    try {
      const { filename } = request.params;
      
      // Получаем информацию о файле из БД
      const fileInfo = await query(
        'SELECT * FROM files WHERE filename = $1',
        [filename]
      );
      
      if (fileInfo.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Файл не найден'
        });
        return;
      }
      
      const file = fileInfo.rows[0];
      const filePath = file.path;
      
      // Проверяем, что файл существует
      try {
        await fs.access(filePath);
      } catch (error) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Файл не найден на диске'
        });
        return;
      }
      
      // Устанавливаем заголовки для кэширования
      reply.header('Cache-Control', 'public, max-age=31536000'); // 1 год
      reply.header('ETag', `"${file.id}"`);
      
      // Отправляем файл
      return reply.sendFile(filename, path.dirname(filePath));
      
    } catch (error) {
      fastify.log.error('Ошибка получения файла:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении файла'
      });
    }
  });
  
  // DELETE /api/files/:filename - удаление файла
  fastify.delete('/:filename', {
    schema: {
      params: fileSchemas.params
    },
    preHandler: [authenticate, requireRole(['admin', 'editor']), logActivity('delete', 'files')]
  }, async (request, reply) => {
    try {
      const { filename } = request.params;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      // Получаем информацию о файле
      const fileInfo = await query(`
        SELECT f.*, l.user_id as location_user_id 
        FROM files f 
        JOIN locations l ON f.location_id = l.id 
        WHERE f.filename = $1
      `, [filename]);
      
      if (fileInfo.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Файл не найден'
        });
        return;
      }
      
      const file = fileInfo.rows[0];
      
      // Проверяем права доступа
      if (userRole !== 'admin' && file.location_user_id !== userId) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Нет доступа к данному файлу'
        });
        return;
      }
      
      // Удаляем файл с диска
      try {
        await fs.unlink(file.path);
      } catch (error) {
        fastify.log.warn(`Не удалось удалить файл с диска: ${file.path}`, error);
      }
      
      // Обновляем поле в таблице locations
      await query(
        `UPDATE locations SET ${file.field_name} = NULL, updated_at = NOW() WHERE id = $1`,
        [file.location_id]
      );
      
      // Удаляем запись из БД
      await query('DELETE FROM files WHERE id = $1', [file.id]);
      
      fastify.log.info(`Удален файл: ${filename}`);
      
      return {
        success: true,
        message: 'Файл успешно удален'
      };
      
    } catch (error) {
      fastify.log.error('Ошибка удаления файла:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при удалении файла'
      });
    }
  });
  
  // GET /api/files - список файлов пользователя
  fastify.get('/', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      let queryText = `
        SELECT f.*, l.название_лк, l.название as location_name
        FROM files f
        JOIN locations l ON f.location_id = l.id
      `;
      let queryParams = [];
      
      // Админы видят все файлы, остальные - только свои
      if (userRole !== 'admin') {
        queryText += ' WHERE l.user_id = $1';
        queryParams.push(userId);
      }
      
      queryText += ' ORDER BY f.created_at DESC';
      
      const result = await query(queryText, queryParams);
      
      return {
        data: result.rows.map(file => ({
          id: file.id,
          filename: file.filename,
          original_name: file.original_name,
          url: `/api/files/${file.filename}`,
          size: file.size,
          mime_type: file.mime_type,
          field_name: file.field_name,
          location_name: file.location_name,
          location_лк: file.название_лк,
          created_at: file.created_at
        }))
      };
      
    } catch (error) {
      fastify.log.error('Ошибка получения списка файлов:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении списка файлов'
      });
    }
  });
}

module.exports = filesRoutes;
