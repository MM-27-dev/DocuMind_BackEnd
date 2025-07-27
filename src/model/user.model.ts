import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export interface IUser extends Document {
  email: string;
  password?: string;
  refreshToken?: string;
  googleTokens?: IGoogleTokens;
  isPasswordCorrect(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
}

export interface IGoogleTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

const TokenSchema: Schema<IGoogleTokens> = new Schema({
  access_token: { type: String, required: true },
  refresh_token: { type: String, required: true },
  scope: { type: String, required: true },
  token_type: { type: String, required: true },
  expiry_date: { type: Number, required: true },
});

const UserSchema: Schema<IUser> = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: false,
    },
    refreshToken: {
      type: String,
    },
    googleTokens: {
      type: TokenSchema,
      required: false,
    },
  },
  { timestamps: true }
);

//hash password
UserSchema.pre("save", async function (next) {
  const user = this as IUser;

  if (!user.isModified("password") || !user.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

//compare password
UserSchema.methods.isPasswordCorrect = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  if (!this.password || !candidatePassword) {
    return false;
  }

  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

//generate access token
UserSchema.methods.generateAccessToken = function (this: IUser): string {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error("JWT secret or expiry not configured in env");
  }

  const expiryTime = process.env.ACCESS_TOKEN_EXPIRY;
  console.log(expiryTime);

  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: "1d",
    }
  );
};

//generate refresh token
UserSchema.methods.generateRefreshToken = function (this: IUser): string {
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error("Refresh token secret or expiry not configured in env");
  }

  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET as string,
    {
      expiresIn: "7d",
    }
  );
};

//convert time to seconds
function convertTimeToSeconds(time: string): number {
  const timeUnits: { [unit: string]: number } = {
    s: 1, // seconds
    m: 60, // minutes
    h: 3600, // hours
    d: 86400, // days
  };

  const unit = time.slice(-1);
  const value = parseInt(time.slice(0, -1), 10);

  if (isNaN(value) || !timeUnits[unit]) {
    throw new Error(`Invalid time unit: ${unit}`);
  }

  return value * timeUnits[unit];
}

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
