/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Activity, Clock, ShieldAlert, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
        const res = await fetch(`${apiUrl}/api/insights`);
        const data = await res.json();
        if (data.insights) {
          setInsights(data.insights);
        }
      } catch (error) {
        console.error("Error fetching insights:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "anomaly": return <Activity className="text-orange-500" />;
      case "sla_warning": return <Clock className="text-red-500" />;
      case "pattern": return <ShieldAlert className="text-blue-500" />;
      default: return <AlertTriangle className="text-neutral-500" />;
    }
  };

  const getBorder = (severity: string) => {
    switch (severity) {
      case "critical": return "border-red-200 bg-red-50/50";
      case "high": return "border-orange-200 bg-orange-50/50";
      case "medium": return "border-blue-200 bg-blue-50/50";
      default: return "border-neutral-200 bg-white";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans p-8">
      <div className="max-w-5xl mx-auto">
        
        <a href="/" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-black mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to Chat
        </a>

        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-2">Proactive Issue Detection</h1>
            <p className="text-neutral-500">Internal operations view. Anomalies detected across all active tickets and orders.</p>
          </div>
          <div className="text-sm font-medium px-3 py-1 bg-green-100 text-green-800 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            System Active
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-neutral-200 animate-pulse rounded-xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {insights.map((insight, idx) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-6 rounded-xl border ${getBorder(insight.severity)} shadow-sm flex gap-6 items-start`}
              >
                <div className="p-3 bg-white rounded-lg shadow-sm border border-neutral-100">
                  {getIcon(insight.type)}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">{insight.title}</h3>
                  <p className="text-neutral-600 text-sm leading-relaxed">{insight.description}</p>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-white border border-neutral-200
                    ${insight.severity === 'critical' ? 'text-red-700' : insight.severity === 'high' ? 'text-orange-700' : 'text-blue-700'}
                  `}>
                    {insight.severity}
                  </span>
                  <span className="text-sm font-mono text-neutral-500">{insight.metric}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

