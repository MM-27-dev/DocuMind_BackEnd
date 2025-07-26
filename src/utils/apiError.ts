class ApiError extends Error {
  public statusCode: number;
  public data: null;
  public success: false;
  public errors: string[] | object[];
  public override message: string;

  constructor(
    statusCode: number,
    message = "Something went wrong",
    errors: string[] | object[] = [],
    stack = ""
  ) {
    super(message);

    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.message = message;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
