"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Cpu, Brain, Shield, Sliders, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [lecturer, setLecturer] = useState<{ name: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [rubric, setRubric] = useState("");
  const [windowSize, setWindowSize] = useState(3);

  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModelName, setAiModelName] = useState("");
  const [aiTemperature, setAiTemperature] = useState("0.2");

  const [shingleSize, setShingleSize] = useState("5");
  const [jaccardThreshold, setJaccardThreshold] = useState("0.7");
  const [hammingThreshold, setHammingThreshold] = useState("5");

  const checkAuth = useCallback(async () => {
    try {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) { router.push("/login"); return; }
      const authData = await authRes.json();
      setLecturer(authData.lecturer);
    } catch { router.push("/login"); }
  }, [router]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Gagal memuat konfigurasi");
      const data = await res.json();
      setRubric(data.rubric || "");
      setWindowSize(data.windowSize ?? 3);
      if (data.aiBaseUrl) setAiBaseUrl(data.aiBaseUrl);
      if (data.aiModelName) setAiModelName(data.aiModelName);
      if (data.aiTemperature !== undefined) setAiTemperature(String(data.aiTemperature));
      if (data.shingleSize) setShingleSize(String(data.shingleSize));
      if (data.jaccardThreshold !== undefined) setJaccardThreshold(String(data.jaccardThreshold));
      if (data.hammingThreshold) setHammingThreshold(String(data.hammingThreshold));
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat konfigurasi global");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (lecturer) fetchConfig();
  }, [lecturer, fetchConfig]);

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rubric,
          windowSize,
          aiBaseUrl,
          aiModelName,
          aiTemperature,
          shingleSize,
          jaccardThreshold,
          hammingThreshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success("Konfigurasi global berhasil disimpan!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan konfigurasi");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !lecturer) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm text-zinc-400 font-medium">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-250">
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-500/5 via-violet-500/5 to-transparent pointer-events-none" />

      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
            <span className="font-extrabold tracking-tight text-white">Pengaturan</span>
          </div>
          <div className="text-sm text-zinc-400">{lecturer.name}</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Global Configuration */}
        <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Konfigurasi Global</CardTitle>
                <CardDescription className="text-zinc-400">
                  Pengaturan default yang akan diterapkan untuk tugas baru.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveGlobal} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="window-size" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Ukuran Window Memori (Default)
                  </Label>
                  <Input
                    id="window-size"
                    type="number"
                    min={0}
                    max={10}
                    value={windowSize}
                    onChange={(e) => setWindowSize(parseInt(e.target.value, 10) || 0)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Jumlah tugas sebelumnya yang dijadikan memori pembanding plagiarisme.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-temperature" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Temperature AI (Default)
                  </Label>
                  <Input
                    id="ai-temperature"
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Semakin rendah, semakin konsisten output AI (recommended: 0.2).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rubric" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Rubrik Penilaian Default
                </Label>
                <Textarea
                  id="rubric"
                  rows={8}
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 text-sm font-mono leading-relaxed"
                  placeholder="Masukkan rubrik penilaian default..."
                />
              </div>

              <Button
                type="submit"
                disabled={isSaving}
                className="w-full bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                {isSaving ? "Menyimpan..." : "Simpan Konfigurasi Global"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Konfigurasi AI</CardTitle>
                <CardDescription className="text-zinc-400">
                  Pengaturan koneksi ke local LLM. Dapat dikonfigurasi via file <code className="text-emerald-400">.env</code> atau disimpan di database.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="ai-base-url" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  AI Base URL
                </Label>
                <Input
                  id="ai-base-url"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1"
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Model Name
                </Label>
                <Input
                  id="ai-model"
                  value={aiModelName}
                  onChange={(e) => setAiModelName(e.target.value)}
                  placeholder="google/gemma-4-e2b"
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Duplicate Detection Settings */}
        <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Deteksi Duplikat</CardTitle>
                <CardDescription className="text-zinc-400">
                  Threshold untuk algoritma deteksi kemiripan teks dan gambar.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="shingle-size" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Ukuran Shingle
                </Label>
                <Input
                  id="shingle-size"
                  type="number"
                  min={2}
                  max={20}
                  value={shingleSize}
                  onChange={(e) => setShingleSize(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                />
                <p className="text-[11px] text-zinc-500">
                  Jumlah token per shingle (default: 5).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jaccard-threshold" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Threshold Jaccard
                </Label>
                <Input
                  id="jaccard-threshold"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={jaccardThreshold}
                  onChange={(e) => setJaccardThreshold(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                />
                <p className="text-[11px] text-zinc-500">
                  Kemiripan minimal untuk deteksi teks (default: 0.7).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hamming-threshold" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Threshold Hamming (Gambar)
                </Label>
                <Input
                  id="hamming-threshold"
                  type="number"
                  min={0}
                  max={64}
                  value={hammingThreshold}
                  onChange={(e) => setHammingThreshold(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono text-sm"
                />
                <p className="text-[11px] text-zinc-500">
                  Jarak Hamming minimal untuk deteksi gambar (default: 5).
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-4">
              Pengaturan ini akan digunakan default untuk tugas baru. Setiap tugas dapat memiliki pengaturan sendiri di halaman detail tugas.
            </p>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Keamanan & Webhook</CardTitle>
                <CardDescription className="text-zinc-400">
                  Informasi konfigurasi keamanan sistem.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Webhook Secret</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-emerald-400 bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800 flex-1">
                  {process.env.NEXT_PUBLIC_WEBHOOK_SECRET || "Dikunci (env var)"}
                </code>
                <span className="text-xs text-zinc-500">Tersimpan di server</span>
              </div>
              <p className="text-xs text-zinc-500">
                Webhook secret digunakan untuk memverifikasi request dari Google Apps Script. Konfigurasi via <code className="text-emerald-400">WEBHOOK_SECRET</code> di file .env.
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sesi Login</p>
              <p className="text-xs text-zinc-500">
                Sesi login menggunakan cookie HMAC-signed dengan masa berlaku 24 jam. Password di-hash menggunakan bcrypt dengan 12 salt rounds.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
