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
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  // إضافة forgot و reset لحالات الصفحة
  const [mode, setMode] = useState<"signin" | "signup" | "verify" | "forgot" | "reset">("signin");
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
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("A 6-digit code has been sent to your email.");
        setMode("verify");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const verifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Please enter the complete 6-digit OTP."); return; }
    
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

  // دالة طلب كود تغيير كلمة المرور
  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("A 6-digit code has been sent to your email.");
    setMode("reset");
  };

  // دالة تأكيد كود كلمة المرور وتحديثها
  const verifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Please enter the complete 6-digit OTP."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "recovery",
    });

    if (verifyError) {
      setBusy(false);
      { toast.error(verifyError.message); return; }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      { toast.error(updateError.message); return; }
    }

    toast.success("Password updated successfully! You can now sign in.");
    setOtp("");
    setPassword("");
    setMode("signin");
  };

  // تحديد العنوان والوصف بناءً على الـ Mode
  let title = "Staff sign in";
  let desc = "Access is restricted to clinic staff.";
  if (mode === "signup") { title = "Create account"; desc = "Register a new staff account."; }
  if (mode === "verify") { title = "Verify Account"; desc = "Enter the 6-digit code sent to your email to activate your account."; }
  if (mode === "forgot") { title = "Reset Password"; desc = "Enter your email address to receive a 6-digit code."; }
  if (mode === "reset") { title = "Set New Password"; desc = "Enter the 6-digit code and your new password."; }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Physio Life" width={48} height={48} className="h-12 w-12" />
          <span className="text-lg font-bold">Physio Life</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Physio Life Center, for Physical Therapy & Rehabilitation.
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
            
            <h2 className="text-2xl font-semibold mb-2">{title}</h2>
            <p className="text-sm text-muted-foreground mb-6">{desc}</p>

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
              </form>
            ) : mode === "forgot" ? (
              <form onSubmit={requestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Code
                </Button>
              </form>
            ) : mode === "reset" ? (
              <form onSubmit={verifyAndReset} className="space-y-6">
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
                <div className="space-y-2">
                  <Label htmlFor="new-pw">New Password</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Update Password
                </Button>
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
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setOtp(""); setPassword(""); }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <button className="hover:underline" onClick={() => setMode("signup")}>
                  First staff account? Create it here
                </button>
              ) : (
                <button className="hover:underline" onClick={() => { setMode("signin"); setOtp(""); setPassword(""); }}>
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
