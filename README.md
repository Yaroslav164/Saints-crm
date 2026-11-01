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

30 проверок: редирект анонима (307) и редирект с исходным путём (`?from=%2Fbundles`), отсутствие
утечки данных при фальшивой cookie и при этом честный редирект в потоке, маппинг
`/login → /auth/login`, страницы входа и регистрации, создание/дубликат/валидация аккаунта,
CSRF, credentials-логин, роль и id в сессии, доступность формы входа при наличии cookie,
неверный пароль, публичная регистрация, а также наличие в разметке дашборда оболочки,
четырёх виджетов, обоих графиков, сериализованного дневного ряда (30 точек) и реальных
связок в топ-5.

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
  auth/login, auth/register         страницы входа и регистрации (без оболочки)
  (dashboard)/
    layout.tsx                      оболочка: Sidebar + Header + MobileNav, каждый в своём <Suspense>
    loading.tsx                     скелетон сегмента (он же даёт границу для чтения сессии)
    page.tsx                        дашборд с виджетами
    bundles/ analytics/ settings/   заглушки этапов 3 и 6
  layout.tsx                        шрифты, тёмная тема, провайдеры
components/
  ui/                               примитивы shadcn/ui
  auth/                             LoginForm, RegisterForm, AuthShell, SignOutButton, DemoAccounts
  layout/                           Sidebar, Header, NavList, MobileMenu (Sheet), MobileNav, UserMenu, BrandMark, nav-items
  dashboard/                        StatsCard, ProfitChart, StatusPieChart, TopBundlesWidget
  bundles/BundleStatusBadge.tsx     цвет статуса (используют и виджет, и будущая таблица)
  providers.tsx                     React Query + Toaster
  StagePlaceholder.tsx              общий вид заглушки этапа
lib/
  auth.ts                           NextAuth: credentials + JWT-клаймы id/role
  dal.ts                            слой доступа к данным (сессия + права)
  dashboard.ts                      агрегаты главной (groupBy по статусам/дням/неделе)
  db.ts                             PrismaClient через pg-адаптер
  http.ts                           ApiError, toResponse, CSV-хелперы
  api-client.ts                     типизированный fetch для клиентских хуков
  validations.ts                    Zod-схемы всех форм и фильтров
  utils.ts / status.ts              расчёты CR/ROI/ROAS, форматирование дат и денег, цвета статусов
hooks/useSignOut.ts                 общий выход из сессии (меню пользователя + кнопка)
prisma/
  schema.prisma, seed.ts, migrations/
proxy.ts
scripts/smoke.mjs
types/next-auth.d.ts                расширение типов сессии
```

## Статус разработки

- [x] **Этап 1.** Проект, зависимости, схема БД + миграции + сид, NextAuth, роли, страницы входа/регистрации, smoke-тест
- [x] **Этап 2.** Layout (сайдбар, хедер, мобильная навигация и drawer) и главная страница с виджетами
- [ ] **Этап 3.** Список связок: API, фильтры, сортировка, пагинация, массовые действия
- [ ] **Этап 4.** Форма создания/редактирования (модалка, оптимистичные обновления)
- [ ] **Этап 5.** Детальная страница: timeline изменений + комментарии
- [ ] **Этап 6.** Аналитика (графики по байерам/офферам) и справочники в настройках
- [ ] **Этап 7.** Экспорт/импорт CSV, уведомления, audit log, Docker-деплой
