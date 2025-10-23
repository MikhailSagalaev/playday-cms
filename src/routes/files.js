const { query } = require('../config/database');
const { fileSchemas } = require('../schemas/file');
const { authenticate } = require('../middleware/auth');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

async function filesRoutes(fastify, options) {
  
  // POST /api/files/upload - загрузка файла
  fastify.post('/upload', {
    schema: fileSchemas.upload,
    preHandler: [authenticate]
  }, async (request, reply) => {
    try {
      const { location_id, field_name } = request.body;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      // Проверяем права доступа к локации
      if (userRole !== 'admin' && userRole !== 'manager') {
        const locationCheck = await query(
          'SELECT user_id FROM locations WHERE id = $1',
          [location_id]
        );
        
        if (locationCheck.rows.length === 0) {
          reply.code(404).send({
            error: 'Not Found',
            message: 'Локация не найдена'
          });
          return;
        }
        
        if (locationCheck.rows[0].user_id !== userId) {
          reply.code(403).send({
            error: 'Forbidden',
            message: 'Нет доступа к данной локации'
          });
          return;
        }
      }
      
      // Получаем файл из multipart
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
      const relativePath = path.join(year.toString(), month, uniqueFilename);
      const fileUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/uploads/${relativePath}`;
      
      const result = await query(`
        INSERT INTO files (user_id, location_id, field_name, original_name, filename, file_path, file_url, file_size, mime_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        userId,
        location_id,
        field_name,
        data.filename,
        uniqueFilename,
        relativePath,
        fileUrl,
        optimizedBuffer.length,
        data.mimetype
      ]);
      
      // Обновляем поле в локации
      await query(`
        UPDATE locations 
        SET ${field_name} = $1, updated_at = NOW()
        WHERE id = $2
      `, [fileUrl, location_id]);
      
      fastify.log.info(`Загружен файл: ${uniqueFilename} для локации ${location_id}`);
      
      reply.code(201).send({
        success: true,
        data: {
          id: result.rows[0].id,
          filename: uniqueFilename,
          file_url: fileUrl,
          file_size: optimizedBuffer.length,
          mime_type: data.mimetype
        },
        message: 'Файл успешно загружен'
      });
      
    } catch (error) {
      fastify.log.error('Ошибка загрузки файла:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при загрузке файла'
      });
    }
  });

  // GET /api/files/:id - получение информации о файле
  fastify.get('/:id', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      let fileQuery;
      let queryParams = [id];
      
      if (userRole === 'admin' || userRole === 'manager') {
        fileQuery = 'SELECT * FROM files WHERE id = $1';
      } else {
        fileQuery = 'SELECT * FROM files WHERE id = $1 AND user_id = $2';
        queryParams.push(userId);
      }
      
      const result = await query(fileQuery, queryParams);
      
      if (result.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Файл не найден'
        });
        return;
      }
      
      reply.send({
        success: true,
        data: result.rows[0]
      });
      
    } catch (error) {
      fastify.log.error('Ошибка получения файла:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при получении файла'
      });
    }
  });

  // DELETE /api/files/:id - удаление файла
  fastify.delete('/:id', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.userId;
      const userRole = request.user.role;
      
      // Получаем информацию о файле
      let fileQuery;
      let queryParams = [id];
      
      if (userRole === 'admin' || userRole === 'manager') {
        fileQuery = 'SELECT * FROM files WHERE id = $1';
      } else {
        fileQuery = 'SELECT * FROM files WHERE id = $1 AND user_id = $2';
        queryParams.push(userId);
      }
      
      const fileResult = await query(fileQuery, queryParams);
      
      if (fileResult.rows.length === 0) {
        reply.code(404).send({
          error: 'Not Found',
          message: 'Файл не найден'
        });
        return;
      }
      
      const file = fileResult.rows[0];
      
      // Удаляем физический файл
      try {
        const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', file.file_path);
        await fs.unlink(fullPath);
      } catch (unlinkError) {
        fastify.log.warn(`Не удалось удалить физический файл: ${file.file_path}`, unlinkError);
      }
      
      // Удаляем запись из БД
      await query('DELETE FROM files WHERE id = $1', [id]);
      
      // Очищаем поле в локации
      if (file.location_id && file.field_name) {
        await query(`
          UPDATE locations 
          SET ${file.field_name} = NULL, updated_at = NOW()
          WHERE id = $1
        `, [file.location_id]);
      }
      
      fastify.log.info(`Удален файл: ${file.filename} пользователем ${userId}`);
      
      reply.send({
        success: true,
        message: 'Файл успешно удален'
      });
      
    } catch (error) {
      fastify.log.error('Ошибка удаления файла:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Ошибка при удалении файла'
      });
    }
  });
}

module.exports = filesRoutes;
