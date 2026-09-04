import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Play,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface SimulatorLabModalProps {
  onClose: () => void;
  onRefreshData: () => void;
}

export const SimulatorLabModal: React.FC<SimulatorLabModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'SCENARIOS' | 'AUDIT_LOGS' | 'MARKET_HOURS'>('SCENARIOS');
  const [logs, setLogs] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const executeScenario = async (scenarioKey: string) => {
    setIsExecuting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/simulation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(data.message);
        onRefreshData();
        fetchAuditLogs();
      } else {
        setStatusMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMessage(`Failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleMarketSession = async (isOpen: boolean | null) => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/market/status/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: isOpen }),
      });
      if (res.ok) {
        setStatusMessage(
          isOpen === null
            ? 'Market session reset to real-time IST clock.'
            : isOpen
            ? 'Market set to OPEN session.'
            : 'Market set to CLOSED session.'
        );
        onRefreshData();
      }
    } catch (err: any) {
      setStatusMessage(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-[#1A1A1A] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00D09C]/20 text-[#00D09C] flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Reliability Lab & Market Simulator</h3>
              <p className="text-xs text-gray-400">
                Evaluate resilience, edge cases, multi-signal scoring, and race conditions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs in Editorial Style */}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-6 py-3">
          <button
            onClick={() => setActiveTab('SCENARIOS')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
              activeTab === 'SCENARIOS'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-200'
            }`}
          >
            Test Scenarios (5)
          </button>
          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
              activeTab === 'AUDIT_LOGS'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-200'
            }`}
          >
            Audit Logs ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('MARKET_HOURS')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
              activeTab === 'MARKET_HOURS'
                ? 'bg-[#1A1A1A] text-white shadow-xs'
                : 'text-gray-500 hover:text-black hover:bg-gray-200'
            }`}
          >
            Session Overrides
          </button>
        </div>

        {/* Status banner */}
        {statusMessage && (
          <div className="px-6 py-3 bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00D09C] shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 grow">
          {activeTab === 'SCENARIOS' && (
            <div className="space-y-4">
              {/* Section 11.1: 6% Price Jump */}
              <div className="p-4 rounded-2xl border-l-4 border-emerald-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Scenario 1
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Reliance +6.2% Price Surge</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Simulates a +6.2% price jump with confirming volume on RELIANCE.
                    <span className="block font-bold text-emerald-700 mt-0.5">
                      Expected Output: Significant Attention (~74/100), Price Action signal.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('PRICE_JUMP_6')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#00D09C] hover:bg-[#00b889] text-black rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Trigger +6% Jump
                </button>
              </div>

              {/* Section 11.2: 3x Volume Surge */}
              <div className="p-4 rounded-2xl border-l-4 border-amber-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Scenario 2
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">SBIN 3.2× Abnormal Volume Surge</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Simulates a 3.2× surge above 20-day average volume indicating block institutional accumulation.
                    <span className="block font-bold text-amber-800 mt-0.5">
                      Expected Output: Volume Anomaly tag and explanation bullet.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('VOLUME_SURGE_3X')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Trigger 3× Volume
                </button>
              </div>

              {/* Section 11.3: 200-DMA Breakout */}
              <div className="p-4 rounded-2xl border-l-4 border-blue-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Scenario 3
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">ICICI Bank 200-DMA Major Breakout</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Simulates price crossing above long-term 200-day moving average (₹1,240 to ₹1,285).
                    <span className="block font-bold text-blue-700 mt-0.5">
                      Expected Output: "Crossed above 200 DMA" technical trigger.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('DMA_200_BREAKOUT')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Trigger 200-DMA
                </button>
              </div>

              {/* Section 11.4: Approaching Earnings Event */}
              <div className="p-4 rounded-2xl border-l-4 border-indigo-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Scenario 4
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Approaching Earnings / Board Meeting</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Injects an upcoming Q3 Board Results announcement scheduled in 2 days for Reliance.
                    <span className="block font-bold text-indigo-700 mt-0.5">
                      Expected Output: Corporate action signal (+15 pts) and upcoming date badge.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('EARNINGS_APPROACHING')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Inject Earnings
                </button>
              </div>

              {/* Section 11.5: Out-of-Order Packet Injection */}
              <div className="p-4 rounded-2xl border-l-4 border-amber-600 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Scenario 5
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Out-of-Order Packet Ingestion (Race Condition)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Attempts to send a market tick with an older timestamp to simulate network jitter or delayed delivery.
                    <span className="block font-bold text-amber-800 mt-0.5">
                      Expected Output: Clean rejection; audit log recorded. Current price remains intact.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('OUT_OF_ORDER_TEST')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Test Rejection
                </button>
              </div>

              {/* Section 11.6: Multi-Provider Data Conflict */}
              <div className="p-4 rounded-2xl border-l-4 border-purple-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      Scenario 6
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Multi-Provider Data Feed Conflict</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Simulates a secondary market data feed reporting a price diverging &gt;1.5% from the primary feed.
                    <span className="block font-bold text-purple-800 mt-0.5">
                      Expected Output: Flags data_conflict=true, retains primary source, and records audit trail.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('DATA_CONFLICT_TEST')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Test Conflict Flag
                </button>
              </div>

              {/* Section 11.7: Illiquid Stock Scenario */}
              <div className="p-4 rounded-2xl border-l-4 border-gray-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">
                      Scenario 7
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Illiquid Trading Session (ITC)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Simulates low trading volume (0.15× normal) with wide spreads.
                    <span className="block font-bold text-gray-700 mt-0.5">
                      Expected Output: Does not falsely elevate attention score.
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('ILLIQUID_STOCK')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-gray-700 hover:bg-gray-800 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Simulate Illiquid
                </button>
              </div>

              {/* Section 11.8: First Visit Observation Test */}
              <div className="p-4 rounded-2xl border-l-4 border-cyan-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                      Scenario 8
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">First Visit Experience Test</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Clears last-seen state for Tata Motors to verify the Section 12 rule: "Never show misleading 0% change since last visit".
                    <span className="block font-bold text-cyan-800 mt-0.5">
                      Expected Output: "You're seeing this stock for the first time."
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('FIRST_VISIT_TEST')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-cyan-600 hover:bg-cyan-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Test First Visit
                </button>
              </div>

              {/* Section 11.9: Multi-Signal High Attention Shock */}
              <div className="p-4 rounded-2xl border-l-4 border-red-500 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                      Scenario 9
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Tata Motors Q3 Earnings Plunge (High Attention)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Simulates -6.2% decline, 2.8× volume surge, 50 DMA breach, and Q3 filing simultaneously.
                    <span className="block font-bold text-red-600 mt-0.5">
                      Expected Output: High Attention (Score 87/100).
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('TATA_PLUNGE')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Trigger Plunge
                </button>
              </div>

              {/* Reset Last-Seen Baseline */}
              <div className="p-4 rounded-2xl border-l-4 border-gray-400 border-t border-r border-b border-gray-200 bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">
                      Reset
                    </span>
                    <span className="font-black text-sm text-[#1A1A1A]">Reset User Last-Seen Baseline</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Rolls back user last-seen state by 4 hours to re-experience the change detection flow.
                  </p>
                </div>
                <button
                  onClick={() => executeScenario('RESET')}
                  disabled={isExecuting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#1A1A1A] hover:bg-black text-white rounded-full shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#00D09C]" />
                  Reset Baseline
                </button>
              </div>
            </div>
          )}

          {activeTab === 'AUDIT_LOGS' && (
            <div className="space-y-2.5">
              <div className="text-xs text-gray-500 mb-2 font-medium">
                Persisted system audit trail tracking data anomalies, out-of-order packet rejections, and provider discrepancies:
              </div>
              {logs.length > 0 ? (
                logs.map(log => (
                  <div key={log.id} className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                      <span className="font-bold text-[#1A1A1A]">{log.event_type}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-gray-700">{log.details}</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">No audit logs recorded yet.</div>
              )}
            </div>
          )}

          {activeTab === 'MARKET_HOURS' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
                  Trading Session State
                </h4>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Normal Indian market trading hours are Monday-Friday 9:15 AM to 3:30 PM IST. You can override the market state to evaluate UI behaviors in both live and post-market conditions.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => toggleMarketSession(true)}
                    className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#00D09C] hover:bg-[#00b889] text-black shadow-xs"
                  >
                    Force Live Session (Open)
                  </button>
                  <button
                    onClick={() => toggleMarketSession(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#1A1A1A] hover:bg-black text-white shadow-xs"
                  >
                    Force Market Closed
                  </button>
                  <button
                    onClick={() => toggleMarketSession(null)}
                    className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-200 hover:bg-gray-300 text-gray-800"
                  >
                    Restore Real IST Clock
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
