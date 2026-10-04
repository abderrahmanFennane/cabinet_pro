import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { readableIssue } from '../utils/readable-issue';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError('Route non trouvée', 404));
};

export const errorHandler = (
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Erreur interne du serveur';
  let errors: Record<string, string> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.length ? readableIssue(err.issues[0], _req.body, 'donnée') : 'Données invalides';
    errors = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.');
      errors[key] = issue.message;
    }
  } else if ((err as any).code === 'P2002') {
    statusCode = 409;
    const target = (err as any).meta?.target;
    message = target
      ? `Conflit : ${Array.isArray(target) ? target.join(', ') : target} existe déjà`
      : 'Conflit de données';
  } else if ((err as any).code === 'P2025') {
    statusCode = 404;
    message = 'Enregistrement non trouvé';
  }

  console.error(JSON.stringify({
    time: new Date().toISOString(),
    level: 'error',
    status: statusCode,
    message,
    name: err.name,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  }));

  res.status(statusCode).json({
    error: message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' &&
      !(err instanceof AppError) && { stack: err.stack }),
  });
};
