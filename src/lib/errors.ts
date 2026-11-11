export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: {
        error: {
          message: err.message,
          code: err.code ?? "APP_ERROR",
        },
      },
    };
  }

  console.error(err);
  return {
    status: 500,
    body: {
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    },
  };
}
