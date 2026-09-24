# Module 26 — Technology Stack & System Implementation Architecture

## 1. Objective

Define the official technology stack, architectural responsibilities, development conventions, integration strategy, and implementation boundaries for the BuildSmart AI platform.

This module is the technical foundation for all other BuildSmart AI functional modules. AI coding agents must consult this specification before implementing or modifying platform functionality.

## 2. Official Technology Stack

| Layer | Technology | Primary Responsibility |
|---|---|---|
| Frontend | Next.js | Web application, UI, routing, rendering, frontend integration |
| Backend | Node.js | Server-side application logic, APIs, business services |
| Database | PostgreSQL | Persistent relational data storage |
| ORM | Prisma ORM | Database schema, migrations, queries, type-safe data access |
| 3D Visualization | Three.js | 3D rendering engine |
| 3D React Integration | React Three Fiber | React-based Three.js scene management |
| 3D Utilities | Drei | Reusable helpers/components for React Three Fiber |
| 2D Graphics | SVG | Vector-based floor plans, diagrams, scalable graphics |
| 2D Canvas | Konva | Interactive 2D drawing and editing |
| 2D Canvas | Fabric.js | Advanced interactive canvas/object manipulation |
| Real-Time Communication | WebSockets | Real-time chat, presence, and live events |

These technologies constitute the baseline stack. Additional libraries may be introduced only when they solve a clearly identified requirement and do not unnecessarily duplicate existing capabilities.

## 3. High-Level Architecture

```text
┌──────────────────────────────────────────────────────┐
│                    CLIENT / BROWSER                  │
│                                                      │
│                    Next.js                           │
│                                                      │
│ Pages • Dashboards • Marketplace • AI Design         │
│ 2D Editor • 3D Viewer • Chat • Administration        │
└─────────────────────────┬────────────────────────────┘
                          │ HTTPS / API
                          ▼
┌──────────────────────────────────────────────────────┐
│                    BACKEND                            │
│                     Node.js                          │
│                                                      │
│ Authentication • Authorization • APIs • Services     │
│ AI Orchestration • Marketplace • Verification        │
│ Payments • Notifications • Business Logic            │
└─────────────────────────┬────────────────────────────┘
                          │
                     Prisma ORM
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│                    PostgreSQL                        │
│ Users • Projects • Designs • Verification • Products │
│ Orders • Messages • Subscriptions • Reviews • Logs   │
└──────────────────────────────────────────────────────┘

Real-time path:
Next.js Client ↔ WebSocket Server / Node.js ↔ Chat/Event Services
```

## 4. Frontend — Next.js

Next.js is the primary frontend framework.

Responsibilities:
- Public landing page
- Authentication interfaces
- Client, architect, vendor and admin dashboards
- Marketplace
- Project management
- AI design interface
- 2D floor-plan editor
- 3D visualization interface
- Verification interfaces
- Subscription/payment UI
- Chat
- Blog/CMS
- Responsive navigation and UI

Keep frontend components modular and reusable.

## 5. Backend — Node.js

Node.js provides the server-side application layer.

Responsibilities:
- APIs
- Authentication and authorization
- User/profile management
- Architect and vendor verification
- Subscription/payment services
- AI service orchestration
- Design generation workflows
- Material estimation
- BOQ generation
- Marketplace
- Cart and orders
- WebSocket services
- Notifications
- File/document processing
- Reviews
- Administration
- Audit logging

Business-critical rules must be enforced on the backend. Never trust client-supplied roles, verification status, prices, permissions, payment status or order totals.

## 6. Database — PostgreSQL

PostgreSQL is the primary relational database.

Store:
- Users and roles
- Profiles
- Architect/vendor verification metadata
- Projects
- Designs
- Floor plans
- Rooms and dimensions
- Material estimates
- BOQs
- Products and inventory
- Carts and orders
- Subscription metadata
- Payment metadata
- Messages
- Reviews
- Notifications
- Blog content
- Support tickets
- Audit events

