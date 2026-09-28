import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { handleWebhook, pay } from "./payments.controller.js";

const router = Router();

router.post("/webhook", handleWebhook);
router.post("/", requireAuth, pay);

export default router;
