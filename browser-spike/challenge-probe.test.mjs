import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {runChallengeProbe} from "./challenge-probe.mjs";

const scene = async name => JSON.parse(await readFile(new URL(`./examples/scene-${name}.json`, import.meta.url)));

test("diagnostic exercises both moves, undo and reset without losing coverage", async () => {
  const commands = [];
  const unsupported = ["one_uncovered_domain"];
  const client = {
    async request(op, payload, revision) {
      commands.push({op, payload, revision});
      return {result: {
        challenge: {status: "goal_met", remaining_triggered: 1, remaining_needs_review: 2},
        assessment: {coverage: [{state: "missing_input"}], unsupported_domains: unsupported},
      }, evaluation_ms: 4};
    },
  };
  const states = await runChallengeProbe(client, scene);
  assert.deepEqual(commands.map(command => command.op), [
    "challenge_start", "challenge_move", "challenge_move", "challenge_undo", "challenge_reset",
  ]);
  assert.deepEqual(states.map(state => state.name), ["before", "conflict", "improved", "undo", "reset"]);
  assert.deepEqual(commands[0].payload.movable_ids, ["chair"]);
  assert.deepEqual(Object.keys(commands[1].payload.transform).sort(), ["position", "yaw_rad"]);
  assert.match(states[2].summary, /已完成.*1项已触发、2项待核查/);
  assert.deepEqual(states[2].unsupported_domains, unsupported);
  assert.deepEqual(states[2].coverage, [{state: "missing_input"}]);
});

test("restarting a diagnostic stops it before issuing more challenge commands", async () => {
  let current = true;
  const commands = [];
  const client = {
    async request(op) {
      commands.push(op);
      current = false;
      return {result: {}};
    },
  };
  assert.equal(await runChallengeProbe(client, scene, () => current), null);
  assert.deepEqual(commands, ["challenge_start"]);
});
