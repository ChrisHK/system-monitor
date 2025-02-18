# Store Management System

A full-stack application for managing retail store operations, inventory, and order processing.

## 📦 System Components

### Backend Services
```
├── src/
│ ├── config/
│ │ ├── database.js # PostgreSQL connection pool with SSL configuration
│ │ └── cache.js # Multi-layer caching (NodeCache + Redis)
│ ├── controllers/
│ │ ├── orderController.js # Order CRUD with transaction handling
│ │ ├── groupController.js # RBAC with permission validation
│ │ └── recordController.js# Paginated data queries
│ ├── routes/
│ │ └── order.js # RESTful endpoints with JWT auth
│ └── db/
│ └── createTables.sql # Schema with indexes and constraints
```
### Frontend UI
```
├── src/
│   ├── pages/
│   │   └── StoreOrdersPage.js # Order management interface
│   ├── components/
│   │   └── inventory/
│   │       └── InventoryColumns.js # Memoized table columns
│   ├── api/
│   │   ├── api.js            # Axios instance with debounced requests
│   │   └── websocket.js      # Batched message processing
│   └── hooks/
│       └── useCacheBuster.js # Cache invalidation handling
```

## 🔧 Key Features

### Backend
- **Order Processing**
  - Transactional updates with BEGIN/COMMIT
  - Soft delete with status flags
  - ACID-compliant inventory updates

- **Security**
  - JWT authentication middleware
  - RBAC with group-based permissions
  - SQL injection prevention with parameterized queries

- **Performance**
  - Connection pooling (max 20 connections)
  - Query batching for bulk operations
  - Cursor-based pagination

### Frontend
- **Order Management**
  - Real-time updates via WebSocket
  - Filterable/sortable data tables
  - CSV export functionality

- **Optimizations**
  - Memoized component rendering
  - Request deduplication
  - Virtualized scrolling

- **UI Components**
  - Dynamic form validation
  - Context-aware modals
  - Progress indicators

## ⚙️ Configuration
env:README.md

#ostgreSQL
DB_HOST=Your_IP
DB_PORT=5432
DB_SSL=true
DB_MAX_CONNECTIONS=20

Redis
REDIS_URL=redis://cache:6379
CACHE_TTL=900 # seconds

JWT
JWT_SECRET=your_secure_key
TOKEN_EXPIRES=1h


## 🚀 API Documentation

### Core Endpoints
http:README.md
GET /api/orders?status=pending
POST /api/orders { "items": [...] }
DELETE /api/orders/{id}
GET /api/groups/{id}/permissions
PUT /api/groups/{id} { "permissions": [...] }

### Example Request
```bash:README.md
curl -X POST http://localhost:4000/api/orders \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": "A123", "quantity": 5}]}'
```

## 🛠 Installation

1. Clone repo:
```bash:README.md
git clone https://github.com/yourrepo/store-system.git
cd store-system
```

2. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Database setup:
```bash
psql -U postgres -f src/db/createTables.sql
npm run migrate
```

4. Start services:
```bash
# Backend
npm run start:dev

# Frontend
npm run start
```

## 📊 Monitoring
Access metrics via built-in endpoints:
- `/metrics/pool` - Database connection stats
- `/metrics/cache` - Cache hit ratios
- `/healthcheck` - System status

## 🚨 Deployment Notes
1. Use Docker for PostgreSQL 13+ with `timescaledb` extension
2. Configure reverse proxy for HTTPS termination
3. Enable connection pooling with PgBouncer
4. Use PM2 for process management

## 📄 License
MIT License - See [LICENSE.md](LICENSE.md) for details.

# System Monitor

A comprehensive system monitoring solution with a modern web interface.

## Project Structure

```
.
├── backend/                 # Backend Node.js application
│   ├── config/             # Configuration files
│   │   ├── default.js      # Default configuration
│   │   ├── development.js  # Development environment config
│   │   └── production.js   # Production environment config
│   ├── src/               # Source code
│   └── .env.example       # Environment variables example
│
├── frontend/               # Frontend React application
│   ├── config/            # Configuration files
│   │   ├── default.js     # Default configuration
│   │   ├── development.js # Development environment config
│   │   └── production.js  # Production environment config
│   ├── src/              # Source code
│   └── .env.example      # Environment variables example
│
└── backups/              # Database backups
```

## Prerequisites

- Node.js >= 16.0.0
- PostgreSQL >= 12
- npm or yarn

## Configuration

### Backend Configuration

The backend uses a layered configuration system:

1. Environment Variables (highest priority)
2. Environment-specific config (development.js/production.js)
3. Default config (default.js)

Key configuration files:
- `.env.example`: Template for environment variables
- `.env`: Local development environment variables
- `.env.production`: Production environment variables

### Frontend Configuration

Similar to the backend, the frontend uses:

1. Environment Variables (highest priority)
2. Environment-specific config
3. Default config

## Development Setup

1. Clone the repository
```bash
git clone [repository-url]
cd system-monitor
```

2. Install dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Set up environment variables
```bash
# Backend
cp backend/.env.example backend/.env
# Edit .env with your local settings

# Frontend
cp frontend/.env.example frontend/.env
# Edit .env with your local settings
```

4. Start development servers
```bash
# Backend
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend
npm start
```

## Production Deployment

1. Set up environment variables
```bash
# Backend
cp backend/.env.example backend/.env.production
# Edit .env.production with production settings

# Frontend
cp frontend/.env.example frontend/.env.production
# Edit .env.production with production settings
```

2. Build and start
```bash
# Frontend
cd frontend
npm run build

# Backend
cd ../backend
npm start
```

## Available Scripts

### Backend
- `npm start`: Start production server
- `npm run dev`: Start development server
- `npm run sync`: Run data synchronization
- `npm run migrate`: Run database migrations

### Frontend
- `npm start`: Start development server
- `npm run start:prod`: Start production preview
- `npm run build`: Build for production
- `npm run build:dev`: Build for development

## Environment Variables

### Backend
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port
- `DB_*`: Database configuration
- `JWT_*`: JWT configuration
- See `.env.example` for all options

### Frontend
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_WS_URL`: WebSocket URL
- See `.env.example` for all options

## License

[Your License]

