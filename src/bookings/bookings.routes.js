import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { cancel, create, list, show } from "./bookings.controller.js";

const router = Router();

router.use(requireAuth);
router.post("/", create);
router.get("/", list);
router.get("/:id", show);
router.post("/:id/cancel", cancel);

export default router;
