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

Run the backend test suite:
```bash
pytest
```
Expected output: `8 passed` across unit and integration tests.

---

## 👥 Default Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@construction.ai` | `admin123` |
| **Project Manager** | `pm@construction.ai` | `pm123` |
| **Site Manager** | `sm@construction.ai` | `sm123` |
| **Lead Engineer** | `eng@construction.ai` | `eng123` |

---

## 📄 License
This project is proprietary and confidential. All rights reserved.
