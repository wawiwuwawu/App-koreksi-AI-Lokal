"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AssignmentRecord } from "@/types";
import { ExternalLink, Eye, AlertTriangle, X, HelpCircle } from "lucide-react";

interface ResultsTableProps {
  assignments: AssignmentRecord[];
}

export default function ResultsTable({ assignments }: ResultsTableProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRecord | null>(null);

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
                      <TableCell className="font-medium text-white">{assignment.studentName}</TableCell>
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
                        <Button
                          onClick={() => setSelectedAssignment(assignment)}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-zinc-350 hover:text-white hover:bg-zinc-800"
                        >
                          <Eye className="h-4 w-4 mr-1.5 text-zinc-400" /> Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/20 flex justify-end">
              <Button
                onClick={() => setSelectedAssignment(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700"
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
