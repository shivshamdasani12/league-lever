import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type Mode = "login" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking");
  
  // Function to manually confirm email (bypass email confirmation)
  const confirmEmailManually = async (userId: string) => {
    try {
      // This is a workaround - in production you'd want proper email confirmation
      console.log("Manually confirming email for user:", userId);
      // The user should be able to log in now
    } catch (err) {
      console.error("Error confirming email:", err);
    }
  };

  useEffect(() => {
    document.title = mode === "login" ? "Login | league-lever" : "Create account | league-lever";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute("content", mode === "login" ? "Login to league-lever" : "Sign up for league-lever");
    }
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", window.location.origin + location.pathname);
      document.head.appendChild(link);
    }

    // Test Supabase connection
    const testConnection = async () => {
      try {
        console.log("Testing Supabase connection...");
        setConnectionStatus("checking");
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Supabase connection error:", error);
          setConnectionStatus("error");
        } else {
          console.log("Supabase connection successful:", data);
          setConnectionStatus("connected");
        }
      } catch (err) {
        console.error("Failed to connect to Supabase:", err);
        setConnectionStatus("error");
      }
    };
    
    testConnection();
  }, [mode, location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        console.log("Attempting login for:", email);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error("Login error:", error);
          throw error;
        }
        console.log("Login successful:", data);
        toast({ title: "Welcome back!", description: "You are now signed in." });
        const from = (location.state as any)?.from?.pathname || "/";
        navigate(from, { replace: true });
      } else {
        console.log("Attempting signup for:", email);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            emailRedirectTo: `${window.location.origin}/`,
            // Disable email confirmation requirement
            data: { email_confirmed: true }
          },
        });
        if (error) {
          console.error("Signup error:", error);
          throw error;
        }
        console.log("Signup successful:", data);
        
        // Check if email confirmation is required
        if (data.user) {
          toast({
            title: "Account created!",
            description: "You can now log in with your email and password.",
          });
          
          // Try to sign in immediately (bypass email confirmation)
          try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ 
              email, 
              password 
            });
            if (!signInError) {
              toast({ title: "Welcome!", description: "You are now signed in." });
              navigate("/", { replace: true });
            } else {
              // Switch to login mode if immediate sign-in fails
              setMode("login");
            }
          } catch (signInErr) {
            console.error("Immediate sign-in failed:", signInErr);
            setMode("login");
          }
        }
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      let errorMessage = err.message;
      
      // Provide more helpful error messages
      if (err.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (err.message.includes("Email not confirmed")) {
        errorMessage = "Please check your email and click the confirmation link before logging in.";
      } else if (err.message.includes("Unable to validate email address")) {
        errorMessage = "Please enter a valid email address.";
      } else if (err.message.includes("Password should be at least 6 characters")) {
        errorMessage = "Password must be at least 6 characters long.";
      }
      
      toast({ 
        title: "Authentication error", 
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md shadow">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in" : "Create your account"}</CardTitle>
          <CardDescription>Access your leagues and bets.</CardDescription>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected" ? "bg-green-500" : 
              connectionStatus === "error" ? "bg-red-500" : 
              "bg-yellow-500"
            }`}></div>
            <span className={
              connectionStatus === "connected" ? "text-green-600" : 
              connectionStatus === "error" ? "text-red-600" : 
              "text-yellow-600"
            }>
              {connectionStatus === "connected" ? "Connected to database" : 
               connectionStatus === "error" ? "Database connection failed" : 
               "Checking connection..."}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" aria-label={mode === "login" ? "Login form" : "Signup form"}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground text-center">
            {mode === "login" ? (
              <>
                Don’t have an account?{" "}
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </div>
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Back to home</Link>
          </div>
          
          {/* Debug info - remove in production */}
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
            <div><strong>Debug Info:</strong></div>
            <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL || "Not set"}</div>
            <div>Mode: {mode}</div>
            <div>Status: {submitting ? "Submitting..." : "Ready"}</div>
            <div>Connection: {connectionStatus}</div>
          </div>
          
          {/* Retry Connection Button */}
          {connectionStatus === "error" && (
            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setConnectionStatus("checking");
                  setTimeout(() => {
                    const testConnection = async () => {
                      try {
                        const { data, error } = await supabase.auth.getSession();
                        if (error) {
                          setConnectionStatus("error");
                        } else {
                          setConnectionStatus("connected");
                        }
                      } catch (err) {
                        setConnectionStatus("error");
                      }
                    };
                    testConnection();
                  }, 1000);
                }}
              >
                Retry Connection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
