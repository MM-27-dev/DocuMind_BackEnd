import { Request, Response } from "express";
import { User } from "../model/user.model";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";

type RefreshTokenPayload = {
  _id: string;
};

// Generate access and refresh tokens
const generateAccessAndRefreshToken = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// Register User
export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const newUser = await User.create({ email, password });

  const RegisteredUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  return res
    .status(201)
    .json(new ApiResponse(200, RegisteredUser, "User registered successfully"));
};

// Login User
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Check if user has a password (not a Google OAuth user)
  if (!user.password) {
    throw new ApiError(
      401,
      "This account was created with Google. Please use Google login."
    );
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    (user._id as string).toString()
  );

  const loginUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
  };

  res
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .status(200)
    .json(new ApiResponse(200, loginUser, "Login successful"));
};

// Logout User
export const logoutUser = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: "" } });

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
  };

  res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .status(200)
    .json(new ApiResponse(200, {}, "Logout successful"));
};

// Get Current User
export const getCurrentUser = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Unauthorized");

  const user = await User.findById(req.user._id).select("email");

  res.status(200).json(new ApiResponse(200, user));
};

//Refresh access token
export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    console.log("Refresh token:", incomingRefreshToken);

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Refresh token not found");
    }

    try {
      const decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET as string
      ) as RefreshTokenPayload;

      const user = await User.findById(decoded._id);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      if (user.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Refresh token does not match");
      }

      const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        (user._id as string).toString()
      );

      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: "none" as const,
      };

      res
        .status(200)
        .cookie("accessToken", accessToken, {
          ...cookieOptions,
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        })
        .cookie("refreshToken", refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .json(
          new ApiResponse(200, null, "Access token refreshed successfully")
        );
    } catch (error: any) {
      console.error("Refresh token error:", error.message);
      throw new ApiError(401, "Invalid or expired refresh token");
    }
  }

