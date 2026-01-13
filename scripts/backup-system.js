#!/usr/bin/env node

/**
 * Система автоматических бэкапов PostgreSQL и email уведомлений
 * PlayDay CMS - Backup & Monitoring System
 * 
 * Функции:
 * 1. Автоматические бэкапы PostgreSQL
 * 2. Ротация старых бэкапов
 * 3. Email уведомления об ошибках
 * 4. Мониторинг состояния сервера
 * 5. Проверка свободного места на диске
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const execAsync = promisify(exec);

// Конфигурация
const CONFIG = {
    // База данных
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'playday_cms',
        user: process.env.DB_USER || 'playday',
        password: process.env.DB_PASSWORD
    },
    
    // Бэкапы
    backup: {
        directory: process.env.BACKUP_DIR || './backups',
        retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7, // Хранить 7 дней
        compression: true,
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *' // Каждый день в 2:00
    },
    
    // Email уведомления
    email: {
        enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
        smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        },
        from: process.env.EMAIL_FROM || 'noreply@play-day.ru',
        to: process.env.EMAIL_TO || 'admin@play-day.ru',
        subject: {
            success: '[PlayDay CMS] ✅ Бэкап выполнен успешно',
            error: '[PlayDay CMS] ❌ Ошибка бэкапа',
            warning: '[PlayDay CMS] ⚠️ Предупреждение системы'
        }
    },
    
    // Мониторинг
    monitoring: {
        diskSpaceThreshold: 85, // Предупреждение при заполнении диска на 85%
        memoryThreshold: 90,    // Предупреждение при использовании памяти на 90%
        schedule: '*/15 * * * *' // Проверка каждые 15 минут
    }
};

class BackupSystem {
    constructor() {
        this.transporter = null;
        this.initEmailTransporter();
    }

    // Инициализация email транспорта
    async initEmailTransporter() {
        if (!CONFIG.email.enabled) {
            console.log('📧 Email уведомления отключены');
            return;
        }

        try {
            this.transporter = nodemailer.createTransporter(CONFIG.email.smtp);
            await this.transporter.verify();
            console.log('📧 Email транспорт инициализирован успешно');
        } catch (error) {
            console.error('❌ Ошибка инициализации email:', error.message);
            this.transporter = null;
        }
    }

    // Отправка email уведомления
    async sendEmail(subject, text, html = null) {
        if (!this.transporter) {
            console.log('📧 Email не отправлен (транспорт не настроен)');
            return false;
        }

        try {
            const mailOptions = {
                from: CONFIG.email.from,
                to: CONFIG.email.to,
                subject,
                text,
                html: html || text.replace(/\n/g, '<br>')
            };

            await this.transporter.sendMail(mailOptions);
            console.log('📧 Email отправлен успешно');
            return true;
        } catch (error) {
            console.error('❌ Ошибка отправки email:', error.message);
            return false;
        }
    }

    // Создание директории для бэкапов
    async ensureBackupDirectory() {
        try {
            await fs.access(CONFIG.backup.directory);
        } catch {
            await fs.mkdir(CONFIG.backup.directory, { recursive: true });
            console.log(`📁 Создана директория бэкапов: ${CONFIG.backup.directory}`);
        }
    }

    // Создание бэкапа базы данных
    async createDatabaseBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `playday_cms_backup_${timestamp}.sql`;
        const filepath = path.join(CONFIG.backup.directory, filename);
        
        console.log(`🔄 Создание бэкапа: ${filename}`);

