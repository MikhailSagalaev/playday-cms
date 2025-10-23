# 🚀 Настройка Git репозитория

## 1. Создайте репозиторий на GitHub

1. Перейдите на https://github.com
2. Нажмите "New repository"
3. Название: `playday-cms`
4. Описание: `PlayDay CMS - система управления контентом для развлекательных центров`
5. Выберите "Public" или "Private"
6. НЕ добавляйте README, .gitignore или лицензию (у нас уже есть)
7. Нажмите "Create repository"

## 2. Получите URL репозитория

После создания репозитория скопируйте URL (будет что-то вроде):
```
https://github.com/YOUR_USERNAME/playday-cms.git
```

## 3. Обновите remote URL

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/playday-cms.git
git push -u origin main
```

## 4. Команды для сервера

После успешного пуша в GitHub, выполните на сервере:

```bash
# Клонируем репозиторий
cd /var/www
git clone https://github.com/YOUR_USERNAME/playday-cms.git
cd playday-cms

# Делаем скрипты исполняемыми
chmod +x scripts/*.sh

# Запускаем полное развертывание
sudo bash scripts/full-deploy.sh api.your-domain.com admin@your-domain.com
```

Замените `YOUR_USERNAME` на ваш GitHub username и `your-domain.com` на ваш домен.
