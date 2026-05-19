"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, Users, FileText, ChevronRight, LogOut, Activity } from "lucide-react";

interface TaskSummary {
  id: string;
  title: string;
}

interface ClassSummary {
  id: string;
  name: string;
  tasks: TaskSummary[];
}

interface CourseSummary {
  id: string;
  code: string;
  name: string;
  classes: ClassSummary[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [lecturer, setLecturer] = useState<{ name: string; email: string } | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  // Check auth and fetch user info
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setLecturer(data.lecturer);
      fetchCourses();
      fetchHealth();
    } catch (err) {
      router.push("/login");
    }
  }, [router]);

  // Fetch courses managed by logged lecturer
  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/courses");
      if (!res.ok) throw new Error("Gagal mengambil data mata kuliah.");
      const data = await res.json();
      setCourses(data.courses);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat mata kuliah.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch LM Studio health status
  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHealthStatus(data.status);
    } catch (err) {
      setHealthStatus("disconnected");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logout berhasil");
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error("Gagal logout.");
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Count helper functions
  const totalClasses = courses.reduce((acc, course) => acc + course.classes.length, 0);
  const totalTasks = courses.reduce((acc, course) => 
    acc + course.classes.reduce((sum, c) => sum + c.tasks.length, 0), 0
  );

  if (isLoading || !lecturer) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-400 font-medium">Memuat dashboard...</p>
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
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-zinc-550 text-xs">LM Studio:</span>
              {healthStatus === "connected" ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-rose-500 font-medium bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Disconnected
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-300 font-medium border-l border-zinc-800 pl-4 flex items-center gap-2">
              <span>{lecturer.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Intro */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Selamat Datang, {lecturer.name}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Kelola koreksi tugas mahasiswa untuk seluruh kelas dan mata kuliah Anda secara terpusat.
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-zinc-100 flex items-center p-6 gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-md">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mata Kuliah</p>
              <p className="text-2xl font-black mt-0.5 text-white">{courses.length}</p>
            </div>
          </Card>

          <Card className="border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-zinc-100 flex items-center p-6 gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-md">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Kelas</p>
              <p className="text-2xl font-black mt-0.5 text-white">{totalClasses}</p>
            </div>
          </Card>

          <Card className="border border-zinc-900 bg-zinc-900/20 backdrop-blur-md text-zinc-100 flex items-center p-6 gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-md">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Tugas Aktif</p>
              <p className="text-2xl font-black mt-0.5 text-white">{totalTasks}</p>
            </div>
          </Card>
        </div>

        {/* Courses Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Daftar Mata Kuliah Anda</span>
          </h2>

          {courses.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl py-16 text-center text-zinc-500">
              <BookOpen className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
              <p className="text-sm font-medium">Belum ada mata kuliah yang terdaftar.</p>
              <p className="text-xs text-zinc-650 mt-1">Silakan hubungi administrator sistem.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  className="border border-zinc-850 bg-zinc-950/40 hover:bg-zinc-900/20 transition-all duration-300 text-zinc-100 shadow-xl flex flex-col justify-between"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {course.code}
                      </span>
                      <span className="text-zinc-600 text-xs font-bold">•</span>
                      <span className="text-zinc-400 text-xs font-medium">Lecturer Room</span>
                    </div>
                    <CardTitle className="text-xl font-extrabold text-white mt-2 leading-snug">
                      {course.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="border-t border-zinc-900 pt-4 space-y-3">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kelas & Tugas Aktif:</p>
                      {course.classes.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">Belum ada kelas terdaftar</p>
                      ) : (
                        <div className="space-y-2">
                          {course.classes.map((clazz) => (
                            <div
                              key={clazz.id}
                              className="bg-zinc-900/40 border border-zinc-850/60 p-3 rounded-lg flex flex-col gap-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-300">{clazz.name}</span>
                                <span className="text-[10px] text-zinc-500">{clazz.tasks.length} Tugas</span>
                              </div>
                              {clazz.tasks.length > 0 && (
                                <div className="space-y-1.5 pl-1.5 border-l-2 border-emerald-500/30">
                                  {clazz.tasks.map((task) => (
                                    <button
                                      key={task.id}
                                      onClick={() => router.push(`/tasks/${task.id}`)}
                                      className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-emerald-400 transition-colors text-left group"
                                    >
                                      <span className="truncate pr-2">{task.title}</span>
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all text-emerald-400" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
