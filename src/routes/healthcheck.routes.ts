import { Router } from "express";
import { healthcheck } from "../controllers/healthcheck.controllers";

const router = Router();

router.get("/", healthcheck);

export { router as healthcheckRouter };
