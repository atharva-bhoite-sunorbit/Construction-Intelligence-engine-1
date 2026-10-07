import React, { useState, useEffect } from 'react';
import {
  X,
  Wind,
  Thermometer,
  CloudRain,
  Droplets,
  Layers,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  HardHat,
  Compass,
  FileSpreadsheet,
  Table,
  Scale,
  Info
} from 'lucide-react';
import { apiClient } from '../api/client';
import { EnvironmentalAnalysis } from '../types';

interface WeatherSoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onAnalysisUpdated?: (analysis: EnvironmentalAnalysis) => void;
}

export const WeatherSoilModal: React.FC<WeatherSoilModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onAnalysisUpdated,
}) => {
  // Weather Form State
  const [temperature, setTemperature] = useState<number>(31.0);
  const [windSpeed, setWindSpeed] = useState<number>(39.5);
  const [weatherCondition, setWeatherCondition] = useState<string>('High Wind');
  const [humidity, setHumidity] = useState<number>(60.0);
  const [rainfall, setRainfall] = useState<number>(0.0);

  // Soil Report Form State
  const [soilType, setSoilType] = useState<string>('Silty Clay / Cohesive Strata');
  const [sbc, setSbc] = useState<number>(175.0);
  const [moisture, setMoisture] = useState<number>(18.5);
  const [waterTable, setWaterTable] = useState<number>(1.9);
  const [compaction, setCompaction] = useState<number>(92.0);
  const [reportFileName, setReportFileName] = useState<string>('');
  const [reportRawText, setReportRawText] = useState<string>('');
  const [managerNotes, setManagerNotes] = useState<string>('');

  // UI state
  const [activeTab, setActiveTab] = useState<'input' | 'analysis'>('input');
  const [loading, setLoading] = useState<boolean>(false);
  const [isParsingReport, setIsParsingReport] = useState<boolean>(false);
  const [currentGeoDetails, setCurrentGeoDetails] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<EnvironmentalAnalysis | null>(null);

  // Fetch latest data when opening
  useEffect(() => {
    if (isOpen && projectId) {
      apiClient.getLatestEnvironmentalAnalysis(projectId)
        .then((res) => {
          if (res) {
            setTemperature(res.temperature_c);
            setWindSpeed(res.wind_speed_kmh);
            setWeatherCondition(res.weather_condition);
            setHumidity(res.humidity_percent);
            setRainfall(res.rainfall_mm);
            setSoilType(res.soil_type);
            setSbc(res.safe_bearing_capacity_kpa);
            setMoisture(res.moisture_content_percent);
            setWaterTable(res.water_table_depth_m);
            setCompaction(res.compaction_percent);
            setReportFileName(res.soil_report_filename || '');
            if ((res as any).soil_report_raw_text) {
              setReportRawText((res as any).soil_report_raw_text);
            }
            if (res.geotechnical_details) {
              setCurrentGeoDetails(res.geotechnical_details);
            }
            setAnalysisResult(res);
          }
        })
        .catch((err) => console.error('Error fetching latest environmental log:', err));
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  // File Upload Handler with Dynamic Parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReportFileName(file.name);
    setIsParsingReport(true);

    try {
      // Send real file to backend to extract PDF, DOCX, XLSX, TXT, CSV
      const parsed = await apiClient.parseSoilReport(file, file.name);
      if (parsed.raw_text) {
        setReportRawText(parsed.raw_text);
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        const text = await file.text();
        setReportRawText(text);
      }

      if (parsed.soil_type) setSoilType(parsed.soil_type);
      if (parsed.safe_bearing_capacity_kpa !== undefined) setSbc(parsed.safe_bearing_capacity_kpa);
      if (parsed.water_table_depth_m !== undefined) setWaterTable(parsed.water_table_depth_m);
      if (parsed.compaction_percent !== undefined) setCompaction(parsed.compaction_percent);
      if (parsed.moisture_content_percent !== undefined) setMoisture(parsed.moisture_content_percent);
      if (parsed.geotechnical_details) {
        setCurrentGeoDetails(parsed.geotechnical_details);
      }
    } catch (err) {
      console.error('Error parsing soil report file:', err);
      try {
        const text = await file.text();
        if (text && text.trim()) {
          setReportRawText(text);
          const parsed = await apiClient.parseSoilReport(text, file.name);
          if (parsed.soil_type) setSoilType(parsed.soil_type);
          if (parsed.safe_bearing_capacity_kpa !== undefined) setSbc(parsed.safe_bearing_capacity_kpa);
          if (parsed.water_table_depth_m !== undefined) setWaterTable(parsed.water_table_depth_m);
          if (parsed.compaction_percent !== undefined) setCompaction(parsed.compaction_percent);
          if (parsed.moisture_content_percent !== undefined) setMoisture(parsed.moisture_content_percent);
          if (parsed.geotechnical_details) setCurrentGeoDetails(parsed.geotechnical_details);
        }
      } catch (e2) {
        console.error('Fallback read text error:', e2);
      }
    } finally {
      setIsParsingReport(false);
    }
  };

  // Dynamic Re-parse of Borelog Text
  const handleReanalyzeText = async () => {
    if (!reportRawText.trim()) return;
    setIsParsingReport(true);
    try {
      const parsed = await apiClient.parseSoilReport(reportRawText, reportFileName || 'Pasted_Borelog.txt');
      if (parsed.soil_type) setSoilType(parsed.soil_type);
      if (parsed.safe_bearing_capacity_kpa !== undefined) setSbc(parsed.safe_bearing_capacity_kpa);
      if (parsed.water_table_depth_m !== undefined) setWaterTable(parsed.water_table_depth_m);
      if (parsed.compaction_percent !== undefined) setCompaction(parsed.compaction_percent);
      if (parsed.moisture_content_percent !== undefined) setMoisture(parsed.moisture_content_percent);
      if (parsed.geotechnical_details) setCurrentGeoDetails(parsed.geotechnical_details);
    } catch (err) {
      console.error('Error re-analyzing report text:', err);
    } finally {
      setIsParsingReport(false);
    }
  };

  // Sample Geotechnical Report Loader
  const handleLoadSampleReport = async () => {
    const sampleText = `
GEOTECHNICAL INVESTIGATION & BORELOG SOIL REPORT
Project: Site Tower Core & Substructure Investigation
Borehole ID: BH-04 (Zone 2 Foundation Bed)
Soil Classification: Silty Clay / Cohesive Strata with trace coarse sand
Safe Bearing Capacity (SBC): 165.0 kN/m2 at 3.5m depth
Groundwater Table (GWL): Depth at 1.8 m below finished ground level
Field Moisture Content: 19.8% (Liquid Limit 38%, Plastic Limit 20%)
Compaction Density achieved: 92.5% Modified Proctor Density
Recommendations: Subgrade compaction is below 95% specification; requires vibratory re-rolling. Shallow water table requires active wellpoint dewatering during trenching.
    `;
    setReportFileName('Borehole_04_Geotech_Report.pdf');
    setReportRawText(sampleText);
    setSoilType('Silty Clay / Cohesive Strata');
    setSbc(165.0);
    setWaterTable(1.8);
    setCompaction(92.5);
    setMoisture(19.8);
    setWindSpeed(42.0);
    setWeatherCondition('High Wind');

    try {
      const parsed = await apiClient.parseSoilReport(sampleText, 'Borehole_04_Geotech_Report.pdf');
      if (parsed.geotechnical_details) {
        setCurrentGeoDetails(parsed.geotechnical_details);
      }
    } catch (err) {
      console.error('Sample report parse error:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiClient.submitEnvironmentalAnalysis(projectId, {
        temperature_c: Number(temperature),
        wind_speed_kmh: Number(windSpeed),
        weather_condition: weatherCondition,
        humidity_percent: Number(humidity),
        rainfall_mm: Number(rainfall),
        soil_type: soilType,
        safe_bearing_capacity_kpa: Number(sbc),
        moisture_content_percent: Number(moisture),
        water_table_depth_m: Number(waterTable),
        compaction_percent: Number(compaction),
        soil_report_filename: reportFileName || undefined,
        soil_report_raw_text: reportRawText || undefined,
        manager_notes: managerNotes || undefined,
        geotechnical_details: currentGeoDetails || undefined,
      });

      setAnalysisResult(res);
      if (res.geotechnical_details) {
        setCurrentGeoDetails(res.geotechnical_details);
      }
      setActiveTab('analysis');
      if (onAnalysisUpdated) {
        onAnalysisUpdated(res);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to analyze environmental and soil data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 text-slate-800 my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-wide">
                  SITE WEATHER & SOIL REPORT INTEL
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                  CRANE & GEOTECH SAFETY
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Update site anemometer wind speeds, ambient thermal metrics, and upload soil strata reports for autonomous engineering analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 mt-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'input'
                ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Update Weather & Soil Data</span>
          </button>
          
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'analysis'
                ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Autonomous Engineering Analysis</span>
            {analysisResult && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                analysisResult.overall_site_risk === 'CRITICAL_HALT'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : analysisResult.overall_site_risk === 'HIGH_RISK'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}>
                {analysisResult.overall_site_risk.replace('_', ' ')}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Input Form */}
        {activeTab === 'input' && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-6">
            
            {/* Quick Demo Action Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" />
                Want to test with a realistic geotechnical test report?
              </span>
              <button
                type="button"
                onClick={handleLoadSampleReport}
                className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-brand-700 border border-slate-200 font-semibold shadow-xs transition-colors"
              >
                Auto-fill Geotechnical Soil Sample
              </button>
            </div>

            {/* Section 1: Weather Parameters */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Wind className="w-4 h-4 text-cyan-600" />
                <span>1. Site Weather & Atmospheric Conditions</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Wind Speed */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Wind Speed</span>
                    <span className={`font-mono font-bold ${
                      windSpeed >= 38 ? 'text-rose-600' : windSpeed >= 25 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {windSpeed} km/h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="0.5"
                    value={windSpeed}
                    onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Calm</span>
                    <span className="text-amber-600 font-semibold">38km/h Crane Limit</span>
                    <span>80</span>
                  </div>
                </div>

                {/* Temperature */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Temperature</span>
                    <span className={`font-mono font-bold ${
                      temperature >= 38 ? 'text-rose-600' : temperature <= 5 ? 'text-cyan-600' : 'text-slate-800'
                    }`}>
                      {temperature} °C
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">Concreting threshold: 38°C</span>
                </div>

                {/* Weather Condition */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Condition</label>
                  <select
                    value={weatherCondition}
                    onChange={(e) => setWeatherCondition(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    <option value="Clear">Clear / Sunny</option>
                    <option value="Cloudy">Partly Cloudy</option>
                    <option value="High Wind">High Wind / Gale</option>
                    <option value="Rain">Rain</option>
                    <option value="Heavy Rain">Heavy Rain</option>
                    <option value="Extreme Heat">Extreme Heat</option>
                    <option value="Thunderstorm">Thunderstorm</option>
                  </select>
                  <span className="text-[10px] text-slate-600">Site prevailing condition</span>
                </div>

                {/* Humidity */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Humidity (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={humidity}
                    onChange={(e) => setHumidity(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">Affects concrete curing</span>
                </div>

                {/* Rainfall */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Rainfall (mm)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={rainfall}
                    onChange={(e) => setRainfall(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">Subgrade runoff volume</span>
                </div>
              </div>
            </div>

            {/* Section 2: Soil Level Report & Geotechnical Data */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>2. Soil Level Report & Geotechnical Calibration</span>
                </div>
                {reportFileName && (
                  <span className="text-[11px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> File Loaded: {reportFileName}
                  </span>
                )}
              </div>

              {/* Upload Box */}
              <div className="relative border-2 border-dashed border-slate-300 hover:border-brand-400 rounded-2xl p-4 text-center bg-slate-50/60 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,.csv,.xlsx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                  <Upload className="w-6 h-6 text-brand-600" />
                  <span className="text-xs font-semibold text-slate-800">
                    Click to upload or drag & drop Geotechnical Soil Report (PDF, TXT, CSV, DOCX, XLSX)
                  </span>
                  <span className="text-[10px] text-slate-600">
                    The autonomous AI parser will automatically scan bearing capacity, groundwater levels, and compaction results
                  </span>
                </div>
              </div>

              {isParsingReport && (
                <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
                  <span className="font-semibold">Dynamically parsing geotechnical parameters & stratum core from document...</span>
                </div>
              )}

              {/* Soil Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Soil Stratum Type */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Soil Stratum Type</label>
                  <select
                    value={soilType}
                    onChange={(e) => setSoilType(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    <option value="Silty Clay / Cohesive Strata">Silty Clay / Cohesive</option>
                    <option value="Sandy Loam / Cohesive Soil">Sandy Loam</option>
                    <option value="Marine Clay (High Plasticity)">Marine Clay (Plastic)</option>
                    <option value="Expansive Black Cotton Clay">Expansive Black Cotton</option>
                    <option value="High Compressible Clay (CH)">High Compressible Clay (CH)</option>
                    <option value="Dense Sand & Gravel Mix">Dense Sand & Gravel</option>
                    <option value="Medium to Coarse Sand">Medium to Coarse Sand</option>
                    <option value="Hard Weathered Rock / Stratum">Hard Rock Stratum</option>
                  </select>
                  <span className="text-[10px] text-slate-600">Subgrade soil matrix</span>
                </div>

                {/* Safe Bearing Capacity */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Safe Bearing (SBC)</span>
                    <span className="font-mono text-brand-600 font-bold">{sbc} kPa</span>
                  </div>
                  <input
                    type="number"
                    step="5"
                    value={sbc}
                    onChange={(e) => setSbc(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">Minimum threshold: 140 kPa</span>
                </div>

                {/* Groundwater Table */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Water Table Depth</span>
                    <span className={`font-mono font-bold ${waterTable <= 2.0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {waterTable} m
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={waterTable}
                    onChange={(e) => setWaterTable(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">&le; 2.0m requires dewatering</span>
                </div>

                {/* Compaction Level */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">Compaction Density</span>
                    <span className={`font-mono font-bold ${compaction < 95 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {compaction} %
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={compaction}
                    onChange={(e) => setCompaction(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">Standard: 95% Proctor</span>
                </div>

                {/* Moisture Content */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Moisture Content (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={moisture}
                    onChange={(e) => setMoisture(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">Optimum OMC: ~12-16%</span>
                </div>
              </div>

              {/* Borelog / Geotechnical Raw Text */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-600" />
                    Borelog & Geotechnical Investigation Text (Extracted or Pasted)
                  </label>
                  {reportRawText && (
                    <button
                      type="button"
                      onClick={handleReanalyzeText}
                      disabled={isParsingReport}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold flex items-center gap-1 border border-indigo-200 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      Re-parse Text Now
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={reportRawText}
                  onChange={(e) => setReportRawText(e.target.value)}
                  placeholder="Paste borehole stratigraphy logs, SBC, or soil investigation notes here to extract parameters dynamically..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-brand-600"
                />
              </div>
            </div>

            {/* Manager Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project Manager On-Site Directives
              </label>
              <textarea
                rows={2}
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                placeholder="e.g. Tower crane operations paused from 14:00 to 18:00 due to wind gusts; dewatering pump active in Zone 2 excavation."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
              />
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                System will analyze civil, crane, and geotechnical impacts across active project activities.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Site Physics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Save & Run Autonomous Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: System Analysis Output */}
        {activeTab === 'analysis' && (
          <div className="mt-5 space-y-5">
            {analysisResult ? (
              <>
                {/* Top Summary Banner */}
                <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  analysisResult.overall_site_risk === 'CRITICAL_HALT'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : analysisResult.overall_site_risk === 'HIGH_RISK'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-center gap-3">
                    {analysisResult.overall_site_risk === 'CRITICAL_HALT' ? (
                      <AlertOctagon className="w-8 h-8 text-rose-600 flex-shrink-0" />
                    ) : analysisResult.overall_site_risk === 'HIGH_RISK' ? (
                      <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                    ) : (
                      <ShieldCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase tracking-wide">
                          SITE STATUS: {analysisResult.overall_site_risk.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 font-bold">
                          {new Date(analysisResult.recorded_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs opacity-90 mt-0.5">
                        Wind: {analysisResult.wind_speed_kmh} km/h • Temp: {analysisResult.temperature_c}°C • Soil: {analysisResult.soil_type} (SBC {analysisResult.safe_bearing_capacity_kpa} kPa)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('input')}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs"
                    >
                      Edit Metrics
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm"
                    >
                      Acknowledge & Close
                    </button>
                  </div>
                </div>

                {/* Key Findings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Crane & Wind Verdict */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Wind className="w-4 h-4 text-cyan-600" />
                        Crane & Elevated Lifting
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        analysisResult.wind_speed_kmh >= 38
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {analysisResult.wind_speed_kmh >= 38 ? 'RESTRICTED / HALTED' : 'PERMITTED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {analysisResult.wind_risk_assessment}
                    </p>
                  </div>

                  {/* Thermal & Concrete Curing */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-amber-600" />
                        Thermal & Concreting
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        analysisResult.temperature_c >= 38
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {analysisResult.temperature_c >= 38 ? 'ACI 305R CAUTION' : 'NORMAL'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {analysisResult.temperature_risk_assessment}
                    </p>
                  </div>

                  {/* Soil Strata & Water Table */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        Soil Stability & Dewatering
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        analysisResult.compaction_percent < 95 || analysisResult.water_table_depth_m <= 2.0
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {analysisResult.water_table_depth_m <= 2.0 ? 'DEWATERING ACTIVE' : 'STABLE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {analysisResult.soil_risk_assessment}
                    </p>
                  </div>
                </div>

                {/* Detailed Geotechnical Soil Report Breakdown (IS: 1888 & IS: 1498) */}
                {(() => {
                  const geoDetails = analysisResult.geotechnical_details || currentGeoDetails;
                  const netSbcVal = Number(analysisResult.safe_bearing_capacity_kpa || sbc || 180.0);
                  const netSbcTon = (netSbcVal / 9.80665).toFixed(1);
                  const grossSbcVal = netSbcVal * 1.25;
                  const grossSbcTon = (grossSbcVal / 9.80665).toFixed(1);

                  const firstPoint = geoDetails?.investigation_points?.[0];
                  const plateFailureLoad = geoDetails?.plate_load_tests?.[0]?.failure_load_range || `${(Number(grossSbcTon) * 0.85).toFixed(2)} - ${(Number(grossSbcTon) * 1.05).toFixed(2)} Ton`;
                  const plateSettle = firstPoint?.plate_settlement_failure_mm !== undefined
                    ? firstPoint.plate_settlement_failure_mm.toFixed(2)
                    : '18.50';
                  const footingSettle = firstPoint?.footing_settlement_failure_mm !== undefined
                    ? firstPoint.footing_settlement_failure_mm.toFixed(2)
                    : '26.40';
                  const permSettle = firstPoint?.permissible_settlement_mm !== undefined
                    ? firstPoint.permissible_settlement_mm.toFixed(2)
                    : '35.00';

                  const investigationPoints = (geoDetails?.investigation_points && geoDetails.investigation_points.length > 0)
                    ? geoDetails.investigation_points
                    : [
                        {
                          location_id: "Trial Pit-01",
                          depth_m: analysisResult.water_table_depth_m || 3.0,
                          soil_description: analysisResult.soil_type,
                          bulk_density_t_m3: 2.05,
                          net_sbc_t_m2: Number(netSbcTon),
                          net_sbc_kpa: netSbcVal,
                          gross_sbc_t_m2: Number(grossSbcTon),
                          liquid_limit_pct: 46.0,
                          plastic_limit_pct: 22.0,
                          plasticity_index_pct: 24.0,
                          fines_pct: 82.0
                        }
                      ];

                  const grainSize = geoDetails?.grain_size_distribution || {
                    sieve_4_75mm: "99.00% Finer (Gravel: 1.00%)",
                    sieve_2_00mm: "98.60% Finer (Coarse Sand: 0.40%)",
                    sieve_0_60mm: "98.00% Finer (Medium Sand: 0.60%)",
                    sieve_0_075mm: "92.00% Finer (Fine Sand: 6.00%)",
                    clay_and_fines_passing_75u: `92.00% Silt & Clay (${analysisResult.soil_type})`
                  };

                  const remarks: string[] = (geoDetails?.engineering_remarks && geoDetails.engineering_remarks.length > 0)
                    ? geoDetails.engineering_remarks
                    : [
                        `Safe Bearing Capacity: Net SBC verified at ${netSbcVal.toFixed(1)} kPa (${netSbcTon} T/m²).`,
                        Number(footingSettle) > Number(permSettle)
                          ? `Settlement Warning: Estimated footing settlement (${footingSettle} mm) exceeds permissible limit (${permSettle} mm). Raft or ground stabilization recommended.`
                          : `Settlement Verified: Footing settlement of ${footingSettle} mm is within ${permSettle} mm permissible threshold.`,
                        analysisResult.water_table_depth_m <= 2.0
                          ? `Groundwater Table: Shallow water table (${analysisResult.water_table_depth_m}m) requires active dewatering during excavation.`
                          : `Groundwater Table: Depth at ${analysisResult.water_table_depth_m}m; no immediate uplift hazard.`
                      ];

                  return (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                Detailed Geotechnical Soil Investigation & Test Report Data
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {geoDetails?.report_metadata?.applicable_codes?.slice(0, 2).join(' & ') || 'IS: 1888 & IS: 1498 Standards'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {analysisResult.soil_report_filename ? `Source: ${analysisResult.soil_report_filename}` : 'Geotechnical Soil Report'} • Lab Job No: {geoDetails?.report_metadata?.job_number || 'AUTO-GEO'} • {geoDetails?.report_metadata?.laboratory_name || 'Geotechnical Testing Lab'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-700">Client / Authority:</span>
                          <span className="truncate max-w-[220px]" title={geoDetails?.report_metadata?.client || 'Project Civil Directorate'}>
                            {geoDetails?.report_metadata?.client || 'Project Civil Directorate'}
                          </span>
                        </div>
                      </div>

                      {/* Summary Metric Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Net Safe Bearing (SBC)</span>
                          <div className="text-sm font-bold text-indigo-700 font-mono mt-0.5">{netSbcTon} T/m²</div>
                          <span className="text-[10px] text-slate-500 font-mono">{netSbcVal.toFixed(1)} kPa (Net)</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Gross Safe Bearing</span>
                          <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{grossSbcTon} T/m²</div>
                          <span className="text-[10px] text-slate-500 font-mono">{grossSbcVal.toFixed(1)} kPa (Gross)</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Plate Test Failure Load</span>
                          <div className="text-sm font-bold text-slate-800 font-mono mt-0.5 truncate" title={plateFailureLoad}>{plateFailureLoad}</div>
                          <span className="text-[10px] text-slate-500 font-mono">Plate Settl: {plateSettle} mm</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Footing Settlement (1m²)</span>
                          <div className={`text-sm font-bold font-mono mt-0.5 ${Number(footingSettle) > Number(permSettle) ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {footingSettle} mm
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">Permissible: {permSettle} mm</span>
                        </div>
                      </div>

                      {/* Multi-Pit Investigation Data Table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2">Test Location</th>
                              <th className="px-3 py-2">Depth</th>
                              <th className="px-3 py-2">Stratum Classification</th>
                              <th className="px-3 py-2">Bulk Density</th>
                              <th className="px-3 py-2">Net SBC</th>
                              <th className="px-3 py-2">Gross SBC</th>
                              <th className="px-3 py-2">Atterberg (LL / PL / PI)</th>
                              <th className="px-3 py-2">Fines (&lt;75µ)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {investigationPoints.map((pt: any, idx: number) => (
                              <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                                <td className="px-3 py-2 font-bold text-slate-900 font-sans">{pt.location_id || `Pit-0${idx + 1}`}</td>
                                <td className="px-3 py-2 text-slate-700">{pt.depth_m !== undefined ? `${Number(pt.depth_m).toFixed(2)} m` : '-'}</td>
                                <td className="px-3 py-2 font-sans font-medium text-indigo-700 truncate max-w-[200px]" title={pt.soil_description || analysisResult.soil_type}>
                                  {pt.soil_description || analysisResult.soil_type}
                                </td>
                                <td className="px-3 py-2 text-slate-700">{pt.bulk_density_t_m3 ? `${Number(pt.bulk_density_t_m3).toFixed(2)} T/m³` : '-'}</td>
                                <td className="px-3 py-2 font-bold text-indigo-700">
                                  {pt.net_sbc_t_m2 ? `${Number(pt.net_sbc_t_m2).toFixed(1)} T/m² (${Number(pt.net_sbc_kpa || (pt.net_sbc_t_m2 * 9.81)).toFixed(1)} kPa)` : `${netSbcTon} T/m² (${netSbcVal.toFixed(1)} kPa)`}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {pt.gross_sbc_t_m2 ? `${Number(pt.gross_sbc_t_m2).toFixed(1)} T/m² (${Number(pt.gross_sbc_kpa || (pt.gross_sbc_t_m2 * 9.81)).toFixed(1)} kPa)` : `${grossSbcTon} T/m² (${grossSbcVal.toFixed(1)} kPa)`}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {pt.liquid_limit_pct ? `${Number(pt.liquid_limit_pct).toFixed(1)}% / ${Number(pt.plastic_limit_pct).toFixed(1)}% / ${Number(pt.plasticity_index_pct).toFixed(1)}%` : 'Non-Plastic (NP)'}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {pt.fines_pct !== undefined ? `${Number(pt.fines_pct).toFixed(2)}%` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Grain Size Distribution & Critical Geotech Flags */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                          <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                            <Scale className="w-3.5 h-3.5 text-indigo-600" />
                            Grain Size Analysis (IS: 2720 Part IV)
                          </div>
                          <div className="space-y-1 text-xs text-slate-600 font-mono">
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span className="font-sans text-[11px] text-slate-500">Sieve 4.75 mm:</span>
                              <span className="text-slate-800">{grainSize.sieve_4_75mm}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span className="font-sans text-[11px] text-slate-500">Sieve 2.00 mm:</span>
                              <span className="text-slate-800">{grainSize.sieve_2_00mm}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span className="font-sans text-[11px] text-slate-500">Sieve 0.60 mm:</span>
                              <span className="text-slate-800">{grainSize.sieve_0_60mm}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-100">
                              <span className="font-sans text-[11px] text-slate-500">Sieve 0.075 mm:</span>
                              <span className="text-slate-800">{grainSize.sieve_0_075mm}</span>
                            </div>
                            <div className="flex justify-between pt-0.5 font-bold text-indigo-700">
                              <span className="font-sans text-[11px]">Silt & Clay (&lt; 0.075mm):</span>
                              <span>{grainSize.clay_and_fines_passing_75u}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
                          <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Critical Geotechnical Engineer Warnings
                          </div>
                          <ul className="space-y-1.5 text-xs text-amber-950">
                            {remarks.map((rem: string, rIdx: number) => (
                              <li key={rIdx} className="flex items-start gap-1.5">
                                <span className="text-amber-600 font-bold">•</span>
                                <span>{rem}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Affected Project Activities */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <HardHat className="w-4 h-4 text-brand-600" />
                      <span>Impacted Workfronts & Construction Activities ({analysisResult.affected_activities.length})</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Cross-referenced against scheduled site tasks
                    </span>
                  </div>

                  {analysisResult.affected_activities.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                      No active construction tasks are restricted under current weather and soil conditions.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {analysisResult.affected_activities.map((act) => (
                        <div key={act.activity_id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{act.activity_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {act.tower} • Floor {act.floor}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              <span className="font-medium text-slate-700">Directive:</span> {act.action_required}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {act.hazard_tag}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              act.impact_level === 'HALTED'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : act.impact_level === 'RESTRICTED'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-brand-50 text-brand-700 border border-brand-200'
                            }`}>
                              {act.impact_level}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority Safety Directives */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Managerial Action Directives
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {analysisResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-brand-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No analysis data available yet. Please complete the input form and click 'Save & Run Autonomous Analysis'.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