        try {
            // Создаем бэкап с помощью pg_dump
            const pgDumpCommand = [
                'pg_dump',
                `-h ${CONFIG.database.host}`,
                `-p ${CONFIG.database.port}`,
                `-U ${CONFIG.database.user}`,
                `-d ${CONFIG.database.name}`,
                '--no-password',
                '--verbose',
                '--clean',
                '--if-exists',
                `--file="${filepath}"`
            ].join(' ');

            // Устанавливаем переменную окружения для пароля
            const env = { 
                ...process.env, 
                PGPASSWORD: CONFIG.database.password 
            };

            const { stdout, stderr } = await execAsync(pgDumpCommand, { env });
            
            // Проверяем, что файл создан
            const stats = await fs.stat(filepath);
            const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
            
            console.log(`✅ Бэкап создан успешно: ${filename} (${sizeInMB} MB)`);

            // Сжимаем бэкап если включено
            if (CONFIG.backup.compression) {
                await this.compressBackup(filepath);
            }

            return {
                success: true,
                filename,
                filepath,
                size: stats.size,
                sizeInMB
            };

        } catch (error) {
            console.error('❌ Ошибка создания бэкапа:', error.message);
            
            // Удаляем частично созданный файл
            try {
                await fs.unlink(filepath);
            } catch {}

            throw error;
        }
    }

    // Сжатие бэкапа
    async compressBackup(filepath) {
        const gzipPath = `${filepath}.gz`;
        
        try {
            await execAsync(`gzip "${filepath}"`);
            console.log(`🗜️ Бэкап сжат: ${path.basename(gzipPath)}`);
            return gzipPath;
        } catch (error) {
            console.error('⚠️ Ошибка сжатия бэкапа:', error.message);
            return filepath; // Возвращаем оригинальный файл
        }
    }

    // Очистка старых бэкапов
    async cleanOldBackups() {
        try {
            const files = await fs.readdir(CONFIG.backup.directory);
            const backupFiles = files.filter(file => 
                file.startsWith('playday_cms_backup_') && 
                (file.endsWith('.sql') || file.endsWith('.sql.gz'))
            );

            const now = new Date();
            const retentionMs = CONFIG.backup.retention * 24 * 60 * 60 * 1000;
            let deletedCount = 0;

            for (const file of backupFiles) {
                const filepath = path.join(CONFIG.backup.directory, file);
                const stats = await fs.stat(filepath);
                const age = now - stats.mtime;

                if (age > retentionMs) {
                    await fs.unlink(filepath);
                    console.log(`🗑️ Удален старый бэкап: ${file}`);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`🧹 Очищено ${deletedCount} старых бэкапов`);
            }

        } catch (error) {
            console.error('⚠️ Ошибка очистки старых бэкапов:', error.message);
        }
    }

    // Проверка свободного места на диске
    async checkDiskSpace() {
        try {
            const { stdout } = await execAsync('df -h .');
            const lines = stdout.trim().split('\n');
            const diskInfo = lines[1].split(/\s+/);
            const usedPercent = parseInt(diskInfo[4]);

            if (usedPercent >= CONFIG.monitoring.diskSpaceThreshold) {
                const message = `⚠️ Предупреждение: Диск заполнен на ${usedPercent}%\n\n` +
                              `Использовано: ${diskInfo[2]}\n` +
                              `Доступно: ${diskInfo[3]}\n` +
                              `Точка монтирования: ${diskInfo[5]}`;

                console.log(message);
                await this.sendEmail(CONFIG.email.subject.warning, message);
            }

            return { used: usedPercent, available: diskInfo[3] };
        } catch (error) {
            console.error('❌ Ошибка проверки диска:', error.message);
            return null;
        }
    }

    // Проверка использования памяти
    async checkMemoryUsage() {
        try {
            const { stdout } = await execAsync('free -m');
            const lines = stdout.trim().split('\n');
            const memInfo = lines[1].split(/\s+/);
            const total = parseInt(memInfo[1]);
            const used = parseInt(memInfo[2]);
            const usedPercent = Math.round((used / total) * 100);

            if (usedPercent >= CONFIG.monitoring.memoryThreshold) {
                const message = `⚠️ Предупреждение: Память используется на ${usedPercent}%\n\n` +
                              `Всего: ${total} MB\n` +
                              `Используется: ${used} MB\n` +
                              `Доступно: ${total - used} MB`;

                console.log(message);
                await this.sendEmail(CONFIG.email.subject.warning, message);
            }

            return { total, used, usedPercent };
        } catch (error) {
            console.error('❌ Ошибка проверки памяти:', error.message);
            return null;
        }
    }

    // Проверка состояния сервиса PlayDay CMS
    async checkServiceHealth() {
        try {
            // Проверяем, что процесс запущен
            const { stdout } = await execAsync('pm2 jlist');
            const processes = JSON.parse(stdout);
            const playdayProcess = processes.find(p => p.name === 'playday-cms');

            if (!playdayProcess) {
                const message = '❌ Критическая ошибка: Процесс PlayDay CMS не найден!';
                console.log(message);
                await this.sendEmail(CONFIG.email.subject.error, message);
                return false;
            }

            if (playdayProcess.pm2_env.status !== 'online') {
                const message = `❌ Критическая ошибка: PlayDay CMS не запущен (статус: ${playdayProcess.pm2_env.status})`;
                console.log(message);
                await this.sendEmail(CONFIG.email.subject.error, message);
                return false;
            }

            // Проверяем доступность API
            const response = await fetch('http://localhost:3000/health');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            const message = `❌ Ошибка проверки сервиса: ${error.message}`;
            console.log(message);
            await this.sendEmail(CONFIG.email.subject.error, message);
            return false;
        }
    }

    // Выполнение полного бэкапа
    async performBackup() {
        console.log('🚀 Запуск процедуры бэкапа...');
        
        try {
            // Создаем директорию
            await this.ensureBackupDirectory();

            // Проверяем состояние системы
            const diskSpace = await this.checkDiskSpace();
            const memory = await this.checkMemoryUsage();
            const serviceHealth = await this.checkServiceHealth();

            // Создаем бэкап
            const backupResult = await this.createDatabaseBackup();

            // Очищаем старые бэкапы
            await this.cleanOldBackups();

            // Отправляем уведомление об успехе
            const successMessage = `✅ Бэкап выполнен успешно!\n\n` +
                                 `Файл: ${backupResult.filename}\n` +
                                 `Размер: ${backupResult.sizeInMB} MB\n` +
                                 `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                                 `Состояние системы:\n` +
                                 `- Диск: ${diskSpace ? diskSpace.used + '% используется' : 'Не проверен'}\n` +
                                 `- Память: ${memory ? memory.usedPercent + '% используется' : 'Не проверена'}\n` +
                                 `- Сервис: ${serviceHealth ? 'Работает' : 'Проблемы'}`;

            console.log(successMessage);
            await this.sendEmail(CONFIG.email.subject.success, successMessage);

            return backupResult;

        } catch (error) {
            const errorMessage = `❌ Ошибка выполнения бэкапа!\n\n` +
                               `Ошибка: ${error.message}\n` +
                               `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                               `Требуется немедленное вмешательство администратора!`;

            console.error(errorMessage);
            await this.sendEmail(CONFIG.email.subject.error, errorMessage);
            
            throw error;
        }
    }

    // Мониторинг системы
    async performMonitoring() {
        console.log('🔍 Проверка состояния системы...');
        
        try {
            await this.checkDiskSpace();
            await this.checkMemoryUsage();
            await this.checkServiceHealth();
        } catch (error) {
            console.error('❌ Ошибка мониторинга:', error.message);
        }
    }

    // Запуск планировщика
    startScheduler() {
        console.log('⏰ Запуск планировщика задач...');

        // Бэкапы
        cron.schedule(CONFIG.backup.schedule, async () => {
            console.log('⏰ Запланированный бэкап...');
            try {
                await this.performBackup();
            } catch (error) {
                console.error('❌ Ошибка планового бэкапа:', error.message);
            }
        }, {
            timezone: "Europe/Moscow"
        });

        // Мониторинг
        cron.schedule(CONFIG.monitoring.schedule, async () => {
            try {
                await this.performMonitoring();
            } catch (error) {
                console.error('❌ Ошибка планового мониторинга:', error.message);
            }
        }, {
            timezone: "Europe/Moscow"
        });

        console.log(`📅 Бэкапы запланированы: ${CONFIG.backup.schedule}`);
        console.log(`📊 Мониторинг запланирован: ${CONFIG.monitoring.schedule}`);
    }

    // Восстановление из бэкапа
    async restoreFromBackup(backupFile) {
        console.log(`🔄 Восстановление из бэкапа: ${backupFile}`);
        
        try {
            const filepath = path.join(CONFIG.backup.directory, backupFile);
            
            // Проверяем существование файла
            await fs.access(filepath);

            // Если файл сжат, распаковываем
            let sqlFile = filepath;
            if (filepath.endsWith('.gz')) {
                sqlFile = filepath.replace('.gz', '');
                await execAsync(`gunzip -c "${filepath}" > "${sqlFile}"`);
            }

            // Восстанавливаем базу данных
            const psqlCommand = [
                'psql',
                `-h ${CONFIG.database.host}`,
                `-p ${CONFIG.database.port}`,
                `-U ${CONFIG.database.user}`,
                `-d ${CONFIG.database.name}`,
                `--file="${sqlFile}"`
            ].join(' ');

            const env = { 
                ...process.env, 
                PGPASSWORD: CONFIG.database.password 
            };

            await execAsync(psqlCommand, { env });

            // Удаляем временный файл если он был создан
            if (filepath.endsWith('.gz')) {
                await fs.unlink(sqlFile);
            }

            console.log('✅ Восстановление завершено успешно');
            
            const message = `✅ База данных восстановлена из бэкапа\n\n` +
                          `Файл: ${backupFile}\n` +
                          `Время: ${new Date().toLocaleString('ru-RU')}`;
            
            await this.sendEmail('[PlayDay CMS] ✅ Восстановление выполнено', message);

        } catch (error) {
            console.error('❌ Ошибка восстановления:', error.message);
            
            const message = `❌ Ошибка восстановления из бэкапа!\n\n` +
                          `Файл: ${backupFile}\n` +
                          `Ошибка: ${error.message}\n` +
                          `Время: ${new Date().toLocaleString('ru-RU')}`;
            
            await this.sendEmail('[PlayDay CMS] ❌ Ошибка восстановления', message);
            throw error;
        }
    }

    // Список доступных бэкапов
    async listBackups() {
        try {
            const files = await fs.readdir(CONFIG.backup.directory);
            const backupFiles = files
                .filter(file => 
                    file.startsWith('playday_cms_backup_') && 
                    (file.endsWith('.sql') || file.endsWith('.sql.gz'))
                )
                .sort()
                .reverse(); // Новые сначала

            const backups = [];
            for (const file of backupFiles) {
                const filepath = path.join(CONFIG.backup.directory, file);
                const stats = await fs.stat(filepath);
                backups.push({
                    filename: file,
                    size: stats.size,
                    sizeInMB: (stats.size / 1024 / 1024).toFixed(2),
                    created: stats.mtime,
                    age: Math.floor((Date.now() - stats.mtime) / (1000 * 60 * 60 * 24)) // дни
                });
            }

            return backups;
        } catch (error) {
            console.error('❌ Ошибка получения списка бэкапов:', error.message);
            return [];
        }
    }
}

