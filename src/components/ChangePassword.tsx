import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ChangePassword() {
  // تعريف الـ State عشان نخزن الباسورد الجديد والتأكيد بتاعه
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // استخدام useMutation عشان نتعامل مع الـ API Request
  const updatePassword = useMutation({
    mutationFn: async () => {
      // التأكد من تطابق كلمة المرور
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      // التأكد من قوة كلمة المرور
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      
      // إرسال الطلب لـ Supabase لتحديث بيانات الـ User الحالي
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      // في حالة النجاح، نظهر رسالة ونفضي الـ Inputs
      toast.success("Password updated successfully");
      setPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => {
      // في حالة وجود خطأ، نظهر رسالة تنبيه
      toast.error(e.message);
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Update your account password securely.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updatePassword.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={updatePassword.isPending}>
            {updatePassword.isPending ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
