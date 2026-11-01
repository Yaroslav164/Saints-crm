# AFF SAINTS CRM

Внутренняя CRM для команды affiliate-маркетинга: учёт связок (оффер + подход + креатив + ГЕО + байер),
бюджетов, результатов (CR / ROI / ROAS / profit), истории решений и комментариев команды.

Стек: **Next.js 16.4.3** (App Router, Cache Components) · **React 19.3.0** · **TypeScript (strict)** ·
**PostgreSQL** · **Prisma 7.10.1** + `@prisma/adapter-pg` · **shadcn/ui (radix)** + Tailwind CSS v4 ·
**NextAuth v5** (credentials, JWT-сессии) · **Zod 4** + React Hook Form · **TanStack Table** ·
**React Query** · **Recharts** · **react-hot-toast**.

Prisma закреплена минором `7.10.1`, а не `latest`: `npm i prisma` отдаёт CLI `8.0.0-rc.29` при клиенте 7.x —
рассинхрон мажоров ломает генерацию клиента.

## Требования

- Node.js 20+ (проверено на 24)
- PostgreSQL 15+ (проверено на 18)

## Установка

```bash
npm install
copy .env.example .env       # Linux/macOS: cp .env.example .env
npm run db:migrate           # создаёт БД (если её нет), применяет миграции, генерит клиент
npm run db:seed              # тестовые данные
npm run dev                  # http://localhost:3000
```

После `git clone` каталог `lib/generated/prisma` (в `.gitignore`) отсутствует — обязателен
`npm run db:generate`, иначе импорт `@/lib/generated/prisma/client` не соберётся.

В `.env` нужны два значения:

| Переменная     | Назначение                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | строка подключения PostgreSQL; по умолчанию база `saints_crm`                                                     |
| `AUTH_SECRET`  | подпись JWT-сессии. Сгенерировать: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

### Демо-данные

Сидирует `prisma/seed.ts` (детерминированный PRNG — данные повторяются при пересиде):
4 пользователя, 5 офферов, 8 ГЕО, 5 тегов, 20 связок со статусами
(3 💡 IDEA / 8 🧪 TESTING / 5 ✅ PROFIT / 2 ⚠️ LOSS / 1 🗑 DRAINED / 1 🚀 SCALE),
история изменений, комментарии, дневные метрики за последние 30 дней и алерты по ROI.

Пароль для всех аккаунтов: **`saints2026`**

| Email                | Роль  |
| -------------------- | ----- |
| `admin@saints.com`   | ADMIN |
| `ivanov@saints.com`  | USER  |
| `petrov@saints.com`  | USER  |
| `sidorov@saints.com` | USER  |

## Скрипты

| Команда               | Что делает                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `npm run dev`         | дев-сервер (Turbopack)                                              |
| `npm run build`       | прод-сборка                                                         |
| `npm run start`       | запуск собранного приложения (`npx next start -p 3111` для смока)   |
| `npm run lint`        | ESLint                                                              |
| `npm run typecheck`   | `tsc --noEmit`                                                      |
| `npm run smoke`       | end-to-end смоук авторизации (см. «Проверка»)                       |
| `npm run db:generate` | перегенерация клиента Prisma (обязательна после `git clone`)         |
| `npm run db:migrate`  | `prisma migrate dev`                                                |
| `npm run db:deploy`   | применение миграций в прод                                           |
| `npm run db:seed`     | перезапись тестовых данных                                           |
| `npm run db:reset`    | полный сброс БД + сид                                               |
| `npm run db:studio`   | Prisma Studio                                                       |

## Проверка

```bash
npm run build
npx next start -p 3111
npm run smoke
```

50 проверок: редирект анонима (307) и редирект с исходным путём (`?from=%2Fbundles`), отсутствие
утечки данных при фальшивой cookie и при этом честный редирект в потоке, маппинг
`/login → /auth/login`, страницы входа и регистрации, создание/дубликат/валидация аккаунта,
CSRF, credentials-логин, роль и id в сессии, доступность формы входа при наличии cookie,
неверный пароль, публичная регистрация; разметка дашборда (оболочка, четыре виджета, оба
графика, сериализованный дневной ряд из 30 точек, реальные связки в топ-5); API связок —
401 без сессии, страница, фильтр по статусу, поиск, пагинация, сортировка по производному ROI,
диапазон ROI, отсечение несуществующей страницы, 422 на неверное значение, CSV с нужными
заголовками и права (чужая связка не меняется, удаление только у админа, своя связка меняется
и возвращается обратно).

