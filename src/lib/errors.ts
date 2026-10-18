export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  success: false;
  error: { code: ErrorCode; message: string };
}

export interface SuccessBody<T> {
  success: true;
  data: T;
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Standard error envelope for every non-2xx API response (see ARCH doc, API Design). */
export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { success: false, error: { code, message } };
}

export function errorResponse(code: ErrorCode, message: string, status: number): Response {
  return Response.json(errorBody(code, message), { status });
}

export function okResponse<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies SuccessBody<T>, { status });
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) return errorResponse(err.code, err.message, err.status);
  return errorResponse("INTERNAL_ERROR", "Something went wrong.", 500);
}
