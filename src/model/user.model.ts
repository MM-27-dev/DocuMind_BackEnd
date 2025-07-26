import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// -------------------
// User Interface (Instance Methods)
// -------------------

export interface IUser extends Document {
  email: string;
  password: string;
  refreshToken?: string;
  isPasswordCorrect(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
}

// -------------------
// User Schema
// -------------------

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
      required: true,
    },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// -------------------
// Pre-save Hook: Hash Password
// -------------------

UserSchema.pre("save", async function (next) {
  const user = this as IUser;

  if (!user.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

// -------------------
// Instance Methods
// -------------------

UserSchema.methods.isPasswordCorrect = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

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

// Helper function to convert time to seconds
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

// -------------------
// Export User Model
// -------------------

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