## API

Все эндпоинты требуют сессию (кроме `POST /api/auth/register`), отвечают `{ data }` или
`{ error: { message, fields } }` и проверяют права через `lib/dal.ts`.

| Метод | Путь | Назначение |
| ----- | ---- | ---------- |
| `POST` | `/api/auth/register` | регистрация (всегда роль `USER`) |
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth: csrf, callback, session |
| `GET` | `/api/bundles` | список: `search`, `status` (csv), `offerId`, `userId`, `mine`, `geoId`, `tagId`, `roiMin`, `roiMax`, `dateFrom`, `dateTo`, `sort`, `order`, `page`, `pageSize`, `archived` |
| `POST` | `/api/bundles` | создание связки |
| `PUT` | `/api/bundles/[id]` | частичное обновление: присылаются только изменённые поля, на каждое пишется запись в историю |
| `GET` | `/api/bundles/export` | тот же фильтр, CSV-файл вместо страницы |
| `POST` | `/api/bundles/bulk` | массово: `status` \| `archive` \| `unarchive` \| `delete` |
| `PATCH` | `/api/bundles/[id]/status` | смена статуса одной связки |

Форма создания/редактирования — модалка на React Hook Form + той же Zod-схеме, что и на сервере;
CR, ROI, ROAS и прибыль считаются на лету по мере ввода чисел. Байер создаёт связку всегда на
себя, переназначить байера и удалить чужую связку может только админ.

Про `PUT` и Zod: `.partial()` в zod 4 **сохраняет `.default()`** поля. Если собирать partial из схемы
с дефолтами, то `{}` пройдёт валидацию и превратится в полный payload — PUT, который хотел поменять
одну колонку, молча обнулил бы остальные. Поэтому общие поля объявлены без дефолтов, дефолты
добавляются только в create-схему через `.extend()`, а partial строится на чистых полях.

`sort` принимает только белый список колонок. `roi`, `cr` и `profit` — производные, их нельзя
ни отсортировать, ни отфильтровать через `orderBy` в Prisma, поэтому для таких запросов
сначала читаются лёгкие строки (только числа), считаются в `lib/bundles.ts`, и только
получившаяся страница поднимается вместе со связями. Окно скана ограничено
(`DERIVED_SCAN_LIMIT`), и при переполнении в ответе приходит `truncated: true` — экран
показывает это предупреждение вместо молча неверного порядка.

## Темы

Тёмная — по умолчанию (по ТЗ), светлая тоже полноценная, переключатель **System / Light / Dark**
в хедере. Реализация без `next-themes`:

- палитра живёт в семантических токенах (`bg-card`, `border-border`, `text-muted-foreground`,
  `text-success`, `text-destructive`, `--sidebar-*`), компоненты цвет не задают — иначе новая
  тема в них не подхватится;
- исключение намеренное: `lib/status.ts` держит оттенки статусов явно (цвет несёт смысл),
  но для каждого задана светлая и тёмная пара;
- выбор хранится в `localStorage`, а `lib/theme-storage.ts` встраивается в `<head>` инлайн-скриптом
  и ставит класс на `<html>` **до первой отрисовки** — мигания при загрузке нет;
- шрифт системный (SF Pro / Segoe UI Variable), веб-шрифтов нет — первый кадр не ждёт font-запрос;
- **цвета графиков задаются в JS** (`lib/chart-theme.ts` по `useResolvedTheme()`), потому что
  Recharts пишет их в SVG-атрибуты `fill`/`stroke`, куда `var(--token)` не подставляется.

Готовность проверяется скриншотами обеих тем на реальных страницах: смоук ходит в API, но
не видит рендер, а авторизованную страницу headless-браузер получает только через CDP
(`Network.setCookie` с сессией + `Page.captureScreenshot`).

## Кэш и мгновенная навигация

Под `cacheComponents` Next в дев-оверлее помечает **«uncached data during a navigation»** — это не
ошибка, а сигнал: переход по ссылке не может быть мгновенным, потому что страница ждёт
не-кэшированные данные. Против каждого случая — своё средство, а не «use cache везде»:

