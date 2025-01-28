# Store Management System

A full-stack application for managing retail store operations, inventory, and order processing.

## 📦 System Components

### Backend Services 
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

