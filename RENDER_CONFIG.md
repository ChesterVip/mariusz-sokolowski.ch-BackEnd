# Render.com Configuration for Backend

## Environment Variables to set in Render.com dashboard:

### Database
- `DB_TYPE`: postgres
- `DB_HOST`: your-postgres-host
- `DB_PORT`: 5432
- `DB_USERNAME`: your-postgres-user
- `DB_PASSWORD`: your-postgres-password
- `DB_DATABASE`: your-postgres-database

### JWT & Security
- `JWT_SECRET`: your-super-secret-jwt-key-change-this-in-production
- `NODE_ENV`: production

### Email Configuration
- `MAIL_HOST`: smtp.gmail.com
- `MAIL_PORT`: 587
- `MAIL_SECURE`: false
- `MAIL_USER`: your-email@gmail.com
- `MAIL_PASS`: your-app-password
- `MAIL_FROM`: noreply@mariusz-sokolowski.ch

### CORS Configuration
- `ALLOWED_ORIGINS`: https://mariusz-sokolowski.ch,https://www.mariusz-sokolowski.ch,https://your-frontend-domain.com

### Optional
- `ENABLE_SWAGGER`: true
- `LOG_LEVEL`: info
- `ENABLE_REQUEST_LOGGING`: true

## Build Command:
```bash
npm ci && npm run build
```

## Start Command:
```bash
npm run start:prod
```

## Health Check:
- Path: `/health`
- Expected response: `{"status":"ok","timestamp":"..."}`

