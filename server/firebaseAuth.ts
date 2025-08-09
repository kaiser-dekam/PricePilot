import type { Express, RequestHandler } from "express";

// Firebase token verification middleware
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - Invalid token format" });
    }

    console.log('Attempting to decode Firebase token...', { tokenLength: token.length });

    try {
      // Basic JWT payload extraction (without signature verification for now)
      // Note: In production, you should verify the signature with Firebase Admin SDK
      const [header, payload, signature] = token.split('.');
      
      if (!header || !payload || !signature) {
        return res.status(401).json({ message: "Unauthorized - Malformed token" });
      }

      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      console.log('Decoded payload:', { 
        sub: decodedPayload.sub, 
        email: decodedPayload.email 
      });

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp && decodedPayload.exp < now) {
        return res.status(401).json({ message: "Unauthorized - Token expired" });
      }

      // Attach user info to request
      req.user = {
        uid: decodedPayload.sub,
        email: decodedPayload.email,
      };

      next();
    } catch (tokenError) {
      console.error('Token decoding error:', tokenError);
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};