import { z } from "zod";
import { directions } from "../../domain/model";

const identifier = z.string().min(1).max(100);

const decisions = z.array(z.strictObject({
  direction: z.enum(directions),
  initiativeId: identifier,
  districtId: identifier,
})).length(directions.length);

export const challengeSchema = z.strictObject({
  datasetVersion: identifier,
  rulesVersion: identifier,
  eventPackVersion: identifier,
  eventId: identifier,
  initialDecisions: decisions,
  responseDecisions: decisions,
});
