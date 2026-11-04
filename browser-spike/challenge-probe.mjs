import {formatChallengeSummary} from "./challenge-summary.mjs";

export async function runChallengeProbe(client, readScene, isCurrent = () => true) {
  const states = [];
  const goals = [
    {rule_id:"R001", profile_id:"child", object_id:"chair"},
    {rule_id:"R005", profile_id:"elder", object_id:"chair"},
  ];

  async function step(name, op, payload, revision) {
    if (!isCurrent()) return false;
    const {result, evaluation_ms} = await client.request(op, payload, revision);
    if (!isCurrent()) return false;
    states.push({
      name, ...result.challenge,
      summary:formatChallengeSummary(result.challenge),
      coverage:result.assessment?.coverage,
      unsupported_domains:result.assessment?.unsupported_domains,
      input_hash:result.assessment?.input_hash,
      evaluation_ms,
    });
    return true;
  }

  const before = await readScene("before");
  if (!await step("before", "challenge_start", {scene:before, movable_ids:["chair"], goals}, before.revision)) return null;
  let revision = before.revision;
  for (const name of ["conflict", "improved"]) {
    const scene = await readScene(name);
    const {position, yaw_rad} = scene.objects.find(object => object.id === "chair");
    if (!await step(name, "challenge_move", {object_id:"chair", transform:{position, yaw_rad}}, ++revision)) return null;
  }
  if (!await step("undo", "challenge_undo", {}, ++revision)) return null;
  if (!await step("reset", "challenge_reset", {}, ++revision)) return null;
  return states;
}
