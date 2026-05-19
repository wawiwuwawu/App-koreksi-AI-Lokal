"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import StatusPanel from "@/components/StatusPanel";
import ResultsTable from "@/components/ResultsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AssignmentRecord } from "@/types";
import { Settings, ArrowLeft, Download, Loader2, Play } from "lucide-react";

interface TaskPageProps {
  params: Promise<{ taskId: string }>;
}

export default function TaskDetailPage({ params }: TaskPageProps) {
  const router = useRouter();
  const { taskId } = use(params);

  const [lecturer, setLecturer] = useState<{ name: string; email: string } | null>(null);
  const [task, setTask] = useState<{ title: string; rubric: string; windowSize: number; class: { name: string; course: { name: string } } } | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [queueLength, setQueueLength] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [rubric, setRubric] = useState("");
  const [windowSize, setWindowSize] = useState(3);
  const [webhookSecret, setWebhookSecret] = useState("");

  const [healthStatus, setHealthStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [healthError, setHealthError] = useState<string | null>(null);

  // Authenticate and load task initial details
  const checkAuthAndFetch = useCallback(async () => {
    try {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) {
        router.push("/login");
        return;
      }
      const authData = await authRes.json();
      setLecturer(authData.lecturer);

      // Fetch task data
      await fetchTaskData();
      await fetchHealth();
    } catch (err) {
      router.push("/login");
    }
  }, [router, taskId]);

  const fetchTaskData = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Gagal mengambil data tugas.");
      const data = await res.json();
      setTask(data.task);
      setAssignments(data.assignments);
      setQueueLength(data.queueLength);
      setRubric(data.task.rubric);
      setWindowSize(data.task.windowSize);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat tugas.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHealth = async () => {
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
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubric, windowSize }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan konfigurasi.");
      toast.success("Kriteria rubrik tugas berhasil disimpan!");
      fetchTaskData();
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan rubrik.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  useEffect(() => {
    checkAuthAndFetch();
    // Load local webhook secret if configured
    if (typeof window !== "undefined") {
      setWebhookSecret(process.env.NEXT_PUBLIC_WEBHOOK_SECRET || "token_rahasia_anda");
    }
  }, [checkAuthAndFetch]);

  // Autopoll for assignments
  useEffect(() => {
    const hasActiveJobs = assignments.some(
      (a) => a.status === "pending" || a.status === "processing"
    );

    const interval = setInterval(() => {
      if (lecturer) fetchTaskData();
    }, hasActiveJobs ? 4000 : 10000);

    const healthInterval = setInterval(() => {
      fetchHealth();
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
    };
  }, [assignments, lecturer]);

  if (isLoading || !lecturer || !task) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm text-zinc-400 font-medium">Memuat data tugas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-250">
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-500/5 via-violet-500/5 to-transparent pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="text-zinc-400 hover:text-white hover:bg-zinc-900 h-9 px-3 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Kembali
            </Button>
            <span className="text-zinc-700">|</span>
            <div>
              <span className="font-extrabold tracking-tight text-white">{task.class.course.name}</span>
              <span className="text-zinc-550 text-xs ml-2">({task.class.name})</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-zinc-550 text-xs">LM Studio:</span>
              {healthStatus === "connected" ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online
                </span>
              ) : (
                <span
                  title={healthError || undefined}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 cursor-help"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Offline
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Task Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              TASK ID: {taskId}
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">
              {task.title}
            </h1>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/tasks/${taskId}/export`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-semibold hover:bg-zinc-800 hover:text-white px-4 py-2 transition-all cursor-pointer shadow-lg"
            >
              <Download className="h-4 w-4 mr-2" /> Ekspor Nilai (CSV)
            </a>
          </div>
        </div>

        {/* Queue Monitor Banner */}
        {queueLength > 0 && (
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Play className="h-5 w-5 text-emerald-400 animate-pulse" />
              <div>
                <h4 className="font-semibold text-emerald-350 text-sm">Pemrosesan AI Sedang Berjalan</h4>
                <p className="text-xs text-zinc-450 mt-0.5">
                  Terdapat {queueLength} tugas mahasiswa dalam antrean. AI menilai secara sekuensial untuk menjaga stabilitas.
                </p>
              </div>
            </div>
            <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded font-bold font-mono">
              Antrean: {queueLength}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (Forms & Control Panel) */}
          <div className="lg:col-span-1 space-y-8">
            <StatusPanel
              assignments={assignments}
              onRefresh={fetchTaskData}
              isLoading={isLoading}
              taskId={taskId}
              webhookSecret={webhookSecret}
            />

            <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
              <CardHeader className="relative pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5 text-zinc-400" />
                  <span>Kriteria Rubrik Tugas</span>
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Ubah kriteria penilaian dan memori pembanding plagiarisme khusus untuk tugas ini.
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
                      Menentukan jumlah tugas mahasiswa kelas ini sebelumnya yang akan dikirimkan ke AI sebagai konteks memori pembanding (plagiarisme).
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
            <ResultsTable assignments={assignments} onRefresh={fetchTaskData} />
          </div>
        </div>
      </main>
    </div>
  );
}