Large binary files should normally use private file/object storage, with PostgreSQL storing metadata and secure references.

## 7. ORM — Prisma ORM

Use Prisma for:
- Database schema
- Migrations
- Queries
- Relations
- Transactions
- Type-safe database access
- Seeding

Rules:
- Use migrations for schema changes.
- Reuse existing models.
- Avoid duplicate entities.
- Use transactions for atomic multi-step operations.
- Add indexes for frequent queries.
- Use appropriate unique constraints.
- Protect sensitive fields.

## 8. 3D Visualization — Three.js

Three.js is the core 3D rendering engine.

Use it for:
- Buildings
- Floors
- Walls
- Roofs
- Doors
- Windows
- Furniture
- Architectural objects
- Cameras
- Lighting
- Materials
- Interactive scenes

Pipeline:

```text
Architectural Data → Building Geometry → Three.js Scene → Interactive 3D Model
```

## 9. React Three Fiber

Use React Three Fiber to integrate Three.js into the React/Next.js application.

Use it for:
- React-based 3D scenes
- Reusable 3D components
- Interactive building elements
- Camera and scene control
- React-driven 3D state

Example:

```text
<BuildingScene>
    <Floor />
    <Walls />
    <Doors />
    <Windows />
    <Furniture />
    <Roof />
    <Camera />
</BuildingScene>
```

## 10. Drei

Use Drei for reusable React Three Fiber utilities such as:
- Controls
- Cameras
- Lighting
- Environment
- Text
- Model loading
- Helpers
- Interaction utilities

Do not recreate functionality already adequately provided by Drei.

## 11. 2D — SVG

Use SVG for:
- Floor plans
- Walls
- Doors
- Windows
- Room boundaries
- Dimension lines
- Labels
- Architectural symbols
- Exportable vector diagrams

SVG is appropriate where geometric precision and scalability are important.

## 12. 2D — Konva

Use Konva for interactive 2D editing such as:
- Dragging rooms
- Resizing rooms
- Moving doors/windows
- Object selection
- Transformations
- Annotations
- Snap-to-grid
- Interactive floor-plan editing

The editor must maintain a structured architectural data model instead of relying only on rendered pixels.

## 13. 2D — Fabric.js

Use Fabric.js where advanced object-based canvas functionality is appropriate:
- Object selection
- Transformation
- Layer management
- Annotation
- Drawing
- Exporting
- Interactive architectural objects

Do not use Konva and Fabric.js redundantly for identical functionality without a clear technical reason.

## 14. Shared 2D/3D Architectural Data Model

The visual layer must not become the business source of truth.

Use a structured model:

```text
Project
  ↓
Architectural Design
  ↓
Building
  ├── Floors
  │    ├── Rooms
  │    ├── Walls
  │    ├── Doors
  │    └── Windows
  ├── Roof
  ├── Materials
  └── Dimensions
```

The same model should feed both renderers:

```text
             Architectural Model
                     │
            ┌────────┴────────┐
            ↓                 ↓
       2D Renderer       3D Renderer
            │                 │
     SVG/Konva/Fabric   Three.js/R3F/Drei
```

## 15. Real-Time Chat — WebSockets

Use WebSockets for:
- One-to-one chat
- Project/group conversations
- Message delivery
- Online presence
- Typing indicators
- Read status
- Real-time notifications
- Appropriate live project events

Conceptual architecture:

```text
Client A ↔ WebSocket Server / Node.js ↔ Client B
                         │
                         ↓
                    PostgreSQL
```

WebSockets provide real-time transport. PostgreSQL stores persistent message history.

## 16. API Architecture

Organize backend APIs by domain, for example:

```text
/api/auth
/api/users
/api/architects
/api/vendors
/api/verification
/api/projects
/api/designs
/api/floor-plans
/api/visualizations
/api/material-estimates
/api/boq
/api/products
/api/cart
/api/orders
/api/payments
/api/subscriptions
/api/reviews
/api/notifications
/api/blog
/api/admin
```

