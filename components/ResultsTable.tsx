"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AssignmentRecord } from "@/types";
import { ExternalLink, Eye, AlertTriangle, X, HelpCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ResultsTableProps {
  assignments: AssignmentRecord[];
  onRefresh?: () => void;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  duplicateScore?: number;
}

export default function ResultsTable({
  assignments,
  onRefresh,
  page = 1,
  totalPages = 1,
  totalItems,
  onPageChange,
  duplicateScore = 50,
}: ResultsTableProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRecord | null>(null);
  const [duplicateSourceId, setDuplicateSourceId] = useState("");
  const [isMarkingDuplicate, setIsMarkingDuplicate] = useState(false);

  const [manualScore, setManualScore] = useState("");
  const [manualFeedback, setManualFeedback] = useState("");
  const [isUpdatingManual, setIsUpdatingManual] = useState(false);

  useEffect(() => {
    if (selectedAssignment) {
      setManualScore(selectedAssignment.score !== null ? String(selectedAssignment.score) : "");
      setManualFeedback(selectedAssignment.feedback || "");
    } else {
      setManualScore("");
      setManualFeedback("");
    }
  }, [selectedAssignment]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Menunggu</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse">Diproses</Badge>;
      case "done":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Selesai</Badge>;
      case "failed":
        return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20">Gagal</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openAssignmentById = async (assignmentId: string) => {
    const localMatch = assignments.find((a) => a.id === assignmentId);
    if (localMatch) {
      setSelectedAssignment(localMatch);
      setDuplicateSourceId("");
      return;
    }

    try {
      const res = await fetch(`/api/assignments/${assignmentId}`);
      if (!res.ok) throw new Error("Gagal mengambil detail assignment");
      const data = await res.json();
      setSelectedAssignment(data.assignment);
      setDuplicateSourceId("");
    } catch (err: any) {
      toast.error(err?.message || "Gagal membuka detail assignment");
    }
  };

  const handleMarkDuplicate = async () => {
    if (!selectedAssignment || !duplicateSourceId) {
      toast.error("Pilih assignment sumber duplikat terlebih dahulu");
      return;
    }

    setIsMarkingDuplicate(true);
    try {
      const res = await fetch(`/api/assignments/${selectedAssignment.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: duplicateSourceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menandai duplikat");

      toast.success("Assignment berhasil ditandai duplikat dan nilainya disamakan");
      setDuplicateSourceId("");
      if (onRefresh) onRefresh();
      setSelectedAssignment(data.assignment || selectedAssignment);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menandai duplikat");
    } finally {
      setIsMarkingDuplicate(false);
    }
  };

  const handleSaveManualGrade = async () => {
    if (!selectedAssignment) return;
    setIsUpdatingManual(true);
    try {
      const res = await fetch(`/api/assignments/${selectedAssignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: manualScore,
          feedback: manualFeedback,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan koreksi manual");
      
      toast.success("Koreksi manual berhasil disimpan!");
      if (onRefresh) onRefresh();
      setSelectedAssignment(data.assignment || selectedAssignment);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan.");
    } finally {
      setIsUpdatingManual(false);
    }
  };

  const handleCancelDuplicate = async () => {
    if (!selectedAssignment) return;
    if (!confirm("Batalkan status duplikat untuk tugas ini? Nilai duplikat akan dibersihkan.")) return;
    setIsUpdatingManual(true);
    try {
      const res = await fetch(`/api/assignments/${selectedAssignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetDuplicate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan status duplikat");
      
      toast.success("Status duplikat dibatalkan!");
      if (onRefresh) onRefresh();
      setSelectedAssignment(data.assignment || selectedAssignment);
    } catch (err: any) {
      toast.error(err?.message || "Gagal membatalkan status duplikat.");
    } finally {
      setIsUpdatingManual(false);
    }
  };

  const handleRetry = async (assignmentId: string) => {
    if (!confirm("Ulangi penilaian untuk tugas ini?")) return;
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/retry`, { method: "POST" });
      if (!res.ok) throw new Error("Gagal mengantrekan kembali tugas");
      toast.success("Tugas berhasil dimasukkan ke antrean kembali!");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Gagal re-grade.");
    }
  };

  return (
    <div className="w-full">
      <Card className="border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl text-zinc-100">
        <CardHeader>
          <CardTitle className="text-xl font-bold tracking-tight">Daftar Koreksi Tugas</CardTitle>
          <CardDescription className="text-zinc-400">
            Kumpulan hasil koreksi otomatis oleh AI lokal serta riwayat antrean tugas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
            <Table>
              <TableHeader className="bg-zinc-900/60">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold">Nama Mahasiswa</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">ID Tugas</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">Tanggal Masuk</TableHead>
                  <TableHead className="text-zinc-400 font-semibold">Status</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-right">Nilai</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                      Belum ada tugas yang masuk. Kirim respons form Anda ke Webhook!
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow
                      key={assignment.id}
                      className="border-zinc-800 hover:bg-zinc-900/30 transition-colors"
                    >
                      <TableCell className="font-medium text-white">
                        <div className="flex flex-col gap-1">
                          <span>{assignment.studentName}</span>
                          {assignment.isDuplicate && assignment.duplicateOf && (
                            <div className="flex items-center gap-2 text-[11px] text-amber-300">
                              <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Duplikat
                              </Badge>
                              <button
                                type="button"
                                className="underline decoration-dotted hover:text-amber-200 text-[11px]"
                                onClick={() => openAssignmentById(assignment.duplicateOf!.id)}
                              >
                                {assignment.duplicateOf.studentName}
                              </button>
                            </div>
                          )}
                          {!assignment.isDuplicate && assignment.duplicates && assignment.duplicates.length > 0 && (
                            <div className="flex items-center flex-wrap gap-1 text-[11px] text-amber-400/80">
                              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] py-0 px-1">
                                Sumber Duplikat
                              </Badge>
                              <span className="text-[10px] text-zinc-500">Diduplikasi oleh:</span>
                              {assignment.duplicates.map((dup, idx) => (
                                <button
                                  key={dup.id}
                                  type="button"
                                  className="underline decoration-dotted hover:text-amber-200 text-[11px]"
                                  onClick={() => openAssignmentById(dup.id)}
                                >
                                  {dup.studentName}{idx < assignment.duplicates!.length - 1 ? ", " : ""}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-400 text-xs">
                        {assignment.taskId || "N/A"}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">
                        {formatDate(assignment.createdAt)}
                      </TableCell>
                      <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                      <TableCell className="text-right font-bold text-base">
                        {assignment.status === "done" && assignment.score !== null ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {assignment.score}
                          </span>
                        ) : assignment.status === "failed" ? (
                          <span className="text-rose-500">Error</span>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {assignment.status === "failed" && (
                            <Button
                              onClick={() => handleRetry(assignment.id)}
                              variant="outline"
                              size="sm"
                              className="h-8 border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setDuplicateSourceId("");
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-8 text-zinc-350 hover:text-white hover:bg-zinc-800"
                          >
                            <Eye className="h-4 w-4 mr-1 text-zinc-400" /> Detail
                          </Button>
                          <Button
                            onClick={async () => {
                              if (confirm(`Apakah Anda yakin ingin menghapus tugas dari ${assignment.studentName}?`)) {
                                try {
                                  const res = await fetch(`/api/assignments/${assignment.id}`, { method: "DELETE" });
                                  if (!res.ok) throw new Error("Gagal menghapus tugas");
                                  toast.success("Tugas berhasil dihapus.");
                                  if (onRefresh) onRefresh();
                                } catch (err: any) {
                                  toast.error(err?.message || "Gagal menghapus.");
                                }
                              }
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-8 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-4 w-4 mr-1 text-rose-500" /> Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-zinc-500">
              <div>
                {typeof totalItems === "number"
                  ? `Menampilkan halaman ${page} dari ${totalPages} (total ${totalItems} data)`
                  : `Menampilkan halaman ${page} dari ${totalPages}`}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => onPageChange?.(page - 1)}
                  disabled={page <= 1}
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => onPageChange?.(page + 1)}
                  disabled={page >= totalPages}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detail Overlay */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 rounded-xl shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-zinc-850">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Hasil Koreksi: {selectedAssignment.studentName}</span>
                  {selectedAssignment.status === "done" && (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Nilai: {selectedAssignment.score}
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  ID Tugas: {selectedAssignment.taskId || "N/A"} | Masuk:{" "}
                  {formatDate(selectedAssignment.createdAt)}
                </p>
              </div>
              <Button
                onClick={() => setSelectedAssignment(null)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* If failed show error details */}
              {selectedAssignment.status === "failed" && (
                <div className="border border-rose-500/30 bg-rose-500/5 rounded-lg p-4 text-sm text-rose-400 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-rose-300">Proses Koreksi Gagal</h4>
                    <p className="mt-1 font-mono text-xs">{selectedAssignment.errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Plagiarism Warning */}
              {selectedAssignment.status === "done" && selectedAssignment.plagiarismNote && (
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 text-sm text-amber-300 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-200">Indikasi Kemiripan / Plagiarisme</h4>
                    <p className="mt-1 leading-relaxed text-zinc-300">
                      {selectedAssignment.plagiarismNote}
                    </p>
                  </div>
                </div>
              )}

              {((selectedAssignment.isDuplicate || selectedAssignment.duplicateReason) || (selectedAssignment.duplicates && selectedAssignment.duplicates.length > 0)) && (
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 text-sm text-amber-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <h4 className="font-semibold text-amber-200">Status Duplikat</h4>
                  </div>
                  {selectedAssignment.duplicateOf && (
                    <div className="text-xs text-zinc-300">
                      Tugas ini menduplikasi tugas dari:{" "}
                      <button
                        type="button"
                        className="underline decoration-dotted hover:text-amber-200"
                        onClick={() => openAssignmentById(selectedAssignment.duplicateOf!.id)}
                      >
                        {selectedAssignment.duplicateOf.studentName}
                      </button>
                    </div>
                  )}
                  {selectedAssignment.duplicates && selectedAssignment.duplicates.length > 0 && (
                    <div className="text-xs text-zinc-300 flex flex-wrap gap-1 items-center">
                      <span>Tugas ini diduplikasi oleh:</span>
                      {selectedAssignment.duplicates.map((dup, idx) => (
                        <button
                          key={dup.id}
                          type="button"
                          className="underline decoration-dotted hover:text-amber-200"
                          onClick={() => openAssignmentById(dup.id)}
                        >
                          {dup.studentName}{idx < selectedAssignment.duplicates!.length - 1 ? ", " : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedAssignment.duplicateReason && (
                    <div className="text-xs text-zinc-400">Alasan: {selectedAssignment.duplicateReason}</div>
                  )}
                  {typeof selectedAssignment.duplicateSimilarity === "number" && (
                    <div className="text-xs text-zinc-400">
                      Kemiripan: {(selectedAssignment.duplicateSimilarity * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              )}

              <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Tandai Duplikat (Manual)
                  </h4>
                  <span className="text-[11px] text-zinc-500">
                    Nilai duplikat: {duplicateScore}
                  </span>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">Pilih assignment sumber (ID)</label>
                  <input
                    list="assignment-options"
                    value={duplicateSourceId}
                    onChange={(e) => setDuplicateSourceId(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 font-mono"
                    placeholder="Contoh: clx123abc..."
                  />
                  <datalist id="assignment-options">
                    {assignments
                      .filter((a) => a.id !== selectedAssignment.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.studentName}
                        </option>
                      ))}
                  </datalist>
                </div>
                <Button
                  onClick={handleMarkDuplicate}
                  disabled={isMarkingDuplicate}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs cursor-pointer"
                  size="sm"
                >
                  {isMarkingDuplicate ? "Memproses..." : "Tandai Duplikat & Samakan Nilai"}
                </Button>
              </div>

              {/* Koreksi Manual */}
              {selectedAssignment.status === "done" && (
                <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Koreksi Manual & Nilai
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400">Nilai Manual (0 - 100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualScore}
                        onChange={(e) => setManualScore(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200"
                        placeholder="Nilai baru..."
                      />
                    </div>
                    {selectedAssignment.isDuplicate && (
                      <div className="flex items-end">
                        <Button
                          onClick={handleCancelDuplicate}
                          disabled={isUpdatingManual}
                          type="button"
                          className="bg-amber-600/20 hover:bg-amber-600/35 text-amber-300 border border-amber-500/30 text-xs w-full py-2.5 h-9 cursor-pointer"
                        >
                          Batalkan Status Duplikat
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Feedback Dosen</label>
                    <textarea
                      value={manualFeedback}
                      onChange={(e) => setManualFeedback(e.target.value)}
                      className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 leading-relaxed"
                      placeholder="Masukkan koreksi feedback manual..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={handleSaveManualGrade}
                      disabled={isUpdatingManual}
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                      size="sm"
                    >
                      {isUpdatingManual ? "Menyimpan..." : "Simpan Nilai & Feedback"}
                    </Button>
                  </div>
                </div>
              )}

              {/* AI Feedback */}
              {selectedAssignment.status === "done" && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Feedback AI Penilai
                  </h4>
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-lg text-zinc-250 text-sm leading-relaxed whitespace-pre-line">
                    {selectedAssignment.feedback || "Tidak ada feedback khusus."}
                  </div>
                </div>
              )}

              {/* Status processing/pending message */}
              {(selectedAssignment.status === "pending" ||
                selectedAssignment.status === "processing") && (
                <div className="py-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  <HelpCircle className="h-10 w-10 mx-auto text-zinc-650 mb-2 animate-bounce" />
                  <p className="text-sm">
                    Tugas ini sedang berada dalam antrean atau sedang dinilai oleh AI lokal.
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Silakan segarkan halaman dashboard secara berkala.
                  </p>
                </div>
              )}

              {/* Drive Link */}
              {selectedAssignment.driveFileUrl && (
                <div className="flex items-center justify-between p-3 border border-zinc-800 bg-zinc-900/40 rounded-lg">
                  <span className="text-xs text-zinc-400">File Laporan di Google Drive:</span>
                  <a
                    href={selectedAssignment.driveFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-350 font-medium transition-colors"
                  >
                    <span>Buka Laporan PDF</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Extracted Text */}
              {selectedAssignment.extractedText && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Teks Ekstraksi PDF
                  </h4>
                  <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-lg text-xs font-mono text-zinc-400 max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                    {selectedAssignment.extractedText}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/20 flex justify-between items-center">
              <div className="flex gap-2">
                {(selectedAssignment.status === "failed" || selectedAssignment.status === "done") && (
                  <Button
                    onClick={async () => {
                      if (!confirm("Ulangi penilaian untuk tugas ini?")) return;
                      try {
                        const res = await fetch(`/api/assignments/${selectedAssignment.id}/retry`, { method: "POST" });
                        if (!res.ok) throw new Error("Gagal mengantrekan kembali tugas");
                        if (onRefresh) onRefresh();
                        setSelectedAssignment(null);
                        toast.success("Tugas berhasil dimasukkan ke antrean kembali!");
                      } catch (err: any) {
                        toast.error(err?.message || "Gagal re-grade.");
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 text-xs py-1 cursor-pointer"
                    size="sm"
                  >
                    Koreksi Ulang
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    if (confirm("Apakah Anda yakin ingin menghapus hasil penilaian ini?")) {
                      try {
                        const res = await fetch(`/api/assignments/${selectedAssignment.id}`, { method: "DELETE" });
                        if (!res.ok) throw new Error("Gagal menghapus tugas");
                        if (onRefresh) onRefresh();
                        setSelectedAssignment(null);
                        toast.success("Tugas berhasil dihapus.");
                      } catch (err: any) {
                        toast.error(err?.message || "Gagal menghapus.");
                      }
                    }
                  }}
                  className="bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs py-1 cursor-pointer"
                  size="sm"
                >
                  Hapus
                </Button>
              </div>
              <Button
                onClick={() => setSelectedAssignment(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 cursor-pointer"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
