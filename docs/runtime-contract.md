# Контракт поставки

| Параметр | Значение |
| --- | --- |
| Локальный образ | `akim-city:local` |
| Runtime | Node.js 22, Next.js standalone, `node server.js` |
| Сеть | `HOSTNAME=0.0.0.0`, `PORT=3000` |
| Health | `GET /api/health`, HTTP 200, `{"status":"ok"}`, `Cache-Control: no-store` |
| Пользователь | UID/GID 1000, без дополнительных capabilities |
| Запись | Kubernetes root filesystem read-only; временные volumes `/tmp` и `/app/.next/cache` |
| AI | `AI_PROVIDER=nvidia` или `openai`; ключ выбранного провайдера опционален для расчётов |
| Kubernetes | Namespace `akim`, Deployment `akim`, Service `akim:80` → container `3000` |
| Secret | Существующий `akim-ai` в namespace `akim`: `NVIDIA_API_KEY` или `OPENAI_API_KEY`, `CASE_SIGNING_SECRET` |

Health проверяет способность процесса обслуживать HTTP. Он не обращается к провайдеру AI: отсутствие ключа и отказ провайдера не блокируют детерминированную симуляцию. Secret отсутствует в репозитории, его ссылка опциональна. При изменении ConfigMap/Secret нужен `kubectl -n akim rollout restart deployment/akim`, поскольку переменные читаются из окружения процесса.

В production AI-генерация требует `CASE_SIGNING_SECRET` длиной минимум 32 символа. Используйте постоянное случайное значение на всех репликах: смена секрета делает ранее созданные AI-кейсы непригодными для повторного расчёта. Токен кейса действует семь дней. В development без настройки используется временный секрет до перезапуска процесса.

## Docker

```sh
docker build -t akim-city:local .
docker run -d --name akim -p 3000:3000 --read-only --tmpfs /tmp --tmpfs /app/.next/cache:uid=1000,gid=1000 --cap-drop ALL --security-opt no-new-privileges akim-city:local
pnpm smoke:deploy
docker logs akim
docker stop akim
docker rm akim
```

AI включается добавлением `--env-file .env.local` перед именем образа. Создайте этот локальный файл из `.env.example` и заполните ключ; `.dockerignore` исключает env-файлы из сборочного контекста. Ключ не нужен при `docker build`.

`pnpm smoke:deploy http://127.0.0.1:3001` проверяет другой адрес. Проверка выполняет синтетические расчёты `/api/challenge` и четырёх `/api/cases`, не тратит AI-токены и не изменяет сохранённые данные.

## Kubernetes

Перед применением проверьте текущий контекст: `kubectl config current-context`. В Docker Desktop локальный образ может быть доступен кластеру напрямую; для kind загрузите его командой `kind load docker-image akim-city:local`, для minikube — `minikube image load akim-city:local`.

```sh
pnpm check:k8s
kubectl apply -k deploy/k8s
kubectl -n akim rollout status deployment/akim --timeout=180s
kubectl -n akim get pods
kubectl -n akim port-forward service/akim 3000:80
```

В другом терминале выполните `pnpm smoke:deploy`. Остановка port-forward: Ctrl+C. Удаление только ресурсов приложения: `kubectl -n akim delete deployment/akim service/akim configmap/akim-config`. Namespace и внешний Secret эта команда сохраняет.

Создайте в namespace `akim` Secret `akim-ai` с ключом выбранного провайдера и `CASE_SIGNING_SECRET` через свой менеджер секретов. Для OpenAI измените `AI_PROVIDER` в ConfigMap на `openai`; модели задаются там же. Не добавляйте реальный Secret YAML в Git. После создания перезапустите Deployment. При обновлении с предыдущей версии перенесите `NVIDIA_API_KEY` из старого `akim-nvidia` в `akim-ai`.

Удалённый кластер должен иметь доступ к опубликованному образу. Пример с registry и тегом, которые нужно заменить на свои:

```sh
docker buildx build --platform linux/amd64 -t registry.example.com/team/akim-city:v1 --push .
```

В `deploy/k8s/kustomization.yaml` добавьте:

```yaml
images:
  - name: akim-city
    newName: registry.example.com/team/akim-city
    newTag: v1
```

Затем повторите проверку и `kubectl apply -k deploy/k8s`. Для ARM-кластера выберите `linux/arm64`, для смешанного — оба значения через запятую. Приватный registry требует настроенного `imagePullSecrets`. Для воспроизводимого релиза используйте неизменяемый тег или digest. Service имеет тип ClusterIP; внешний HTTPS и Ingress зависят от инфраструктуры и в этот комплект не входят.

## Проверки

`pnpm check:k8s` собирает Kustomize-манифест и проверяет четыре ресурса через kubeconform 0.7.0 в строгом режиме по схемам Kubernetes 1.32.0. Нужны `kubectl`, Go 1.24+ и доступ к сети. Эта проверка не подтверждает доступность образа или успешный rollout; после неё выполняются rollout и HTTP smoke в целевом кластере.

CI собирает Docker-образ и запускает его с read-only root filesystem, без capabilities и без AI-ключа. Smoke проверяет health, HTML, статический asset, контрольные значения события `50.896 → 50.176 → 50.784`, расходы `100 → 85`, четыре новых кейса, точный Score astana 52.55768→56.54307 и отклонение неполного плана.

## Эксплуатационные границы

Поставляется один stateless Pod. Сохранённые планы находятся в localStorage браузера, серверной общей таблицы команд нет. Подписанный AI-кейс можно повторно рассчитать до истечения токена; сохранённый отчёт остаётся доступен после истечения. Ключ AI и подписывающий секрет не входят в образ. Генерация и AI-разбор имеют process-local лимиты; при масштабировании нужны общая квота и доступ через аутентифицированный шлюз, чтобы контролировать расходы провайдера. TLS/Ingress, резервное копирование серверного хранилища и управление пользователями не заявлены как реализованные функции.

Основа реализации: локальная документация Next.js `output: standalone` и Route Handlers, [security context Kubernetes](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/), [kubeconform](https://github.com/yannh/kubeconform).

Проверено 23 сентября 2026: 99 тестов, 8 Chromium E2E, lint, TypeScript, production build; kubeconform — 4 валидных ресурса; Docker 29.4.2 — сборка и healthy-контейнер с read-only root; локальный Kubernetes — rollout, Pod 1/1 Running, 0 рестартов. HTTP smoke прошёл в Docker и через Kubernetes Service. OpenAI отдельно проверен живыми запросами через браузер; NVIDIA — mock-тестами. Полный [протокол релиза](release-verification.md).
