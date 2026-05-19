"use client";

import { useState, useEffect, useCallback } from "react";
import StatusPanel from "@/components/StatusPanel";
import ResultsTable from "@/components/ResultsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AssignmentRecord } from "@/types";
import { Settings } from "lucide-react";

export default function DashboardPage() {
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rubric, setRubric] = useState("");
  const [windowSize, setWindowSize] = useState(3);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"connected" | "disconnected" | "checking">(
    "checking"
  );
  const [healthError, setHealthError] = useState<string | null>(null);

  // Fetch all graded assignments and pending queue
  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error("Gagal mengambil data tugas.");
      const data = await res.json();
      setAssignments(data);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyinkronkan data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch system configurations (rubric & memory limits)
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Gagal mengambil konfigurasi.");
      const data = await res.json();
      setRubric(data.rubric || "");
      setWindowSize(data.windowSize ?? 3);
    } catch (err: any) {
      console.error("Failed to load config:", err);
    }
  }, []);

  // Fetch LM Studio health status
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHealthStatus(data.status);
      setHealthError(data.error || null);
    } catch (err) {
      setHealthStatus("disconnected");
      setHealthError("Gagal menghubungi endpoint health.");
    }
  }, []);

  // Save updated configurations
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubric, windowSize }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan konfigurasi.");
      toast.success("Konfigurasi sistem berhasil diperbarui!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan konfigurasi.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchAssignments();
    fetchConfig();
    fetchHealth();
  }, [fetchAssignments, fetchConfig, fetchHealth]);

  // Autopoll every 4-10 seconds for tasks, and every 15 seconds for health status
  useEffect(() => {
    const hasActiveJobs = assignments.some(
      (a) => a.status === "pending" || a.status === "processing"
    );

    const interval = setInterval(() => {
      fetchAssignments();
    }, hasActiveJobs ? 4000 : 10000);

    const healthInterval = setInterval(() => {
      fetchHealth();
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
    };
  }, [assignments, fetchAssignments, fetchHealth]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-250">
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-500/5 via-violet-500/5 to-transparent pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-zinc-950 shadow-lg shadow-emerald-500/25">
              G
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white">Gradely</span>
              <span className="text-emerald-400 font-medium text-xs ml-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Lokal AI
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-550 text-xs">LM Studio Status:</span>
            {healthStatus === "connected" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Terhubung
              </span>
            ) : healthStatus === "checking" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-yellow-500 font-medium bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/20 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-yellow-550 animate-pulse" /> Memeriksa...
              </span>
            ) : (
              <span
                title={healthError || undefined}
                className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 cursor-help"
              >
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Terputus
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (Forms & Control Panel) */}
          <div className="lg:col-span-1 space-y-8">
            <StatusPanel
              assignments={assignments}
              onRefresh={fetchAssignments}
              isLoading={isLoading}
            />

            <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
              <CardHeader className="relative pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5 text-zinc-400" />
                  <span>Pengaturan Rubrik & AI</span>
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Ubah kriteria rubrik penilaian dan jumlah memori pembanding plagiarisme.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  {/* Sliding Window Size */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="window-size"
                      className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                    >
                      Ukuran Window Memori (Tugas Pembanding)
                    </Label>
                    <Input
                      id="window-size"
                      type="number"
                      min={0}
                      max={10}
                      value={windowSize}
                      onChange={(e) => setWindowSize(parseInt(e.target.value, 10) || 0)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm focus-visible:ring-emerald-500"
                    />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Menentukan jumlah tugas mahasiswa sebelumnya yang akan dikirimkan ke AI sebagai konteks memori pembanding (plagiarisme).
                    </p>
                  </div>

                  {/* Rubric Input */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="rubric"
                      className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                    >
                      Rubrik Penilaian Laporan
                    </Label>
                    <Textarea
                      id="rubric"
                      rows={8}
                      value={rubric}
                      onChange={(e) => setRubric(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 text-sm font-mono leading-relaxed focus-visible:ring-emerald-500"
                      placeholder="Masukkan detail rubrik..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSavingConfig}
                    className="w-full bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
                  >
                    {isSavingConfig ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Submissions Table) */}
          <div className="lg:col-span-2">
            <ResultsTable assignments={assignments} />
          </div>
        </div>
      </main>
    </div>
  );
}