// CLI интерфейс
async function main() {
    const backupSystem = new BackupSystem();
    const command = process.argv[2];

    switch (command) {
        case 'backup':
            await backupSystem.performBackup();
            break;

        case 'monitor':
            await backupSystem.performMonitoring();
            break;

        case 'start':
            backupSystem.startScheduler();
            console.log('🚀 Система бэкапов запущена. Нажмите Ctrl+C для остановки.');
            // Держим процесс активным
            process.on('SIGINT', () => {
                console.log('\n👋 Система бэкапов остановлена');
                process.exit(0);
            });
            break;

        case 'restore':
            const backupFile = process.argv[3];
            if (!backupFile) {
                console.error('❌ Укажите файл бэкапа: node backup-system.js restore filename.sql.gz');
                process.exit(1);
            }
            await backupSystem.restoreFromBackup(backupFile);
            break;

        case 'list':
            const backups = await backupSystem.listBackups();
            console.log('\n📋 Доступные бэкапы:');
            if (backups.length === 0) {
                console.log('Бэкапы не найдены');
            } else {
                backups.forEach(backup => {
                    console.log(`  ${backup.filename} (${backup.sizeInMB} MB, ${backup.age} дней назад)`);
                });
            }
            break;

        case 'test-email':
            await backupSystem.sendEmail(
                '[PlayDay CMS] 📧 Тест email уведомлений',
                'Это тестовое сообщение для проверки работы email уведомлений.\n\nВремя: ' + new Date().toLocaleString('ru-RU')
            );
            break;

        default:
            console.log(`
🔧 PlayDay CMS - Система бэкапов и мониторинга

Использование:
  node backup-system.js <команда>

Команды:
  backup      - Создать бэкап базы данных
  monitor     - Проверить состояние системы
  start       - Запустить планировщик (daemon режим)
  restore     - Восстановить из бэкапа
  list        - Показать список бэкапов
  test-email  - Отправить тестовое email

Примеры:
  node backup-system.js backup
  node backup-system.js restore playday_cms_backup_2024-01-13T10-00-00-000Z.sql.gz
  node backup-system.js start

Конфигурация через переменные окружения:
  BACKUP_DIR=/path/to/backups
  BACKUP_RETENTION_DAYS=7
  EMAIL_NOTIFICATIONS=true
  SMTP_HOST=smtp.gmail.com
  SMTP_USER=your-email@gmail.com
  SMTP_PASSWORD=your-app-password
  EMAIL_TO=admin@play-day.ru
            `);
            break;
    }
}

// Запуск только если файл вызван напрямую
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Критическая ошибка:', error.message);
        process.exit(1);
    });
}

module.exports = BackupSystem;