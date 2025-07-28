import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple test endpoint that doesn't require auth
  app.get("/api/test", (req, res) => {
    res.json({ message: "Server is working", timestamp: new Date().toISOString() });
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  const httpServer = createServer(app);
  return httpServer;
}