import { Request, Response } from "express";
import { ApiResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";

const healthcheck = async (req: Request, res: Response) => {
  return res.status(200).json(new ApiResponse(200, "Ok", "Healthcheck passed"));
}

export { healthcheck };
