import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UserProfileModal() {
  const { user, fullName } = useAuth();
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // States
  const [name, setName] = useState(fullName);
  const [email, setEmail] = useState(user?.email || "");
  const [otp, setOtp] = useState("");
  const [isAwaitingOtp, setIsAwaitingOtp] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Reset states when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(fullName);
      setEmail(user?.email || "");
      setIsAwaitingOtp(false);
      setOtp("");
      setPassword("");
      setConfirmPassword("");
    }
  }, [isOpen, fullName, user?.email]);

  // 1. Mutation: Update Name
  const updateName = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user found");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Name updated successfully");
      qc.invalidateQueries();
      window.location.reload(); // لتحديث الاسم في الـ Sidebar فوراً
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 2. Mutation: Request Email Change (Sends OTP)
  const requestEmailChange = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OTP sent to your new email. Please check your inbox (valid for 10 mins).");
      setIsAwaitingOtp(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 3. Mutation: Verify Email OTP
  const verifyEmailOtp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email_change",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email updated successfully");
      setIsAwaitingOtp(false);
      setIsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 4. Mutation: Update Password
  const updatePassword = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) throw new Error("Passwords do not match");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated successfully");
      setPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/75">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Tab 1: Full Name */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              onClick={() => updateName.mutate()}
              disabled={updateName.isPending || name === fullName}
              className="w-full"
            >
              {updateName.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </TabsContent>

          {/* Tab 2: Email & OTP */}
          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isAwaitingOtp}
              />
            </div>

            {!isAwaitingOtp ? (
              <Button
                onClick={() => requestEmailChange.mutate()}
                disabled={requestEmailChange.isPending || email === user?.email}
                className="w-full"
              >
                {requestEmailChange.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Email
              </Button>
            ) : (
              <div className="space-y-4 p-4 border rounded-md bg-secondary/50">
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter 6-digit OTP</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Code is valid for 10 minutes.</p>
                </div>
                <Button
                  onClick={() => verifyEmailOtp.mutate()}
                  disabled={verifyEmailOtp.isPending || otp.length < 6}
                  className="w-full"
                >
                  {verifyEmailOtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Update
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setIsAwaitingOtp(false)}
                  className="w-full text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Password */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={() => updatePassword.mutate()}
              disabled={updatePassword.isPending || !password}
              className="w-full"
            >
              {updatePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
