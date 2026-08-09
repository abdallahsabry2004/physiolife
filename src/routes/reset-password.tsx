import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — Physio Life EMR" },
      { name: "description", content: "Reset your Physio Life clinic staff account password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [busy, setBusy] = useState(false);

  // دالة طلب الكود
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
    setStep("verify");
  };

  // دالة تأكيد الكود وتغيير الباسورد
  const verifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Please enter the complete 6-digit OTP."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    
    setBusy(true);

    // 1. تأكيد الـ OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "recovery",
    });

    if (verifyError) {
      setBusy(false);
      { toast.error(verifyError.message); return; }
    }

    // 2. تحديث كلمة المرور بعد نجاح التأكيد
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      { toast.error(updateError.message); return; }
    }

    toast.success("Password updated successfully! You can now sign in.");
    void navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8">
          <h1 className="text-2xl font-semibold mb-2">Reset Password</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {step === "request" 
              ? "Enter your email address and we'll send you a 6-digit code." 
              : "Enter the 6-digit code sent to your email along with your new password."}
          </p>

          {step === "request" ? (
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
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
