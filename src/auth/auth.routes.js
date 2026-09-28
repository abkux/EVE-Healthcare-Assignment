import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { limitAuth } from "../middleware/rateLimit.js";
import { currentUser, loginUser, signupUser } from "./auth.controller.js";

const router = Router();

router.post("/signup", limitAuth, signupUser);
router.post("/login", limitAuth, loginUser);
router.get("/me", requireAuth, currentUser);

export default router;
