import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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
  // ضفنا حالة verify ومسحنا forgot لأننا هننقله لصفحة منفصلة
  const [mode, setMode] = useState<"signin" | "signup" | "verify">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
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
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("A 6-digit code has been sent to your email.");
        setMode("verify"); // النقل لخطوة إدخال الـ OTP
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // دالة مخصصة لتأكيد الـ OTP للحساب الجديد
  const verifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return toast.error("Please enter the complete 6-digit OTP.");
    
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      
      if (error) throw error;

      toast.success("Account verified successfully! You are now signed in.");
      void navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code.");
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
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img src={logo} alt="Physio Life" width={40} height={40} className="h-10 w-10" />
              <span className="font-bold">Physio Life</span>
            </div>
            
            <h2 className="text-2xl font-semibold mb-2">
              {mode === "signin" ? "Staff sign in" : mode === "signup" ? "Create account" : "Verify Account"}
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "verify"
                ? "Enter the 6-digit code sent to your email to activate your account."
                : "Access is restricted to clinic staff."}
            </p>

            {mode === "verify" ? (
              <form onSubmit={verifySignup} className="space-y-6">
                <div className="space-y-2 flex flex-col items-center">
                  <Label htmlFor="otp" className="w-full text-left">OTP Code</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Sign In
                </Button>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <button type="button" className="hover:underline" onClick={() => setMode("signup")}>
                    Back to sign up
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={submit} className="space-y-4">
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
                
                {mode === "signin" && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={remember}
                        onCheckedChange={(v) => setRemember(Boolean(v))}
                      />
                      Remember me
                    </label>
                    <Link
                      to="/reset-password"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
            )}

            {mode !== "verify" && (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