| Что | Почему так |
| --- | --- |
| Чтение сессии (`getSessionUser`) | `'use cache: private'` — значение живёт **только в браузере**, на сервер не пишется; именно это даёт Next prefetchить авторизованный шелл. Для route handler'ов есть отдельный `readSessionUser()` без приватного кэша — там записи держать некому |
| Справочники фильтров (`getBundleFacets`) | `use cache` + `cacheTag('facets')` + `cacheLife('minutes')`: меняются редко, тег инвалидирует CRUD настроек на этапе 6 |
| Агрегаты дашборда (`getDashboardData`) | то же под тегом `dashboard`, и **любая** запись в `lib/bundles.ts` вызывает `revalidateTag('dashboard', { expire: 0 })` — иначе после массовой смены статусов цифры на главной остались бы старыми |
| `searchParams` страницы `/bundles` | на сервере не читается вообще: состоянием фильтра владеет клиент, а серверный `await` только блокировал навигацию |

Тонкость с `cacheLife`: пресет `'seconds'` даёт `stale = 1 s`, а при `stale < 30 s` Next исключает
scope из пререндеров и prefetch — кэш был бы, эффекта нет. Поэтому везде `'minutes'`.

Проверка: в `npm run smoke` есть кейс «cached dashboard is invalidated by a status change»
(8 → 9 → 8), а отсутствие инсайтов подтверждено реальным рендером — навигация `/ → /bundles → /`
в headless Edge через CDP (оверлей живёт в shadow DOM, его текст читается сквозь `shadowRoot`).

Один шум в логе остаётся и он не наш:

```
DeprecationWarning: Calling client.query() when the client is already executing a query
is deprecated and will be removed in pg@9.0.
```

Стек (`@prisma/client/runtime/client.js → interpretNode → performIO → pg/lib/client.js`) показывает,
что запросы вразнолад на одном соединении отправляет сам движок Prisma с pg-адаптером, а не код
приложения — там все вызовы последовательные. На корректность сегодня не влияет (Postgres
исполняет сообщения соединения по порядку), но на мажоре `pg@9` сломается, поэтому `pg`
закреплён на 8.x и при апгрейде это проверять первым. Попытка убрать его через интерактивную
`$transaction` не помогла — транзакция оставлена по другой причине: запись и её история теперь
фиксируются атомарно.

## Как устроена защита

Защита в несколько слоёв, и они не заменяют друг друга:

1. **`proxy.ts`** — только проверка *наличия* cookie сессии. Даёт честный HTTP-редирект
   на `/auth/login` для анонимных запросов. Под Partial Prerender сам `redirect()` внутри
   страницы не может вернуть 3xx: статический шелл (скелетон) уже отправлен, и редирект
   прилетает в потоке. Поэтому у анонимного `GET /` здесь 307, а не 200 со скелетоном.
   Правила «уже вошёл → убери со страницы входа» здесь намеренно **нет**: по одному лишь
   наличию cookie оно загоняло бы просроченный токен в цикл «/auth/login → / → /login».
2. **`lib/dal.ts`** — настоящая авторизация: `requirePageUser()` для страниц и
   `requireApiUser()` / `requireApiAdmin()` для каждого API-эндпоинта. Токен проверяется
   на подписи, поэтому фальшивая cookie показывает только скелетон без данных
   (это и проверяет смоук). Перед `auth()` стоит `await connection()`: без него Next
   ругается `blocking-prerender-crypto` на внутреннем редиректе Auth.js, и вместо
   перехода на форму входа пользователь получает упавший стрим.
3. **`next.config.ts → redirects()`** — `/login → /auth/login`. `auth()` из серверного
   компонента при отсутствии сессии редиректит на служебный `/login` и `pages.signIn`
   в этом пути не учитывает; вместо дубля страницы внутренний адрес мапится на реальную
   форму входа.

Правила прав: `ADMIN` видит и удаляет всё; `USER` создаёт свои связки и редактирует только
свои (`canManageBundle`). Регистрация всегда выдаёт роль `USER`.

## Откуда что берётся на дашборде

Числа на главной считаются по `BundleMetric` — дневным срезам, поэтому `date` в этой таблице
имеет тип `DATE` (`@db.Date`), а не timestamp: иначе каждая строка была бы «своим днём» и
группировка по дням была бы невозможна. Следствия, о которых легко забыть:

- итоги (`budgetSpent`, `revenue`, `clicks`, `conversions`) на самом `Bundle` остаются
  авторитетными для формы, а графики и «прибыль за месяц» читают дневные строки;
