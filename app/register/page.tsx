"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Semua field wajib diisi");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Pendaftaran gagal");
      }

      toast.success("Pendaftaran sukses! Selamat datang.");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center relative px-4 select-none">
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-indigo-500/10 via-violet-500/5 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-extrabold text-zinc-950 text-xl shadow-xl shadow-emerald-500/20 mb-4">
            G
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Daftar Akun Dosen</CardTitle>
          <CardDescription className="text-zinc-400 text-sm mt-1">
            Buat akun baru untuk mengelola kelas dan mengoreksi tugas otomatis
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Nama Lengkap & Gelar
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-555" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Dr. John Doe, M.T."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-950/80 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-650 focus-visible:ring-emerald-500"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-555" />
                <Input
                  id="email"
                  type="email"
                  placeholder="dosen@univ.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-950/80 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-650 focus-visible:ring-emerald-500"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-555" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-950/80 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-650 focus-visible:ring-emerald-500"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Konfirmasi Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-555" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-zinc-950/80 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-650 focus-visible:ring-emerald-500"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 font-bold hover:from-emerald-400 hover:to-teal-300 transition-all duration-300 py-6 mt-6 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {isLoading ? "Mendaftar..." : "Daftar Akun Baru"}
            </Button>

            <div className="text-center text-xs text-zinc-400 mt-4">
              Sudah memiliki akun?{" "}
              <Link href="/login" className="text-emerald-400 hover:underline">
                Masuk di sini
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