Use consistent validation, authorization, error handling and response conventions.

## 17. Authentication & Authorization

The implementation must provide:
- Secure authentication
- Session/token management
- Password security
- Role-based authorization
- Protected frontend routes
- Protected APIs
- Account recovery
- Email verification where required

Core roles:

```text
CLIENT
ARCHITECT
VENDOR
ADMIN
```

Authorization must be enforced on the backend.

## 18. AI Integration Architecture

AI services should be orchestrated by the backend:

```text
Next.js
   ↓
Node.js API
   ↓
AI Service / Provider
   ↓
Structured AI Result
   ↓
Validation / Normalization
   ↓
PostgreSQL
   ↓
Next.js
```

Never expose AI API keys or other server secrets in frontend code.

## 19. File & Document Architecture

The platform will process:
- Architect credentials
- Vendor credentials
- Reference images
- Floor plans
- 3D assets
- BOQs
- Invoices
- Project documents
- Product documents

Recommended flow:

```text
Frontend
   ↓
Node.js Upload API
   ↓
Validation + Authorization
   ↓
Private File Storage
   ↓
PostgreSQL Metadata
```

Sensitive verification documents must remain private.

## 20. Environment & Secrets

Use environment variables or a secure secret-management system.

Examples:

```text
DATABASE_URL
AUTH_SECRET
AI_API_KEY
PAYMENT_SECRET
WEBSOCKET_SECRET
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
```

Never commit secrets to Git or expose server-side secrets to the browser.

## 21. Recommended Project Organization

```text
buildsmart-ai/
│
├── app/                 # Next.js application
├── components/
│   ├── ui/
│   ├── forms/
│   ├── marketplace/
│   ├── architecture/
│   ├── floor-plan/
│   ├── visualization/
│   └── chat/
│
├── server/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── routes/
│   ├── websocket/
│   └── utils/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── three/
│   ├── websocket/
│   └── validation/
│
└── public/
```

Adapt the exact structure to the chosen Next.js/Node.js deployment architecture.

## 22. Performance Requirements

### Next.js
- Use server rendering/static generation where beneficial.
- Lazy-load heavy components.
- Optimize images.
- Code-split large features.

### 2D
- Avoid unnecessary canvas redraws.
- Optimize object/layer management.
- Maintain efficient geometry representations.

### 3D
- Lazy-load 3D assets.
- Optimize model complexity.
- Avoid unnecessary scene re-renders.
- Dispose unused Three.js resources.

### WebSockets
- Manage connection lifecycle.
- Reconnect safely.
- Prevent duplicate subscriptions.
- Validate incoming events.
- Handle connection failures.

### PostgreSQL/Prisma
- Index frequent queries.
- Avoid N+1 queries.
- Paginate large datasets.
- Use transactions appropriately.

## 23. Security Architecture

Security must span every layer:

```text
Next.js
   ↓
Authentication
   ↓
Authorization
   ↓
Node.js Validation
   ↓
Business Rules
   ↓
Prisma
   ↓
PostgreSQL
```

Implement:
- Input validation
- Authentication
- Authorization
- Rate limiting
- Secure headers
- CSRF protection where applicable
- File validation
- Access control
- Audit logging
- Secure secrets
- Secure WebSocket authentication

## 24. Technology Responsibility Matrix

| Requirement | Technology |
|---|---|
| Web UI | Next.js |
| Frontend routing | Next.js |
| Server-side application | Node.js |
| APIs | Node.js |
| Persistent data | PostgreSQL |
| Database access | Prisma ORM |
| Database migrations | Prisma ORM |
| 3D rendering | Three.js |
| React 3D integration | React Three Fiber |
| 3D helpers | Drei |
| 2D vector graphics | SVG |
| Interactive 2D editing | Konva |
| Advanced object canvas | Fabric.js |
| Real-time chat | WebSockets |
| Message persistence | PostgreSQL + Prisma |
| AI orchestration | Node.js |
| 2D architectural UI | Next.js + SVG/Konva/Fabric.js |
| 3D architectural UI | Next.js + React Three Fiber + Three.js + Drei |