- Prisma отдаёт `DATE` как полночь по UTC, а машина в UTC+4 — поэтому подписи дней формируются
  из UTC-полей (`formatDayLabel`), а не через локальный `Intl`/`date-fns`;
- «Топ-5 по ROI за неделю» считается по тратам за 7 дней, а не по lifetime-итогам, и
  отфильтровывает связки с нулевой тратой (нет трат — нет доказательства ROI).

## Структура

```
app/
  api/auth/[...nextauth]/route.ts   NextAuth (GET/POST, connection() первой строкой)
  api/auth/register/route.ts        регистрация
  api/bundles/route.ts              список с фильтрами/сортировкой/пагинацией
  api/bundles/export/route.ts       CSV тех же фильтров
  api/bundles/bulk/route.ts         массовые действия
  api/bundles/[id]/status/route.ts  смена статуса одной связки
  auth/login, auth/register         страницы входа и регистрации (без оболочки)
  (dashboard)/
    layout.tsx                      оболочка: Sidebar + Header + MobileNav, каждый в своём <Suspense>
    loading.tsx                     скелетон сегмента (он же даёт границу для чтения сессии)
    page.tsx                        дашборд с виджетами
    bundles/page.tsx                список связок (сервер читает фильтры из URL и словари)
    analytics/ settings/            заглушки этапа 6
  layout.tsx                        скрипт темы до первой отрисовки, провайдеры
components/
  ui/                               примитивы shadcn/ui
  auth/                             LoginForm, RegisterForm, AuthShell, SignOutButton, DemoAccounts
  layout/                           Sidebar, Header, NavList, MobileMenu (Sheet), MobileNav, UserMenu, BrandMark, ThemeToggle, nav-items
  dashboard/                        StatsCard, ProfitChart, StatusPieChart, TopBundlesWidget
  bundles/                          BundlesView, BundleTable (+карточки, пагинация, скелетон), BundleFilters, BulkActionsBar, BundleStatusBadge, BundleForm, BundleDialog
  providers.tsx                     React Query + Toaster
  StagePlaceholder.tsx              общий вид заглушки этапа
lib/
  auth.ts                           NextAuth: credentials + JWT-клаймы id/role
  dal.ts                            слой доступа к данным (сессия + права)
  bundles.ts                        запросы списка, CSV-строки, массовые операции + лог изменений
  dashboard.ts                      агрегаты главной (groupBy по статусам/дням/неделе)
  db.ts                             PrismaClient через pg-адаптер
  http.ts                           ApiError, toResponse, errorResponse, CSV-хелперы
  api-client.ts                     типизированный fetch для клиентских хуков
  validations.ts                    Zod-схемы всех форм, фильтров и bulk-операций
  theme.ts / theme-storage.ts       клиентский store темы + скрипт до первой отрисовки
  chart-theme.ts                    палитры графиков по темам (JS-значения, не CSS-переменные)
  utils.ts / status.ts              расчёты CR/ROI/ROAS, форматирование дат и денег, цвета статусов
hooks/
  useBundles.ts                     запросы списка и мутации, состояние фильтра = URL
  useSignOut.ts                     общий выход из сессии (меню пользователя + кнопка)
types/index.ts                      DTO списка, facets, bulk-ответа
prisma/
  schema.prisma, seed.ts, migrations/
proxy.ts
scripts/smoke.mjs
types/next-auth.d.ts                расширение типов сессии
```

## Статус разработки

- [x] **Этап 1.** Проект, зависимости, схема БД + миграции + сид, NextAuth, роли, страницы входа/регистрации, smoke-тест
- [x] **Этап 2.** Layout (сайдбар, хедер, мобильная навигация и drawer) и главная страница с виджетами
- [x] **Этап 3.** Список связок: API, фильтры, сортировка, пагинация, массовые действия, CSV
- [x] **Тематический проход.** Семантические токены, светлая и тёмная темы, переключатель System/Light/Dark, системный шрифт, палитра графиков по теме
- [x] **Этап 4.** Форма создания/редактирования (модалка, оптимистичные обновления)
- [ ] **Этап 5.** Детальная страница: timeline изменений + комментарии
- [ ] **Этап 6.** Аналитика (графики по байерам/офферам) и справочники в настройках
- [ ] **Этап 7.** Экспорт/импорт CSV, уведомления, audit log, Docker-деплой
