import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { addTest, create, list, listCentreTests, show } from "./centres.controller.js";

const router = Router();

router.get("/", list);
router.post("/", requireAuth, requireAdmin, create);
router.get("/:id/tests", listCentreTests);
router.post("/:id/tests", requireAuth, requireAdmin, addTest);
router.get("/:id", show);

export default router;
