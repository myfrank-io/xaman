import { z } from "zod";

import { uuid } from "@/lib/schemas/common";

export const exportBoatSchema = z.object({ boatId: uuid });
