import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1] || req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const verifyAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',') || ['3eatcru@gmail.com'];
  if (req.user && req.user.email && ADMIN_EMAILS.includes(req.user.email)) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access only' });
  }
};
