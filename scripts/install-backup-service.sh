#!/bin/bash

# Скрипт установки службы автоматических бэкапов PlayDay CMS
# Создает systemd сервис для автоматического запуска системы бэкапов

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка прав root
if [[ $EUID -eq 0 ]]; then
   print_error "Не запускайте этот скрипт от root! Используйте sudo при необходимости."
   exit 1
fi

# Определение путей
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="playday-backup"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
USER=$(whoami)

print_info "Установка службы автоматических бэкапов PlayDay CMS"
print_info "Проект: $PROJECT_DIR"
print_info "Пользователь: $USER"

# Проверка зависимостей
print_info "Проверка зависимостей..."

# Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js не установлен!"
    exit 1
fi

# PostgreSQL клиент
if ! command -v pg_dump &> /dev/null; then
    print_error "PostgreSQL клиент (pg_dump) не установлен!"
    print_info "Установите: sudo apt install postgresql-client"
    exit 1
fi

# PM2 (опционально)
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 не установлен. Мониторинг сервиса будет ограничен."
fi

print_success "Зависимости проверены"

# Установка npm зависимостей
print_info "Установка зависимостей npm..."
cd "$PROJECT_DIR"

if [ ! -f "package.json" ]; then
    print_error "package.json не найден в $PROJECT_DIR"
    exit 1
fi

# Проверяем и устанавливаем недостающие зависимости
REQUIRED_PACKAGES="nodemailer node-cron"
for package in $REQUIRED_PACKAGES; do
    if ! npm list "$package" &> /dev/null; then
        print_info "Установка $package..."
        npm install "$package"
    fi
done

print_success "Зависимости npm установлены"

# Создание конфигурационного файла
BACKUP_ENV_FILE="$PROJECT_DIR/backup.env"
if [ ! -f "$BACKUP_ENV_FILE" ]; then
    print_info "Создание конфигурационного файла..."
    cp "$PROJECT_DIR/backup.env.example" "$BACKUP_ENV_FILE"
    print_warning "Настройте параметры в файле: $BACKUP_ENV_FILE"
    print_warning "Особенно важно настроить email уведомления!"
fi

# Создание директории для бэкапов
BACKUP_DIR="$PROJECT_DIR/backups"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    print_success "Создана директория бэкапов: $BACKUP_DIR"
fi

# Создание systemd сервиса
print_info "Создание systemd сервиса..."

sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=PlayDay CMS Backup System
Documentation=https://github.com/playday/cms
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
EnvironmentFile=$BACKUP_ENV_FILE
ExecStart=/usr/bin/node $PROJECT_DIR/scripts/backup-system.js start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=playday-backup

# Безопасность
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$PROJECT_DIR/backups $PROJECT_DIR/logs

# Ресурсы
MemoryMax=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

print_success "Systemd сервис создан: $SERVICE_FILE"

# Перезагрузка systemd
print_info "Перезагрузка systemd..."
sudo systemctl daemon-reload

# Включение автозапуска
print_info "Включение автозапуска сервиса..."
sudo systemctl enable "$SERVICE_NAME"

print_success "Сервис включен для автозапуска"

# Создание скрипта управления
CONTROL_SCRIPT="$PROJECT_DIR/backup-control.sh"
cat > "$CONTROL_SCRIPT" << 'EOF'
#!/bin/bash

# Скрипт управления службой бэкапов PlayDay CMS

SERVICE_NAME="playday-backup"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$1" in
    start)
        echo "🚀 Запуск службы бэкапов..."
        sudo systemctl start $SERVICE_NAME
        ;;
    stop)
        echo "⏹️  Остановка службы бэкапов..."
        sudo systemctl stop $SERVICE_NAME
        ;;
    restart)
        echo "🔄 Перезапуск службы бэкапов..."
        sudo systemctl restart $SERVICE_NAME
        ;;
    status)
        echo "📊 Статус службы бэкапов:"
        sudo systemctl status $SERVICE_NAME
        ;;
    logs)
        echo "📋 Логи службы бэкапов:"
        sudo journalctl -u $SERVICE_NAME -f
        ;;
    backup-now)
        echo "💾 Создание бэкапа вручную..."
        cd "$PROJECT_DIR"
        node scripts/backup-system.js backup
        ;;
    list-backups)
        echo "📋 Список бэкапов:"
        cd "$PROJECT_DIR"
        node scripts/backup-system.js list
        ;;
    monitor)
        echo "🔍 Проверка системы:"
        cd "$PROJECT_DIR"
        node scripts/backup-system.js monitor
        ;;
    test-email)
        echo "📧 Тест email уведомлений:"
        cd "$PROJECT_DIR"
        node scripts/backup-system.js test-email
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs|backup-now|list-backups|monitor|test-email}"
        echo ""
        echo "Команды:"
        echo "  start         - Запустить службу"
        echo "  stop          - Остановить службу"
        echo "  restart       - Перезапустить службу"
        echo "  status        - Показать статус службы"
        echo "  logs          - Показать логи службы"
        echo "  backup-now    - Создать бэкап вручную"
        echo "  list-backups  - Показать список бэкапов"
        echo "  monitor       - Проверить состояние системы"
        echo "  test-email    - Отправить тестовое email"
        exit 1
        ;;
esac
EOF

chmod +x "$CONTROL_SCRIPT"
print_success "Создан скрипт управления: $CONTROL_SCRIPT"

# Создание cron задачи для дополнительной надежности
print_info "Настройка дополнительной cron задачи..."
CRON_JOB="0 3 * * * cd $PROJECT_DIR && /usr/bin/node scripts/backup-system.js backup >> logs/backup-cron.log 2>&1"

# Проверяем, есть ли уже такая задача
if ! crontab -l 2>/dev/null | grep -q "backup-system.js"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    print_success "Добавлена резервная cron задача"
else
    print_info "Cron задача уже существует"
fi

# Создание логротейт конфигурации
print_info "Настройка ротации логов..."
sudo tee "/etc/logrotate.d/playday-backup" > /dev/null << EOF
$PROJECT_DIR/logs/backup*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $USER $USER
    postrotate
        systemctl reload-or-restart playday-backup
    endscript
}
EOF

print_success "Настроена ротация логов"

# Финальные инструкции
print_success "🎉 Установка завершена успешно!"
echo ""
print_info "Что дальше:"
echo "1. Настройте параметры в файле: $BACKUP_ENV_FILE"
echo "2. Особенно важно настроить email уведомления"
echo "3. Запустите службу: ./backup-control.sh start"
echo "4. Проверьте статус: ./backup-control.sh status"
echo "5. Протестируйте email: ./backup-control.sh test-email"
echo "6. Создайте тестовый бэкап: ./backup-control.sh backup-now"
echo ""
print_info "Управление службой:"
echo "  ./backup-control.sh start     - Запуск"
echo "  ./backup-control.sh status    - Статус"
echo "  ./backup-control.sh logs      - Логи"
echo "  ./backup-control.sh backup-now - Ручной бэкап"
echo ""
print_warning "Не забудьте настроить email уведомления в backup.env!"
print_warning "Проверьте, что PostgreSQL доступен и учетные данные корректны"

# Показать следующие шаги
echo ""
print_info "Рекомендуемые следующие шаги:"
echo "1. nano $BACKUP_ENV_FILE"
echo "2. ./backup-control.sh test-email"
echo "3. ./backup-control.sh backup-now"
echo "4. ./backup-control.sh start"