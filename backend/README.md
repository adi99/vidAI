# AI Video Generation App - Backend API

This is the backend API server for the AI Video Generation mobile application. Built with Node.js, Express, TypeScript, and Supabase.

## Features

- **Authentication**: JWT-based authentication with Supabase Auth
- **Database**: PostgreSQL with Supabase and Row Level Security
- **Validation**: Request validation with Zod schemas
- **Logging**: Structured logging with Winston
- **Security**: Helmet, CORS, rate limiting
- **Error Handling**: Comprehensive error handling and logging
- **Queues**: BullMQ-based queues (image, video, training) with retries, priorities, DLQ, and health endpoints

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project with database setup

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with:
   - Supabase URL and service role key
   - Upstash Redis URL and Token for queue system
   - GPU service API keys
   - Other required environment variables

### Queue System (BullMQ + Upstash Redis)

- Environment variables (see `.env.example`):
  - `UPSTASH_REDIS_URL` (e.g. rediss://xxxxx.upstash.io)
  - `UPSTASH_REDIS_TOKEN`
- Queues:
  - `gen:image`, `gen:video`, `train:model`
  - Dead-letter queues: `gen:image:dlq`, `gen:video:dlq`, `train:model:dlq`
- Health endpoints:
  - `GET /health/queues`
  - `GET /health/queues/:name`
- Producers (helpers):
  - Import from [`backend/src/queues/producers.ts`](backend/src/queues/producers.ts)
- Workers:
  - Initialized via [`backend/src/queues/workers.ts`](backend/src/queues/workers.ts)
- Graceful shutdown:
  - Coordinated in [`backend/src/index.ts`](backend/src/index.ts)

### Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001` with hot reloading.

### Building

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `GET /api/auth/profile` - Get user profile with credits
- `POST /api/auth/refresh` - Refresh JWT tokens (TODO)
- `POST /api/auth/logout` - Logout user (TODO)

### Generation (TODO)
- `POST /api/generate/image` - Create image generation job
- `POST /api/generate/video` - Create video generation job
- `GET /api/generate/:jobId` - Get generation job status

### Training (TODO)
- `POST /api/train/upload` - Upload training images
- `POST /api/train/start` - Start LoRA training job
- `GET /api/train/:jobId` - Get training job status

### Social (TODO)
- `GET /api/feed` - Get paginated social feed
- `POST /api/content/:id/like` - Like/unlike content
- `POST /api/content/:id/comment` - Add comment

### Credits (TODO)
- `GET /api/credits/balance` - Get current credit balance
- `POST /api/credits/purchase` - Initiate credit purchase

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files (Supabase, Logger, Redis)
│   ├── middleware/          # Express middleware
│   ├── routes/              # API route handlers (auth, health)
│   ├── queues/              # BullMQ queues, workers, producers
│   │   ├── index.ts         # Queue registry and DLQ helpers
│   │   ├── workers.ts       # Workers and processors
│   │   └── producers.ts     # Producer helpers
│   ├── schemas/             # Zod validation schemas
│   ├── types/               # TypeScript type definitions
│   ├── app.ts               # Express app configuration
│   └── index.ts             # Server entry point
├── logs/                    # Log files
├── dist/                    # Compiled JavaScript (generated)
└── package.json
```

## Environment Variables

See `.env.example` for all required environment variables.

## Logging

Logs are written to:
- `logs/error.log` - Error level logs
- `logs/combined.log` - All logs
- Console output in development

## Security

- Helmet for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes per IP)
- Input validation with Zod
- JWT token verification
- Supabase Row Level Security

## Error Handling

All errors are handled consistently with:
- Structured error responses
- Proper HTTP status codes
- Error logging
- Validation error details

## Next Steps

This foundation provides:
1. ✅ Express server with TypeScript
2. ✅ Supabase service role client configuration
3. ✅ Zod schema validation setup
4. ✅ Authentication middleware
5. ✅ Error handling and logging infrastructure
6. ✅ Redis queue system with BullMQ (image/video/training), DLQ, health endpoints, and graceful shutdown

The following tasks will build upon this foundation:
- GPU service integration (Task 4)
- Generation API endpoints (Task 5)
- Training API endpoints (Task 6)
- Social API endpoints (Task 7)
- Push notification system (Task 8)