# Construction Intelligence Platform

An enterprise-grade, autonomous AI/ML-powered Construction Planning, Progress Monitoring, Critical Path Method (CPM) Scheduling, and Risk Prediction Engine.

---

## 🌟 Key Features

- **Automated CPM Scheduling Engine**: Forward/backward pass critical path analysis, total/free float computation, and dependency resolution.
- **Predictive Machine Learning**: 
  - Activity duration estimation
  - Schedule delay probability & risk classification (Low / Medium / High / Critical)
  - Daily productivity forecasting
  - Labour shortage predictions & material variance tracking
- **Geotechnical & Environmental Risk Analysis**: Automated parsing and integration of geotechnical reports (SBC, rock types, groundwater levels, soil strata).
- **Daily Progress Tracking & Engineer Validation**: Daily logs, multi-stage checklist verification, and variance detection.
- **Interactive Modern Dashboard**: React 19 + TypeScript + Vite dashboard with responsive KPI metrics, Gantt/CPM charts, blocker trackers, and real-time status.

---

## 🏗️ Architecture

```
Construction-1/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (auth, projects, schedule, predictions, etc.)
│   │   ├── database/        # SQLAlchemy engine, session & migrations
│   │   ├── ml/              # Feature engineering & ML prediction models
│   │   ├── models/          # Database models (Projects, Activities, BOQ, Logs, etc.)
│   │   ├── schemas/         # Pydantic schemas & validation
│   │   ├── services/        # CPM engine, scheduling, resource management
│   │   └── utils/           # Security, JWT tokens, date calculations
│   ├── models/              # Pre-trained ML model artifacts (.joblib)
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/                 # React components, pages, hooks, api client
│   ├── package.json         # Frontend dependencies (React 19, Lucide, Tailwind)
│   └── vite.config.ts       # Vite configuration
├── tests/                   # Pytest automated test suites
├── construction_intelligence.db # SQLite database pre-loaded with projects & ML predictions
├── seed_data.py             # Script to initialize or re-seed baseline data
├── train_models.py          # Script to re-train and evaluate ML models
└── import_user_dataset.py   # Script to import dataset & regenerate models
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.11)
- **Node.js**: 18+ and npm (tested on Node 22)
- **Git**

---

### 1. Backend Setup & Run

1. Open a terminal in the project root:
   ```bash
   cd Construction-1
   ```

2. Create and activate a Python virtual environment:
   - **Windows**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. *(Optional)* The repository already includes a pre-seeded `construction_intelligence.db`. If you ever want to rebuild or re-train from scratch:
   ```bash
   python seed_data.py
   python train_models.py
   ```

5. Run the FastAPI backend server:
   ```bash
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

   - **Backend API**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
   - **Interactive OpenAPI Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 2. Frontend Setup & Run

1. In a separate terminal, navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   - **Web UI**: [http://localhost:5173/](http://localhost:5173/)

---

### 3. Running Automated Tests

Run the comprehensive backend test suite:
```bash
pytest
```
Expected output: `27 passed` across CPM scheduling, ML prediction, Geotechnical Intelligence, and external API key integration test suites.

---

## 🔒 Geotechnical Intelligence External API (v1)

A dedicated, cryptographically hashed API-key secured namespace under `/api/v1/geotechnical/` for external construction systems (e.g., Construction ERPs, PMIS, Civil engineering software).

### Authentication
Send your provisioned API key in the `Authorization` header:
```http
Authorization: Bearer geo_live_xxxxxxxxxxxxxxxxxxxxxxxxx
```
or via the `X-API-Key` header:
```http
X-API-Key: geo_live_xxxxxxxxxxxxxxxxxxxxxxxxx
```

### Security Features
- **SHA-256 Hashing**: Plaintext keys are never stored in the database.
- **Granular Scopes**: `geotechnical:upload`, `geotechnical:read`, `geotechnical:analyze`, `geotechnical:alerts`, `geotechnical:recommendations`, `geotechnical:admin`.
- **Perimeter Boundary Isolation**: External API keys are strictly confined to `/api/v1/geotechnical/*` and cannot access internal platform modules (`/civil`, `/electrical`, `/admin`, `/users`).
- **Multi-Tenant Isolation**: Complete isolation of reports and data across client tenants.
- **Rate Limiting & Audit Logging**: Sliding 60-second window rate limiting with full request audit logging.

### Endpoints Summary

| Method | Endpoint | Required Scope | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/geotechnical/reports/upload` | `geotechnical:upload` | Upload PDF/DOCX/TXT/XLSX report with automated parsing & unique ID generation. |
| `GET` | `/api/v1/geotechnical/reports/{report_id}` | `geotechnical:read` | Overview with boreholes count, depths, soil summary & alerts. |
| `GET` | `/api/v1/geotechnical/reports/{report_id}/boreholes` | `geotechnical:read` | Deep borehole exploration logs, coordinates, and SPT profiles. |
| `GET` | `/api/v1/geotechnical/reports/{report_id}/soil-profile` | `geotechnical:read` | USCS strata layers, N-values, RQD, UCS, and laboratory results. |
| `GET` | `/api/v1/geotechnical/reports/{report_id}/alerts` | `geotechnical:alerts` | Geotechnical hazard alerts (groundwater, liquefaction, rock hardness). |
| `GET` | `/api/v1/geotechnical/reports/{report_id}/foundation-recommendations` | `geotechnical:recommendations` | Raft vs. Pile recommendations, SBC (kPa), settlement criteria, IS codes. |
| `POST` | `/api/v1/geotechnical/reports/{report_id}/analyze` | `geotechnical:analyze` | Trigger AI/ML risk computation and excavation fleet sizing. |
| `GET` | `/api/v1/geotechnical/reports/{report_id}/analysis` | `geotechnical:read` | Full engineering analysis report and mitigation plan. |
| `POST` | `/api/v1/geotechnical/keys` | `geotechnical:admin` | Provision a new external client API key. |
| `GET` | `/api/v1/geotechnical/keys` | `geotechnical:admin` | List client API keys (masked, secrets never returned). |
| `POST` | `/api/v1/geotechnical/keys/{key_id}/rotate` | `geotechnical:admin` | Rotate an existing API key and revoke the previous one. |
| `POST` | `/api/v1/geotechnical/keys/{key_id}/revoke` | `geotechnical:admin` | Immediately revoke an API key. |
| `GET` | `/api/v1/geotechnical/audit-logs` | `geotechnical:read` | Query request audit history for the authenticated tenant. |

---

## 👥 Default Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@construction.ai` | `admin123` |
| **Project Manager** | `pm@construction.ai` | `pm123` |
| **Site Manager** | `sm@construction.ai` | `sm123` |
| **Lead Engineer** | `eng@construction.ai` | `eng123` |

### Pre-provisioned Demo Geotechnical API Key
- **Client**: Construction ERP
- **Tenant ID**: `tenant_erp_01`
- **Key Prefix**: `geo_live_C3eV...7HTw`
- **Scopes**: `geotechnical:upload`, `geotechnical:read`, `geotechnical:analyze`, `geotechnical:alerts`, `geotechnical:recommendations`, `geotechnical:admin`

---

## 📄 License
This project is proprietary and confidential. All rights reserved.

