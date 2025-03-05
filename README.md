# System Architecture Documentation

## 1. System Overview

This system is a comprehensive inventory management solution designed to handle computer equipment tracking, store management, and various business operations.

### 1.1 Core Features
- Inventory Management
- Store Management
- Order Processing
- RMA (Return Merchandise Authorization) Handling
- Outbound Management
- User Permission Control
- Data Export Capabilities

### 1.2 Technology Stack
- Frontend: React with Ant Design
- Backend: Node.js with Express
- Database: PostgreSQL
- Authentication: JWT (JSON Web Tokens)
- WebSocket: Real-time updates
- Cache: Server-side caching system

## 2. Frontend Architecture

### 2.1 Core Components

#### 2.1.1 Store Page (`StorePage.js`)
- Main inventory management interface
- Features:
  - Real-time inventory display
  - Search functionality
  - Bulk selection operations
  - Outbound management
  - Export capabilities
  - Notes management
  - Permission-based UI rendering

#### 2.1.2 Inventory Page (`InventoryPage.js`)
- Central inventory control
- Features:
  - Duplicate detection
  - Location tracking
  - Item transfer
  - Bulk operations
  - Advanced filtering

#### 2.1.3 Order Management (`StoreOrdersPage.js`)
- Order processing interface
- Features:
  - Order creation
  - Payment method handling
  - Order status tracking
  - Print functionality
  - Notes management

### 2.2 State Management
- React Hooks for local state
- Context API for global state:
  - Authentication context
  - Notification context
  - Permission context

### 2.3 API Services
- Modular service structure:
  - `inventoryService`
  - `storeService`
  - `orderService`
  - `salesService`
  - `rmaService`

## 3. Backend Architecture

### 3.1 Core Components

#### 3.1.1 Authentication System
- JWT-based authentication
- Permission middleware
- Role-based access control
- Cache-based session management

#### 3.1.2 Database Structure
- Tables:
  - `users`
  - `groups`
  - `stores`
  - `inventory`
  - `orders`
  - `rma`
  - `group_store_permissions`

#### 3.1.3 Caching System
- Permission caching
- Store data caching
- User data caching
- Cache invalidation strategies

### 3.2 API Endpoints

#### 3.2.1 Store Management
```
GET    /api/stores
POST   /api/stores
GET    /api/stores/:id
PUT    /api/stores/:id
DELETE /api/stores/:id
GET    /api/stores/:id/inventory
```

#### 3.2.2 Inventory Management
```
GET    /api/records
POST   /api/records
GET    /api/records/:id
PUT    /api/records/:id
DELETE /api/records/:id
GET    /api/records/duplicates
POST   /api/records/cleanup-duplicates
```

#### 3.2.3 Order Management
```
GET    /api/orders/:storeId
POST   /api/orders/:storeId
GET    /api/orders/:storeId/:orderId
PUT    /api/orders/:storeId/:orderId
DELETE /api/orders/:storeId/:orderId
```

## 4. Permission System

### 4.1 Permission Levels
1. Admin Permissions
   - Full system access
   - All store access
   - Configuration capabilities

2. Store Permissions
   - Inventory management
   - Order processing
   - RMA handling
   - Outbound operations

3. Feature Permissions
   - Bulk operations
   - Export capabilities
   - Note management
   - Price management

### 4.2 Permission Implementation
- Group-based permission system
- Store-specific permissions
- Feature-level access control
- Permission caching for performance

## 5. Data Flow

### 5.1 Inventory Management Flow
1. Item Creation/Import
2. Location Assignment
3. Store Transfer
4. Status Updates
5. History Tracking

### 5.2 Order Processing Flow
1. Item Selection
2. Order Creation
3. Payment Method Assignment
4. Order Confirmation
5. Status Update
6. History Recording

### 5.3 RMA Processing Flow
1. RMA Request
2. Approval Process
3. Item Return
4. Status Updates
5. Resolution Recording

## 6. Caching Strategy

### 6.1 Cache Levels
1. User Permissions Cache
   - TTL: 30 minutes
   - Scope: User-specific

2. Store Permissions Cache
   - TTL: 30 minutes
   - Scope: Group-specific

3. Store Data Cache
   - TTL: 1 hour
   - Scope: Store-specific

### 6.2 Cache Invalidation
- Automatic time-based expiration
- Manual invalidation triggers
- Bulk cache clearing capabilities

## 7. Error Handling

### 7.1 Frontend Error Handling
- API error interceptors
- User-friendly error messages
- Retry mechanisms
- Error boundary implementation

### 7.2 Backend Error Handling
- Structured error responses
- Error logging
- Transaction rollback
- Graceful degradation

## 8. Security Measures

### 8.1 Authentication Security
- JWT token management
- Token refresh mechanism
- Session handling
- CSRF protection

### 8.2 Data Security
- Input validation
- SQL injection prevention
- XSS protection
- Rate limiting

## 9. Performance Optimization

### 9.1 Frontend Optimization
- Component memoization
- Lazy loading
- Virtual scrolling
- Debounced search
- Optimized re-renders

### 9.2 Backend Optimization
- Query optimization
- Caching strategies
- Batch processing
- Connection pooling
- Load balancing

## 10. Development Workflow

### 10.1 Code Organization
- Modular component structure
- Service-based architecture
- Utility functions
- Shared components

### 10.2 Best Practices
- Code commenting
- Error logging
- Performance monitoring
- Security auditing
- Testing implementation

## 11. Future Enhancements

### 11.1 Planned Features
- Advanced analytics
- Automated inventory alerts
- Mobile application
- Batch processing improvements
- Enhanced reporting

### 11.2 Technical Improvements
- GraphQL implementation
- Real-time notifications
- Enhanced caching
- Automated testing
- CI/CD pipeline

## 12. Maintenance

### 12.1 Regular Tasks
- Cache clearing
- Log rotation
- Database optimization
- Security updates
- Performance monitoring

### 12.2 Troubleshooting Guide
- Common issues
- Debug procedures
- Error codes
- Support contacts
- Recovery procedures 