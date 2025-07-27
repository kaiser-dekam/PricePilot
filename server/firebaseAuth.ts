import type { RequestHandler } from "express";

// Simple middleware that extracts user info from Firebase token
// In production, you'd want to verify Firebase tokens server-side
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // For now, we'll rely on client-side authentication
  // and expect the client to send user info in headers
  const userId = req.headers['x-user-id'];
  const userEmail = req.headers['x-user-email'];
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Attach user info to request
  req.user = {
    uid: userId,
    email: userEmail,
  };

  next();
};