#!/bin/bash
# Устанавливает на сервер последний сохранённый коммит. Настройки .env, база и фото на сервере не меняются.
# Ничего не отправляет на GitHub. Запуск: bash deploy.sh
set -euo pipefail

SERVER="root@201.24.121.150"
KEY="$HOME/.ssh/sadovodps_server"
DIR="/opt/sadovodps"

if [ -n "$(git status --porcelain)" ]; then
  echo "Есть несохранённые изменения. Сначала сделайте коммит: на сервер уходит только сохранённая версия."
  exit 1
fi

COMMIT=$(git rev-parse --short HEAD)
echo "Загружаю версию $COMMIT..."
git -c core.autocrlf=false -c core.eol=lf archive --format=tar.gz HEAD | ssh -i "$KEY" "$SERVER" "tar xz -C $DIR && echo $COMMIT > $DIR/DEPLOYED_COMMIT"

echo "Пересобираю и перезапускаю сайт..."
ssh -i "$KEY" "$SERVER" "cd $DIR && docker compose up -d --build && docker compose ps --format '{{.Name}}: {{.Status}}'"

echo "Готово: на сервере версия $COMMIT."
