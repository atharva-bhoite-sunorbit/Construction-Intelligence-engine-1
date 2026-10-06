import json
import os
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, mean_absolute_error, root_mean_squared_error, r2_score
from sqlalchemy.orm import Session
from backend.app.ml.feature_engineering import FEATURE_COLUMNS
from backend.app.ml.model_registry import ModelRegistryService
from backend.app.models.all_models import ModelRegistry

class MLTrainingPipeline:
    @staticmethod
    def generate_synthetic_historical_dataset(num_samples: int = 1200) -> pd.DataFrame:
        """
        Synthesizes a realistic historical construction dataset based on empirical construction benchmarks.
        Provides realistic variations across floor height, labor shortages, materials, and weather.
        """
        np.random.seed(42)

        c_types = np.random.randint(0, 10, num_samples)
        phases = np.random.randint(0, 7, num_samples)
        floors = np.random.randint(0, 35, num_samples)
        quantities = np.random.exponential(scale=200, size=num_samples) + 10
        planned_durations = np.random.randint(2, 30, num_samples)
        workers_avail = np.random.randint(4, 30, num_samples)
        workers_assigned = np.clip(workers_avail - np.random.randint(0, 6, num_samples), 1, 30)
        labour_shortages = np.maximum(0, workers_avail - workers_assigned)
        working_hours = np.random.choice([8.0, 9.0, 10.0, 6.0], p=[0.7, 0.15, 0.1, 0.05], size=num_samples)
        mat_avail = np.random.uniform(50.0, 100.0, num_samples)
        eq_avail = np.random.uniform(60.0, 100.0, num_samples)
        open_blockers = np.random.choice([0, 1, 2, 3], p=[0.65, 0.2, 0.1, 0.05], size=num_samples)
        critical_flags = np.random.choice([0.0, 1.0], p=[0.7, 0.3], size=num_samples)
        weather_enc = np.random.choice([0, 1, 2, 3, 4], p=[0.6, 0.2, 0.1, 0.07, 0.03], size=num_samples)
        rem_quantities = quantities * np.random.uniform(0.1, 0.9, num_samples)
        pred_counts = np.random.randint(1, 4, num_samples)
        succ_counts = np.random.randint(1, 4, num_samples)

        # Baseline productivity
        base_prod = (quantities / np.maximum(1, planned_durations * workers_assigned)) * np.random.uniform(0.85, 1.15, num_samples)
        daily_prod = np.clip(base_prod * (mat_avail / 100.0) * (eq_avail / 100.0), 0.1, 100.0)
        cum_prod = daily_prod * np.random.uniform(0.9, 1.1, num_samples)
        prog_var = (daily_prod - base_prod) / np.maximum(0.1, base_prod) * 100.0

        # Delay probability formula
        risk_score = (
            (labour_shortages * 0.12)
            + ((100.0 - mat_avail) * 0.008)
            + (open_blockers * 0.25)
            + (weather_enc * 0.08)
            + (floors * 0.005)
            - (prog_var * 0.01)
        )
        delay_prob = 1.0 / (1.0 + np.exp(-risk_score + 1.2))
        delay_flag = (delay_prob > 0.5).astype(int)

        # Actual duration target
        actual_durations = np.maximum(1.0, planned_durations * (1.0 + np.maximum(-0.2, (delay_prob - 0.4) * 0.8)))

        # Required labour target
        required_labour_target = np.clip(
            np.round((quantities / np.maximum(1, planned_durations * np.maximum(0.5, daily_prod))) * (1.0 + floors * 0.01)),
            2, 50
        ).astype(int)

        data = {
            "c_type_encoded": c_types,
            "phase_encoded": phases,
            "floor": floors,
            "quantity": quantities,
            "planned_duration": planned_durations,
            "workers_available": workers_avail,
            "workers_assigned": workers_assigned,
            "labour_shortage": labour_shortages,
            "working_hours": working_hours,
            "material_availability_pct": mat_avail,
            "equipment_availability_pct": eq_avail,
            "daily_productivity": daily_prod,
            "cumulative_productivity": cum_prod,
            "progress_variance_pct": prog_var,
            "open_blockers_count": open_blockers,
            "critical_path_flag": critical_flags,
            "weather_encoded": weather_enc,
            "remaining_quantity": rem_quantities,
            "predecessor_count": pred_counts,
            "successor_count": succ_counts,
            # Targets
            "target_delayed": delay_flag,
            "target_actual_duration": actual_durations,
            "target_productivity": daily_prod,
            "target_required_labour": required_labour_target
        }
        return pd.DataFrame(data)

    @classmethod
    def train_all_models(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """Trains candidate models, validates, registers, and serializes the best models."""
        df = cls.generate_synthetic_historical_dataset()
        X = df[FEATURE_COLUMNS].values

        results = {}

        # 1. DELAY PREDICTION CLASSIFICATION
        y_delay = df["target_delayed"].values
        X_train, X_test, y_train, y_test = train_test_split(X, y_delay, test_size=0.2, random_state=42, stratify=y_delay)

        clf_candidates = {
            "RandomForestClassifier": RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42),
            "GradientBoostingClassifier": GradientBoostingClassifier(n_estimators=80, max_depth=4, random_state=42),
            "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42)
        }

        best_delay_model = None
        best_f1 = -1.0
        delay_metrics = {}

        for name, clf in clf_candidates.items():
            clf.fit(X_train, y_train)
            preds = clf.predict(X_test)
            proba = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else preds
            f1 = f1_score(y_test, preds)
            acc = accuracy_score(y_test, preds)
            prec = precision_score(y_test, preds, zero_division=0)
            rec = recall_score(y_test, preds, zero_division=0)
            auc = roc_auc_score(y_test, proba)

            if f1 > best_f1:
                best_f1 = f1
                best_delay_model = clf
                delay_metrics = {
                    "model_type": name,
                    "accuracy": round(acc, 4),
                    "precision": round(prec, 4),
                    "recall": round(rec, 4),
                    "f1": round(f1, 4),
                    "roc_auc": round(auc, 4)
                }

        ModelRegistryService.save_model("delay_model", best_delay_model)
        results["delay_model"] = delay_metrics

        # 2. DURATION PREDICTION REGRESSION
        y_dur = df["target_actual_duration"].values
        X_train, X_test, y_train, y_test = train_test_split(X, y_dur, test_size=0.2, random_state=42)

        reg_candidates = {
            "GradientBoostingRegressor": GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=42),
            "RandomForestRegressor": RandomForestRegressor(n_estimators=80, max_depth=6, random_state=42),
            "LinearRegression": LinearRegression()
        }

        best_dur_model = None
        best_r2 = -float("inf")
        dur_metrics = {}

        for name, reg in reg_candidates.items():
            reg.fit(X_train, y_train)
            preds = reg.predict(X_test)
            r2 = r2_score(y_test, preds)
            mae = mean_absolute_error(y_test, preds)
            rmse = root_mean_squared_error(y_test, preds)

            if r2 > best_r2:
                best_r2 = r2
                best_dur_model = reg
                dur_metrics = {
                    "model_type": name,
                    "r2": round(r2, 4),
                    "mae": round(mae, 4),
                    "rmse": round(rmse, 4)
                }

        ModelRegistryService.save_model("duration_model", best_dur_model)
        results["duration_model"] = dur_metrics

        # 3. PRODUCTIVITY PREDICTION
        y_prod = df["target_productivity"].values
        X_train, X_test, y_train, y_test = train_test_split(X, y_prod, test_size=0.2, random_state=42)
        prod_reg = GradientBoostingRegressor(n_estimators=80, max_depth=4, random_state=42)
        prod_reg.fit(X_train, y_train)
        prod_preds = prod_reg.predict(X_test)
        prod_metrics = {
            "model_type": "GradientBoostingRegressor",
            "r2": round(r2_score(y_test, prod_preds), 4),
            "mae": round(mean_absolute_error(y_test, prod_preds), 4)
        }
        ModelRegistryService.save_model("productivity_model", prod_reg)
        results["productivity_model"] = prod_metrics

        # 4. LABOUR REQUIREMENT PREDICTION
        y_labour = df["target_required_labour"].values
        X_train, X_test, y_train, y_test = train_test_split(X, y_labour, test_size=0.2, random_state=42)
        labour_reg = RandomForestRegressor(n_estimators=80, max_depth=5, random_state=42)
        labour_reg.fit(X_train, y_train)
        labour_preds = labour_reg.predict(X_test)
        labour_metrics = {
            "model_type": "RandomForestRegressor",
            "r2": round(r2_score(y_test, labour_preds), 4),
            "mae": round(mean_absolute_error(y_test, labour_preds), 4)
        }
        ModelRegistryService.save_model("labour_model", labour_reg)
        results["labour_model"] = labour_metrics

        # Record in ModelRegistry table if db session passed
        if db:
            for mod_name, metrics in results.items():
                record = ModelRegistry(
                    model_name=mod_name,
                    version="v1.0",
                    model_type=metrics.get("model_type", "Standard"),
                    file_path=ModelRegistryService.get_model_path(mod_name),
                    metrics_json=json.dumps(metrics),
                    features_list_json=json.dumps(FEATURE_COLUMNS),
                    is_active=True
                )
                db.add(record)
            db.commit()

        return results
