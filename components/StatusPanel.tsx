"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clipboard, Check, Code } from "lucide-react";
import { AssignmentRecord } from "@/types";

interface StatusPanelProps {
  assignments: AssignmentRecord[];
  onRefresh: () => void;
  isLoading: boolean;
  taskId?: string;
  webhookSecret?: string;
  statusCounts?: {
    total: number;
    pending: number;
    processing: number;
    done: number;
    failed: number;
  };
}

export default function StatusPanel({
  assignments,
  onRefresh,
  isLoading,
  taskId = "",
  webhookSecret = "",
  statusCounts,
}: StatusPanelProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/webhook`);
    }
  }, []);

  const total = statusCounts?.total ?? assignments.length;
  const pending = statusCounts?.pending ?? assignments.filter((a) => a.status === "pending").length;
  const processing = statusCounts?.processing ?? assignments.filter((a) => a.status === "processing").length;
  const done = statusCounts?.done ?? assignments.filter((a) => a.status === "done").length;
  const failed = statusCounts?.failed ?? assignments.filter((a) => a.status === "failed").length;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success("URL Webhook disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Gagal menyalin URL.");
    }
  };

  const appsScriptTemplate = `function onFormSubmit(e) {
  var payload = e.namedValues;
  
  // Set ID Tugas secara otomatis
  payload["id_tugas"] = ["${taskId || "ID_TUGAS_ANDA"}"];
  
  // URL endpoint webhook aplikasi Next.js Anda
  var webhookUrl = "${webhookUrl || "http://localhost:3000/api/webhook"}";
  
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Webhook-Secret": "${webhookSecret || "TOKEN_SECRET_ANDA"}"
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    UrlFetchApp.fetch(webhookUrl, options);
  } catch (error) {
    Logger.log("Error sending webhook: " + error.toString());
  }
}`;

  return (
    <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 pointer-events-none" />
      <CardHeader className="relative pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              Webhook & Status Integrasi
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-1">
              Hubungkan Google Sheets Form Responses Anda ke sistem penilaian otomatis lokal.
            </CardDescription>
          </div>
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            {isLoading ? "Menyegarkan..." : "Refresh Data"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-6">
        {/* Webhook URL Input Group */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            URL Webhook Endpoint
          </label>
          <div className="flex gap-2">
            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-emerald-400 select-all truncate">
              {webhookUrl || "Memuat..."}
            </div>
            <Button
              onClick={copyToClipboard}
              variant="outline"
              className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-zinc-550 text-xs font-medium">Total Masuk</span>
            <span className="text-3xl font-extrabold text-white mt-2">{total}</span>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-zinc-550 text-xs font-medium">Menunggu</span>
            <span className="text-3xl font-extrabold text-zinc-400 mt-2">{pending}</span>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-zinc-550 text-xs font-medium">Diproses</span>
            <span className="text-3xl font-extrabold text-blue-400 mt-2">{processing}</span>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-zinc-550 text-xs font-medium">Selesai</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-2">{done}</span>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-zinc-550 text-xs font-medium">Gagal</span>
            <span className="text-3xl font-extrabold text-rose-500 mt-2">{failed}</span>
          </div>
        </div>

        {/* Apps Script collapsible instruction */}
        <div className="border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-900/20">
          <button
            onClick={() => setShowScript(!showScript)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 font-medium">
              <Code className="h-4 w-4 text-zinc-400" />
              <span>Lihat Panduan & Script Google Apps Script</span>
            </div>
            <Badge variant="outline" className="border-zinc-800 text-zinc-400">
              {showScript ? "Sembunyikan" : "Tampilkan"}
            </Badge>
          </button>

          {showScript && (
            <div className="p-4 border-t border-zinc-800/60 space-y-3 bg-zinc-950/40">
              <div className="text-xs text-zinc-400 leading-relaxed space-y-1">
                <p><strong>Cara Pemasangan Trigger Otomatis:</strong></p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Buka Google Sheets hasil respons Google Form Anda.</li>
                  <li>Pilih menu <strong>Ekstensi &gt; Apps Script</strong>.</li>
                  <li>Hapus kode bawaan dan tempel kode berikut di bawah ini.</li>
                  <li>Klik tombol <strong>Simpan</strong> (ikon disket).</li>
                  <li>Pilih ikon <strong>Pemicu (Triggers)</strong> di bilah navigasi kiri (ikon jam).</li>
                  <li>Klik <strong>Tambahkan Pemicu</strong> di kanan bawah.</li>
                  <li>Pilih fungsi yang dijalankan: <code className="text-emerald-400 font-mono">onFormSubmit</code>.</li>
                  <li>Pilih jenis acara: <strong>Saat mengirim form (On form submit)</strong>.</li>
                  <li>Klik Simpan, lalu izinkan akses Google Account jika diminta.</li>
                </ol>
              </div>
              <pre className="text-xs bg-zinc-900 border border-zinc-800 p-3 rounded-md text-zinc-300 overflow-x-auto font-mono max-h-48 select-all">
                {appsScriptTemplate}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
