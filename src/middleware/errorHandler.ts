import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, errorResponse } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.issues,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
    return;
  }

  const { status, body } = errorResponse(err);
  res.status(status).json(body);
};