## 25. Integration With Functional Modules

The stack must support all BuildSmart AI modules, including:
- Authentication & authorization
- User/profile management
- Architect verification
- Vendor verification
- Subscription/payment
- AI architectural design
- Floor plans
- 3D visualization
- Project management
- Material estimation
- BOQ
- Marketplace
- AI-to-marketplace integration
- Cart/orders
- Real-time chat
- Architect discovery
- Reviews/ratings
- Notifications
- Search/recommendations
- Blog/CMS
- Administration
- Analytics
- File/document management
- Support
- Security/audit

Example dependency chain:

```text
Authentication
      ↓
Verification
      ↓
Subscription
      ↓
AI Design
      ↓
2D Floor Plan
      ↓
3D Visualization
      ↓
Material Estimation
      ↓
BOQ
      ↓
Marketplace
      ↓
Procurement
      ↓
Chat / Notifications / Reviews
```

## 26. AI-Agent Implementation Rules

1. Read this module before implementing any BuildSmart AI functionality.
2. Use Next.js as the primary frontend framework.
3. Use Node.js for backend application services.
4. Use PostgreSQL as the primary relational database.
5. Use Prisma ORM for database access and migrations.
6. Use Three.js for 3D rendering.
7. Use React Three Fiber for React-based 3D components.
8. Use Drei for reusable 3D helpers.
9. Use SVG for scalable 2D architectural graphics.
10. Use Konva for appropriate interactive 2D editing.
11. Use Fabric.js for appropriate advanced object-based canvas features.
12. Use WebSockets for real-time chat and appropriate live events.
13. Do not introduce another primary database or ORM without explicit authorization.
14. Do not replace the specified 2D/3D stack without technical justification.
15. Keep 2D and 3D visualization driven by a shared structured architectural model.
16. Keep business-critical logic on the Node.js/backend side.
17. Never expose secrets in client-side code.
18. Reuse existing modules, components, services and database models.
19. Avoid duplicate dependencies and functionality.
20. Build responsive and accessible interfaces.
21. Test each module independently and after integration.
22. Preserve existing functionality.
23. Document significant architectural decisions.

## 27. Acceptance Criteria

The technology architecture is correctly implemented when:
- Next.js is the primary frontend.
- Node.js handles backend application services.
- PostgreSQL is the primary database.
- Prisma ORM manages database access and migrations.
- Three.js provides core 3D rendering.
- React Three Fiber integrates Three.js with React.
- Drei provides reusable 3D helpers.
- SVG supports scalable 2D graphics.
- Konva supports appropriate interactive 2D editing.
- Fabric.js supports appropriate advanced canvas functionality.
- WebSockets support real-time chat.
- Persistent chat data is stored in PostgreSQL.
- Frontend/backend responsibilities are clearly separated.
- Server secrets remain protected.
- The architecture can support all BuildSmart AI modules.
- The architecture remains modular and scalable.

## 28. Final Technology Architecture

```text
                         BUILDSMART AI
                              │
              ┌───────────────┴────────────────┐
              │                                │
          FRONTEND                          BACKEND
              │                                │
          Next.js                           Node.js
              │                                │
     ┌────────┼────────┐              ┌────────┼─────────┐
     │        │        │              │        │         │
    2D       3D       UI             APIs    Services  WebSockets
     │        │                         │        │         │
 SVG/Konva  Three.js                    │     AI/Business Chat
 Fabric.js   │                          │      Services
             │                          │
      React Three Fiber                 │
             │                          │
            Drei                        │
                                        │
                                  Prisma ORM
                                        │
                                        ▼
                                  PostgreSQL
```

This technology stack is the official technical baseline for BuildSmart AI.
