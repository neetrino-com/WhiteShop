# Як виправити помилку ChunkLoadError

## Проблема
Помилка `ChunkLoadError` в Next.js 15 зазвичай виникає через проблеми з кешем або HMR (Hot Module Replacement).

## Рішення

### Крок 1: Очистити кеш та перезапустити

```bash
cd shop-classic/apps/web

# Очистити кеш Next.js
rm -rf .next

# Перезапустити dev сервер
npm run dev
```

Або використайте скрипт:
```bash
npm run dev:clean
```

### Крок 2: Якщо проблема залишилась, використайте webpack замість Turbopack

```bash
npm run dev:webpack
```

### Крок 3: Якщо все ще не працює

1. Очистіть node_modules та перевстановіть залежності:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Перезапустіть сервер:
```bash
npm run dev
```

### Крок 4: Перевірте браузер

1. Закрийте всі вкладки з `localhost:3000`
2. Очистіть кеш браузера (Ctrl+Shift+Delete)
3. Відкрийте нову вкладку з `http://localhost:3000`

## Альтернативне рішення

Якщо проблема повторюється, можна тимчасово відключити Turbopack, додавши в `next.config.js`:

```javascript
experimental: {
  turbo: false,
},
```

Але зазвичай достатньо просто очистити `.next` директорію.

