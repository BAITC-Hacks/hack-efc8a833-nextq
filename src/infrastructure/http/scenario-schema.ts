import { z } from "zod";
import { directions } from "../../domain/model";

const identifier = z.string().min(1).max(100);

export const scenarioSchema = z.strictObject({
  datasetVersion: identifier,
  rulesVersion: identifier,
  decisions: z.array(z.strictObject({
    direction: z.enum(directions),
    initiativeId: identifier,
    districtId: identifier,
  })).length(directions.length),
});
