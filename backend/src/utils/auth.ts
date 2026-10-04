import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  role: string;
  cabinetId?: string | null;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.bcryptSaltRounds);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwt.secret as jwt.Secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
};

// ─── Two-step login (TOTP) ───

export interface SessionPayload extends JwtPayload {
  /** User.tokenVersion when the token was issued: a newer version signs this session out. */
  tv?: number;
  /** "mfa": short-lived token between the password and the code; never accepted as a session. */
  purpose?: 'mfa';
}

/** Session token of a fully signed-in user. */
export const sessionToken = (user: { id: string; role: string; cabinetId: string | null; tokenVersion: number }) =>
  generateToken({ userId: user.id, role: user.role, cabinetId: user.cabinetId, tv: user.tokenVersion } as SessionPayload);

/** Token proving the password was right, valid 10 minutes, only for the second step. */
export const mfaToken = (user: { id: string; tokenVersion: number }) =>
  jwt.sign({ userId: user.id, purpose: 'mfa', tv: user.tokenVersion }, config.jwt.secret as jwt.Secret, { expiresIn: '10m' });

export const readMfaToken = (token: string) => {
  const payload = jwt.verify(token, config.jwt.secret) as SessionPayload;
  if (payload.purpose !== 'mfa') throw new Error('Jeton invalide');
  return payload;
};

/** Doctors, owners and the Super Admin must use two-step login; demo accounts are exempt so demos keep working. */
export const mfaRequiredFor = (user: { role: string; cabinet?: { isDemo: boolean } | null }) =>
  process.env.MFA_REQUIRED !== 'false' && ['OWNER', 'PRACTITIONER', 'SUPER_ADMIN'].includes(user.role) && !user.cabinet?.isDemo;
