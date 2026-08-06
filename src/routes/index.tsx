import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logo from "@/assets/physio-life-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Physio Life EMR — Clinic Sign In" },
      {
        name: "description",
        content:
          "Secure staff sign-in for the Physio Life physical therapy center electronic medical record and clinic management system.",
      },
      { property: "og:title", content: "Physio Life EMR — Clinic Sign In" },
      {
        property: "og:description",
        content:
          "Electronic medical records, treatment sessions, exercise programs and billing for Physio Life PT center.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!remember) sessionStorage.setItem("pl-session-only", "1");
        void navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset instructions sent to your email.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Physio Life" width={48} height={48} className="h-12 w-12" />
          <span className="text-lg font-bold">Physio Life</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Hospital-grade records, built for physical therapy.
          </h1>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            Full patient journeys: assessment, examination, diagnosis, every treatment session,
            exercise programs, imaging files, progress graphs and billing — in one secure place.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Physio Life PT Center · Electronic Medical Record
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img src={logo} alt="Physio Life" width={40} height={40} className="h-10 w-10" />
              <span className="font-bold">Physio Life</span>
            </div>
            <h2 className="text-2xl font-semibold">
              {mode === "signin" ? "Staff sign in" : mode === "signup" ? "Create account" : "Reset password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "We'll email you a link to set a new password."
                : "Access is restricted to clinic staff."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
              {mode === "signin" && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(Boolean(v))}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <button className="hover:underline" onClick={() => setMode("signup")}>
                  First staff account? Create it here
                </button>
              ) : (
                <button className="hover:underline" onClick={() => setMode("signin")}>
                  Back to sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
